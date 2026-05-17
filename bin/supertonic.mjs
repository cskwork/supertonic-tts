#!/usr/bin/env node
// Cross-platform CLI entry. `npm install -g` will produce:
//   - Unix:    a symlink in $PATH -> this file (shebang + exec bit)
//   - Windows: <supertonic-tts>.cmd / .ps1 shims that invoke `node` on this file
// The behaviour is identical from the user's perspective: `supertonic-tts ...`.

import { parseArgs } from 'node:util';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = path.resolve(SCRIPT_DIR, '..');

const HELP = `supertts — local Supertonic 3 text-to-speech CLI
(also available as 'supertonic-tts')

Usage
  supertts "hello world"                 # simplest form
  supertts "안녕하세요"                  # auto-detects Korean
  supertts -t "hi" -o hi.wav --voice F2
  supertts -f input.txt --lang ja
  echo "piped" | supertts -o pipe.wav
  supertts --download                    # pre-fetch model assets
  supertts --list-voices
  supertts --list-langs

Input (any one of)
  positional                 free-form text  (supertts "hello")
  -t, --text <string>        inline text
  -f, --file <path>          read a .txt file
  (stdin)                    pipe text in

Output
  -o, --out <path>           output .wav  (default: ./out-<timestamp>.wav)

Synthesis
  -l, --lang <code>          language tag        (default: auto)
  -v, --voice <id>           F1 F2 F3 M1 M2 M3   (default: F1)
  -s, --speed <num>          0.7 – 1.8           (default: 1.05)
      --steps <n>            quality 4 – 16      (default: 8)
      --silence <sec>        pause between chunks (default: 0.3)

Misc
      --assets <dir>         override assets directory
                             (env: SUPERTONIC_ASSETS)
      --download             only download / verify assets, then exit
      --no-play              don't auto-play the generated audio
  -q, --quiet                suppress progress output
  -h, --help                 show this help

Default assets location (auto-downloaded on first synth):
  Windows : %LOCALAPPDATA%\\supertonic-tts\\assets
  macOS   : ~/Library/Caches/supertonic-tts/assets
  Linux   : $XDG_CACHE_HOME/supertonic-tts/assets  (or ~/.cache/...)

Run \`supertonic-tts --list-langs\` for every supported language tag.
`;

let parsed;
try {
  parsed = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      text:    { type: 'string',  short: 't' },
      file:    { type: 'string',  short: 'f' },
      out:     { type: 'string',  short: 'o' },
      lang:    { type: 'string',  short: 'l' },
      voice:   { type: 'string',  short: 'v' },
      speed:   { type: 'string',  short: 's' },
      steps:   { type: 'string'              },
      silence: { type: 'string'              },
      assets:  { type: 'string'              },
      download:      { type: 'boolean' },
      'list-voices': { type: 'boolean' },
      'list-langs':  { type: 'boolean' },
      'no-play':     { type: 'boolean' },
      quiet:   { type: 'boolean', short: 'q' },
      help:    { type: 'boolean', short: 'h' }
    }
  });
} catch (err) {
  process.stderr.write(`error: ${err.message}\nRun supertonic-tts --help\n`);
  process.exit(2);
}

const { values, positionals } = parsed;

if (values.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

// Top-level await is fine in ESM.
const { resolveAssetsDir, ensureAssets, VOICE_CATALOG } = await import('../cli/assets.mjs');

if (values['list-voices']) {
  for (const v of VOICE_CATALOG) {
    process.stdout.write(`${v.id}\t${v.label}\t${v.gender}\n`);
  }
  process.exit(0);
}

if (values['list-langs']) {
  // Loaded lazily to avoid touching onnxruntime-node on a pure metadata call.
  const { listLanguages } = await import('../cli/synth.mjs');
  process.stdout.write(listLanguages().join(' ') + '\n');
  process.exit(0);
}

const assetsDir = resolveAssetsDir({
  override: values.assets,
  packageDir: PACKAGE_DIR
});

if (values.download) {
  await ensureAssets(assetsDir, { quiet: !!values.quiet });
  process.stderr.write(`[done] assets ready at ${assetsDir}\n`);
  process.exit(0);
}

// Collect text from one of: -t / positional / -f / stdin.
async function readStdin() {
  let data = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

async function getText() {
  if (values.text) return values.text;
  if (positionals.length > 0) return positionals.join(' ');
  if (values.file) {
    const p = path.resolve(values.file);
    if (!existsSync(p)) throw new Error(`file not found: ${p}`);
    return await readFile(p, 'utf8');
  }
  if (!process.stdin.isTTY) return await readStdin();
  return '';
}

// Light language sniffing: only used when --lang is omitted. Returns a code
// supported by the underlying Supertonic text processor.
function detectLang(text) {
  if (/[가-힯]/.test(text)) return 'ko';
  if (/[぀-ヿ]/.test(text)) return 'ja';
  return 'en';
}

// Spawn a command and resolve true on clean exit, false on error / non-zero.
function trySpawn(cmd, args) {
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(cmd, args, { stdio: 'ignore' });
    child.on('error', () => { if (!settled) { settled = true; resolve(false); } });
    child.on('exit', (code) => { if (!settled) { settled = true; resolve(code === 0); } });
  });
}

// Play a WAV file synchronously using a platform-native command.
// Best-effort: silently no-ops if no player is available.
async function playWav(filePath) {
  if (process.platform === 'darwin') {
    return await trySpawn('afplay', [filePath]);
  }
  if (process.platform === 'win32') {
    const ps = `$p = New-Object Media.SoundPlayer '${filePath.replace(/'/g, "''")}'; $p.PlaySync();`;
    return await trySpawn('powershell.exe', ['-NoProfile', '-Command', ps]);
  }
  // linux / *bsd — try common players in priority order
  const candidates = [
    ['paplay', [filePath]],
    ['aplay',  ['-q', filePath]],
    ['play',   ['-q', filePath]],
    ['ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath]]
  ];
  for (const [cmd, args] of candidates) {
    if (await trySpawn(cmd, args)) return true;
  }
  return false;
}

function timestampedName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `out-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.wav`;
}

function clampFloat(raw, min, max, fb) {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return fb;
  return Math.max(min, Math.min(max, n));
}
function clampInt(raw, min, max, fb) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fb;
  return Math.max(min, Math.min(max, n));
}

const text = (await getText()).trim();
if (!text) {
  process.stderr.write('error: no input text. Use -t, -f, or pipe text via stdin.\n');
  process.exit(1);
}

const lang    = values.lang  || detectLang(text);
const voice   = values.voice || 'F1';
const speed   = clampFloat(values.speed,   0.7,  1.8,  1.05);
const steps   = clampInt  (values.steps,    4,   16,    8);
const silence = clampFloat(values.silence, 0.0,  2.0,  0.3);

const outPath = values.out
  ? path.resolve(values.out)
  : path.resolve(process.cwd(), timestampedName());

await mkdir(path.dirname(outPath), { recursive: true });

const quiet = !!values.quiet;
const stderrLine = (msg) => { if (!quiet) process.stderr.write(`${msg}\n`); };

await ensureAssets(assetsDir, { quiet });

const { synthesize } = await import('../cli/synth.mjs');

stderrLine(`[run] lang=${lang} voice=${voice} steps=${steps} speed=${speed}`);
const startedAt = Date.now();

try {
  let lastStep = 0;
  await synthesize({
    text,
    lang,
    voice,
    speed,
    steps,
    silence,
    assetsDir,
    outPath,
    onLoad: (name, i, total) => stderrLine(`[load] ${name} (${i}/${total})`),
    onStep: (step, total) => {
      if (quiet) return;
      // Carriage-return progress; finalize on last step.
      process.stderr.write(`\r[infer] step ${step}/${total}`);
      if (step === total) process.stderr.write('\n');
      lastStep = step;
    }
  });
} catch (err) {
  process.stderr.write(`\nerror: ${err.message}\n`);
  process.exit(1);
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
stderrLine(`[done] wrote ${outPath} (${elapsed}s)`);

// Auto-play the result unless explicitly suppressed with --no-play.
// Best-effort: missing players don't fail the command. Playback is blocking
// (PlaySync / afplay / aplay) so the WAV finishes before the command returns.
if (!values['no-play']) {
  stderrLine(`[play] ${outPath}`);
  await playWav(outPath);
}

// Final line on stdout so it's easy to pipe / consume.
process.stdout.write(`${outPath}\n`);

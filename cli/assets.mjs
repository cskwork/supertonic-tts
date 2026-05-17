// Asset path resolution + on-demand download for the CLI.
// Mirrors the file list used by scripts/download-assets.mjs but targets a
// user-writable cache directory so the CLI works from any cwd after
// `npm install -g`.

import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';

const HF_REPO = 'Supertone/supertonic-3';
const HF_BRANCH = 'main';
const BASE_URL = `https://huggingface.co/${HF_REPO}/resolve/${HF_BRANCH}`;

export const VOICE_IDS = ['F1', 'F2', 'F3', 'M1', 'M2', 'M3'];

export const VOICE_CATALOG = [
  { id: 'F1', label: 'Mina',  gender: 'female' },
  { id: 'F2', label: 'Sora',  gender: 'female' },
  { id: 'F3', label: 'Yuna',  gender: 'female' },
  { id: 'M1', label: 'Aiden', gender: 'male'   },
  { id: 'M2', label: 'Hiro',  gender: 'male'   },
  { id: 'M3', label: 'Leo',   gender: 'male'   }
];

export const ASSET_FILES = [
  'onnx/tts.json',
  'onnx/unicode_indexer.json',
  'onnx/duration_predictor.onnx',
  'onnx/text_encoder.onnx',
  'onnx/vector_estimator.onnx',
  'onnx/vocoder.onnx',
  ...VOICE_IDS.map((id) => `voice_styles/${id}.json`)
];

// Platform-specific default cache directory. Honors XDG on Linux.
function defaultCacheDir() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'supertonic-tts', 'assets');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Caches', 'supertonic-tts', 'assets');
  }
  const xdg = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(xdg, 'supertonic-tts', 'assets');
}

// Pick which assets dir to use. Order of preference:
//   1. explicit --assets <dir>
//   2. $SUPERTONIC_ASSETS env var
//   3. ./assets in cwd if it already has model files (repo dev)
//   4. <packageDir>/assets if it already has model files (repo dev via local link)
//   5. platform user cache dir (auto-download target)
export function resolveAssetsDir({ override, packageDir } = {}) {
  if (override) return path.resolve(override);
  if (process.env.SUPERTONIC_ASSETS) return path.resolve(process.env.SUPERTONIC_ASSETS);

  const cwdAssets = path.resolve(process.cwd(), 'assets');
  if (existsSync(path.join(cwdAssets, 'onnx', 'tts.json'))) return cwdAssets;

  if (packageDir) {
    const pkgAssets = path.resolve(packageDir, 'assets');
    if (existsSync(path.join(pkgAssets, 'onnx', 'tts.json'))) return pkgAssets;
  }

  return defaultCacheDir();
}

export function listMissing(assetsDir) {
  return ASSET_FILES.filter((rel) => {
    const p = path.join(assetsDir, rel);
    return !existsSync(p) || statSync(p).size === 0;
  });
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function downloadOne(rel, assetsDir, { onProgress, onLine }) {
  const url = `${BASE_URL}/${rel}`;
  const dest = path.join(assetsDir, rel);
  mkdirSync(path.dirname(dest), { recursive: true });

  const tmp = `${dest}.part`;
  if (existsSync(tmp)) unlinkSync(tmp);

  onLine(`downloading ${rel}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const total = Number(res.headers.get('content-length') || 0);
  let received = 0;
  let lastPrint = 0;

  const reportingStream = new Readable({ read() {} });
  const reader = res.body.getReader();

  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          reportingStream.push(null);
          break;
        }
        received += value.byteLength;
        reportingStream.push(Buffer.from(value));
        const now = Date.now();
        if (total && now - lastPrint > 500) {
          const pct = ((received / total) * 100).toFixed(1);
          onProgress(`  ${rel}: ${fmtBytes(received)} / ${fmtBytes(total)} (${pct}%)`);
          lastPrint = now;
        }
      }
    } catch (err) {
      reportingStream.destroy(err);
    }
  })();

  await pipeline(reportingStream, createWriteStream(tmp));
  await rename(tmp, dest);
  onLine(`done       ${rel} (${fmtBytes(statSync(dest).size)})`);
}

// Ensures every required asset exists under assetsDir. Downloads anything
// missing from the Hugging Face CDN. Idempotent; safe to call on every run.
export async function ensureAssets(assetsDir, { quiet = false } = {}) {
  mkdirSync(assetsDir, { recursive: true });
  const missing = listMissing(assetsDir);
  if (missing.length === 0) return { downloaded: 0, assetsDir };

  const log = (msg) => { if (!quiet) process.stderr.write(`[assets] ${msg}\n`); };
  const inline = (msg) => { if (!quiet) process.stderr.write(`\r[assets] ${msg}`); };

  log(`assets dir: ${assetsDir}`);
  log(`missing ${missing.length} file(s) — downloading from Hugging Face`);

  for (const rel of missing) {
    await downloadOne(rel, assetsDir, {
      onProgress: inline,
      onLine: (m) => {
        if (!quiet) process.stderr.write(`\r[assets] ${m}\n`);
      }
    });
  }
  return { downloaded: missing.length, assetsDir };
}

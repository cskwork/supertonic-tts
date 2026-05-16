#!/usr/bin/env node
/**
 * Download Supertonic 3 ONNX model assets directly from Hugging Face via HTTPS.
 * No git-lfs required.
 *
 * Files are placed under <repo>/assets/. Skips automatically if the required
 * files are already present.
 */

import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'assets');

const HF_REPO = 'Supertone/supertonic-3';
const HF_BRANCH = 'main';
const BASE_URL = `https://huggingface.co/${HF_REPO}/resolve/${HF_BRANCH}`;

// Six voice presets matching the UI catalog.
const VOICE_IDS = ['M1', 'M2', 'M3', 'F1', 'F2', 'F3'];

const FILES = [
  // small JSON configs
  { rel: 'onnx/tts.json' },
  { rel: 'onnx/unicode_indexer.json' },
  // ONNX models (~tens-of-MB each)
  { rel: 'onnx/duration_predictor.onnx' },
  { rel: 'onnx/text_encoder.onnx' },
  { rel: 'onnx/vector_estimator.onnx' },
  { rel: 'onnx/vocoder.onnx' },
  // Voice style tensors
  ...VOICE_IDS.map((id) => ({ rel: `voice_styles/${id}.json` }))
];

function log(msg) {
  process.stdout.write(`[assets] ${msg}\n`);
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function downloadOne(rel) {
  const url = `${BASE_URL}/${rel}`;
  const dest = path.join(assetsDir, rel);
  ensureDir(path.dirname(dest));

  // Skip if file exists and is non-empty.
  if (existsSync(dest)) {
    const st = statSync(dest);
    if (st.size > 0) {
      log(`✓ ${rel} (${fmtBytes(st.size)}, cached)`);
      return;
    }
  }

  const tmp = `${dest}.part`;
  if (existsSync(tmp)) unlinkSync(tmp);

  log(`↓ ${rel} …`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  const total = Number(res.headers.get('content-length') || 0);
  let received = 0;
  let lastPrint = 0;

  const reportingStream = new Readable({
    read() {}
  });

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
        if (total && now - lastPrint > 800) {
          const pct = ((received / total) * 100).toFixed(1);
          process.stdout.write(
            `\r[assets]   ${rel}: ${fmtBytes(received)} / ${fmtBytes(total)} (${pct}%)`
          );
          lastPrint = now;
        }
      }
    } catch (err) {
      reportingStream.destroy(err);
    }
  })();

  await pipeline(reportingStream, createWriteStream(tmp));
  if (total) process.stdout.write('\n');

  // Atomic rename
  const fs = await import('node:fs/promises');
  await fs.rename(tmp, dest);

  const finalSize = statSync(dest).size;
  log(`✓ ${rel} (${fmtBytes(finalSize)})`);
}

async function main() {
  // Skip downloads in CI / hosted build environments — production builds
  // fetch the models directly from Hugging Face at runtime.
  if (process.env.CI || process.env.SKIP_ASSET_DOWNLOAD || process.env.VERCEL) {
    log('CI environment detected — skipping local asset download.');
    log('(Production builds load models from Hugging Face CDN at runtime.)');
    return;
  }

  ensureDir(assetsDir);
  log(`Assets directory: ${assetsDir}`);
  log(`Source: https://huggingface.co/${HF_REPO}`);

  const missing = FILES.filter((f) => {
    const p = path.join(assetsDir, f.rel);
    return !existsSync(p) || statSync(p).size === 0;
  });

  if (missing.length === 0) {
    log('All required files present — skipping download.');
    return;
  }

  log(`Downloading ${missing.length} file(s)…`);

  // Download serially to avoid hammering the CDN and to keep progress readable.
  for (const f of missing) {
    try {
      await downloadOne(f.rel);
    } catch (err) {
      log(`✗ ${f.rel}: ${err.message}`);
      log('You can retry later with: npm run assets');
      process.exitCode = 1;
      return;
    }
  }

  log('Done. Model assets ready.');
}

main().catch((err) => {
  console.error('[assets] Unexpected error:', err);
  process.exitCode = 1;
});

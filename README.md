# Supertonic TTS — Minimal Web App

A clean, beginner-friendly text-to-speech web app built on
[Supertonic 3](https://github.com/supertone-inc/supertonic). Three languages
(English, Korean, Japanese), six preset voices with one-tap preview, paste-or-upload
input (`.txt` / `.docx`), and instant download — all running entirely in your
browser via WebGPU/WebAssembly. No accounts, no API keys, no cloud round-trips.

## Features

- **3 languages**: English, Korean, Japanese
- **6 voices** with click-to-preview
- **Paste or upload**: drop in `.txt` or `.docx`
- **Sample text presets** per language
- **One-tap "Speak"** with autoplay + transcript view
- **WAV download** of any generated audio
- **WebGPU acceleration** with automatic WASM fallback
- **Fully local**: text never leaves the browser

## Quick start

Requires Node.js 18+ only. Model assets (~150 MB) are streamed directly from
Hugging Face — no `git-lfs` needed.

```bash
# Install + auto-download the model assets
npm install

# Start the dev server (opens http://localhost:3000)
npm run dev
```

If the asset download was interrupted, just re-run it; existing files are
skipped automatically:

```bash
npm run assets
```

## Production build

```bash
npm run build     # outputs to ./dist
npm start         # serves ./dist on http://localhost:3000
```

In production builds, the app **fetches model weights directly from the
Hugging Face CDN at runtime** (`huggingface.co/Supertone/supertonic-3`),
so deployments don't have to ship the 380 MB of `.onnx` files. The CDN sets
proper CORS headers and long cache lifetimes.

## Deploying

### GitHub Pages (zero-config)

A workflow at `.github/workflows/deploy.yml` builds and publishes on every
push to `main`.

1. Push the repo to GitHub
2. In repo settings → Pages → Build and deployment → Source: **GitHub Actions**
3. Push to `main` (or trigger the workflow manually)
4. App is live at `https://<user>.github.io/<repo>/`

The workflow sets `VITE_BASE=/<repo>/` so all relative URLs resolve under
the subpath. No model files are uploaded to Pages.

### Vercel

```bash
vercel --prod
```

`vercel.json` is already configured with:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless` (enables faster
  multi-threaded WASM where supported)
- Long-cache headers for `/assets/*`
- `.vercelignore` excludes the local `assets/` directory from upload

### Self-hosting

`npm run build` emits a fully static `./dist` directory — serve it with any
static host (nginx, Caddy, Cloudflare Pages, S3 + CloudFront, etc.). If you
also want multi-threaded WASM acceleration, send these response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

## Project layout

```
.
├── app/                  # Vite project root (the web app)
│   ├── index.html
│   ├── main.js           # UI + synthesis orchestration
│   ├── helper.js         # Supertonic ONNX runtime helpers
│   └── style.css
├── assets/               # Model weights & voice styles (downloaded)
│   ├── onnx/*.onnx
│   ├── onnx/tts.json
│   ├── onnx/unicode_indexer.json
│   └── voice_styles/*.json
├── scripts/
│   └── download-assets.mjs
├── vite.config.js
└── package.json
```

## How it works

1. The browser loads four ONNX models (duration predictor, text encoder,
   vector estimator, vocoder) and a voice style tensor.
2. Your text is preprocessed (NFKD-normalised, emoji-stripped, wrapped with
   the language tag) and converted to token IDs.
3. A short diffusion loop denoises a latent audio representation.
4. The vocoder synthesises 44.1 kHz, 16-bit PCM. The WAV file is built
   client-side and offered for playback / download.

Every step runs locally — your text and the generated audio never leave
the device.

## Troubleshooting

- **"Loading model" stays forever**: open DevTools → Network. If the model
  files (`.onnx`) 404, run `npm run assets` again.
- **WebGPU disabled**: only modern Chrome / Edge / Safari Tech Preview
  support WebGPU. The app silently falls back to WebAssembly — slower but
  works everywhere.
- **DOCX upload fails**: complex DOCX files with embedded objects may not
  parse cleanly. Save as plain `.txt` as a fallback.
- **Korean / Japanese sound rushed**: drop "Speed" in Advanced options
  to ~0.95.

## License

App code: MIT. Supertonic model weights are subject to
[Supertone's license](https://huggingface.co/Supertone/supertonic-3).

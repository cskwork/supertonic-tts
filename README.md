# Supertonic TTS: web app and CLI

A text-to-speech project built on
[Supertonic 3](https://github.com/supertone-inc/supertonic). Two ways to use it:

- **Web app.** Three ready-made UI languages (English, Korean, Japanese), six
  preset voices with one-tap preview, paste-or-upload input (`.txt` / `.docx`),
  instant WAV download. Runs in your browser on WebGPU or WebAssembly.
- **CLI.** `supertonic-tts "hello"` from any terminal on macOS, Windows, or
  Linux. Install globally with `npm`. Native ONNX runtime, no GPU required.

No accounts, no API keys, no cloud round-trips.

## Features

- **3 UI languages**: English, Korean, Japanese
- **32 TTS language tags** available in the underlying Supertonic text processor
- **6 voice styles** with click-to-preview
- **Paste or upload**: drop in `.txt` or `.docx`
- **Sample text presets** per language
- **One-tap "Speak"** with autoplay + transcript view
- **WAV download** of any generated audio
- **WebGPU acceleration** with automatic WASM fallback
- **Fully local**: text never leaves the browser

## Supported TTS options

The app has two language layers:

- **Current UI choices**: English (`en`), Korean (`ko`), Japanese (`ja`).
  These are the languages with ready-made sample text, preview text, and UI
  tabs in `app/main.js`.
- **Underlying Supertonic language tags**: `en`, `ko`, `ja`, `ar`, `bg`, `cs`,
  `da`, `de`, `el`, `es`, `et`, `fi`, `fr`, `hi`, `hr`, `hu`, `id`, `it`,
  `lt`, `lv`, `nl`, `pl`, `pt`, `ro`, `ru`, `sk`, `sl`, `sv`, `tr`, `uk`,
  `vi`, `na`. These are accepted by the text processor in `app/helper.js`.

To expose another language in the UI, add an entry to `LANGS` in `app/main.js`
with preview and preset text, then add or render the matching language tab.

### Voice styles

You can pair any voice style with any supported TTS language tag.

| ID | Display name | Type | Style file |
| --- | --- | --- | --- |
| `F1` | Mina | Female | `voice_styles/F1.json` |
| `F2` | Sora | Female | `voice_styles/F2.json` |
| `F3` | Yuna | Female | `voice_styles/F3.json` |
| `M1` | Aiden | Male | `voice_styles/M1.json` |
| `M2` | Hiro | Male | `voice_styles/M2.json` |
| `M3` | Leo | Male | `voice_styles/M3.json` |

`F1` / Mina is the default voice. The app pulls voice styles from
`Supertone/supertonic-3` and loads them on demand, from `assets/voice_styles/`
in development or from the Hugging Face CDN in production.

### Model/runtime options

- **TTS model family**: Supertonic 3 from `Supertone/supertonic-3`.
- **ONNX model files**: `duration_predictor.onnx`, `text_encoder.onnx`,
  `vector_estimator.onnx`, `vocoder.onnx`.
- **Runtime**: WebGPU first, then WebAssembly fallback.
- **Generation controls**: quality steps from 4 to 16, and speed from 0.7 to
  1.8.
- **Output**: mono 44.1 kHz, 16-bit PCM WAV generated locally in the browser.

## CLI

A standalone Node CLI ships in this package. Install once and run from any
directory. Two equivalent commands are exposed: short (`supertts`) and full
(`supertonic-tts`).

```bash
# global install — Windows, macOS, Linux
npm install -g supertonic-tts

# simplest form — positional text, auto-detects KO/JA/EN
supertts "Hello from Supertonic!"
supertts "안녕하세요"
supertts "こんにちは" --voice M1

# explicit flags
supertts -t "Hi there" -o hi.wav --voice F2
supertts -f input.txt --lang ko -o out.wav
echo "piped text" | supertts -o piped.wav
```

On the first synth, model assets (~380 MB) are auto-downloaded from Hugging
Face into a platform-appropriate user cache:

| Platform | Default assets directory |
| --- | --- |
| Windows | `%LOCALAPPDATA%\supertonic-tts\assets` |
| macOS   | `~/Library/Caches/supertonic-tts/assets` |
| Linux   | `$XDG_CACHE_HOME/supertonic-tts/assets` (or `~/.cache/...`) |

Override with `--assets <dir>` or the `SUPERTONIC_ASSETS` env var. Pre-fetch
without synthesizing via `supertonic-tts --download`.

### CLI flags

| Flag | Default | Description |
| --- | --- | --- |
| `-t, --text <s>` | — | inline text |
| `-f, --file <p>` | — | read text from a `.txt` file |
| `-o, --out <p>`  | `./out-<timestamp>.wav` | output WAV path |
| `-l, --lang <c>` | auto | language tag (auto-detects ko/ja/en; see `--list-langs`) |
| `-v, --voice <id>` | `F1` | voice id: `F1`–`F3`, `M1`–`M3` |
| `-s, --speed <n>` | `1.05` | 0.7 – 1.8 |
| `--steps <n>` | `8` | quality steps 4 – 16 |
| `--silence <s>` | `0.3` | inter-chunk pause (sec) |
| `--assets <dir>` | auto | override assets directory |
| `--download` | — | only fetch / verify assets |
| `--no-play` | — | don't auto-play the generated WAV |
| `--list-voices` | — | print voice catalog |
| `--list-langs` | — | print supported language tags |
| `-q, --quiet` | — | suppress progress logs |
| `-h, --help` | — | show help |

By default the generated WAV plays back immediately
(macOS `afplay`, Windows `Media.SoundPlayer`, Linux `paplay`/`aplay`/`play`/
`ffplay`). Playback blocks, so the command returns only once the audio has
finished. Pass `--no-play` for batch or scripted usage.

The CLI prints the output path on `stdout` (one line, easy to pipe). All
progress / status messages go to `stderr`.

```bash
# capture the output path without playback
OUT=$(supertts "audio test" --quiet --no-play)
echo "wrote $OUT"
```

## Web app quick start

Requires Node.js 18+ only. Model assets (~380 MB) stream directly from
Hugging Face, so you do not need `git-lfs`.

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

In production builds, the app fetches model weights from the Hugging Face CDN at
runtime (`huggingface.co/Supertone/supertonic-3`), so a deployment does not have
to ship the 380 MB of `.onnx` files. The CDN sets the CORS headers and long
cache lifetimes this needs.

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

`npm run build` emits a fully static `./dist` directory. Serve it with any
static host: nginx, Caddy, Cloudflare Pages, S3 + CloudFront. If you also want
multi-threaded WASM acceleration, send these response headers:

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

Every step runs locally. Your text and the generated audio never leave
the device.

## Troubleshooting

- **"Loading model" stays forever**: open DevTools → Network. If the model
  files (`.onnx`) 404, run `npm run assets` again.
- **WebGPU disabled**: only recent Chrome, Edge, and Safari Tech Preview
  support WebGPU. The app falls back to WebAssembly without saying so. That is
  slower, but it works everywhere.
- **DOCX upload fails**: complex DOCX files with embedded objects may not
  parse cleanly. Save as plain `.txt` as a fallback.
- **Korean / Japanese sound rushed**: drop "Speed" in Advanced options
  to ~0.95.

## License

App code: MIT. Supertonic model weights are subject to
[Supertone's license](https://huggingface.co/Supertone/supertonic-3).

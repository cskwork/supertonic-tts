---
name: supertts
description: Use the supertonic-tts CLI to generate WAV files locally from text (EN / KO / JA / 32 lang tags). No API key, runs offline after first asset download. Invoke when the user asks to "speak", "narrate", "say", "make audio from text", "TTS", "음성 생성", "내레이션", "읽어줘".
---

# supertts — local TTS CLI

`supertts` (alias: `supertonic-tts`) is a globally installable Node CLI that
turns text into a 44.1 kHz mono WAV file using the on-device Supertonic 3 ONNX
model. Synthesis is fully local: no API key, no network call after the model
weights are cached.

## Quick check: is it available?

Run one of these. If both fail, ask the user to install:

```bash
supertts --list-voices
# or
npx supertonic-tts --list-voices
```

Install command (Windows / macOS / Linux, requires Node >= 18.3):

```bash
npm install -g supertonic-tts
```

First synthesis auto-downloads ~380 MB of model weights to a platform-specific
cache. Subsequent runs reuse the cache and are fast.

## Common invocations

| Goal | Command |
| --- | --- |
| Simplest (auto-detects KO/JA/EN) | `supertts "Hello there"` |
| Korean, female voice F2 | `supertts "안녕하세요" --voice F2 -o ko.wav` |
| Read a text file | `supertts -f script.txt -o out.wav` |
| Pipe from another command | `cat script.txt \| supertts -o out.wav` |
| Higher quality (slower) | `supertts "long text" --steps 16` |
| Faster preview (lower quality) | `supertts "draft" --steps 4` |
| Slow down speech | `supertts "feliz" --lang es --speed 0.9` |
| Use specific assets dir | `supertts "hi" --assets /path/to/assets` |
| Pre-fetch model only | `supertts --download` |

## Flags (cheat sheet)

```
-t, --text <s>       inline text (positional also works)
-f, --file <p>       read .txt file
-o, --out <p>        output WAV (default: ./out-<timestamp>.wav)
-l, --lang <code>    language tag (default: auto = ko / ja / en)
-v, --voice <id>     F1 F2 F3 M1 M2 M3 (default: F1)
-s, --speed <n>      0.7 – 1.8 (default: 1.05)
    --steps <n>      4 – 16 quality steps (default: 8)
    --silence <s>    pause between chunks in seconds (default: 0.3)
    --assets <dir>   override assets directory
    --download       fetch / verify assets only
    --no-play        skip auto-playback (default plays after synth)
    --list-voices    print voice catalog
    --list-langs     print supported language tags
-q, --quiet          suppress progress logs
-h, --help           show help
```

By default the generated WAV plays back immediately using a platform-native
player (macOS `afplay`, Windows `Media.SoundPlayer`, Linux `paplay` /
`aplay` / `play` / `ffplay`). Playback is blocking — the command returns
once audio is done. Pass `--no-play` for batch jobs or any time you don't
want the audio to play (capturing the path in a script, automated tests,
log-only runs).

The CLI prints the final output path on **stdout** (one line). All progress /
status messages go to **stderr**, so this pattern is safe in scripts:

```bash
OUT=$(supertts "audio test" --quiet)
# $OUT now holds the absolute path; auto-play was skipped because stdout
# was being captured.
```

## Voice catalog

| ID | Name  | Gender |
| -- | ----- | ------ |
| F1 | Mina  | female |
| F2 | Sora  | female |
| F3 | Yuna  | female |
| M1 | Aiden | male   |
| M2 | Hiro  | male   |
| M3 | Leo   | male   |

Every voice works with every supported language. There is no per-voice
language. The voice provides timbre; `--lang` controls pronunciation.

## Supported language tags

`en, ko, ja, ar, bg, cs, da, de, el, es, et, fi, fr, hi, hr, hu, id, it, lt,
lv, nl, pl, pt, ro, ru, sk, sl, sv, tr, uk, vi, na`

Chinese (`zh`) is **not** supported by the underlying Supertonic 3 model.

## Failure modes and fixes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `error: no input text` | nothing piped, no `-t`, no positional | pass text |
| Hangs on first run | downloading 380 MB of weights | wait or run `supertts --download` first |
| `unsupported language` | typo in `--lang` | run `supertts --list-langs` |
| `unknown voice` | bad `--voice` value | use `F1-F3`, `M1-M3` |
| Garbled pronunciation for Korean | running without `--lang` and text is only ASCII | omit ASCII transliteration; pass actual Hangul, or use `--lang ko` explicitly |
| File-not-found | `-f path` wrong | use absolute path or check cwd |

## Best practices for agents

- Default to `--steps 8`. Only raise to 12–16 for production narration; only
  drop to 4 for fast iteration / preview.
- Korean / Japanese sound clearer at `--speed 0.95`–`1.0`.
- Auto language detection covers Hangul (`ko`) and Hiragana/Katakana (`ja`);
  for any other language always pass `--lang` explicitly.
- For long content, chunk by paragraph and concatenate WAVs externally rather
  than feeding 10 000 chars at once. The model handles long input but a single
  process holds the entire WAV in RAM.
- Capture output path from stdout, never parse stderr.
- If the user wants a specific filename, always pass `-o <path>`; otherwise
  they get a timestamped file in cwd which is often not what they expect.

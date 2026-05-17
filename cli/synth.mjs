// CLI-side TTS orchestration. Loads ONNX models via onnxruntime-node, reuses
// the runtime-agnostic logic in app/helper.js (UnicodeProcessor, TextToSpeech,
// writeWavFile), and writes a single .wav file.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as ort from 'onnxruntime-node';
import {
  configureOrt,
  UnicodeProcessor,
  Style,
  TextToSpeech,
  writeWavFile,
  AVAILABLE_LANGS,
  isValidLang
} from '../app/helper.js';
import { VOICE_CATALOG, VOICE_IDS } from './assets.mjs';

configureOrt(ort);

export function listVoices() {
  return VOICE_CATALOG.slice();
}

export function listLanguages() {
  return AVAILABLE_LANGS.slice();
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function loadCfgs(onnxDir) {
  return await readJson(path.join(onnxDir, 'tts.json'));
}

async function loadTextProcessor(onnxDir) {
  const indexer = await readJson(path.join(onnxDir, 'unicode_indexer.json'));
  return new UnicodeProcessor(indexer);
}

// Build a single-speaker Style tensor pair from a voice_styles/<id>.json file.
async function loadVoiceStyle(stylePath) {
  const v = await readJson(stylePath);

  const ttlDims = v.style_ttl.dims;
  const dpDims  = v.style_dp.dims;

  const ttlFlat = new Float32Array(v.style_ttl.data.flat(Infinity));
  const dpFlat  = new Float32Array(v.style_dp.data.flat(Infinity));

  const ttlTensor = new ort.Tensor('float32', ttlFlat, [1, ttlDims[1], ttlDims[2]]);
  const dpTensor  = new ort.Tensor('float32', dpFlat,  [1, dpDims[1],  dpDims[2]]);
  return new Style(ttlTensor, dpTensor);
}

async function loadTts(onnxDir, onLoad) {
  const cfgs = await loadCfgs(onnxDir);
  const sessionOpts = { graphOptimizationLevel: 'all' };

  const models = [
    ['Duration Predictor', 'duration_predictor.onnx'],
    ['Text Encoder',       'text_encoder.onnx'],
    ['Vector Estimator',   'vector_estimator.onnx'],
    ['Vocoder',            'vocoder.onnx']
  ];

  const sessions = [];
  for (let i = 0; i < models.length; i++) {
    const [name, file] = models[i];
    if (onLoad) onLoad(name, i + 1, models.length);
    sessions.push(
      await ort.InferenceSession.create(path.join(onnxDir, file), sessionOpts)
    );
  }
  const [dp, te, ve, voc] = sessions;
  const processor = await loadTextProcessor(onnxDir);
  return new TextToSpeech(cfgs, processor, dp, te, ve, voc);
}

export async function synthesize({
  text,
  lang = 'en',
  voice = 'F1',
  speed = 1.05,
  steps = 8,
  silence = 0.3,
  assetsDir,
  outPath,
  onLoad = null,
  onStep = null
}) {
  if (!text || !text.trim()) {
    throw new Error('empty input text');
  }
  if (!isValidLang(lang)) {
    throw new Error(`unsupported language "${lang}". Supported: ${AVAILABLE_LANGS.join(', ')}`);
  }
  if (!VOICE_IDS.includes(voice)) {
    throw new Error(`unknown voice "${voice}". Available: ${VOICE_IDS.join(', ')}`);
  }

  const onnxDir = path.join(assetsDir, 'onnx');
  const stylePath = path.join(assetsDir, 'voice_styles', `${voice}.json`);

  const tts = await loadTts(onnxDir, onLoad);
  const style = await loadVoiceStyle(stylePath);

  const { wav, duration } = await tts.call(
    text,
    lang,
    style,
    steps,
    speed,
    silence,
    onStep
  );
  const wavLen = Math.floor(tts.sampleRate * duration[0]);
  const wavOut = wav.slice(0, wavLen);
  const buf = writeWavFile(wavOut, tts.sampleRate);

  await writeFile(outPath, Buffer.from(buf));
  return { outPath, durationSec: duration[0], sampleRate: tts.sampleRate };
}

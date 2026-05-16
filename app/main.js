import { loadTextToSpeech, loadVoiceStyle, writeWavFile } from './helper.js';
import mammoth from 'mammoth/mammoth.browser.js';
import { t, applyDom, setLocale, getLocale } from './i18n.js';

/* ================== Config ================== */

// In dev, models are served from local ./assets via the Vite middleware.
// In production builds (Vercel, GitHub Pages, etc.) we fetch directly from
// the Hugging Face CDN so the 380 MB of model assets aren't shipped with
// the deploy. Both static hosts cap files at 100 MB; the vector_estimator
// model alone is 244 MB.
const HF_CDN_BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/main';
const ASSETS_BASE = import.meta.env.PROD ? HF_CDN_BASE : 'assets';
const ONNX_BASE = `${ASSETS_BASE}/onnx`;

// Voice catalog. Names are language-neutral (read naturally in Korean,
// English, and Japanese). The underlying Supertonic model is multilingual,
// so every voice works for every language.
const VOICES = [
  { id: 'F1', label: 'Mina',  gender: 'female', style: `${ASSETS_BASE}/voice_styles/F1.json` },
  { id: 'F2', label: 'Sora',  gender: 'female', style: `${ASSETS_BASE}/voice_styles/F2.json` },
  { id: 'F3', label: 'Yuna',  gender: 'female', style: `${ASSETS_BASE}/voice_styles/F3.json` },
  { id: 'M1', label: 'Aiden', gender: 'male',   style: `${ASSETS_BASE}/voice_styles/M1.json` },
  { id: 'M2', label: 'Hiro',  gender: 'male',   style: `${ASSETS_BASE}/voice_styles/M2.json` },
  { id: 'M3', label: 'Leo',   gender: 'male',   style: `${ASSETS_BASE}/voice_styles/M3.json` }
];

const LANGS = {
  en: {
    preview: "Hi. This is a quick voice sample, so you can hear me before you generate your full audio.",
    presets: [
      "Welcome to our product demo. Today, we will explore three key features that save you hours of work each week.",
      "The early morning fog lifted slowly over the harbor, revealing fishing boats and the soft glow of sunrise on the water.",
      "Thanks for tuning in. Don't forget to like, comment, and subscribe. We will see you in the next episode."
    ]
  },
  ko: {
    preview: "안녕하세요. 이 목소리가 마음에 드시는지 짧게 미리 들려드릴게요.",
    presets: [
      "오늘은 새로 출시된 기능 세 가지를 함께 살펴보겠습니다. 끝까지 시청해 주세요.",
      "봄바람이 부는 오후, 공원 벤치에 앉아 따뜻한 햇살을 즐기는 것만큼 좋은 일은 없다.",
      "오디오북을 만들고 싶으신가요? 텍스트를 붙여넣고 음성을 선택한 다음, 생성 버튼만 누르면 됩니다."
    ]
  },
  ja: {
    preview: "こんにちは。本番の音声を作る前に、私の声を短くお試しください。",
    presets: [
      "本日は新機能を三つご紹介します。最後までお付き合いください。",
      "春の午後、公園のベンチで暖かい日差しを浴びる、そんな時間がいちばん好きです。",
      "ナレーションを自動で作りたい方は、テキストを貼り付けて声を選び、再生ボタンを押すだけです。"
    ]
  }
};

const DEFAULT_VOICE_ID = 'F1';
const DEFAULT_LANG = 'ko';

/* ================== State ================== */

const state = {
  lang: DEFAULT_LANG,       // TTS source language (the text language)
  voiceId: DEFAULT_VOICE_ID,
  tts: null,
  cfgs: null,
  styleByVoice: new Map(),
  loadingStyleFor: null,
  previewCache: new Map(),
  previewAudio: new Audio(),
  currentPreviewKey: null,
  lastOutputUrl: null
};

/* ================== DOM ================== */

const $ = (sel) => document.querySelector(sel);

const dom = {
  loader: $('#loader'),
  loaderText: $('#loaderText'),
  loaderPct: $('#loaderPct'),
  loaderFill: $('#loaderFill'),
  backendBadge: $('#backendBadge'),
  langTabs: $('#langTabs'),
  voiceGrid: $('#voiceGrid'),
  presets: $('#presets'),
  text: $('#text'),
  textWrap: $('#textWrap'),
  charCount: $('#charCount'),
  fileInput: $('#fileInput'),
  fileName: $('#fileName'),
  totalStep: $('#totalStep'),
  speed: $('#speed'),
  generateBtn: $('#generateBtn'),
  generateLabel: $('#generateLabel'),
  errorMsg: $('#errorMsg'),
  output: $('#output'),
  audio: $('#audio'),
  statAudio: $('#statAudio'),
  statGen: $('#statGen'),
  downloadBtn: $('#downloadBtn'),
  copyLinkBtn: $('#copyLinkBtn'),
  transcript: $('#transcript'),
  localeToggle: $('#localeToggle')
};

/* ================== Init ================== */

window.addEventListener('DOMContentLoaded', () => {
  // Apply i18n to the static markup before anything else.
  applyDom();
  syncLocaleToggle(getLocale());

  renderVoices();
  renderPresets();
  wireEvents();
  dom.text.value = LANGS[state.lang].presets[0];
  updateCharCount();
  initialiseModels();

  // Re-run dynamic renders when UI locale changes.
  window.addEventListener('locale-changed', (e) => {
    syncLocaleToggle(e.detail);
    renderVoices();
    renderPresets();
    updateCharCount();
  });
});

/* ================== Rendering ================== */

function renderVoices() {
  dom.voiceGrid.innerHTML = '';
  for (const v of VOICES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'voice-chip' + (v.id === state.voiceId ? ' is-active' : '');
    chip.dataset.voiceId = v.id;
    const genderLabel = t(v.gender === 'male' ? 'gender_male' : 'gender_female');
    const previewTitle = t('voice_preview_title', { name: v.label });
    const previewAria = t('voice_preview_aria', { name: v.label });
    chip.innerHTML = `
      <span class="voice-name">${v.label}</span>
      <span class="voice-meta">${genderLabel}</span>
      <span class="voice-preview" data-action="preview" title="${previewTitle}" aria-label="${previewAria}">
        <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="5" r="3"/>
        </svg>
      </span>
    `;
    dom.voiceGrid.appendChild(chip);
  }
}

function renderPresets() {
  const presets = LANGS[state.lang].presets;
  dom.presets.innerHTML = '';
  presets.forEach((text, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'preset-chip';
    chip.textContent = t('preset_label', { n: String(i + 1).padStart(2, '0') });
    chip.title = text;
    chip.addEventListener('click', () => {
      dom.text.value = text;
      updateCharCount();
      dom.text.focus();
    });
    dom.presets.appendChild(chip);
  });
}

function updateCharCount() {
  const text = dom.text.value;
  const chars = text.length;
  // For Korean/Japanese (no whitespace word breaks), word counts are noisy.
  // Show only characters for those languages; words + chars for English.
  if (state.lang === 'en') {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    dom.charCount.textContent = t('char_count_en', {
      words: words.toLocaleString(),
      chars: chars.toLocaleString()
    });
  } else {
    dom.charCount.textContent = t('char_count_ko', { chars: chars.toLocaleString() });
  }
}

function setActiveLang(lang) {
  if (!LANGS[lang]) return;
  state.lang = lang;
  document.querySelectorAll('.lang-pill').forEach((tab) => {
    const isActive = tab.dataset.lang === lang;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  renderPresets();
  updateCharCount();
}

function setActiveVoice(voiceId) {
  if (!VOICES.find((v) => v.id === voiceId)) return;
  state.voiceId = voiceId;
  document.querySelectorAll('.voice-chip').forEach((card) => {
    card.classList.toggle('is-active', card.dataset.voiceId === voiceId);
  });
  ensureStyleLoaded(voiceId).catch((err) => {
    console.error(err);
    showError(t('error_voice_load', { voice: voiceId, error: err.message }));
  });
}

function syncLocaleToggle(loc) {
  dom.localeToggle.querySelectorAll('.locale-opt').forEach((b) => {
    const isActive = b.dataset.locale === loc;
    b.classList.toggle('is-active', isActive);
    b.setAttribute('aria-pressed', String(isActive));
  });
}

/* ================== Events ================== */

function wireEvents() {
  dom.langTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.lang-pill');
    if (!tab) return;
    setActiveLang(tab.dataset.lang);
  });

  dom.voiceGrid.addEventListener('click', async (e) => {
    const preview = e.target.closest('[data-action="preview"]');
    const chip = e.target.closest('.voice-chip');
    if (!chip) return;
    const voiceId = chip.dataset.voiceId;
    if (preview) {
      e.stopPropagation();
      await playPreview(voiceId);
      return;
    }
    setActiveVoice(voiceId);
  });

  dom.text.addEventListener('input', updateCharCount);
  dom.text.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!dom.generateBtn.disabled) generateSpeech();
    }
  });

  // Drag-drop file
  ['dragenter', 'dragover'].forEach((evt) =>
    dom.textWrap.addEventListener(evt, (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      dom.textWrap.classList.add('is-dragover');
    })
  );
  ['dragleave', 'dragend', 'drop'].forEach((evt) =>
    dom.textWrap.addEventListener(evt, () => dom.textWrap.classList.remove('is-dragover'))
  );
  dom.textWrap.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) await ingestFile(file);
  });

  dom.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await ingestFile(file);
    e.target.value = '';
  });

  dom.generateBtn.addEventListener('click', generateSpeech);

  dom.downloadBtn.addEventListener('click', () => {
    if (!state.lastOutputUrl) return;
    const a = document.createElement('a');
    a.href = state.lastOutputUrl;
    a.download = `supertonic-${state.lang}-${state.voiceId}.wav`;
    a.click();
  });

  dom.copyLinkBtn.addEventListener('click', () => {
    if (!state.lastOutputUrl) return;
    window.open(state.lastOutputUrl, '_blank', 'noopener');
  });

  // Locale toggle (KO ⇄ EN)
  dom.localeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.locale-opt');
    if (!btn) return;
    setLocale(btn.dataset.locale);
  });

  state.previewAudio.addEventListener('ended', clearPreviewIndicators);
  state.previewAudio.addEventListener('pause', clearPreviewIndicators);
}

/* ================== File ingest ================== */

async function ingestFile(file) {
  hideError();
  dom.fileName.textContent = file.name;
  try {
    const text = await extractTextFromFile(file);
    if (!text.trim()) throw new Error(t('error_file_empty'));
    dom.text.value = text.trim();
    updateCharCount();
  } catch (err) {
    showError(err.message);
    dom.fileName.textContent = '';
  }
}

async function extractTextFromFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.txt') || file.type === 'text/plain') {
    return await file.text();
  }
  if (lower.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '';
  }
  throw new Error(t('error_file_unsupported'));
}

/* ================== Model loading ================== */

async function initialiseModels() {
  try {
    setLoader(t('loader_initial'), 0);

    let backendUsed = 'wasm';
    const loadOpts = (provider) => ({
      executionProviders: [provider],
      graphOptimizationLevel: 'all'
    });

    const onProgress = (modelName, current, total) => {
      const pct = Math.round((current / total) * 80);
      setLoader(t('loader_model_progress', { model: modelName.toLowerCase() }), pct);
    };

    try {
      const result = await loadTextToSpeech(ONNX_BASE, loadOpts('webgpu'), onProgress);
      state.tts = result.textToSpeech;
      state.cfgs = result.cfgs;
      backendUsed = 'webgpu';
    } catch (webgpuErr) {
      console.log('WebGPU unavailable, falling back to WASM.', webgpuErr);
      const result = await loadTextToSpeech(ONNX_BASE, loadOpts('wasm'), onProgress);
      state.tts = result.textToSpeech;
      state.cfgs = result.cfgs;
    }

    setBackendBadge(backendUsed);

    setLoader(t('loader_voice'), 92);
    await ensureStyleLoaded(state.voiceId);

    setLoader(t('loader_ready'), 100);
    setTimeout(() => dom.loader.classList.add('is-done'), 350);
    dom.generateBtn.disabled = false;
  } catch (err) {
    console.error(err);
    setLoader(t('loader_error', { error: err.message }), 0);
    dom.loader.style.color = 'var(--danger)';
  }
}

async function ensureStyleLoaded(voiceId) {
  if (state.styleByVoice.has(voiceId)) return state.styleByVoice.get(voiceId);
  if (state.loadingStyleFor === voiceId) {
    return await new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        if (state.styleByVoice.has(voiceId)) {
          clearInterval(timer);
          resolve(state.styleByVoice.get(voiceId));
        }
      }, 50);
      setTimeout(() => { clearInterval(timer); reject(new Error('Voice load timed out.')); }, 30000);
    });
  }
  state.loadingStyleFor = voiceId;
  const voice = VOICES.find((v) => v.id === voiceId);
  if (!voice) throw new Error(`Unknown voice: ${voiceId}`);
  const style = await loadVoiceStyle([voice.style], false);
  state.styleByVoice.set(voiceId, style);
  state.loadingStyleFor = null;
  return style;
}

/* ================== Preview ================== */

async function playPreview(voiceId) {
  const key = `${voiceId}::${state.lang}`;
  if (state.currentPreviewKey === key && !state.previewAudio.paused) {
    state.previewAudio.pause();
    state.previewAudio.currentTime = 0;
    clearPreviewIndicators();
    return;
  }
  if (!state.tts) {
    showError(t('error_model_loading'));
    return;
  }
  hideError();
  const btn = previewButtonFor(voiceId);

  try {
    if (state.previewCache.has(key)) {
      playPreviewUrl(state.previewCache.get(key), voiceId, key);
      return;
    }
    if (btn) btn.classList.add('is-loading');
    const style = await ensureStyleLoaded(voiceId);
    const { wav, duration } = await state.tts.call(
      LANGS[state.lang].preview,
      state.lang,
      style,
      6,
      1.05,
      0.2
    );
    const wavLen = Math.floor(state.tts.sampleRate * duration[0]);
    const wavOut = wav.slice(0, wavLen);
    const buf = writeWavFile(wavOut, state.tts.sampleRate);
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    state.previewCache.set(key, url);
    playPreviewUrl(url, voiceId, key);
  } catch (err) {
    console.error(err);
    showError(t('error_preview', { error: err.message }));
  } finally {
    if (btn) btn.classList.remove('is-loading');
  }
}

function playPreviewUrl(url, voiceId, key) {
  clearPreviewIndicators();
  state.previewAudio.src = url;
  state.currentPreviewKey = key;
  const btn = previewButtonFor(voiceId);
  if (btn) btn.classList.add('is-playing');
  state.previewAudio.play().catch((err) => {
    console.error(err);
    clearPreviewIndicators();
  });
}

function previewButtonFor(voiceId) {
  const chip = dom.voiceGrid.querySelector(`.voice-chip[data-voice-id="${voiceId}"]`);
  return chip ? chip.querySelector('[data-action="preview"]') : null;
}

function clearPreviewIndicators() {
  document
    .querySelectorAll('.voice-preview.is-playing, .voice-preview.is-loading')
    .forEach((b) => b.classList.remove('is-playing', 'is-loading'));
  state.currentPreviewKey = null;
}

/* ================== Main synthesis ================== */

async function generateSpeech() {
  hideError();
  const text = dom.text.value.trim();
  if (!text) {
    showError(t('error_no_text'));
    dom.text.focus();
    return;
  }
  if (!state.tts) {
    showError(t('error_model_loading'));
    return;
  }
  if (!state.previewAudio.paused) state.previewAudio.pause();

  const totalStep = clampInt(dom.totalStep.value, 4, 16, 8);
  const speed = clampFloat(dom.speed.value, 0.7, 1.8, 1.05);

  dom.generateBtn.disabled = true;
  dom.generateBtn.classList.add('is-busy');
  dom.generateLabel.textContent = t('btn_generating');

  const start = performance.now();
  try {
    const style = await ensureStyleLoaded(state.voiceId);
    const { wav, duration } = await state.tts.call(
      text,
      state.lang,
      style,
      totalStep,
      speed,
      0.3,
      (step, total) => {
        dom.generateLabel.textContent = t('btn_generating_progress', { step, total });
      }
    );
    const wavLen = Math.floor(state.tts.sampleRate * duration[0]);
    const wavOut = wav.slice(0, wavLen);
    const buf = writeWavFile(wavOut, state.tts.sampleRate);
    const blob = new Blob([buf], { type: 'audio/wav' });

    if (state.lastOutputUrl) URL.revokeObjectURL(state.lastOutputUrl);
    state.lastOutputUrl = URL.createObjectURL(blob);

    dom.audio.src = state.lastOutputUrl;
    dom.transcript.textContent = text;
    dom.statAudio.textContent = t('output_audio_stat', { seconds: duration[0].toFixed(2) });
    dom.statGen.textContent = t('output_gen_stat', {
      seconds: ((performance.now() - start) / 1000).toFixed(2)
    });
    dom.output.classList.remove('hidden');
    dom.output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    dom.audio.play().catch(() => {/* autoplay blocked is fine */});
  } catch (err) {
    console.error(err);
    showError(t('error_generation', { error: err.message }));
  } finally {
    dom.generateBtn.disabled = false;
    dom.generateBtn.classList.remove('is-busy');
    dom.generateLabel.textContent = t('btn_speak');
  }
}

/* ================== Helpers ================== */

function setLoader(text, percent) {
  dom.loader.classList.remove('is-done');
  dom.loaderText.textContent = text;
  dom.loaderPct.textContent = `${Math.round(percent)}%`;
  dom.loaderFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function setBackendBadge(provider) {
  dom.backendBadge.textContent = provider === 'webgpu' ? 'webgpu' : 'wasm';
  // Stop overriding via i18n once we have a real backend value.
  delete dom.backendBadge.dataset.i18n;
  dom.backendBadge.classList.add('is-ready');
}

function showError(msg) {
  dom.errorMsg.textContent = msg;
}
function hideError() {
  dom.errorMsg.textContent = '';
}

function clampInt(raw, min, max, fallback) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function clampFloat(raw, min, max, fallback) {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

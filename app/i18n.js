/**
 * Lightweight i18n for the UI shell.
 *
 * Usage:
 *   - In HTML, mark elements with `data-i18n="key"` (or
 *     `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-aria-label`,
 *     `data-i18n-html` for elements that need raw HTML).
 *   - Call `applyDom()` once on load and again whenever the locale changes.
 *   - In JS, use `t('key', { name: 'Mina' })` for dynamic strings.
 *
 * Only two locales are supported: Korean (ko, default) and English (en).
 * State persists in localStorage.
 */

const STORAGE_KEY = 'supertonic.uiLocale';
const SUPPORTED = ['ko', 'en'];

export const STRINGS = {
  page_title: {
    ko: '슈퍼토닉: 내 기기에서 바로 글을 목소리로',
    en: 'Supertonic: Turn text into speech, right on your device'
  },
  meta_description: {
    ko: '브라우저 안에서 바로 작동하는 텍스트 음성 변환. 한국어, 영어, 일본어를 지원합니다.',
    en: 'Text to speech that runs in your browser. Supports Korean, English, and Japanese.'
  },
  topbar_loading: { ko: '불러오는 중', en: 'Loading' },
  topbar_source: { ko: '소스 보기', en: 'View source' },

  hero_h1_html: {
    ko: '글이 <em>목소리</em>가 되는 가장 빠른 방법',
    en: 'The fastest way to turn text into a <em>voice</em>'
  },
  hero_sub: {
    ko: '원하는 문장을 붙여넣거나 파일을 올리고, 목소리를 골라보세요. 작성하신 내용은 브라우저 밖으로 나가지 않습니다.',
    en: 'Paste a sentence or upload a file, then pick a voice. Your text never leaves your browser.'
  },

  loader_initial: { ko: '음성 모델을 불러오는 중입니다', en: 'Loading the voice model' },
  loader_model_progress: { ko: '{model} 모델을 불러오는 중', en: 'Loading the {model} model' },
  loader_voice: { ko: '목소리를 불러오는 중', en: 'Loading voice' },
  loader_ready: { ko: '준비 완료', en: 'Ready' },
  loader_error: { ko: '모델을 불러오지 못했습니다. {error}', en: 'Could not load the model. {error}' },

  section_language: { ko: '언어', en: 'Language' },
  section_voice: { ko: '목소리', en: 'Voice' },
  section_voice_hint: { ko: '동그라미를 눌러 미리 들어보세요.', en: 'Tap a circle to preview.' },
  section_text: { ko: '본문', en: 'Text' },
  section_text_hint: {
    ko: '직접 쓰거나 붙여넣거나, 파일을 끌어다 놓아 보세요.',
    en: 'Type, paste, or drop a file here.'
  },

  text_placeholder: {
    ko: '여기에 변환할 문장을 입력하거나 붙여넣으세요. .txt 또는 .docx 파일을 끌어다 놓아도 됩니다.',
    en: 'Type or paste your text here. You can also drop a .txt or .docx file.'
  },
  text_dragover: { ko: '놓으면 본문에 불러옵니다', en: 'Release to load into the text box' },

  file_pick_link: { ko: '.txt / .docx 파일 올리기', en: 'Upload a .txt or .docx file' },
  presets_aria: { ko: '예시 문장', en: 'Example sentences' },
  preset_label: { ko: '예시 {n}', en: 'Example {n}' },

  char_count_ko: { ko: '{chars} 글자', en: '{chars} characters' },
  char_count_en: { ko: '{words} 단어 · {chars} 글자', en: '{words} words, {chars} characters' },

  advanced_toggle: { ko: '고급 설정', en: 'Advanced settings' },
  advanced_quality: { ko: '품질 (단계 수)', en: 'Quality (steps)' },
  advanced_speed: { ko: '속도', en: 'Speed' },

  btn_speak: { ko: '음성으로 변환', en: 'Convert to speech' },
  btn_generating: { ko: '생성 중', en: 'Generating' },
  btn_generating_progress: { ko: '생성 중 {step}/{total}', en: 'Generating {step}/{total}' },
  btn_shortcut_aria: { ko: '단축키 Cmd 또는 Ctrl 엔터', en: 'Shortcut: Cmd or Ctrl Enter' },

  error_no_text: { ko: '먼저 변환할 문장을 입력해 주세요.', en: 'Please enter some text to convert first.' },
  error_model_loading: {
    ko: '모델을 불러오는 중입니다. 잠시만 기다려 주세요.',
    en: 'The model is still loading. Please wait a moment.'
  },
  error_voice_load: {
    ko: '{voice} 목소리를 불러오지 못했어요. {error}',
    en: 'Could not load the {voice} voice. {error}'
  },
  error_preview: { ko: '미리듣기를 재생하지 못했어요. {error}', en: 'Could not play the preview. {error}' },
  error_generation: { ko: '음성 생성에 실패했어요. {error}', en: 'Could not generate the audio. {error}' },
  error_file_empty: { ko: '파일이 비어 있어요.', en: 'The file is empty.' },
  error_file_unsupported: {
    ko: '.txt 또는 .docx 파일만 지원합니다.',
    en: 'Only .txt and .docx files are supported.'
  },
  error_file_read: { ko: '파일을 읽지 못했어요. {error}', en: 'Could not read the file. {error}' },

  output_title: { ko: '결과', en: 'Result' },
  output_audio_stat: { ko: '{seconds}초 분량', en: '{seconds} seconds long' },
  output_gen_stat: { ko: '{seconds}초 만에 생성', en: 'Generated in {seconds} seconds' },
  btn_download: { ko: 'WAV 파일로 저장', en: 'Save as WAV' },
  btn_open_tab: { ko: '새 탭에서 열기', en: 'Open in new tab' },
  transcript_toggle: { ko: '원문 보기', en: 'Show original text' },

  footer_html: {
    ko: 'Supertonic 3 모델로 동작합니다. WebGPU 또는 WebAssembly로 기기 안에서 직접 실행되며, 계정과 API 키가 필요 없습니다.',
    en: 'Powered by the Supertonic 3 model. Runs directly on your device via WebGPU or WebAssembly, with no account or API key required.'
  },

  gender_male: { ko: '남', en: 'M' },
  gender_female: { ko: '여', en: 'F' },
  voice_preview_title: { ko: '{name} 미리듣기', en: 'Preview {name}' },
  voice_preview_aria: { ko: '{name} 목소리 미리듣기', en: 'Preview the {name} voice' },

  locale_toggle_aria: { ko: '표시 언어 전환', en: 'Switch display language' }
};

function readStoredLocale() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(v)) return v;
  } catch (_) {
    /* storage may be blocked (private mode) — fall through */
  }
  return 'ko';
}

let currentLocale = readStoredLocale();

export function getLocale() {
  return currentLocale;
}

export function setLocale(loc) {
  if (!SUPPORTED.includes(loc) || loc === currentLocale) return;
  currentLocale = loc;
  try { localStorage.setItem(STORAGE_KEY, loc); } catch (_) {}
  document.documentElement.lang = loc;
  document.title = t('page_title');
  applyDom();
  window.dispatchEvent(new CustomEvent('locale-changed', { detail: loc }));
}

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in params ? params[k] : `{${k}}`));
}

export function t(key, params) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const raw = entry[currentLocale] ?? entry.ko ?? key;
  return interpolate(raw, params);
}

export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

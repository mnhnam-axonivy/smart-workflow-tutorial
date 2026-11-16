/**
 * The voice of the walkthrough: reads the notes aloud with the browser's own speech synthesis
 * (Web Speech API), one sentence at a time, so the note can mark the sentence being spoken like
 * a subtitle. Nothing is downloaded or sent anywhere by this code: the voices are those of the
 * viewer's browser and system (some browsers use online voices of their vendor). A lesson turns
 * it on with `voice: true` in its definition; the viewer turns it on and off in the player, and
 * that choice is remembered.
 *
 * Speech engines differ and some are unreliable, so:
 * - an utterance never holds more than one sentence (Chrome cuts long ones off);
 * - pausing cancels the sentence and resuming says it again (pause() does not work everywhere);
 * - a sentence that does not start, or does not end, is given up after a while, so the
 *   walkthrough can never hang on the voice.
 */

const STORAGE_KEY = 'swWalkthroughVoice';
/** Speaking rate: 1 is the voice's normal speed. */
export const RATE = 1;
/** How long a voice takes to start a sentence before it is tried once more, then given up. */
const START_TIMEOUT = 2500;

const ABBREVIATIONS = /(?:^|\s)(?:e\.g|i\.e|etc|vs|Ltd|Inc|No)\.$/i;

/**
 * Splits a note's text into sentences, keeping the spaces after each one, so the parts joined
 * give the text back exactly. `code spans` are never split.
 * @returns {string[]}
 */
export function sentences(text) {
  const s = String(text);
  const out = [];
  let start = 0;
  let code = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '`') { code = !code; continue; }
    if (code) continue;
    let end = -1;
    if ('。！？'.includes(ch)) end = i + 1;
    else if ('.!?'.includes(ch) && (i + 1 === s.length || /\s/.test(s[i + 1])) && !ABBREVIATIONS.test(s.slice(start, i + 1))) end = i + 1;
    if (end < 0) continue;
    while (end < s.length && /\s/.test(s[end])) end++;
    out.push(s.slice(start, end));
    start = end;
    i = end - 1;
  }
  if (start < s.length) out.push(s.slice(start));
  return out.filter(part => part.trim());
}

/**
 * What a voice should say for a piece of text: code is read the way a developer says it
 * (`in.invoiceText` and `<%=in.invoiceText%>` → "in dot invoice Text"), names written together
 * as words (AgenticProcessCall → "Agentic Process Call"), and dashes and arrows become pauses.
 */
export function speakable(text) {
  return String(text)
    .replace(/`([^`]*)`/g, (_, code) => code
      .replace(/<%=?|%>/g, ' ')
      .replace(/[<>{}()[\]"'=;*]/g, ' ')
      .replace(/(\w)\.(?=\w)/g, '$1 dot ')
      .replace(/_/g, ' '))
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s*[—–→]\s*/g, ', ')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The best voice of the browser for a language: a natural (neural) one if there is one,
 * else one of the browser vendor's, else any.
 * @param {{name:string, lang:string, default?:boolean}[]} voices
 * @param {'en'|'ja'} lang
 */
export function pickVoice(voices, lang) {
  const want = lang === 'ja' ? 'ja' : 'en';
  let best = null;
  let bestScore = -1;
  (voices || []).forEach(v => {
    const l = String(v.lang || '').toLowerCase().replace('_', '-');
    if (!l.startsWith(want)) return;
    let score = 0;
    if (/natural|neural|online|premium|enhanced/i.test(v.name)) score += 4;
    if (/google/i.test(v.name)) score += 2;
    if (want === 'en' && l.startsWith('en-us')) score += 1;
    if (v.default) score += 0.5;
    if (score > bestScore) { best = v; bestScore = score; }
  });
  return best;
}

/** About how long a voice takes for a text at RATE, in ms. */
export function speakingTime(text, lang) {
  let units = 0;
  for (const ch of String(text)) units += /[　-鿿＀-￯]/.test(ch) ? 2 : 1;
  return Math.round((units * (lang === 'ja' ? 68 : 64)) / RATE) + 250;
}

const storage = {
  get() { try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; } },
  set(value) { try { window.localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* not stored: on for this visit only */ } }
};

/** The browser's speech engine, or null when it has none. */
function browserEngine() {
  const w = typeof window === 'undefined' ? null : window;
  return w && w.speechSynthesis && typeof w.SpeechSynthesisUtterance === 'function'
    ? { synth: w.speechSynthesis, Utterance: w.SpeechSynthesisUtterance }
    : null;
}

export class Voice {
  /**
   * @param {{synth: SpeechSynthesis, Utterance: Function, startTimeout?: number}|null} [engine]
   *   the browser's when omitted; null for no voice (tests)
   * @param {() => void} [onVoices]  the voices of the browser have changed (they load late in Chrome)
   */
  constructor(engine, onVoices) {
    this.engine = engine === undefined ? browserEngine() : engine;
    this.voices = [];
    this.speech = null;
    this.wanted = storage.get() !== 'off'; // on unless the viewer turned it off
    if (!this.engine) return;
    const { synth } = this.engine;
    this.listener = () => {
      this.voices = synth.getVoices() || [];
      if (onVoices) onVoices();
    };
    this.voices = synth.getVoices() || [];
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', this.listener);
    else synth.onvoiceschanged = this.listener;
  }

  /** Can this browser say something in that language? */
  canSpeak(lang) {
    return Boolean(this.engine && pickVoice(this.voices, lang));
  }

  /** The viewer's choice: voice on or off. */
  get on() { return this.wanted; }
  set on(value) {
    this.wanted = Boolean(value);
    storage.set(this.wanted ? 'on' : 'off');
    if (!this.wanted) this.stop();
  }

  /**
   * Says the parts one after the other. Returns the speech in progress, or null when nothing
   * is said (voice off, or no voice for the language).
   * @param {string[]} parts
   * @param {'en'|'ja'} lang
   * @param {(index: number) => void} [onPart]  part `index` starts; parts.length when all are said
   */
  say(parts, lang, onPart) {
    this.stop();
    const voice = this.on ? pickVoice(this.voices, lang) : null;
    if (!voice || !parts.some(p => String(p).trim())) return null;
    this.speech = new Speech(this.engine, voice, parts, lang, onPart || (() => {}));
    return this.speech;
  }

  /** Stops what is being said. */
  stop() {
    if (this.speech) this.speech.cancel();
    this.speech = null;
  }

  dispose() {
    this.stop();
    if (!this.engine) return;
    const { synth } = this.engine;
    if (typeof synth.removeEventListener === 'function') synth.removeEventListener('voiceschanged', this.listener);
    else if (synth.onvoiceschanged === this.listener) synth.onvoiceschanged = null;
  }
}

/** One note, title, or screen being said, sentence by sentence. */
class Speech {
  constructor(engine, voice, parts, lang, onPart) {
    this.engine = engine;
    this.voice = voice;
    this.parts = parts.map(String);
    this.lang = lang;
    this.onPart = onPart;
    this.index = 0;
    this.done = false;
    this.paused = false;
    this.endedAt = 0; // when the last part ended; 0 when it was cancelled
    this.utterance = null;
    this.started = false;
    this.startedAt = 0;
    this.retried = false;
    this.timer = 0;
    this.total = this.parts.reduce((n, p) => n + p.length, 0) || 1;
    this.#next();
  }

  #next() {
    clearTimeout(this.timer);
    if (this.done || this.paused) return;
    while (this.index < this.parts.length && !this.parts[this.index].trim()) this.index++;
    if (this.index >= this.parts.length) {
      this.#finish(true);
      return;
    }
    this.onPart(this.index);
    this.#speak(false);
  }

  #speak(retry) {
    const { synth, Utterance } = this.engine;
    const text = this.parts[this.index];
    const u = new Utterance(text);
    u.voice = this.voice;
    u.lang = this.voice.lang;
    u.rate = RATE;
    this.utterance = u; // also keeps it from being garbage collected before it ends (Chrome)
    this.started = false;
    this.retried = retry;
    u.onstart = () => {
      if (u !== this.utterance) return;
      this.started = true;
      this.startedAt = Date.now();
      // a sentence that never ends is given up after much longer than it should take
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { if (u === this.utterance) this.#ended(); }, speakingTime(text, this.lang) * 3 + 4000);
    };
    u.onend = () => { if (u === this.utterance) this.#ended(); };
    u.onerror = e => {
      if (u !== this.utterance) return;
      if (e && e.error === 'not-allowed') this.#finish(true); // the browser wants a click first
      else this.#ended();
    };
    if (synth.paused && typeof synth.resume === 'function') synth.resume();
    synth.speak(u);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (u !== this.utterance || this.started) return;
      // nothing came out: try once more (Chrome sometimes drops a sentence), then go silent
      this.utterance = null;
      synth.cancel();
      if (retry) this.#finish(true);
      else this.#speak(true);
    }, this.engine.startTimeout || START_TIMEOUT);
  }

  #ended() {
    this.utterance = null;
    this.index++;
    this.#next();
  }

  #finish(said) {
    clearTimeout(this.timer);
    this.done = true;
    this.utterance = null;
    this.endedAt = said ? Date.now() : 0;
    if (said) this.onPart(this.parts.length); // cancelled: whoever cancelled clears the marks
  }

  /** About how much of it has been said, 0…1. */
  progress() {
    if (this.done) return 1;
    let before = 0;
    for (let i = 0; i < this.index; i++) before += this.parts[i].length;
    const part = this.parts[this.index] || '';
    const share = this.started && !this.paused ? Math.min(0.95, (Date.now() - this.startedAt) / speakingTime(part, this.lang)) : 0;
    return (before + part.length * share) / this.total;
  }

  /** Stops in the middle of a sentence; resume() says that sentence again. */
  pause() {
    if (this.done || this.paused) return;
    this.paused = true;
    clearTimeout(this.timer);
    this.utterance = null;
    this.engine.synth.cancel();
  }

  resume() {
    if (this.done || !this.paused) return;
    this.paused = false;
    this.#next();
  }

  cancel() {
    if (this.done) return;
    this.utterance = null;
    this.engine.synth.cancel();
    this.#finish(false);
  }
}

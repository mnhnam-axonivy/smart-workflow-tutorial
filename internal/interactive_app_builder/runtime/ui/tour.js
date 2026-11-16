/**
 * The walkthrough: the simulator plays a lesson by itself, like an explainer video. It runs
 * the process, opens the inscription view, types changes and switches tabs, and shows one
 * note at a time next to the thing the note explains. Afterwards the learner is left with
 * the editable simulator.
 *
 * A feature defines the lesson as chapters:
 *   tour: { chapters: [{ id, play: async d => { … } }] }
 * A chapter can also be split into parts, e.g. the causes of a problem:
 *   { id, label: 'cause', play: intro, parts: [{ id, play: async d => { … } }] }
 * `play` (optional) runs first, then each part: the process is put back as the tutorial ships
 * it, a screen shows "<chapter> · tour.screen.<label> (Cause 2 of 6) · tour.<part id>.title",
 * and the part plays. The player shows the parts as 1.1, 1.2, …; each can be started on its
 * own, and the intro card counts them with tour.count.<label> ("6 causes").
 * with the texts `tour.intro.*`, `tour.chapter.<id>` and `tour.<note>.title` / `.text` in its
 * strings. Every chapter opens with a title screen showing only its name, which should be the
 * heading of the tutorial section it belongs to, so learners can find it in the text. `d` is the director handed to `play`:
 *
 *   d.note(key, { target, params, quote, wait, extra })
 *                                                  show a note and wait until it has been read;
 *                                                  quote: text, or lines [{ text, wrong }] where
 *                                                  the wrong ones are shown in red and flagged;
 *                                                  extra: more time than the text alone needs,
 *                                                  for a note whose target has to be read too
 *   d.focus(target) / d.clear()                    spotlight something without a note
 *   d.run({ fast, on, runIndex, start })           run the process; `on` hooks into the run,
 *                                                  `start` names the start element to begin at
 *   d.stop()                                       end the run from inside one of its hooks
 *   d.reset()                                      back to the process as the tutorial ships it
 *   d.open(elementId, tab) / d.close()             inscription view (of an element of any file)
 *   d.panel('log' | 'chat' | 'data' | null)        bottom panel
 *   d.tab('process' | 'tools' | 'src:<id>' | 'variables' | 'view:<id>')
 *                                                  editor tab: the process, the file with its
 *                                                  tools, a source file, variables.yaml
 *   d.edit(target, value | old => value)           type a change: 'f5.system', 'f7.code', 'vars',
 *                                                  'src:<id>' (a source file).
 *                                                  The spotlight goes to the characters that
 *                                                  change, then they are typed one by one
 *   d.answer(text)                                 type an answer into the open user dialog
 *                                                  and submit it (in a 'dialog:<id>' hook)
 *   d.screen(key, { label, ...params })            a black screen inside a chapter, e.g. before
 *                                                  each cause of a problem: the chapter's name,
 *                                                  then tour.screen.<label> (e.g. "Cause {n} of
 *                                                  {total}"), then tour.<key>.title in large type
 *   d.wait(ms)
 *
 * Targets of notes and spotlights:
 *   'el:f5'                       an element on the canvas
 *   'field:f5.system'             a field of the open inscription view
 *   'field:f7.code@Total Amount'  the line of a code field that contains the text
 *   'field:f5.resultType@.class'  in any other field: exactly that text
 *   'vars' / 'vars@APIKey'        variables.yaml, or one of its lines
 *   'src:tool' / 'src:tool@name'  a source file, or the first of its lines with that text
 *   'log:last'                    the newest line of the Runtime Log
 *   'data:result'                 a field in the Process data view
 *   'chat' / 'chat:system'        the Conversation panel, or one of its parts: system, user,
 *                                 schema, tools, toolcall, tool, assistant (a message of that
 *                                 role), head (provider, model, endpoint), guards; '@last' or
 *                                 '@<n>' picks another than the first of them
 *   'side'                        the readout next to variables.yaml
 *   'dialog'                      the open user dialog of a user task
 *   'view:<id>@<part>'            a part of an editor tab the lesson brings (its rect(part))
 *   (none)                        the note docks in the bottom left corner of the canvas
 *
 * Hooks of d.run: 'enter:<id>' (the token has arrived, the element has not run yet),
 * 'after:<id>' (the element has run, the token is about to move on), 'pause:<id>' (a task
 * waits for its user; the run carries on when the hook returns), 'dialog:<id>' (the dialog
 * of a user task is open; it is submitted when the hook returns) and 'agent:<phase>' (request,
 * thinking, tool-call, tool-done, tool-result, response, mapped, unmapped, skipped, failed, end).
 * Elements of the tools file have the ids of that file with the prefix "tools-".
 *
 * With `voice: true` in the definition, the walkthrough also speaks (see voice.js): each
 * chapter title, each screen, and each note (its title, then its text sentence by sentence,
 * with the sentence being said marked in the note; quotes are not read). A note then stays
 * until the voice has finished, and at least as long as without it. The player has a button
 * to turn the voice off and on.
 */
import { h, append, clear } from '../util.js';
import { icon } from './icons.js';
import { Voice, sentences, speakable } from './voice.js';
import { elementById, agentConfig } from '../model/process.js';
import { elementBounds } from '../stage/layout.js';

const CANCELLED = Symbol('walkthrough cancelled');
const FAST = 2.5;
const SIDES = { view: ['bottom', 'top', 'left', 'right'], el: ['bottom', 'top', 'left', 'right'], field: ['left', 'bottom', 'top'], vars: ['bottom', 'top'], src: ['bottom', 'top'], dialog: ['bottom', 'right', 'left', 'top'], log: ['top', 'bottom'], data: ['top', 'bottom'], chat: ['top', 'bottom'], side: ['left', 'top', 'bottom'] };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Text with `code` spans. */
function rich(text) {
  return String(text).split('`').map((part, i) => (i % 2 ? h('code', null, part) : part));
}

/**
 * How long a note stays: a base plus time per character, with CJK characters counted double.
 * Kept brisk on purpose; anyone who wants to read longer clicks the simulation to pause.
 */
export function readingTime(text) {
  let units = 0;
  for (const ch of String(text)) units += /[　-鿿＀-￯]/.test(ch) ? 2.2 : 1;
  return clamp(600 + units * 26, 1800, 6000);
}

/** A quoted value cut to what fits a note, with an ellipsis when something is left out. */
function excerpt(text) {
  const full = String(text);
  let out = full.split('\n').slice(0, 8).join('\n');
  if (out.length > 380) out = out.slice(0, 380).trimEnd();
  return out.length < full.length ? out + ' …' : out;
}

const quoteText = quote => (Array.isArray(quote) ? quote.map(l => l.text).join('\n') : String(quote || ''));

/** The chapter title screen only needs a glance. */
const titleTime = text => clamp(1100 + String(text).length * 25, 1500, 2600);
/** A screen inside a chapter has a little more to read: what comes next, and where it belongs. */
const screenTime = text => clamp(1500 + String(text).length * 30, 2400, 4200);

/** Time per typed step: a few characters go slowly enough to follow, a long text takes about as long in total. */
const typingTime = steps => clamp(Math.round(1400 / steps), 40, 200);

function parseTarget(target) {
  const m = /^(el|field|vars|src|log|data|chat|side|dialog|view)(?::([^@]*))?(?:@(.*))?$/.exec(target || '');
  return m ? { kind: m[1], name: m[2] || '', line: m[3] || '' } : null;
}

/** Index of the first line of a code editor that contains `text`, or -1. */
const lineIndex = (editor, text) => editor.textarea.value.split('\n').findIndex(l => l.includes(text));

export class Tour {
  /** @param {Object} app  the DesignerApp  @param {{chapters: {id:string, play:Function}[]}} [definition] */
  constructor(app, definition) {
    this.app = app;
    this.chapters = (definition && definition.chapters) || [];
    this.pace = Number(app.options.tourPace) > 0 ? Number(app.options.tourPace) : 1;
    this.state = 'idle'; // 'idle' | 'intro' | 'playing' | 'done'
    this.index = 0;
    this.paused = false;
    this.gen = 0;
    this.playing = Promise.resolve();
    this.abort = null; // ends the wait in progress
    this.advance = false; // "Next" was pressed
    this.notes = 0; // notes shown in the current chapter
    this.current = null; // the note on screen
    this.title = null; // id of the chapter whose title screen is showing
    this.screen = null; // { key, params } of the screen inside a chapter that is showing
    this.part = -1; // index of the part of the current chapter that is playing, -1 before its first
    this.target = null;
    this.cardKind = null;
    this.tracking = 0;
    // the voice, when the lesson has one: `say` gives what is showing as parts to say (in the
    // current language), `speech` is that being said, `sayEls` the sentences of the note on screen
    this.voice = definition && definition.voice ? new Voice(app.options.speech, () => this.renderPlayer()) : null;
    this.say = null;
    this.speech = null;
    this.sayEls = [];

    this.block = h('div.tour-block', { onclick: () => this.togglePause() });
    this.spotEl = h('div.tour-spot', { hidden: true });
    this.noteEl = h('div.tour-note', { hidden: true, role: 'status', 'aria-live': 'polite' });
    this.titleEl = h('div.tour-title', { hidden: true, role: 'status', 'aria-live': 'polite' });
    this.cover = h('div.tour-cover', { hidden: true });
    app.layer.append(this.block, this.spotEl, this.noteEl, this.titleEl, this.cover);
    this.onKey = e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.back(); }
    };
    app.playerEl.addEventListener('keydown', this.onKey);
  }

  get available() { return this.chapters.length > 0; }

  // ── screens ────────────────────────────────────────────────────────────────

  #card(kind, children) {
    this.cardKind = kind;
    clear(this.cover).append(h('div.tour-card', { role: 'dialog', 'aria-label': this.app.t('tour.kicker') }, children));
    this.cover.className = 'tour-cover ' + kind;
    this.cover.hidden = false;
  }

  #closeCard() {
    this.cardKind = null;
    this.cover.hidden = true;
    clear(this.cover);
  }

  /** The first thing a learner sees: what the walkthrough covers, and one button. */
  showIntro() {
    const t = this.app.t;
    this.state = 'intro';
    this.app.setMode('intro');
    this.#card('intro', [
      h('div.tour-kicker', null, t('tour.kicker')),
      h('h3', null, t('tour.intro.title')),
      h('p', null, t('tour.intro.text')),
      h('ol.tour-card-list', null, this.chapters.map(c => h('li', null, t('tour.chapter.' + c.id),
        c.parts && c.label ? h('span.tour-card-count', null, ' · ' + t('tour.count.' + c.label, { n: c.parts.length })) : null))),
      h('div.tour-card-actions', null,
        h('button.tour-play', { type: 'button', onclick: () => this.start(0) }, icon('play', 14), h('span', null, t('tour.play')), h('span.tour-play-time', null, t('tour.intro.duration'))),
        h('button.link-btn', { type: 'button', onclick: () => this.skip() }, t('tour.skip')))]);
  }

  #showEnd() {
    const t = this.app.t;
    this.#card('end', [
      h('div.tour-kicker', null, t('tour.kicker')),
      h('h3', null, t('tour.end.title')),
      h('p', null, t('tour.end.text')),
      h('div.tour-card-actions', null,
        h('button.tour-play', { type: 'button', onclick: () => this.#closeCard() }, h('span', null, t('tour.end.start'))),
        h('button.link-btn', { type: 'button', onclick: () => this.start(0) }, icon('reset', 13), t('tour.replay.all')))]);
  }

  // ── transport ──────────────────────────────────────────────────────────────

  /**
   * Plays from the given chapter to the end, or from one of its parts. Whatever was playing
   * is stopped first.
   */
  async start(index = 0, part = -1) {
    await this.#halt();
    const gen = this.gen;
    this.state = 'playing';
    this.#closeCard();
    this.setPaused(false);
    this.app.setMode('tour');
    const chapter = clamp(index, 0, this.chapters.length - 1);
    const parts = this.chapters[chapter].parts || [];
    this.playing = this.#play(gen, chapter, part >= 0 && parts.length ? clamp(part, 0, parts.length - 1) : -1);
    const toggle = this.app.playerEl.querySelector('.tour-toggle');
    if (toggle) toggle.focus({ preventScroll: true });
  }

  async #play(gen, from, fromPart = -1) {
    const d = this.#director(gen);
    try {
      for (let i = from; i < this.chapters.length; i++) {
        const chapter = this.chapters[i];
        const jump = i === from && fromPart >= 0; // started at one of its parts: no title, no intro
        this.index = i;
        this.part = -1;
        this.notes = 0;
        this.#prepare();
        this.renderPlayer();
        if (!jump) {
          await this.#titleScreen(gen, chapter);
          await d.wait(120);
          if (chapter.play) await chapter.play(d);
        }
        const parts = chapter.parts || [];
        for (let p = jump ? fromPart : 0; p < parts.length; p++) {
          this.part = p;
          this.notes = 0;
          this.#prepare(); // every part starts from the process as the tutorial ships it
          this.renderPlayer();
          await this.#screen(gen, parts[p].id, { label: chapter.label, n: p + 1, total: parts.length });
          await d.wait(120);
          await parts[p].play(d);
          await d.wait(300);
        }
        await d.wait(400);
      }
    } catch (e) {
      if (e === CANCELLED) return;
      console.error('[swInteractive] The walkthrough stopped unexpectedly.', e);
    }
    if (gen === this.gen) this.#finish(true);
  }

  /** The screen between chapters: the name of the tutorial section that comes next. */
  async #titleScreen(gen, chapter) {
    const t = this.app.t;
    this.title = chapter.id;
    this.#fillTitle();
    this.titleEl.hidden = false;
    this.titleEl.classList.remove('leave');
    this.#speak(() => [speakable(this.app.t('tour.chapter.' + chapter.id))]);
    try {
      await this.#sleep(gen, titleTime(t('tour.chapter.' + chapter.id)), { skippable: true, hold: true });
      this.#silence();
      this.titleEl.classList.add('leave');
      await this.#sleep(gen, 220);
    } finally {
      this.title = null;
      this.titleEl.hidden = true;
    }
  }

  #fillTitle() {
    const t = this.app.t;
    const index = this.chapters.findIndex(c => c.id === this.title);
    if (index < 0) return;
    clear(this.titleEl).append(h('div.tour-title-box', null,
      h('h3', null, t('tour.chapter.' + this.title))));
  }

  /** The texts of a screen inside the chapter: where it belongs, its label, its name. */
  #screenTexts() {
    const t = this.app.t;
    const { key, params } = this.screen;
    const chapter = this.chapters[this.index];
    return {
      context: chapter ? t('tour.chapter.' + chapter.id) : '',
      label: params.label ? t('tour.screen.' + params.label, params) : '',
      name: t('tour.' + key + '.title', params)
    };
  }

  #fillScreen() {
    const { context, label, name } = this.#screenTexts();
    clear(this.titleEl).append(h('div.tour-title-box.tour-screen', null,
      context ? h('div.tour-screen-context', null, context) : null,
      label ? h('div.tour-screen-label', null, label) : null,
      h('h3', null, name)));
  }

  /** A black screen inside a chapter, before the next part of it, e.g. the next cause of a problem. */
  async #screen(gen, key, params = {}) {
    if (gen !== this.gen) throw CANCELLED;
    this.#hide();
    this.screen = { key, params };
    this.#fillScreen();
    this.titleEl.hidden = false;
    this.titleEl.classList.remove('leave');
    this.#speak(() => {
      const texts = this.#screenTexts();
      return [texts.label, texts.name].filter(Boolean).map(speakable);
    });
    try {
      const { label, name } = this.#screenTexts();
      await this.#sleep(gen, screenTime(label + ' ' + name), { skippable: true, hold: true });
      this.#silence();
      this.titleEl.classList.add('leave');
      await this.#sleep(gen, 220);
    } finally {
      this.screen = null;
      this.titleEl.hidden = true;
      this.titleEl.classList.remove('leave');
    }
  }

  /** Every chapter starts from the process as the tutorial ships it. */
  #prepare() {
    const { app } = this;
    this.#hide();
    app.reset();
    app.setTab('process');
    app.select(null);
    app.setInscriptionOpen(false);
    app.setPanelOpen(false);
  }

  /** The animation engines of all canvases. */
  #effects() {
    return Object.keys(this.app.stages).map(doc => this.app.stages[doc].effects);
  }

  async #halt() {
    this.gen++;
    if (this.abort) this.abort();
    this.#silence();
    this.#effects().forEach(fx => { fx.paused = false; }); // a paused animation would never finish, and neither would what waits for it
    this.app.stop();
    this.app.cancelEffects();
    this.#hide();
    this.titleEl.hidden = true;
    await this.playing;
  }

  #finish(withCard) {
    const { app } = this;
    this.state = 'done';
    this.setPaused(false);
    this.#hide();
    this.#closeCard();
    app.reset();
    app.setTab('process');
    app.setMode('explore');
    this.renderPlayer();
    if (withCard) this.#showEnd();
  }

  /** Leaves the walkthrough for the editable simulator. */
  async skip() {
    await this.#halt();
    this.#finish(false);
  }

  setPaused(paused) {
    this.paused = paused;
    this.#effects().forEach(fx => { fx.paused = paused; });
    if (!paused) this.app.viewStage().invalidate();
    this.noteEl.classList.toggle('paused', paused);
    if (this.speech) {
      if (paused) this.speech.pause();
      else this.speech.resume(); // says the sentence it stopped in again
    }
    this.renderPlayer();
  }

  togglePause() {
    if (this.state === 'playing') this.setPaused(!this.paused);
  }

  /** Ends the current note right away. */
  next() {
    if (this.state !== 'playing') return;
    this.advance = true;
    if (this.paused) this.setPaused(false);
  }

  /**
   * Replays the chapter, or the part that is playing; from its very beginning, goes to the
   * previous one (the part before, or the chapter's start before its first part).
   */
  back() {
    if (this.state !== 'playing') return;
    const atStart = this.notes <= 1;
    if (this.part >= 0) {
      if (!atStart) this.start(this.index, this.part);
      else if (this.part > 0) this.start(this.index, this.part - 1);
      else this.start(this.index);
      return;
    }
    this.start(atStart && this.index > 0 ? this.index - 1 : this.index);
  }

  /** Turns the voice off, or on again: then it says what is showing from its beginning. */
  toggleVoice() {
    if (!this.voice) return;
    this.voice.on = !this.voice.on;
    if (this.voice.on && this.say) this.#speak(this.say);
    else if (!this.voice.on) {
      this.speech = null;
      this.#mark(-1);
    }
    this.renderPlayer();
    const button = this.app.playerEl.querySelector('.tour-voice');
    if (button) button.focus({ preventScroll: true });
  }

  /** The player's voice button: on, off, or unavailable when the browser has no voice for the language. */
  #voiceButton() {
    const t = this.app.t;
    const can = this.voice.canSpeak(this.app.lang);
    const on = can && this.voice.on;
    const label = !can ? t('tour.voice.none') : t(on ? 'tour.voice.off' : 'tour.voice.on');
    return h('button.icon-btn.tour-voice' + (on ? '.on' : '') + (can ? '' : '.inert'), {
      type: 'button', title: label, 'aria-label': label, 'aria-pressed': can ? String(on) : null, disabled: !can,
      onclick: () => this.toggleVoice()
    }, icon(on ? 'sound' : 'mute', 15));
  }

  renderPlayer() {
    const { app } = this;
    const t = app.t;
    const el = clear(app.playerEl);
    if (this.state !== 'playing') return;
    const total = this.chapters.length;
    const button = (name, label, handler, extra = '') => h('button.icon-btn' + extra, { type: 'button', title: label, 'aria-label': label, onclick: handler }, icon(name, 15));
    el.append(
      button(this.paused ? 'play' : 'pause', t(this.paused ? 'tour.resume' : 'tour.pause'), () => this.togglePause(), '.tour-toggle'),
      button('chevronLeft', t(this.part >= 0 ? 'tour.backPart' : 'tour.back'), () => this.back()),
      button('chevronRight', t('tour.next'), () => this.next()),
      this.voice ? this.#voiceButton() : null,
      h('div.tour-chapters', {
        role: 'list',
        // a mouse wheel scrolls the list sideways when it does not fit
        onwheel: e => {
          const list = e.currentTarget;
          if (list.scrollWidth <= list.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
          list.scrollLeft += e.deltaY;
          e.preventDefault();
        }
      }, this.chapters.map((c, i) => {
        const title = t('tour.chapter.' + c.id);
        const current = i === this.index;
        const chapterButton = h('button.tour-chapter' + (current ? '.current' : i < this.index ? '.done' : '') + (current && c.parts ? '.has-parts' : ''), {
          type: 'button', role: 'listitem', title, 'aria-label': t('tour.chapter', { n: i + 1, total }) + ': ' + title,
          'aria-current': current && this.part < 0 ? 'step' : null, onclick: () => this.start(i)
        }, h('span.tour-chapter-n', null, String(i + 1)), h('span.tour-chapter-title', null, title));
        if (!current || !c.parts || !c.parts.length) return chapterButton;
        // the parts of the chapter that is playing: 1.1, 1.2, …; the current one shows its name
        return h('div.tour-chapter-group', { role: 'listitem' }, chapterButton,
          h('div.tour-parts', { role: 'list', 'aria-label': title }, c.parts.map((part, p) => {
            const label = (c.label ? t('tour.screen.' + c.label, { n: p + 1, total: c.parts.length }) + ': ' : '') + t('tour.' + part.id + '.title');
            const state = p === this.part ? '.current' : p < this.part ? '.done' : '';
            return h('button.tour-part' + state, {
              type: 'button', role: 'listitem', title: label, 'aria-label': label,
              'aria-current': p === this.part ? 'step' : null, onclick: () => this.start(i, p)
            }, h('span.tour-part-n', null, (i + 1) + '.' + (p + 1)),
            p === this.part ? h('span.tour-part-title', null, t('tour.' + part.id + '.title')) : null);
          })));
      })),
      h('span.spacer'),
      h('button.tour-exit', { type: 'button', onclick: () => this.skip() }, h('span', null, t('tour.exit')), icon('close', 12)));
    // when the chapters do not fit, the list scrolls: keep what is playing in the middle of it
    const list = el.querySelector('.tour-chapters');
    const active = el.querySelector('.tour-part.current') || el.querySelector('.tour-chapter.current');
    if (list && active) {
      requestAnimationFrame(() => {
        const a = active.getBoundingClientRect();
        const l = list.getBoundingClientRect();
        if (l.width) list.scrollLeft += a.left + a.width / 2 - (l.left + l.width / 2);
        list.classList.toggle('scrolls', list.scrollWidth > list.clientWidth + 1); // fades its edges
      });
    }
  }

  /** Rebuilds everything that carries text (language switch). */
  render() {
    this.renderPlayer();
    if (this.cardKind === 'intro') this.showIntro();
    else if (this.cardKind === 'end') this.#showEnd();
    if (this.title) this.#fillTitle();
    if (this.screen) this.#fillScreen();
    if (this.current) this.#fill(this.current);
    if (this.say) this.#speak(this.say); // from the beginning, in the new language
  }

  // ── the voice ──────────────────────────────────────────────────────────────

  /**
   * Has the voice say what is showing, when it is on. `say()` gives the parts to say in the
   * current language; for a note, part 0 is its title and part k its k-th sentence, which is
   * marked while it is said.
   */
  #speak(say) {
    this.say = say;
    this.speech = null;
    this.#mark(-1);
    if (!this.voice) return;
    this.speech = this.voice.on ? this.voice.say(say(), this.app.lang, part => this.#mark(part - 1)) : null;
    if (this.speech && this.paused) this.speech.pause();
  }

  /** Stops the voice: what it was saying is gone. */
  #silence() {
    this.say = null;
    this.speech = null;
    if (this.voice) this.voice.stop();
    this.#mark(-1);
  }

  /** Marks sentence k of the note as being said, those before as said; -1 (or past the end) clears. */
  #mark(k) {
    const live = k >= 0 && k < this.sayEls.length;
    this.sayEls.forEach((el, i) => {
      el.classList.toggle('said', live && i < k);
      el.classList.toggle('saying', live && i === k);
    });
  }

  /** The voice is still speaking, or has just finished (a short breath before moving on). */
  #held() {
    const s = this.speech;
    return Boolean(s) && (!s.done || (s.endedAt > 0 && Date.now() - s.endedAt < 450));
  }

  // ── the director handed to a chapter ───────────────────────────────────────

  #director(gen) {
    const { app } = this;
    const alive = () => { if (gen !== this.gen) throw CANCELLED; };
    // the layout changed: wait for it, then bring the whole process back into view
    const settle = async () => {
      await this.#sleep(gen, 260);
      await this.#refit();
      alive();
      await this.#sleep(gen, 120);
    };
    return {
      app,
      wait: ms => this.#sleep(gen, ms),
      note: (key, options) => this.#note(gen, key, options),
      screen: (key, params) => this.#screen(gen, key, params),
      focus: target => { alive(); this.#show(null, parseTarget(target)); },
      clear: () => { alive(); this.#hide(); },
      run: options => this.#run(gen, options),
      stop: () => { alive(); app.stop(); },
      answer: async text => {
        alive();
        const dialog = app.dialog;
        if (!dialog) return;
        this.#show(null, parseTarget('dialog'));
        await this.#sleep(gen, 500);
        const steps = Math.min(text.length, 40);
        for (let k = 1; k <= steps; k++) {
          dialog.setAnswer(text.slice(0, Math.round(text.length * k / steps)));
          await this.#sleep(gen, Math.max(35, Math.round(1800 / steps)));
        }
        await this.#sleep(gen, 800);
        this.#hide();
        if (app.dialog === dialog) dialog.submit();
      },
      reset: () => { alive(); this.#prepare(); },
      edit: (target, change) => this.#edit(gen, target, change),
      open: async (id, tab) => {
        alive();
        const el = elementById(app.model, id);
        app.setTab(el.doc);
        if (tab) app.state.inscriptionTabs[id] = tab;
        if (app.state.selection === id) app.state.selection = null; // selected again: render it anew
        app.select(id);
        app.setInscriptionOpen(true);
        if (tab) app.setInscriptionTab(el, tab);
        await settle();
      },
      close: async () => {
        alive();
        this.#hide();
        app.setInscriptionOpen(false);
        app.select(null);
        await settle();
      },
      panel: async tab => {
        alive();
        if (tab) app.setPanelTab(tab);
        app.setPanelOpen(Boolean(tab));
        await settle();
      },
      tab: async id => {
        alive();
        this.#hide();
        app.setTab(id);
        await this.#sleep(gen, 500);
      }
    };
  }

  /** Brings the whole process back into view after the canvas changed size. */
  #refit() {
    const stage = this.app.stages[this.app.state.tab];
    if (!stage) return Promise.resolve();
    stage.resize();
    return !stage.view.tilt && !stage.effects.agent ? stage.fit({ animate: true }) : Promise.resolve();
  }

  async #run(gen, { fast = false, on = {}, runIndex = null, start = null } = {}) {
    const { app } = this;
    if (gen !== this.gen) throw CANCELLED;
    this.#hide();
    const hooks = {};
    Object.keys(on).forEach(name => {
      hooks[name] = async payload => {
        try { await on[name](payload); } catch (e) { if (e !== CANCELLED) throw e; }
      };
    });
    const stages = Object.keys(app.stages).map(doc => app.stages[doc]);
    app.runHooks = hooks;
    stages.forEach(stage => stage.setSpeed((fast ? FAST : 1) * this.pace));
    let result;
    try {
      result = await app.run({ runIndex, start });
    } finally {
      app.runHooks = null;
      stages.forEach(stage => stage.setSpeed(1));
    }
    if (gen !== this.gen) throw CANCELLED;
    return result || { status: 'cancelled', agentCalls: [] };
  }

  /**
   * Types a change into a field. The spotlight first rests on the characters that are about
   * to go (or on the place where text will be added), then they are removed and the new ones
   * written, one step at a time, with the spotlight following.
   */
  async #edit(gen, target, change) {
    const { app } = this;
    if (gen !== this.gen) throw CANCELLED;
    let get;
    let set;
    let control;
    let spot;
    if (target === 'vars') {
      get = () => app.variablesText;
      set = v => app.setVariables(v);
      control = () => app.variablesCode;
      spot = { kind: 'vars', name: '', line: '' };
    } else if (target.startsWith('src:')) {
      const id = target.slice(4);
      get = () => app.sourceText[id];
      set = v => app.setSource(id, v);
      control = () => app.sourceCode[id];
      spot = { kind: 'src', name: id, line: '' };
    } else {
      const [id, key] = target.split('.');
      const el = elementById(app.model, id);
      control = () => app.inscription.controls[key];
      spot = { kind: 'field', name: target, line: '' };
      if (key === 'code') {
        get = () => (el.config.output && el.config.output.code) || '';
        set = v => {
          app.changeElement(el, e => { e.config.output = { ...(e.config.output || {}), code: v }; }, 'code');
          if (control()) control().setValue(v);
        };
      } else if (key === 'tags') {
        // the tags of an element, as a comma-separated list
        get = () => (el.tags || []).join(',');
        set = v => {
          app.changeElement(el, e => { e.tags = v ? String(v).split(',') : []; }, 'tags');
          app.inscription.render();
        };
      } else if (el.isAgent) {
        get = () => agentConfig(el)[key] || '';
        set = v => {
          app.setAgentConfig(el, key, v);
          if (control()) control().setValue(v);
        };
      } else {
        // a setting of any other element, e.g. the signature of a sub-process start
        get = () => el.config[key] || '';
        set = v => {
          app.changeElement(el, e => { e.config[key] = v; }, key);
          if (control()) control().setValue(v);
        };
      }
    }
    const from = get();
    const to = typeof change === 'function' ? change(from) : change;
    if (to === from) return;
    if (!control() || typeof control().textRect !== 'function') {
      // a choice, not text: there is nothing to type
      set(to);
      await this.#sleep(gen, 500);
      return;
    }
    let p = 0;
    while (p < from.length && p < to.length && from[p] === to[p]) p++;
    let s = 0;
    while (s < from.length - p && s < to.length - p && from[from.length - 1 - s] === to[to.length - 1 - s]) s++;
    const head = from.slice(0, p);
    const tail = from.slice(from.length - s);
    const removed = from.length - p - s;
    const added = to.length - p - s;
    // the changing characters are [p, p + n) of the field's value
    const mark = n => { if (this.target) this.target.range = [p, p + n]; };
    this.#show(null, { ...spot, range: [p, p + removed] });
    await this.#sleep(gen, removed ? 900 : 500);
    const out = Math.min(removed, 16);
    for (let k = 1; k <= out; k++) {
      const left = removed - Math.round(removed * k / out);
      set(head + from.slice(p, p + left) + tail);
      mark(left);
      await this.#sleep(gen, typingTime(out));
    }
    if (out && added) await this.#sleep(gen, 250);
    const steps = Math.min(added, 28);
    for (let k = 1; k <= steps; k++) {
      const n = Math.round(added * k / steps);
      set(head + to.slice(p, p + n) + tail);
      mark(n);
      await this.#sleep(gen, typingTime(steps));
    }
    set(to);
    mark(added);
    await this.#sleep(gen, 600);
  }

  // ── notes ──────────────────────────────────────────────────────────────────

  async #note(gen, key, { target = null, params = null, quote = '', wait = null, extra = 0 } = {}) {
    if (gen !== this.gen) throw CANCELLED;
    this.notes++;
    const note = { key, params, quote };
    this.#show(note, parseTarget(target));
    const t = this.app.t;
    const manual = wait == null && this.app.reducedMotion;
    this.noteEl.classList.toggle('manual', manual);
    const ms = wait != null ? wait : readingTime(t('tour.' + key + '.title') + ' ' + t('tour.' + key + '.text', params || {})) + Math.min(1200, quoteText(quote).length * 5) + extra;
    // the voice reads the title, then the text; the quote is left to the eyes
    this.#speak(() => [this.app.t('tour.' + key + '.title', params || {}), ...sentences(this.app.t('tour.' + key + '.text', params || {}))].map(speakable));
    await this.#sleep(gen, ms, { skippable: true, progress: true, manual, hold: true });
    this.#silence();
    this.#hide();
  }

  #fill(note) {
    const t = this.app.t;
    this.bar = h('i');
    // the text sentence by sentence, so the voice can mark the one it is saying
    this.sayEls = sentences(t('tour.' + note.key + '.text', note.params || {})).map(part => h('span.tour-say', null, rich(part)));
    let quote = null;
    if (Array.isArray(note.quote)) {
      quote = h('div.tour-note-quote', null, note.quote.map(line => h('div' + (line.wrong ? '.wrong' : ''), null,
        line.text || '\u00a0', line.wrong ? h('span.tour-note-flag', null, ' ' + t('tour.quote.wrong')) : null)));
    } else if (note.quote) quote = h('div.tour-note-quote', null, excerpt(note.quote));
    append(clear(this.noteEl), [
      h('div.tour-note-title', null, t('tour.' + note.key + '.title', note.params || {})),
      h('div.tour-note-text', null, this.sayEls),
      quote,
      h('button.tour-note-next', { type: 'button', onclick: () => this.next() }, t('tour.next'), icon('chevronRight', 12)),
      h('div.tour-note-bar', null, this.bar)]);
  }

  /** @param {Object|null} target  a parsed target; with `range`, characters [start, end) of the field's value */
  #show(note, target) {
    this.current = note;
    this.target = target;
    this.#reveal();
    if (note) {
      this.#fill(note);
      this.noteEl.hidden = false;
      this.noteEl.classList.remove('enter');
      void this.noteEl.offsetWidth;
      this.noteEl.classList.add('enter');
    } else this.noteEl.hidden = true;
    this.#place();
    if (!this.tracking) {
      const loop = () => { this.#place(); this.tracking = requestAnimationFrame(loop); };
      this.tracking = requestAnimationFrame(loop);
    }
  }

  #hide() {
    cancelAnimationFrame(this.tracking);
    this.tracking = 0;
    this.current = null;
    this.sayEls = [];
    this.target = null;
    this.noteEl.hidden = true;
    this.spotEl.hidden = true;
  }

  #editor(target) {
    const { app } = this;
    if (target.kind === 'vars') return app.variablesCode;
    if (target.kind === 'src') return app.sourceCode[target.name] || null;
    const node = app.inscriptionEl.querySelector('[data-tour="' + target.name.split('.').pop() + '"]');
    return node ? node.querySelector('.code') : null;
  }

  /**
   * The characters of a field's value that the target means, as [start, end), or null when
   * it means the whole field or a line: a range given by #edit, or the text after "@" in a
   * field that is not a code editor.
   */
  #range(target) {
    if (target.range) return target.range;
    if (target.kind !== 'field' || !target.line) return null;
    const [id, key] = target.name.split('.');
    const el = elementById(this.app.model, id);
    if (key === 'code' || !el || !el.isAgent) return null;
    const at = String(agentConfig(el)[key] || '').indexOf(target.line);
    return at < 0 ? null : [at, at + target.line.length];
  }

  /** Where those characters are on screen, or null. */
  #textRect(target) {
    const range = this.#range(target);
    if (!range) return null;
    const control = target.kind === 'vars' ? this.app.variablesCode
      : target.kind === 'src' ? this.app.sourceCode[target.name]
        : this.app.inscription.controls[target.name.split('.').pop()];
    const r = control && typeof control.textRect === 'function' ? control.textRect(range[0], range[1]) : null;
    return r && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height, exact: true } : null;
  }

  /** Scrolls the target into view inside its own scroll container (never the page). */
  #reveal() {
    const { app } = this;
    const target = this.target;
    if (!target) return;
    if (target.kind === 'log') {
      app.panel.logView.scrollTop = app.panel.logView.scrollHeight;
      return;
    }
    if (target.kind === 'view') {
      const view = app.views[target.name];
      if (view && view.reveal) view.reveal(target.line);
      return;
    }
    if (target.kind === 'chat') {
      const node = this.#chatPart(target);
      const view = app.panel.chatView;
      if (node && node !== view) {
        const n = node.getBoundingClientRect();
        const b = view.getBoundingClientRect();
        if (n.top < b.top || n.bottom > b.bottom) view.scrollTop += n.top - b.top - 4;
      }
      return;
    }
    if (target.kind === 'data') {
      const row = app.panel.dataView.querySelector('[data-field="' + target.name + '"]');
      if (row) app.panel.dataView.scrollTop = Math.max(0, row.offsetTop - 2);
      return;
    }
    if (target.kind === 'field') {
      const node = app.inscriptionEl.querySelector('[data-tour="' + target.name.split('.').pop() + '"]');
      const body = app.inscriptionEl.querySelector('.inscription-body');
      if (node && body) {
        const n = node.getBoundingClientRect();
        const b = body.getBoundingClientRect();
        if (n.top < b.top + 8 || n.bottom > b.bottom - 8) body.scrollTop += n.top - b.top - 12;
      }
    }
    if ((target.line || target.range) && (target.kind === 'field' || target.kind === 'vars' || target.kind === 'src')) {
      const editor = this.#editor(target);
      const lineOf = at => editor.textarea.value.slice(0, at).split('\n').length - 1;
      const i = !editor ? -1 : target.range ? lineOf(target.range[0]) : lineIndex(editor, target.line);
      if (i >= 0) {
        const lh = parseFloat(getComputedStyle(editor).lineHeight) || 18;
        editor.scrollTop = Math.max(0, 6 + i * lh - editor.clientHeight / 2 + lh / 2);
      }
    }
  }

  /** The part of the Conversation panel a 'chat' target means: the panel itself without a name. */
  #chatPart(target) {
    const view = this.app.panel.chatView;
    if (!target.name) return view;
    const selector = target.name === 'head' ? '.chat-head' : target.name === 'guards' ? '.guards' : '.msg.' + target.name + ':not(.before)';
    const all = [...view.querySelectorAll(selector)];
    const i = target.line === 'last' ? all.length - 1 : Number(target.line) || 0;
    return all[i] || null;
  }

  /** The target's box on screen, or null when there is nothing to point at. */
  #rect(target) {
    const { app } = this;
    const box = r => (r && r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null);
    const line = editor => {
      const i = lineIndex(editor, target.line);
      const outer = editor.getBoundingClientRect();
      if (i < 0) return box(outer);
      const lh = parseFloat(getComputedStyle(editor).lineHeight) || 18;
      const body = editor.querySelector('.code-body').getBoundingClientRect();
      const left = editor.querySelector('.code-gutter').getBoundingClientRect().right;
      const top = clamp(body.top + 6 + i * lh, outer.top, outer.bottom - lh);
      return box({ left, top, width: outer.right - left - 2, height: lh });
    };
    switch (target.kind) {
      case 'el': {
        const el = elementById(app.model, target.name);
        const stage = el ? app.stages[el.doc] : null; // the canvas of the element's file, when it is the open tab
        if (!el || app.state.tab !== el.doc || !stage.width) return null;
        const b = elementBounds(el);
        const a = stage.worldToClient(b.x, b.y);
        const c = stage.worldToClient(b.x + b.w, b.y + b.h);
        return box({ left: Math.min(a.x, c.x), top: Math.min(a.y, c.y), width: Math.abs(c.x - a.x), height: Math.abs(c.y - a.y) });
      }
      case 'field': {
        const node = app.inscriptionEl.querySelector('[data-tour="' + target.name.split('.').pop() + '"]');
        if (!node) return null;
        const editor = target.line ? node.querySelector('.code') : null;
        return this.#textRect(target) || (editor ? line(editor) : box(node.getBoundingClientRect()));
      }
      case 'src': {
        const code = app.sourceCode[target.name];
        if (!code || app.state.tab !== 'src:' + target.name) return null;
        return this.#textRect(target) || (target.line ? line(code) : box(code.getBoundingClientRect()));
      }
      case 'vars':
        if (!app.variablesCode) return null;
        return this.#textRect(target) || (target.line ? line(app.variablesCode) : box(app.variablesCode.getBoundingClientRect()));
      case 'log': {
        const lines = app.panel.logView.querySelectorAll('.log-line');
        return lines.length ? box(lines[lines.length - 1].getBoundingClientRect()) : box(app.panel.logView.getBoundingClientRect());
      }
      case 'data': {
        const row = app.panel.dataView.querySelector('[data-field="' + target.name + '"]');
        const view = app.panel.dataView.getBoundingClientRect();
        if (!row) return box(view);
        // only the part of the row that the panel shows
        const r = row.getBoundingClientRect();
        const top = Math.max(r.top, view.top);
        return box({ left: r.left, top, width: r.width, height: Math.min(r.bottom, view.bottom) - top });
      }
      case 'chat': {
        const node = this.#chatPart(target);
        const view = app.panel.chatView.getBoundingClientRect();
        if (!node || app.state.panelTab !== 'chat') return null;
        // only the part that the panel shows
        const r = node.getBoundingClientRect();
        const top = Math.max(r.top, view.top);
        return box({ left: r.left, top, width: r.width, height: Math.min(r.bottom, view.bottom) - top });
      }
      case 'view': {
        const view = app.views[target.name];
        if (!view || app.state.tab !== 'view:' + target.name) return null;
        const node = view.rect(target.line);
        return node ? box(node.getBoundingClientRect()) : null;
      }
      case 'side':
        return app.variablesInfo ? box(app.variablesInfo.getBoundingClientRect()) : null;
      case 'dialog':
        return app.dialog ? box(app.dialog.box.getBoundingClientRect()) : null;
      default:
        return null;
    }
  }

  /** Puts the spotlight on the target and the note beside it. */
  #place() {
    const { app } = this;
    const layer = app.layer.getBoundingClientRect();
    if (!layer.width) return;
    const r = this.target ? this.#rect(this.target) : null;
    const spot = this.spotEl;
    if (r) {
      const exact = Boolean(r.exact); // around characters, not around a field
      const pad = exact ? 3 : this.target.line ? 2 : 5;
      const side = exact ? 1 : pad; // the frame must not cover the neighbouring characters
      spot.classList.toggle('text', exact);
      spot.hidden = false;
      spot.style.transform = 'translate(' + Math.round(r.left - layer.left - side) + 'px,' + Math.round(r.top - layer.top - pad) + 'px)';
      spot.style.width = Math.round(r.width + side * 2) + 'px';
      spot.style.height = Math.round(r.height + pad * 2) + 'px';
    } else spot.hidden = true;

    const note = this.noteEl;
    if (note.hidden) return;
    const w = note.offsetWidth;
    const ht = note.offsetHeight;
    const floor = layer.height - app.playerEl.offsetHeight - 8;
    let x;
    let y;
    let side = 'dock';
    let arrow = 0;
    if (r) {
      const gap = 16;
      const left = r.left - layer.left;
      const top = r.top - layer.top;
      const fits = {
        bottom: top + r.height + gap + ht <= floor,
        top: top - gap - ht >= 8,
        left: left - gap - w >= 8,
        right: left + r.width + gap + w <= layer.width - 8
      };
      // beside characters the note goes below or above: to their left is the rest of the field
      const order = r.exact ? ['bottom', 'top', 'left', 'right'] : SIDES[this.target.kind];
      side = order.find(s => fits[s]) || order[0];
      const cx = left + r.width / 2;
      const cy = top + r.height / 2;
      if (side === 'bottom' || side === 'top') {
        x = clamp(cx - w / 2, 8, Math.max(8, layer.width - w - 8));
        y = side === 'bottom' ? top + r.height + gap : top - gap - ht;
        arrow = clamp(cx - x, 18, w - 18);
      } else {
        x = side === 'left' ? left - gap - w : left + r.width + gap;
        y = clamp(cy - ht / 2, 8, Math.max(8, floor - ht));
        arrow = clamp(cy - y, 18, ht - 18);
      }
      y = clamp(y, 8, Math.max(8, floor - ht));
    } else {
      const host = app.canvasHost.getBoundingClientRect();
      const area = host.width > 0 ? host : layer;
      // bottom left: the middle of the canvas is where the agent and the model are
      x = clamp(area.left - layer.left + 16, 8, Math.max(8, layer.width - w - 8));
      y = clamp(area.bottom - layer.top - ht - 16, 8, Math.max(8, floor - ht));
    }
    note.dataset.side = side;
    note.style.setProperty('--arrow', Math.round(arrow) + 'px');
    note.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }

  // ── time ───────────────────────────────────────────────────────────────────

  /**
   * Waits `ms` of playing time: paused time does not count. `skippable` waits end when
   * "Next" is pressed; `manual` ones only then (reduced motion: nothing moves by itself);
   * `hold` ones also wait for the voice to finish what it is saying.
   */
  #sleep(gen, ms, { skippable = false, progress = false, manual = false, hold = false } = {}) {
    if (gen !== this.gen) return Promise.reject(CANCELLED);
    if (skippable) this.advance = false;
    return new Promise((resolve, reject) => {
      let elapsed = 0;
      let last = performance.now();
      let raf = 0;
      this.abort = () => {
        cancelAnimationFrame(raf);
        this.abort = null;
        reject(CANCELLED);
      };
      const tick = now => {
        const dt = Math.min(80, now - last);
        last = now;
        if (!this.paused) elapsed += dt * this.pace;
        // with the voice, the bar follows whichever takes longer: the reading time or the voice
        const share = Math.min(1, elapsed / ms, hold && this.speech ? this.speech.progress() : 1);
        if (progress && this.bar) this.bar.style.width = (manual ? 0 : share * 100) + '%';
        if ((skippable && this.advance) || (!manual && elapsed >= ms && !(hold && this.#held()))) {
          if (skippable) this.advance = false;
          this.abort = null;
          resolve();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
  }

  dispose() {
    this.gen++;
    if (this.abort) this.abort();
    this.#silence();
    if (this.voice) this.voice.dispose();
    this.playing.catch(() => {});
    cancelAnimationFrame(this.tracking);
    this.app.playerEl.removeEventListener('keydown', this.onKey);
  }
}

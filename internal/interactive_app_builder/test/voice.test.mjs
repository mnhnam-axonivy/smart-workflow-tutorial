import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';

import { Voice, sentences, speakable, pickVoice } from '../runtime/ui/voice.js';
import { strings } from '../features/feature-01/text.js';

/** Every lesson with a walkthrough: { id, strings, tour }. */
const features = new URL('../features/', import.meta.url);
const lessons = await Promise.all(readdirSync(features)
  .filter(dir => existsSync(new URL(dir + '/tour.js', features)))
  .map(async dir => ({
    id: dir,
    strings: (await import(new URL(dir + '/text.js', features))).strings,
    tour: (await import(new URL(dir + '/tour.js', features))).tour
  })));

const VOICES = [
  { name: 'Microsoft David - English (United States)', lang: 'en-US', default: true },
  { name: 'Google US English', lang: 'en-US' },
  { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US' },
  { name: 'Microsoft Haruka - Japanese', lang: 'ja-JP' }
];

/**
 * A speech engine that speaks nothing: an utterance starts after `startMs` and ends after
 * `ms`, unless `silent` (it never starts) or cancelled.
 */
function fakeEngine({ voices = VOICES, ms = 15, startMs = 2, silent = false, error = null } = {}) {
  const engine = {
    said: [],
    cancels: 0,
    current: null,
    listeners: [],
    startTimeout: 60,
    Utterance: class { constructor(text) { this.text = text; } },
    synth: {
      paused: false,
      getVoices: () => voices,
      addEventListener: (type, fn) => engine.listeners.push(fn),
      removeEventListener: (type, fn) => { engine.listeners = engine.listeners.filter(l => l !== fn); },
      speak(u) {
        engine.said.push(u.text);
        engine.current = u;
        if (silent) return;
        setTimeout(() => {
          if (engine.current !== u) return;
          if (error) { u.onerror({ error }); return; }
          u.onstart();
          u.timer = setTimeout(() => { if (engine.current === u) { engine.current = null; u.onend(); } }, ms);
        }, startMs);
      },
      cancel() {
        engine.cancels++;
        const u = engine.current;
        engine.current = null;
        if (u) { clearTimeout(u.timer); u.onerror({ error: 'interrupted' }); }
      }
    }
  };
  return engine;
}

const until = async (condition, timeout = 2000) => {
  const end = Date.now() + timeout;
  while (!condition()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise(r => setTimeout(r, 5));
  }
};

test('sentences: in every lesson the parts give the text back exactly, and code is never split', () => {
  assert.deepEqual(sentences('Total is JPY 99,000.00. It works, e.g. here. 終わり。次！ `a. b` end'),
    ['Total is JPY 99,000.00. ', 'It works, e.g. here. ', '終わり。', '次！ ', '`a. b` end']);
  assert.ok(lessons.length >= 17, 'all walkthroughs are checked');
  lessons.forEach(lesson => ['en', 'ja'].forEach(lang => {
    const texts = lesson.strings[lang];
    Object.keys(texts).filter(k => /^tour\.\w+\.text$/.test(k)).forEach(key => {
      const text = texts[key];
      const parts = sentences(text);
      const where = lesson.id + ' ' + lang + ' ' + key;
      assert.equal(parts.join(''), text, where);
      parts.forEach(part => assert.equal(part.split('`').length % 2, 1, where + ': a code span is cut in two'));
      parts.map(speakable).forEach(said => assert.ok(said.length > 0, where + ': a sentence with nothing to say'));
    });
  }));
  assert.equal(sentences(strings.en['tour.systemGuess.text']).length, 3);
  assert.equal(sentences(strings.ja['tour.systemGuess.text']).length, 3);
});

test('speakable: code is read the way a developer says it; dashes and arrows become pauses', () => {
  assert.equal(speakable('`<%=in.invoiceText%>` is resolved'), 'in dot invoice Text is resolved');
  assert.equal(speakable('stored in `in.summary`.'), 'stored in in dot summary.');
  assert.equal(speakable('every AgenticProcessCall uses `DefaultProvider`'), 'every Agentic Process Call uses Default Provider');
  assert.equal(speakable('Global configuration — variables.yaml'), 'Global configuration, variables dot yaml');
  assert.equal(speakable('“a single sentence summary” → “a bullet list”'), '"a single sentence summary", "a bullet list"');
  assert.equal(speakable('The type has to end in `.class`, e.g. `tutorial.InvoiceData.class`.'), 'The type has to end in dot class, for example tutorial dot Invoice Data dot class.');
  assert.equal(speakable('A Word file (.docx), not .png・.jpg'), 'A Word file (dot docx), not dot png・dot jpg');
  assert.equal(speakable('a field items of type List<Invoice> and an APIKey, IDocument or URLs'), 'a field items of type List of Invoice and an API Key, I Document or URLs');
  assert.equal(speakable('The closing `>` is missing'), 'The closing > is missing', 'code of symbols only is read as it is');
  assert.equal(speakable('`ivy.cms.co("/Files/Documents/InvoiceSample")`'), 'ivy dot cms dot co Files Documents Invoice Sample');
  assert.equal(speakable('Phoenix at http://localhost:6006 ☕️'), 'Phoenix at localhost:6006');
  assert.equal(speakable('-Dotel.traces.exporter=otlp'), 'D otel dot traces dot exporter=otlp');
  assert.equal(speakable('JPY 99,000.00 at 0.0, in Smart Workflow 14.0.0.'), 'JPY 99,000.00 at 0.0, in Smart Workflow 14.0.0.', 'numbers stay numbers');
});

test('pickVoice: a natural voice first, then the browser vendor\'s, only of the language', () => {
  assert.equal(pickVoice(VOICES, 'en').name, 'Microsoft Aria Online (Natural) - English (United States)');
  assert.equal(pickVoice(VOICES.slice(0, 2), 'en').name, 'Google US English');
  assert.equal(pickVoice(VOICES, 'ja').name, 'Microsoft Haruka - Japanese');
  assert.equal(pickVoice([{ name: 'Kyoko', lang: 'ja_JP' }], 'ja').name, 'Kyoko');
  assert.equal(pickVoice(VOICES.slice(0, 3), 'ja'), null);
  assert.equal(pickVoice([], 'en'), null);
});

test('a voice says the parts one by one, reports each, and is done after the last', async () => {
  const engine = fakeEngine();
  const voice = new Voice(engine);
  const parts = [];
  const speech = voice.say(['Mock data', 'This script stands in.', '', 'It fills the field.'], 'en', i => parts.push(i));
  assert.ok(speech && !speech.done);
  await until(() => speech.done);
  assert.deepEqual(engine.said, ['Mock data', 'This script stands in.', 'It fills the field.'], 'a blank part is skipped');
  assert.deepEqual(parts, [0, 1, 3, 4], 'each part as it starts, then the end');
  assert.ok(speech.endedAt > 0);
  assert.equal(speech.progress(), 1);
});

test('pause stops the sentence; resume says it again from its beginning', async () => {
  const engine = fakeEngine({ ms: 80 });
  const voice = new Voice(engine);
  const speech = voice.say(['One.', 'Two.'], 'en');
  await until(() => speech.started);
  speech.pause();
  assert.equal(engine.cancels, 1);
  await new Promise(r => setTimeout(r, 120));
  assert.ok(!speech.done, 'nothing goes on while paused');
  speech.resume();
  await until(() => speech.done);
  assert.deepEqual(engine.said, ['One.', 'One.', 'Two.']);
});

test('turning the voice off stops it; cancelling does not count as said', async () => {
  const engine = fakeEngine({ ms: 80 });
  const voice = new Voice(engine);
  const parts = [];
  const speech = voice.say(['One.', 'Two.'], 'en', i => parts.push(i));
  await until(() => speech.started);
  voice.on = false;
  assert.ok(speech.done && speech.endedAt === 0);
  assert.deepEqual(parts, [0], 'no end is reported for a cancelled speech');
  assert.equal(voice.say(['Three.'], 'en'), null, 'off: nothing is said');
  voice.on = true;
  assert.ok(voice.say(['Three.'], 'en'));
});

test('no voice for the language: nothing is said, and the player can tell', () => {
  const engine = fakeEngine({ voices: VOICES.slice(0, 3) });
  const voice = new Voice(engine);
  assert.ok(voice.canSpeak('en'));
  assert.ok(!voice.canSpeak('ja'));
  assert.equal(voice.say(['音声'], 'ja'), null);
  assert.equal(engine.said.length, 0);
  assert.ok(!new Voice(null).canSpeak('en'), 'a browser without speech synthesis');
});

test('voices that load late are picked up', () => {
  const voices = [];
  const engine = fakeEngine({ voices });
  let changed = 0;
  const voice = new Voice(engine, () => changed++);
  assert.ok(!voice.canSpeak('en'));
  voices.push(VOICES[0]);
  engine.listeners.forEach(fn => fn());
  assert.ok(voice.canSpeak('en'));
  assert.equal(changed, 1);
  voice.dispose();
  assert.equal(engine.listeners.length, 0);
});

test('a voice that never starts is tried once more, then given up, so the walkthrough goes on', async () => {
  const engine = fakeEngine({ silent: true });
  const speech = new Voice(engine).say(['Hello.', 'World.'], 'en');
  await until(() => speech.done, 1000);
  assert.deepEqual(engine.said, ['Hello.', 'Hello.']);
});

test('a browser that wants a click first ends the speech at once', async () => {
  const engine = fakeEngine({ error: 'not-allowed' });
  const speech = new Voice(engine).say(['Hello.', 'World.'], 'en');
  await until(() => speech.done, 500);
  assert.deepEqual(engine.said, ['Hello.']);
});

test('every walkthrough has the voice: none leaves it out', () => {
  lessons.forEach(lesson => assert.notEqual(lesson.tour.voice, false, lesson.id));
});

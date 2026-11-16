/**
 * Feature 11 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const MOCK = 'fA';
const AGENT = 'f5';
const LOG_RESULT = 'fB';
const field = name => 'field:' + AGENT + '.' + name;

/** The answer line by line; a line that still shows a placeholder, or a description of one, is marked. */
const marked = text => String(text).split('\n').map(line => ({ text: line, wrong: /<[A-Z_]+_[0-9a-f]+>|\(an anonymised /.test(line) }));

/** 1 — the message, and the guardrail in both lists. */
async function both(d) {
  await d.run({
    on: {
      ['after:' + MOCK]: () => d.note('pii', { target: 'el:' + MOCK, quote: d.app.data.query }),
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('input', { target: field('inputGuardrails') });
        await d.note('output', { target: field('outputGuardrails') });
        await d.close();
        d.stop(); // what the guardrail does to the message is chapter 3
      }
    }
  });
}

/** 2 — the hint that keeps the model from rewording the placeholders. */
async function system(d) {
  await d.open(AGENT, 'configuration');
  await d.note('hint', { target: field('system') });
  await d.close();
}

/** 3 — on the way in: placeholders instead of values. */
async function receives(d) {
  await d.run({
    fast: true,
    on: {
      'agent:guard': ({ side, verdict }) => (side === 'input' ? d.note('masked', { quote: verdict.rewritten, extra: 800 }) : null),
      'agent:request': () => d.note('sent'),
      'agent:response': async ({ call }) => {
        await d.note('echo', { quote: call.answer.split('\n').map(text => ({ text })) });
        d.stop(); // what happens to the answer is the next chapter
      }
    }
  });
}

/** 4 — on the way out: the values are back. */
async function result(d) {
  await d.run({
    fast: true,
    on: {
      'agent:guard': ({ side, verdict }) => (side === 'output' ? d.note('restored', { quote: verdict.rewritten.split('\n').map(text => ({ text })), extra: 600 }) : null),
      ['after:' + LOG_RESULT]: async () => {
        await d.panel('log');
        await d.note('log', { target: 'log:last', extra: 1200 });
        await d.panel(null);
      }
    }
  });
}

/** 5 — the guardrail in one list only, and a model that rewords the placeholders. */
async function mistakes(d) {
  await d.open(AGENT, 'configuration');
  d.focus(field('outputGuardrails'));
  await d.wait(900);
  await d.edit(AGENT + '.outputGuardrails', '');
  await d.note('inputOnly', { target: field('outputGuardrails'), extra: 400 });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:mapped': ({ call }) => d.note('placeholders', { quote: marked(call.answer), extra: 800 }),
      'agent:end': () => d.stop()
    }
  });

  d.reset();
  await d.open(AGENT, 'configuration');
  await d.edit(AGENT + '.system', '');
  await d.note('noHint', { target: field('system'), extra: 400 });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:mapped': ({ call }) => d.note('paraphrased', { quote: marked(call.answer), extra: 800 }),
      'agent:end': () => d.stop()
    }
  });
}

export const tour = {
  chapters: [
    { id: 'both', play: both },
    { id: 'system', play: system },
    { id: 'receives', play: receives },
    { id: 'result', play: result },
    { id: 'mistakes', play: mistakes }
  ]
};

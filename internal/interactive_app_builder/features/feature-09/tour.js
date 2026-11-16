/**
 * Feature 09 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const AGENT = 'f5';
const BOUNDARY = 'fE'; // the Error Boundary Event on the agent
const HANDLER = 'fC'; // "Show violation"
const CODE_FIELD = 'field:' + BOUNDARY + '.errorCode';

/** 1 — the guardrail on the agent, and an answer it does not let through. */
async function add(d) {
  await d.run({
    on: {
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('guardrail', { target: 'field:' + AGENT + '.outputGuardrails' });
        await d.close();
      },
      'agent:response': ({ call }) => d.note('answer', { quote: call.answer }),
      'agent:guard': ({ verdict }) => d.note('inspects', { quote: (verdict.match && verdict.match.text) || '' }),
      'agent:blocked': async () => {
        await d.note('blocked', { quote: 'smartworkflow:guardrail:output:violation' });
        d.stop(); // what catches the error is the next chapter
      }
    }
  });
}

/** 2 — the event that catches the error. */
async function boundary(d) {
  await d.open(BOUNDARY, 'error');
  await d.note('code', { target: CODE_FIELD });
  await d.open(BOUNDARY, 'output');
  await d.note('mapping', { target: 'field:' + BOUNDARY + '.outputMap' });
  await d.close();
  await d.run({
    fast: true,
    on: {
      ['enter:' + BOUNDARY]: () => d.note('caught', { target: 'el:' + BOUNDARY }),
      ['enter:' + HANDLER]: () => d.stop()
    }
  });
}

/** 3 — what the process does with the caught error. */
async function handle(d) {
  await d.run({
    fast: true,
    on: {
      ['enter:' + HANDLER]: async () => {
        await d.open(HANDLER, 'output');
        await d.note('script', { target: 'field:' + HANDLER + '.code' });
        await d.close();
      },
      ['after:' + HANDLER]: async () => {
        await d.panel('log');
        await d.note('log', { target: 'log:last', extra: 1500 });
        await d.panel('data');
        await d.note('discarded', { target: 'data:result' });
        await d.panel(null);
      }
    }
  });
}

/** 4 — an event that waits for the wrong code catches nothing. */
async function mistakes(d) {
  await d.open(BOUNDARY, 'error');
  await d.edit(BOUNDARY + '.errorCode', code => code.replace(':output:', ':input:'));
  await d.note('wrongCode', { target: CODE_FIELD, extra: 600 });
  await d.close();
  await d.run({ fast: true });
  await d.wait(600);
  await d.note('unhandled', { target: 'el:' + AGENT, extra: 800 });
  await d.panel('log');
  await d.note('unhandledLog', { target: 'log:last', extra: 1200 });
  await d.panel(null);
}

export const tour = {
  chapters: [
    { id: 'add', play: add },
    { id: 'boundary', play: boundary },
    { id: 'handle', play: handle },
    { id: 'mistakes', play: mistakes }
  ]
};

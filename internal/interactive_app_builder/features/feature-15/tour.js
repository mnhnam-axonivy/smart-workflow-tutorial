/**
 * Feature 15 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
// the three starts of the process
const DEMO = 'f0';
const STOP_ALL = 'f20';
const RESUME_ALL = 'f30';

const AGENT = 'f5';
const BOUNDARY = 'fE'; // "Agent stopped"
const FALLBACK = 'fC'; // "Fallback: manual review"
const STOP_SCRIPT = 'f22';
const RESUME_SCRIPT = 'f32';
const SWITCH = 'vars@Enabled:';
const CODE_FIELD = 'field:' + BOUNDARY + '.errorCode';

/** Every chapter starts with the switch off; this turns it on the way the process does. */
const switchOn = d => d.run({ start: STOP_ALL, fast: true });

/** 1 — the variable, and the process while the switch is off. */
async function how(d) {
  await d.tab('variables');
  await d.note('variable', { target: SWITCH });
  await d.tab('process');
  await d.run({
    start: DEMO,
    fast: true,
    on: { 'agent:response': ({ call }) => d.note('normal', { quote: call.answer }) }
  });
}

/** 2 — the script that switches all agents off. */
async function flip(d) {
  await d.run({
    start: STOP_ALL,
    on: {
      ['enter:' + STOP_SCRIPT]: async () => {
        await d.open(STOP_SCRIPT, 'output');
        await d.note('stopAll', { target: 'field:' + STOP_SCRIPT + '.code@CircuitBreakerSignal.stopAll' });
        await d.close();
      },
      ['after:' + STOP_SCRIPT]: async () => {
        await d.tab('variables');
        await d.note('on', { target: SWITCH });
        await d.note('everywhere', { target: 'side' });
        await d.tab('process');
      }
    }
  });
}

/** 3 — a stopped call, and the event that catches it. */
async function boundary(d) {
  await switchOn(d);
  await d.run({
    start: DEMO,
    fast: true,
    on: {
      'agent:guard': () => d.note('stopped'),
      'agent:blocked': () => d.note('stopCode', { quote: 'smartworkflow:stop' }),
      ['enter:' + BOUNDARY]: async () => {
        await d.open(BOUNDARY, 'error');
        await d.note('catches', { target: CODE_FIELD });
        await d.close();
        d.stop(); // the fallback is the next chapter
      }
    }
  });
}

/** 4 — what the process does instead. */
async function fallback(d) {
  await switchOn(d);
  await d.run({
    start: DEMO,
    fast: true,
    on: {
      ['enter:' + FALLBACK]: async () => {
        await d.open(FALLBACK, 'output');
        await d.note('script', { target: 'field:' + FALLBACK + '.code' });
        await d.close();
      },
      ['after:' + FALLBACK]: async () => {
        await d.panel('log');
        await d.note('log', { target: 'log:last', extra: 1200 });
        await d.panel('data');
        await d.note('flag', { target: 'data:isStopped' });
        await d.panel(null);
      }
    }
  });
}

/** 5 — switching back on brings nothing back. */
async function cancelled(d) {
  await switchOn(d);
  await d.run({ start: DEMO, fast: true });
  await d.note('ended', { target: 'el:' + FALLBACK });
  await d.run({
    start: RESUME_ALL,
    fast: true,
    on: {
      ['after:' + RESUME_SCRIPT]: async () => {
        await d.tab('variables');
        await d.note('off', { target: SWITCH });
        await d.tab('process');
      }
    }
  });
  await d.note('notResumed', { target: 'el:' + FALLBACK });
  await d.run({
    start: DEMO,
    fast: true,
    on: { 'agent:response': ({ call }) => d.note('newRun', { quote: call.answer }) }
  });
}

/** 6 — an event for a guardrail violation does not catch a stop. */
async function mistakes(d) {
  await d.open(BOUNDARY, 'error');
  await d.edit(BOUNDARY + '.errorCode', 'smartworkflow:guardrail:input:violation');
  await d.note('wrongCode', { target: CODE_FIELD, extra: 600 });
  await d.close();
  await switchOn(d);
  await d.run({ start: DEMO, fast: true });
  await d.wait(600);
  await d.note('unhandled', { target: 'el:' + AGENT, extra: 800 });
}

export const tour = {
  chapters: [
    { id: 'how', play: how },
    { id: 'flip', play: flip },
    { id: 'boundary', play: boundary },
    { id: 'fallback', play: fallback },
    { id: 'cancelled', play: cancelled },
    { id: 'mistakes', play: mistakes }
  ]
};

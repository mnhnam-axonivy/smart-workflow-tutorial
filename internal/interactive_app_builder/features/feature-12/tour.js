/**
 * Feature 12 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do. The process is the one of Human in the Loop.
 */
const HIGH = 'f0'; // start of the invoice above the limit
const MOCK = 'fA';
const AGENT = 'f5';
const USER_TASK = 'f26';
const MEMORY = 'data:aiMemoryId';

/** What the person at the user task types in the walkthrough. */
const REASON = 'Approved - covered by the Q3 infrastructure budget.';

/** Shows a note on the memory id in the Process data view. */
async function onMemory(d, key, options = {}) {
  await d.panel('data');
  await d.note(key, { target: MEMORY, ...options });
  await d.panel(null);
}

/** 1 — the field. */
async function field(d) {
  await d.run({
    start: HIGH,
    on: {
      ['enter:' + AGENT]: async () => {
        await onMemory(d, 'named');
        d.stop();
      }
    }
  });
}

/** 2 — nothing to configure on the agent; the id appears by itself. */
async function runAgent(d) {
  await d.open(AGENT, 'configuration');
  await d.note('nothingToSet');
  await d.close();
  await d.run({
    start: HIGH,
    fast: true,
    on: {
      'agent:suspended': async () => {
        await onMemory(d, 'written');
        d.stop();
      }
    }
  });
}

/** 3 — the id from the start of the process to its end. */
async function trace(d) {
  await d.run({
    start: HIGH,
    fast: true,
    on: {
      ['after:' + MOCK]: () => onMemory(d, 'traceStart'),
      'agent:suspended': ({ call }) => onMemory(d, 'traceSuspended', { params: { id: call.memoryId } }),
      ['dialog:' + USER_TASK]: async () => {
        await d.note('traceWaiting', { target: 'dialog' });
        await d.answer(REASON);
      },
      ['after:' + USER_TASK]: () => d.note('traceResolved', { target: 'el:' + USER_TASK }),
      'agent:request': ({ call }) => (call.restored ? d.note('traceResumed', { params: { id: call.memoryId } }) : null),
      'agent:response': ({ call }) => d.note('traceAnswer', { quote: call.answer }),
      ['after:' + AGENT]: () => onMemory(d, 'traceCleared')
    }
  });
}

/** 4 — an id that is thrown away between two turns. */
async function mistakes(d) {
  const code = 'field:' + USER_TASK + '.code';
  let dialogs = 0;
  await d.open(USER_TASK, 'output');
  await d.edit(USER_TASK + '.code', text => text + '\nin.aiMemoryId = "";');
  await d.note('reset', { target: code + '@in.aiMemoryId = ""', extra: 400 });
  await d.close();
  await d.run({
    start: HIGH,
    fast: true,
    on: {
      ['dialog:' + USER_TASK]: async () => {
        dialogs++;
        if (dialogs === 1) {
          await d.answer(REASON);
          return;
        }
        await d.note('forgotten', { target: 'dialog', extra: 800 });
        d.stop();
      }
    }
  });
}

export const tour = {
  chapters: [
    { id: 'field', play: field },
    { id: 'run', play: runAgent },
    { id: 'trace', play: trace },
    { id: 'mistakes', play: mistakes }
  ]
};

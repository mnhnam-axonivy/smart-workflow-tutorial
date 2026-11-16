/**
 * Feature 13 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const HIGH = 'f0'; // start of the invoice above the limit
const LOW = 'f0B'; // start of the invoice below it
const AGENT = 'f5';
const BOUNDARY = 'f32'; // Error Boundary Event "human:decision" on the agent
const USER_TASK = 'f26'; // "Provide justification"
const LOG_RESULT = 'fL';
const APPROVAL = 'fTS'; // the task "Invoice Approval"
// askUserFeedback in Feature13Tools.p.json: its start and its Error End
const TOOL = { start: 'tools-f30', end: 'tools-f32' };

/** What the person at the user task types in the walkthrough. */
const REASON = 'Cloud capacity for the Q3 product launch; budget approved by the CFO.';

const questionOf = step => String(((step.arguments || {}).feedback || {}).question || '');

/** 1 — the field the pattern rests on. */
async function memory(d) {
  await d.run({
    start: HIGH,
    on: {
      ['enter:' + AGENT]: async () => {
        await d.panel('data');
        await d.note('memoryField', { target: 'data:aiMemoryId' });
        await d.panel(null);
        d.stop();
      }
    }
  });
}

/** 2 — a tool that ends in an error. */
async function tool(d) {
  await d.tab('tools');
  await d.open(TOOL.start, 'general');
  await d.note('toolStart', { target: 'field:' + TOOL.start + '.description' });
  await d.open(TOOL.start, 'start');
  await d.note('toolParam', { target: 'field:' + TOOL.start + '.params' });
  await d.open(TOOL.end, 'error');
  await d.note('throws', { target: 'field:' + TOOL.end + '.throws' });
  await d.note('attribute', { target: 'field:' + TOOL.end + '.code' });
  await d.close();
}

/** 3 — the agent: its tool, its rule, and the event for the error. */
async function agent(d) {
  await d.open(AGENT, 'configuration');
  await d.note('toolSelected', { target: 'field:' + AGENT + '.tools' });
  await d.note('instructed', { target: 'field:' + AGENT + '.system' });
  await d.open(BOUNDARY, 'error');
  await d.note('boundaryCode', { target: 'field:' + BOUNDARY + '.errorCode' });
  await d.open(BOUNDARY, 'output');
  await d.note('boundaryMap', { target: 'field:' + BOUNDARY + '.outputMap' });
  await d.close();
}

/** 4 — a run up to the point where a person is asked. */
async function userTask(d) {
  await d.run({
    start: HIGH,
    on: {
      'agent:tool-call': ({ step }) => d.note('asks', { quote: questionOf(step) }),
      'agent:suspended': async () => {
        await d.note('suspended', { target: 'el:' + AGENT });
        await d.panel('data');
        await d.note('idWritten', { target: 'data:aiMemoryId' });
        await d.panel(null);
      },
      ['dialog:' + USER_TASK]: async () => {
        await d.note('dialogOpen', { target: 'dialog', extra: 800 });
        d.stop(); // the answer is the next chapter
      }
    }
  });
}

/** 5 — the answer, and the agent that goes on with it. */
async function resolve(d) {
  await d.run({
    start: HIGH,
    fast: true,
    on: {
      ['dialog:' + USER_TASK]: () => d.answer(REASON),
      ['after:' + USER_TASK]: async () => {
        await d.open(USER_TASK, 'output');
        await d.note('resolved', { target: 'field:' + USER_TASK + '.code@DecisionMaker(' });
        await d.close();
      },
      'agent:request': ({ call }) => (call.restored ? d.note('resumes') : null),
      'agent:response': ({ call }) => d.note('confirmed', { quote: call.answer }),
      ['pause:' + APPROVAL]: ({ name }) => d.note('approvalTask', { target: 'el:' + APPROVAL, params: { name } })
    }
  });
}

/** 6 — an invoice below the limit needs nobody. */
async function lowValue(d) {
  await d.run({
    start: LOW,
    fast: true,
    on: {
      'agent:response': ({ call }) => d.note('auto', { quote: call.answer }),
      ['after:' + LOG_RESULT]: () => d.note('sameProcess', { target: 'el:' + USER_TASK })
    }
  });
}

/** 7 — a start without the tag is no tool. */
async function mistakes(d) {
  const tags = 'field:' + TOOL.start + '.tags';
  await d.tab('tools');
  await d.open(TOOL.start, 'general');
  d.focus(tags);
  await d.wait(900);
  await d.edit(TOOL.start + '.tags', '');
  await d.note('noTag', { target: 'el:' + TOOL.start, extra: 400 });
  await d.close();
  await d.tab('process');
  await d.run({
    start: HIGH,
    fast: true,
    on: {
      'agent:response': ({ call }) => d.note('cannotAsk', { quote: call.answer, extra: 800 }),
      'agent:end': () => d.stop()
    }
  });
}

export const tour = {
  chapters: [
    { id: 'memory', play: memory },
    { id: 'tool', play: tool },
    { id: 'agent', play: agent },
    { id: 'userTask', play: userTask },
    { id: 'resolve', play: resolve },
    { id: 'lowValue', play: lowValue },
    { id: 'mistakes', play: mistakes }
  ]
};

/**
 * Appendix 05 — the walkthrough. Its chapters carry the headings of the Troubleshooting page;
 * the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for what the
 * director `d` can do.
 *
 * Every symptom is made the same way: break one thing in the Human in the Loop process, run
 * it, and read the line the Runtime Log has for it. d.reset() puts the process and
 * variables.yaml back before the next one.
 */
const HIGH = 'f0'; // the invoice above the limit: the agent asks a person
const LOW = 'f0B'; // the invoice below it: the agent answers at once
const AGENT = 'f5';
const BOUNDARY = 'f32'; // Error Boundary Event "human:decision" on the agent
const USER_TASK = 'f26'; // "Provide justification", which calls DecisionMaker.resolve()
const LOG_RESULT = 'fL';
const TOOL_START = 'tools-f30'; // askUserFeedback in Feature13Tools.p.json

const field = key => 'field:' + AGENT + '.' + key;
const QUERY = field('query');
const SYSTEM = field('system');
const TOOLS = field('tools');
const MAP = field('resultMapping');
const MODEL = field('model');
const SWITCH = 'vars@Enabled:';
const RESOLVE = 'field:' + USER_TASK + '.code@DecisionMaker(';

/** What the person at the user task types. */
const REASON = 'Cloud capacity for the Q3 product launch; budget approved by the CFO.';

/** A note on the newest line of the Runtime Log. */
async function onLog(d, key, options = {}) {
  await d.panel('log');
  await d.note(key, { target: 'log:last', extra: 500, ...options });
  await d.panel(null);
}

/** Opens the agent's Configuration and types one change into a field. */
async function change(d, key, value, note, options = {}) {
  if (key === 'model') d.app.state.sections[AGENT + ':model'] = true;
  await d.open(AGENT, 'configuration');
  d.focus(field(key));
  await d.wait(250);
  await d.edit(AGENT + '.' + key, value);
  await d.note(note, { target: options.target || field(key) });
  await d.close();
}

/** Types one change into variables.yaml. */
async function changeVariables(d, from, to, note, target) {
  await d.tab('variables');
  d.focus(target);
  await d.wait(250);
  await d.edit('vars', text => text.replace(from, to));
  await d.note(note, { target });
  await d.tab('process');
}

/** The person answers, wherever the run asks. */
const answering = d => ({ ['dialog:' + USER_TASK]: () => d.answer(REASON) });

/** 1 — the call never reaches the model, or its answer never reaches the process. */
async function noAnswer(d) {
  await d.note('logFirst');

  await changeVariables(d, 'Enabled: "false"', 'Enabled: "true"', 'breakerOn', SWITCH);
  await d.run({ start: LOW, fast: true });
  await onLog(d, 'breakerLog');
  d.reset();

  await change(d, 'query', '', 'blankQuery');
  await d.run({
    start: LOW,
    fast: true,
    on: {
      'agent:skipped': () => onLog(d, 'skippedLog'),
      ['after:' + LOG_RESULT]: () => d.note('carriesOn', { target: 'el:' + LOG_RESULT })
    }
  });
  d.reset();

  await change(d, 'resultMapping', 'in.decision', 'wrongTarget');
  await d.run({
    start: LOW,
    fast: true,
    on: { 'agent:map-failed': () => onLog(d, 'mapLog') }
  });
}

/** 2 — the agent answers, but it explains what it would do instead of doing it. */
async function unexpected(d) {
  await change(d, 'tools', '', 'noTools');
  await d.run({
    start: HIGH,
    fast: true,
    on: { 'agent:response': ({ call }) => d.note('explains', { quote: call.answer, extra: 600 }) }
  });
  d.reset();

  await d.tab('tools');
  await d.open(TOOL_START, 'general');
  d.focus('field:' + TOOL_START + '.tags');
  await d.wait(300);
  await d.edit(TOOL_START + '.tags', '');
  await d.note('noTag', { target: 'el:' + TOOL_START, extra: 300 });
  await d.close();
  await d.tab('process');
  await d.run({
    start: HIGH,
    fast: true,
    on: {
      'agent:request': ({ call }) => d.note('dropped', { quote: call.toolsNotFound.map(name => ({ text: name, wrong: true })) }),
      'agent:response': ({ call }) => d.note('neverCalls', { quote: call.answer, extra: 600 })
    }
  });
}

/** 3 — an expression that fails: in the user message the call is skipped, in the system message the rules are gone. */
async function messages(d) {
  await change(d, 'query', '<%=in.qeury%>', 'queryTypo', { target: QUERY + '@qeury' });
  await d.run({
    start: LOW,
    fast: true,
    on: { 'agent:skipped': ({ call }) => onLog(d, 'queryFailed', { quote: [{ text: call.queryError, wrong: true }] }) }
  });
  d.reset();

  await change(d, 'system', text => text.replace('exceeds $2,000', 'exceeds <%=in.limit%>'), 'systemTypo', { target: SYSTEM + '@<%=in.limit%>' });
  await d.run({
    start: HIGH,
    fast: true,
    on: {
      'agent:request': async () => {
        await d.panel('chat');
        await d.note('noSystem', { extra: 600 });
        await d.panel(null);
      },
      'agent:response': ({ call }) => d.note('withoutRules', { quote: call.answer, extra: 600 })
    }
  });
}

/** 4 — provider, key and model: each one stops the call before it is sent. */
async function configuration(d) {
  await changeVariables(d, 'DefaultProvider: "OpenAI"', 'DefaultProvider: "Open AI"', 'providerTypo', 'vars@DefaultProvider');
  await d.run({ start: LOW, fast: true });
  await onLog(d, 'unknownProvider');
  d.reset();

  await changeVariables(d, 'APIKey: "sk-..."', 'APIKey: ""', 'noKey', 'vars@APIKey');
  await d.run({ start: LOW, fast: true });
  await onLog(d, 'unauthorized');
  d.reset();

  await change(d, 'model', 'gpt-4o', 'unquoted');
  await d.run({ start: LOW, fast: true });
  await onLog(d, 'modelLog');
  await d.note('readEachCall');
}

/** 5 — DecisionMaker.resolve() says which part of the chain is missing. */
async function humanInTheLoop(d) {
  await d.open(USER_TASK, 'output');
  d.focus(RESOLVE);
  await d.wait(250);
  await d.edit(USER_TASK + '.code', code => code.replace('DecisionMaker(in.aiMemoryId)', 'DecisionMaker(in.invoiceId)'));
  await d.note('wrongId', { target: RESOLVE });
  await d.close();
  await d.run({ start: HIGH, fast: true, on: answering(d) });
  await onLog(d, 'noMemory', { extra: 900 });
  d.reset();

  await d.open(USER_TASK, 'output');
  await d.edit(USER_TASK + '.code', code => code + '\nnew DecisionMaker(in.aiMemoryId).resolve(result.answer);');
  await d.note('twice', { target: 'field:' + USER_TASK + '.code' });
  await d.close();
  await d.run({ start: HIGH, fast: true, on: answering(d) });
  await onLog(d, 'noRequest', { extra: 900 });
  await d.note('notBpm', { target: 'el:' + BOUNDARY });
}

/** 6 — a BPM error goes to the boundary event with its code, and past one with another. */
async function catchable(d) {
  await d.open(BOUNDARY, 'error');
  await d.note('boundaryCode', { target: 'field:' + BOUNDARY + '.errorCode' });
  await d.close();
  await changeVariables(d, 'Enabled: "false"', 'Enabled: "true"', 'breakerAgain', SWITCH);
  await d.run({
    start: HIGH,
    fast: true,
    on: { 'agent:blocked': () => d.note('stopCode', { quote: 'smartworkflow:stop', target: 'el:' + BOUNDARY }) }
  });
  await onLog(d, 'unhandled');
  await d.note('codes');
}

/** 7 — what the model received. */
async function observe(d) {
  await d.run({
    start: HIGH,
    fast: true,
    on: {
      'agent:suspended': async () => {
        await d.panel('chat');
        await d.note('conversation', { extra: 900 });
        await d.panel(null);
        d.stop();
      }
    }
  });
  await d.note('inTheEngine');
}

export const tour = {
  chapters: [
    { id: 'noAnswer', play: noAnswer },
    { id: 'unexpected', play: unexpected },
    { id: 'messages', play: messages },
    { id: 'configuration', play: configuration },
    { id: 'humanInTheLoop', play: humanInTheLoop },
    { id: 'catchable', play: catchable },
    { id: 'observe', play: observe }
  ]
};

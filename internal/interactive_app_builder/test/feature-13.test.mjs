import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, toolStarts } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { evalExpression, validateScript, runScript } from '../runtime/model/ivyscript.js';
import { respond, readInvoice, limitOf } from '../features/feature-13/agent.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n';
const REASON = 'Cloud capacity for the Q3 launch.';
const QUESTION = 'Invoice INV-2025-0892 from Apex Solutions Ltd. totals $12,500 USD, which is above $2,000. What is your justification reason for approving it?';
const APPROVED = 'Invoice INV-2025-0892 from Apex Solutions Ltd. for $12,500 USD is approved. An approval task will be created with the justification reason: "' + REASON + '"';
const MEMORY_ID = 'a7c3e5f1-2b4d-4f6a-8c9e-000000000001';

function setup({ answer = REASON } = {}) {
  const model = loadProcess(json('process/tutorial/features/Feature13.p.json'), json('dataclass/tutorial/Feature13Data.d.json'), {
    project: 'tutorial', file: 'Feature13.p.json', classes: [json('dataclass/tutorial/HumanFeedback.d.json')],
    toolProcess: { file: 'Feature13Tools.p.json', process: json('process/tutorial/tools/Feature13Tools.p.json'), dataClass: json('dataclass/tutorial/Feature13ToolsData.d.json') }
  });
  const events = [];
  const seen = { dialogs: [], memoryIds: [] };
  const io = {
    enter: e => { events.push('enter:' + e.id); },
    agent: (phase, p) => { events.push('agent:' + phase + (p.call.restored ? ':restored' : '')); },
    data: (name, value) => { if (name === 'aiMemoryId') seen.memoryIds.push(value); },
    dialog: (el, info) => { seen.dialogs.push(info); return { answer }; },
    pause: () => {}
  };
  const runner = new ProcessRunner({ model, brain: { respond }, io, simulates: { tools: true } });
  return { model, runner, events, seen };
}

test('script: new, a cast, and attributes of an error', () => {
  const error = { __bpmError: true, errorCode: 'human:decision', message: 'm', attributes: {} };
  const feedback = { __type: 'tutorial.HumanFeedback', question: 'Why?', answer: null };
  const fields = [{ name: 'feedback', type: 'tutorial.HumanFeedback' }, { name: 'aiMemoryId', type: 'String' }];
  runScript('error.setAttribute("decision", in.feedback);', { data: { feedback }, fields, vars: { error } });
  assert.equal(error.attributes.decision, feedback);
  assert.equal(evalExpression('error.getAttribute("decision") as tutorial.HumanFeedback', { data: {}, fields, vars: { error } }), feedback);
  assert.equal(evalExpression('error.getAttribute("other")', { data: {}, fields, vars: { error } }), null);
  const resolved = [];
  const ctx = { data: { aiMemoryId: 'id-1' }, fields, vars: { result: { answer: 'yes' } }, constructors: { DecisionMaker: id => ({ __native: true, resolve: answer => { resolved.push([id, answer]); } }) } };
  const code = 'import com.axonivy.utils.smart.workflow.tools.human.DecisionMaker;\n\nnew DecisionMaker(in.aiMemoryId).resolve(result.answer);';
  assert.equal(validateScript(code, ctx), null);
  runScript(code, ctx);
  assert.deepEqual(resolved, [['id-1', 'yes']]);
  assert.equal(validateScript('new Thread().start();', ctx).kind, 'unsupported');
});

test('agent: it reads the invoice and the limit, and asks only above the limit', () => {
  assert.deepEqual(readInvoice('Invoice #INV-2025-0891 from Office Depot. Total: $85 USD. Office stationery supplies.'), { id: 'INV-2025-0891', supplier: 'Office Depot', total: '$85 USD', amount: 85 });
  assert.equal(readInvoice('Invoice #INV-2025-0892 from Apex Solutions Ltd. Total: $12,500 USD.').supplier, 'Apex Solutions Ltd.');
  assert.equal(limitOf('When an invoice total exceeds $2,000, you MUST pause'), 2000);
  assert.equal(limitOf('Approve everything.'), 2000);
});

test('model: the tool ends in an Error End, and the agent has a boundary event for its code', () => {
  const { model } = setup();
  const tool = toolStarts(model)[0];
  assert.equal(tool.name, 'askUserFeedback');
  assert.deepEqual(tool.params, [{ name: 'feedback', type: 'tutorial.HumanFeedback', description: 'required: a question for the human to answer in free text' }]);
  const end = elementById(model, 'tools-f32');
  assert.equal(end.type, 'ErrorEnd');
  assert.equal(end.config.throws.error, 'human:decision');
  assert.equal(elementById(model, 'f32').attachedTo, 'f5');
  assert.equal(elementById(model, 'f26').kind, 'usertask');
  assert.deepEqual(elementById(model, 'f26').outgoing.map(c => c.to), ['f5'], 'the user task leads back to the agent');
});

test('runner: above the limit the agent is suspended, a person answers, and the agent goes on', async () => {
  const { runner, events, seen } = setup();
  const result = await runner.run({ variablesText: VARIABLES, start: 'f0' });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.visited, ['f0', 'fA', 'f5', 'f32', 'f26', 'f5', 'fL', 'fTS', 'f99']);
  const [first, second] = result.agentCalls;

  // the first call ends in the tool
  assert.equal(first.status, 'suspended');
  assert.equal(first.memoryId, MEMORY_ID);
  assert.deepEqual(first.steps.map(s => [s.name, s.arguments, s.suspended]), [['askUserFeedback', { feedback: { question: QUESTION } }, true]]);
  assert.deepEqual(result.caught.map(c => [c.elementId, c.boundaryId, c.errorCode]), [['f5', 'f32', 'human:decision']]);
  // the question reaches the dialog through the error and the process data
  assert.equal(seen.dialogs.length, 1);
  assert.equal(seen.dialogs[0].name, 'Provide feedback for Invoice Approval Agent');
  assert.equal(seen.dialogs[0].question, QUESTION);
  assert.equal(seen.dialogs[0].dialog, 'tutorial.HumanDecision:start(tutorial.HumanFeedback)');
  assert.deepEqual(result.data.decision, { __type: 'tutorial.HumanFeedback', question: QUESTION, answer: null });

  // the second call takes the conversation up again
  assert.equal(second.restored, true);
  assert.equal(second.memoryId, MEMORY_ID);
  assert.equal(second.continuation, 'continue with my selection from the tool');
  assert.equal(second.user, first.user, 'the first user message is still the first');
  assert.deepEqual(second.steps.map(s => [s.name, s.result, s.human]), [['askUserFeedback', REASON, true]]);
  assert.equal(second.answer, APPROVED);
  assert.equal(result.data.result, APPROVED);

  // the memory id is written when the agent is suspended and cleared when the conversation ends
  assert.deepEqual(seen.memoryIds, [MEMORY_ID, '']);
  assert.equal(result.data.aiMemoryId, '');
  assert.deepEqual(result.tasks.map(t => t.name), ['Provide feedback for Invoice Approval Agent', 'Invoice INV-2025-0892 Approval']);
  assert.equal(result.tasks[1].description, 'Justification reason: ' + APPROVED);
  assert.equal(result.logs[result.logs.length - 1].message, '[HumanInTheLoop] Agent result: ' + APPROVED);
  const order = ['agent:tool-call', 'enter:tools-f30', 'enter:tools-f32', 'agent:suspended', 'enter:f32', 'enter:f26', 'agent:request:restored', 'agent:response:restored'];
  assert.deepEqual(events.filter(e => order.includes(e)), order);
  assert.ok(!events.includes('agent:tool-result'), 'the tool never returns a result by itself');
});

test('runner: an invoice below the limit is approved without tool, error or user task', async () => {
  const { runner, seen } = setup();
  const result = await runner.run({ variablesText: VARIABLES, start: 'f0B' });
  assert.deepEqual(result.visited, ['f0B', 'fAB', 'f5', 'fL', 'fTS', 'f99']);
  assert.equal(result.agentCalls.length, 1);
  assert.deepEqual(result.agentCalls[0].steps, []);
  assert.equal(result.data.result, 'Invoice INV-2025-0891 from Office Depot for $85 USD is approved automatically: the total does not exceed $2,000. An approval task will be created.');
  assert.deepEqual(seen.dialogs, []);
  assert.deepEqual(result.tasks.map(t => t.name), ['Invoice INV-2025-0891 Approval']);
});

test('runner: without the tool tag the agent has nothing to ask with', async () => {
  const { model, runner, seen } = setup();
  elementById(model, 'tools-f30').tags = [];
  const result = await runner.run({ variablesText: VARIABLES, start: 'f0' });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.agentCalls[0].tools, []);
  assert.deepEqual(result.agentCalls[0].toolsNotFound, ['askUserFeedback']);
  assert.match(result.data.result, /I have no tool to ask for one, so I cannot approve this invoice\.$/);
  assert.deepEqual(seen.dialogs, []);
});

test('runner: without DecisionMaker.resolve the agent cannot go on', async () => {
  const { model, runner } = setup();
  elementById(model, 'f26').config.output.code = '';
  const result = await runner.run({ variablesText: VARIABLES, start: 'f0' });
  assert.equal(result.status, 'failed');
  assert.equal(result.failedAt, 'f5');
  assert.match(result.error.message, /still waits for the result of a tool call: DecisionMaker\.resolve\(\) has not been called$/);
});

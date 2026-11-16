/**
 * Appendix 05 — Troubleshooting. The walkthrough breaks the Human in the Loop process
 * (Feature13.p.json) in the ways the page lists, one at a time. Each test is one of them:
 * the symptom it produces, and the log line that names the cause.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { respond } from '../features/feature-13/agent.js';
import { VARIABLES, SIMULATES } from '../features/appendix-05/settings.js';
const lesson = { variables: VARIABLES, simulates: SIMULATES };

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const REASON = 'Cloud capacity for the Q3 launch.';
const HIGH = 'f0';
const LOW = 'f0B';

function setup() {
  const model = loadProcess(json('process/tutorial/features/Feature13.p.json'), json('dataclass/tutorial/Feature13Data.d.json'), {
    project: 'tutorial', file: 'Feature13.p.json', classes: [json('dataclass/tutorial/HumanFeedback.d.json')],
    toolProcess: { file: 'Feature13Tools.p.json', process: json('process/tutorial/tools/Feature13Tools.p.json'), dataClass: json('dataclass/tutorial/Feature13ToolsData.d.json') }
  });
  const seen = { dialogs: 0, calls: [] };
  const io = {
    agent: (phase, p) => { if (phase === 'request') seen.calls.push(p.call); },
    dialog: () => { seen.dialogs++; return { answer: REASON }; },
    pause: () => {}
  };
  const runner = new ProcessRunner({ model, brain: { respond }, io, simulates: lesson.simulates });
  const agent = elementById(model, 'f5').config.userConfig;
  const userTask = elementById(model, 'f26').config.output;
  return { model, runner, seen, agent, userTask };
}

const run = (runner, start, variablesText = lesson.variables) => runner.run({ variablesText, start });
const messages = result => result.logs.map(l => l.message);
const code = output => (Array.isArray(output.code) ? output.code.join('\n') : String(output.code));
const withVar = (from, to) => lesson.variables.replace(from, to);

test('lesson: unbroken, with the circuit breaker switched off, the process runs to its end', async () => {
  assert.match(lesson.variables, /Enabled: "false"/);
  const { runner, seen } = setup();
  const result = await run(runner, HIGH);
  assert.equal(result.status, 'completed', 'unbroken, the process runs to its end');
  assert.equal(seen.dialogs, 1);
});

test('did not answer: the circuit breaker stops the call, and the boundary for human:decision does not catch it', async () => {
  const { runner } = setup();
  const result = await run(runner, LOW, withVar('Enabled: "false"', 'Enabled: "true"'));
  assert.equal(result.status, 'failed');
  assert.equal(result.failedAt, 'f5');
  assert.equal(result.error.errorCode, 'smartworkflow:stop');
  assert.ok(messages(result).some(m => m.startsWith('Unhandled error smartworkflow:stop: ')));
});

test('did not answer: a blank user message skips the call, and the process carries on', async () => {
  const { runner, agent, seen } = setup();
  agent.query = '';
  const result = await run(runner, LOW);
  assert.equal(result.status, 'completed');
  assert.equal(seen.calls.length, 0, 'nothing went to the model');
  assert.ok(messages(result).includes('Agent call was skipped, since there was no user query'));
  assert.ok(result.visited.includes('fL'), 'Log result still runs');
  assert.equal(result.data.result ?? null, null);
});

test('did not answer: an answer that does not fit the target field is logged, not thrown', async () => {
  const { runner, agent } = setup();
  agent.resultMapping = 'in.decision';
  const result = await run(runner, LOW);
  assert.equal(result.status, 'completed');
  assert.ok(messages(result).includes('Failed to map result to in.decision'));
  assert.equal(result.data.result ?? null, null);
});

test('not as expected: without tools the agent explains instead of asking', async () => {
  const { runner, agent, seen } = setup();
  agent.tools = '';
  const result = await run(runner, HIGH);
  assert.equal(result.status, 'completed');
  assert.equal(seen.dialogs, 0);
  assert.match(result.data.result, /I have no tool to ask for one, so I cannot approve this invoice/);
});

test('not as expected: a tool start without the tag is dropped from the request without a message', async () => {
  const { model, runner, seen } = setup();
  elementById(model, 'tools-f30').tags = [];
  const result = await run(runner, HIGH);
  assert.equal(result.status, 'completed');
  assert.equal(seen.dialogs, 0);
  assert.deepEqual(seen.calls[0].tools, [], 'nothing goes with the request');
  assert.deepEqual(seen.calls[0].toolsNotFound, ['askUserFeedback'], 'although the agent still selects it');
  assert.ok(!result.logs.some(l => l.level === 'warn' || l.level === 'error'), 'and nothing says so');
  assert.match(result.data.result, /I have no tool to ask for one/);
});

test('messages: a user message that fails to expand skips the call', async () => {
  const { runner, agent, seen } = setup();
  agent.query = '<%=in.qeury%>';
  const result = await run(runner, LOW);
  assert.equal(result.status, 'completed');
  assert.equal(seen.calls.length, 0);
  const log = messages(result);
  const skipped = log.indexOf('Agent call was skipped, since there was no user query');
  assert.ok(skipped > 0);
  assert.equal(result.logs[skipped - 1].level, 'error', 'the expansion error comes just before it');
});

test('messages: a system message that fails to expand is left out, and the agent runs without rules', async () => {
  const { runner, agent, seen } = setup();
  agent.system = agent.system.replace('exceeds $2,000', 'exceeds <%=in.limit%>');
  const result = await run(runner, HIGH);
  assert.equal(result.status, 'completed');
  assert.equal(seen.calls[0].system, '', 'no system message was sent');
  assert.equal(seen.calls[0].tools.length, 1, 'the tool still goes with the request');
  assert.equal(seen.dialogs, 0);
  assert.ok(result.logs.some(l => l.level === 'error'));
  assert.match(result.data.result, /My instructions do not say how to get one, so I cannot approve this invoice\.$/);
});

test('configuration: an unknown provider, a missing key, an unquoted model name', async () => {
  const unknown = await run(setup().runner, LOW, withVar('DefaultProvider: "OpenAI"', 'DefaultProvider: "Open AI"'));
  assert.equal(unknown.status, 'failed');
  assert.ok(messages(unknown).includes('Unknown model provider Open AI'));

  const noKey = await run(setup().runner, LOW, withVar('APIKey: "sk-..."', 'APIKey: ""'));
  assert.equal(noKey.status, 'failed');
  assert.ok(messages(noKey).some(m => m.includes('401 Unauthorized')));

  const s = setup();
  s.agent.model = 'gpt-4o';
  const unquoted = await run(s.runner, LOW);
  assert.equal(unquoted.status, 'failed');
  assert.ok(messages(unquoted).includes("Failed to extract config 'model' for value 'gpt-4o'"));

  const q = setup();
  q.agent.model = '"gpt-4o"';
  assert.equal((await run(q.runner, LOW)).status, 'completed', 'quoted, it works');
});

test('human in the loop: the wrong id, and resolve() called twice', async () => {
  const wrong = setup();
  wrong.userTask.code = code(wrong.userTask).replace('DecisionMaker(in.aiMemoryId)', 'DecisionMaker(in.invoiceId)');
  const a = await run(wrong.runner, HIGH);
  assert.equal(a.status, 'failed');
  assert.equal(a.failedAt, 'f26');
  assert.ok(messages(a).some(m => m.includes('IllegalStateException: Found no pending ChatMemory for id: INV-2025-0892')));

  const twice = setup();
  twice.userTask.code = code(twice.userTask) + '\nnew DecisionMaker(in.aiMemoryId).resolve(result.answer);';
  const b = await run(twice.runner, HIGH);
  assert.equal(b.status, 'failed');
  assert.equal(b.failedAt, 'f26');
  assert.ok(messages(b).some(m => m.includes('IllegalStateException: Found no pending ToolExecutionRequest for id: ')));
  assert.equal(b.caught.length, 1, 'only the human:decision of the tool was caught; the exception was not');
});

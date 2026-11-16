import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, startElements } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { setVariable, parseYaml, readVariable } from '../runtime/model/yaml.js';
import { validateScript } from '../runtime/model/ivyscript.js';
import { circuitBreakerOn, circuitBreakerStatics } from '../runtime/model/guardrails.js';
import { respond } from '../features/feature-01/agent.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const processJson = json('process/tutorial/features/Feature15.p.json');
const dataClassJson = json('dataclass/tutorial/Feature15Data.d.json');

const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n    # Emergency circuit breaker.\n    CircuitBreaker:\n      # the switch\n      Enabled: "false"\n';
const SUMMARY = 'The invoice INV-2024-00123 from Acme Supplies Ltd. has a total amount of JPY 10,560.00 and is due on 2024-06-30.';
const STOPPED = 'The guardrail com.axonivy.utils.smart.workflow.guardrails.adapter.InputGuardrailAdapter failed with this message: All AI agent activities are currently stopped.';

/** A little application: its variables outlive a run, as on an engine. */
function setup() {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature15.p.json' });
  const app = { variables: VARIABLES };
  const runner = new ProcessRunner({ model, brain: { respond }, io: { variable: (name, value, text) => { app.variables = text; } }, simulates: { guardrails: true } });
  const start = id => runner.run({ variablesText: app.variables, start: id });
  return { model, app, start };
}

test('yaml: a variable is rewritten in place, or added where it belongs', () => {
  const on = setVariable(VARIABLES, 'AI.CircuitBreaker.Enabled', 'true');
  assert.equal(on, VARIABLES.replace('Enabled: "false"', 'Enabled: "true"'), 'only the value changes; comments stay');
  const bare = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "k"\n';
  const added = setVariable(bare, 'AI.CircuitBreaker.Enabled', 'true');
  assert.equal(added, bare + '    CircuitBreaker:\n      Enabled: "true"\n');
  assert.equal(readVariable(parseYaml(added).value, 'AI.Providers.OpenAI.APIKey'), 'k');
  assert.equal(readVariable(parseYaml(setVariable('', 'AI.CircuitBreaker.Enabled', 'true')).value, 'AI.CircuitBreaker.Enabled'), 'true');
  assert.equal(circuitBreakerOn(parseYaml(on).value), true);
  assert.equal(circuitBreakerOn(parseYaml(VARIABLES).value), false);
  assert.equal(circuitBreakerOn(parseYaml(bare).value), false, 'no variable: off');
  assert.equal(circuitBreakerOn(parseYaml(VARIABLES.replace('"false"', '" TRUE "')).value), true);
});

test('scripts: the import line and CircuitBreakerSignal are understood', () => {
  const { model } = setup();
  const code = elementById(model, 'f22').config.output.code;
  assert.match(code, /^import com\.axonivy\.utils\.smart\.workflow\.guardrails\.circuitbreaker\.CircuitBreakerSignal;/);
  const ctx = { data: {}, fields: model.dataClass.fields, statics: circuitBreakerStatics(() => {}) };
  assert.equal(validateScript(code, ctx), null);
  assert.match(validateScript('Other.stopAll();', ctx).message, /Unknown variable 'Other'/);
});

test('runner: the process has three starts; with the switch off the agent summarises', async () => {
  const { model, start } = setup();
  assert.deepEqual(startElements(model).map(e => e.name), ['Circuit breaker demo', 'Stop all agents', 'Re-enable agents']);
  const result = await start('f0');
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.visited, ['f0', 'fA', 'f5', 'f9', 'f1']);
  assert.equal(result.data.summary, SUMMARY);
  assert.deepEqual(result.agentCalls[0].guardrails, [], 'the circuit breaker stays out of sight while it is off');
});

test('runner: stop all, a stopped run, re-enable, a new run — as in the tutorial', async () => {
  const { app, start } = setup();
  const stop = await start('f20');
  assert.deepEqual(stop.visited, ['f20', 'f22', 'f24']);
  assert.equal(stop.logs[0].message, 'Circuit breaker ON: all AI agent calls in this application are stopped.');
  assert.match(app.variables, /Enabled: "true"/);

  const stopped = await start('f0');
  assert.equal(stopped.status, 'completed');
  assert.deepEqual(stopped.visited, ['f0', 'fA', 'f5', 'fE', 'fC', 'f1']);
  const call = stopped.agentCalls[0];
  assert.equal(call.status, 'blocked');
  assert.equal(call.answer, undefined, 'the model was not called');
  assert.deepEqual(call.guardrails, [{ side: 'input', name: 'CircuitBreakerGuardrail', allowed: false, reason: 'All AI agent activities are currently stopped.' }]);
  assert.deepEqual(stopped.caught, [{ elementId: 'f5', boundaryId: 'fE', errorCode: 'smartworkflow:stop', message: STOPPED }]);
  assert.equal(stopped.data.isStopped, true);
  assert.equal(stopped.data.summary, 'AI is currently unavailable - invoice routed to manual review.');
  assert.deepEqual(stopped.logs.map(l => l.level + ' ' + l.message), ['warn Agent stopped by circuit breaker: ' + STOPPED, 'error AI is currently unavailable - invoice routed to manual review.']);

  const resume = await start('f30');
  assert.equal(resume.logs[0].message, 'Circuit breaker OFF: new AI agent calls are allowed again. Calls stopped earlier are not re-run.');
  assert.match(app.variables, /Enabled: "false"/);
  assert.equal((await start('f0')).data.summary, SUMMARY, 'a new run calls the model again');
});

test('runner: an event for a guardrail violation does not catch the stop', async () => {
  const { model, start } = setup();
  elementById(model, 'fE').config.errorCode = 'smartworkflow:guardrail:input:violation';
  await start('f20');
  const result = await start('f0');
  assert.equal(result.status, 'failed');
  assert.equal(result.failedAt, 'f5');
  assert.equal(result.error.errorCode, 'smartworkflow:stop');
  assert.equal(result.logs[result.logs.length - 1].message, 'Unhandled error smartworkflow:stop: ' + STOPPED);
});

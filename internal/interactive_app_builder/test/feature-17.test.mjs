import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { toTemperature, formatTemperature } from '../runtime/model/providers.js';
import { respond, variety } from '../features/feature-17/agent.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const processJson = json('process/tutorial/features/Feature17.p.json');
const dataClassJson = json('dataclass/tutorial/Feature17Data.d.json');
const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n      Anthropic:\n        APIKey: "sk-ant-..."\n';
const FIXED = 'Friendly reminder: invoice INV-2024-00123 is past due';

function setup(simulates = { temperature: true }) {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature17.p.json' });
  const runner = new ProcessRunner({ model, brain: { respond }, io: {}, simulates });
  return { model, runner };
}

test('temperature: empty, not a number and negative all become 0.0', () => {
  assert.deepEqual(['0.7', ' 1.0 ', '2', '', null, 'high', '-0.5', 'NaN', '1e-1'].map(toTemperature), [0.7, 1, 2, 0, 0, 0, 0, 0, 0.1]);
  assert.deepEqual([0, 1, 0.7, 2].map(formatTemperature), ['0.0', '1.0', '0.7', '2.0']);
  assert.deepEqual([0, 0.2, 0.7, 1, 2].map(variety), [1, 2, 5, 6, 8]);
});

test('runner: the same invoice at 0.0 and at the temperature from the process data', async () => {
  const { runner } = setup();
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await runner.run({ variablesText: VARIABLES, runIndex: i }));
  assert.deepEqual(runs[0].agentCalls.map(c => [c.name, c.temperature]), [['Reminder Subject (deterministic)', 0], ['Reminder Subject (creative)', 1]]);
  assert.deepEqual(runs.map(r => r.data.deterministicSubject), [FIXED, FIXED, FIXED], 'the same line on every run');
  const creative = runs.map(r => r.data.creativeSubject);
  assert.deepEqual(creative, [
    'A quick nudge about invoice INV-2024-00123 (due 2024-06-30)',
    'Invoice INV-2024-00123 from Acme Supplies Ltd. is still open',
    'Could you take a look at invoice INV-2024-00123?']);
  assert.ok(creative.every(line => line !== FIXED) && new Set(creative).size === 3, 'another line on every run');
  assert.deepEqual(runs[0].logs.slice(-2).map(l => l.message), ['temperature 0.0: ' + FIXED, 'temperature 1.0: ' + creative[0]]);
});

test('runner: a value that is no temperature is sent as 0.0, without an error', async () => {
  const { runner, model } = setup();
  const mock = elementById(model, 'fA');
  mock.config.output.code = mock.config.output.code.replace('"1.0"', '"high"');
  const result = await runner.run({ variablesText: VARIABLES, runIndex: 0 });
  assert.equal(result.status, 'completed');
  assert.equal(result.agentCalls[1].temperature, 0);
  assert.equal(result.data.creativeSubject, FIXED);
  assert.ok(!result.logs.some(l => l.category !== 'USER' && (l.level === 'warn' || l.level === 'error')));
});

test('runner: a temperature above the range of the provider is rejected by the provider', async () => {
  const anthropic = setup();
  agentConfig(elementById(anthropic.model, 'f7')).provider = '"Anthropic"';
  elementById(anthropic.model, 'fA').config.output.code = 'in.invoiceText = "Invoice Number: INV-1\\n";\nin.temperature = "1.5";';
  const rejected = await anthropic.runner.run({ variablesText: VARIABLES });
  assert.equal(rejected.status, 'failed');
  assert.equal(rejected.failedAt, 'f7');
  assert.equal(rejected.error.message, 'Anthropic rejected the call with 400 Bad Request: temperature 1.5 is above its maximum of 1');
  const openai = setup();
  elementById(openai.model, 'fA').config.output.code = 'in.invoiceText = "Invoice Number: INV-1\\n";\nin.temperature = "1.5";';
  assert.equal((await openai.runner.run({ variablesText: VARIABLES })).status, 'completed', 'OpenAI takes up to 2');
});

test('runner: lessons that do not simulate temperature record none', async () => {
  const { runner } = setup({});
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.agentCalls[0].temperature, undefined);
});

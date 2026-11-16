import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { evalExpression } from '../runtime/model/ivyscript.js';
import { respond, urgencyLimits, classifyUrgency, classifyRisk } from '../features/feature-03/agent.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const processJson = json('process/tutorial/features/Feature03.p.json');
const dataClassJson = json('dataclass/tutorial/Feature03Data.d.json');
const invoiceDataJson = json('dataclass/tutorial/InvoiceData.d.json');

// the lesson's variables.yaml (features/feature-03/index.js)
const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n        DefaultModel: "gpt-4.1-mini"\n' +
  '      Anthropic:\n        APIKey: "sk-ant-..."\n      Ollama:\n        BaseUrl: "http://localhost:11434"\n';
const JSON_LOGGED = '{\n  "invoiceNumber" : "INV-2024-00123",\n  "supplierName" : "Acme Supplies Ltd.",\n  "totalAmount" : 10560.00,\n  "currency" : "JPY",\n  "invoiceDate" : "2024-06-01"\n}';

function setup() {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature03.p.json', classes: [invoiceDataJson] });
  const events = [];
  const io = { enter: e => { events.push('enter:' + e.id); }, agent: (phase, p) => { events.push('agent:' + phase + ':' + p.element.id); } };
  const runner = new ProcessRunner({ model, brain: { respond }, io, simulates: { structuredOutput: true } });
  return { model, runner, events, agent: id => elementById(model, id) };
}

test('process: Feature03 has three agents, each with its own provider and model', () => {
  const { model } = setup();
  const agents = model.elements.filter(e => e.isAgent);
  assert.deepEqual(agents.map(a => a.name), ['Invoice Analysis Agent', 'Urgency Classifier', 'Supplier Risk Check']);
  assert.deepEqual(agents.map(a => agentConfig(a).provider + ' / ' + agentConfig(a).model), ['"OpenAI" / "gpt-4o"', '"Anthropic" / "claude-haiku-4-5"', '"Ollama" / "llama3.2"']);
});

test('ivyscript: a call on a missing value yields nothing instead of failing', () => {
  const { model } = setup();
  const ctx = { data: {}, fields: model.dataClass.fields, classes: model.classes };
  assert.equal(evalExpression('in.invoiceData.totalAmount.toString()', ctx), null);
  ctx.data.invoiceData = { __type: 'tutorial.InvoiceData', totalAmount: '10560.00' };
  assert.equal(evalExpression('in.invoiceData.totalAmount.toString()', ctx), '10560.00');
});

test('agent: the urgency classifier applies the limits of its system message', () => {
  const system = agentConfig(setup().agent('f7')).system;
  assert.deepEqual(urgencyLimits(system), { urgent: 10000, low: 1000 });
  assert.equal(classifyUrgency(system, '10560.00').text, 'URGENT');
  assert.equal(classifyUrgency(system, '10000').text, 'URGENT');
  assert.equal(classifyUrgency(system, '9,999.99').text, 'NORMAL');
  assert.equal(classifyUrgency(system, '1000').text, 'NORMAL');
  assert.equal(classifyUrgency(system, '999').text, 'LOW');
  assert.equal(classifyUrgency(system.replace('10000 or above', '50000 or above'), '10560.00').text, 'NORMAL', 'changed limits are honoured');
  assert.deepEqual(classifyUrgency(system, 'no number').insights, [{ id: 'urgency-missing' }]);
  assert.deepEqual(classifyUrgency(system, '10560.00').insights, [{ id: 'urgency', amount: '10560', urgent: '10000', low: '1000', result: 'URGENT' }]);
});

test('agent: the risk check goes by what the supplier name looks like', () => {
  assert.equal(classifyRisk('Acme Supplies Ltd.').text, 'LOW');
  assert.equal(classifyRisk('Demo Company AG').text, 'LOW');
  assert.equal(classifyRisk('Northwind Traders').text, 'MEDIUM');
  assert.equal(classifyRisk('Supplier').text, 'HIGH');
  assert.equal(classifyRisk('xkcd qwrt').text, 'HIGH');
  assert.equal(classifyRisk('').text, 'HIGH');
  assert.deepEqual(classifyRisk('Acme Supplies Ltd.').insights, [{ id: 'risk-low', name: 'Acme Supplies Ltd.' }]);
});

test('agent: what a call asks for decides which stand-in answers', () => {
  const { model, agent } = setup();
  const invoice = 'Invoice Number: INV-1\nSupplier: Northwind Ltd.\nTotal: EUR 5.00\n';
  assert.equal(respond({ system: agentConfig(agent('f5')).system, user: invoice, resultClass: model.classes['tutorial.InvoiceData'] }).value.invoiceNumber, 'INV-1');
  assert.equal(respond({ system: agentConfig(agent('f7')).system, user: '500' }).text, 'LOW');
  assert.equal(respond({ system: agentConfig(agent('f9')).system, user: 'Northwind Ltd.' }).text, 'LOW');
  assert.match(respond({ system: 'Summarise.', user: invoice }).text, /^invoiceNumber: INV-1/);
});

test('runner: each agent calls its own provider and the results flow from step to step', async () => {
  const { runner } = setup();
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.agentCalls.map(c => c.name + ': ' + c.provider + ' / ' + c.model), [
    'Invoice Analysis Agent: OpenAI / gpt-4o', 'Urgency Classifier: Anthropic / claude-haiku-4-5', 'Supplier Risk Check: Ollama / llama3.2']);
  assert.deepEqual(result.agentCalls.map(c => c.url), ['https://api.openai.com/v1/chat/completions', 'https://api.anthropic.com/v1/messages', 'http://localhost:11434/api/chat']);
  assert.deepEqual(result.agentCalls.map(c => c.user).slice(1), ['10560.00', 'Acme Supplies Ltd.']);
  assert.equal(result.data.invoiceData.totalAmount, '10560.00');
  assert.equal(result.data.urgency, 'URGENT');
  assert.equal(result.data.riskLevel, 'LOW');
  assert.equal(result.logs[result.logs.length - 1].message, 'invoiceData: ' + JSON_LOGGED + ', urgency: URGENT, riskLevel: LOW');
});

test('runner: an agent without provider and model uses the global default from variables.yaml', async () => {
  const { runner, agent } = setup();
  delete agentConfig(agent('f7')).provider;
  delete agentConfig(agent('f7')).model;
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.agentCalls[1].provider, 'OpenAI');
  assert.equal(result.agentCalls[1].model, 'gpt-4.1-mini');
  assert.equal(result.agentCalls[2].provider, 'Ollama', 'the other agents keep their own');
  const other = await runner.run({ variablesText: VARIABLES.replace('DefaultProvider: "OpenAI"', 'DefaultProvider: "Anthropic"') });
  assert.equal(other.agentCalls[1].provider, 'Anthropic');
  assert.equal(other.agentCalls[0].provider, 'OpenAI', 'an override wins over the default');
});

test('runner: a provider that an agent names needs its own key', async () => {
  const { runner, events } = setup();
  const result = await runner.run({ variablesText: VARIABLES.replace('APIKey: "sk-ant-..."', 'APIKey: ""') });
  assert.equal(result.status, 'failed');
  assert.equal(result.failedAt, 'f7');
  assert.equal(result.error.kind, 'auth');
  assert.equal(result.error.variable, 'AI.Providers.Anthropic.APIKey');
  assert.equal(result.agentCalls[0].status, 'answered');
  assert.ok(!events.includes('enter:f9'));
});

test('runner: without the extracted invoice the two later agents have no user message and are skipped', async () => {
  const { runner, agent } = setup();
  delete agentConfig(agent('f5')).resultMapping;
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.agentCalls.map(c => c.status), ['answered', 'skipped', 'skipped']);
  assert.equal(result.logs.filter(l => l.message === 'Agent call was skipped, since there was no user query').length, 2);
  assert.equal(result.logs[result.logs.length - 1].message, 'invoiceData: null, urgency: , riskLevel: ');
});

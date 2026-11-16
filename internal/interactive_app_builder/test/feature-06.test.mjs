import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { respond } from '../features/feature-06/agent.js';
import { readJavaTool, convertToUsd, registeredJavaTools } from '../features/feature-06/java-tool.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const text = path => readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8').replace(/\r\n/g, '\n');
const processJson = JSON.parse(text('process/tutorial/features/Feature06.p.json'));
const dataClassJson = JSON.parse(text('dataclass/tutorial/Feature06Data.d.json'));
const SOURCES = {
  tool: text('src/tutorial/tool/FxRateConverterTool.java'),
  provider: text('src/tutorial/tool/TutorialToolProvider.java'),
  spi: text('src/META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider')
};
const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n';
const SUMMARY = 'Invoice INV-2024-00123 from Acme Supplies Ltd. totals JPY 10,560.00, which is equivalent to approximately 70.75 USD at a rate of 0.0067.';

function setup(sources = SOURCES) {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature06.p.json' });
  const runner = new ProcessRunner({ model, brain: { respond }, io: {}, simulates: { tools: true }, javaTools: () => registeredJavaTools(sources) });
  return { model, runner, agent: elementById(model, 'f5') };
}

test('java: name, description, parameters and rates are read from FxRateConverterTool.java', () => {
  const tool = readJavaTool(SOURCES.tool);
  assert.equal(tool.name, 'convertToUSD');
  assert.match(tool.description, /^Convert an invoice amount from its original currency to USD using fixed exchange rates\.\nPass the total amount/);
  assert.ok(!tool.description.includes('"""') && !/^\s/.test(tool.description.split('\n')[1]), 'the text block without its indentation');
  assert.deepEqual(tool.params, [
    { name: 'amount', description: 'Invoice total amount as a plain number string (digits and decimal point only)', type: 'String' },
    { name: 'currency', description: 'ISO 4217 currency code of the invoice (e.g. JPY, EUR, GBP, USD)', type: 'String' }]);
  assert.equal(tool.rates.JPY, 0.0067);
  assert.equal(tool.rates.EUR, 1.09);
  assert.ok(Object.keys(tool.rates).length >= 4);
});

test('java: execute does what the Java method does', () => {
  const { rates } = readJavaTool(SOURCES.tool);
  assert.equal(convertToUsd(rates, { amount: '10560.00', currency: 'JPY' }), '10560.00 JPY = 70.75 USD (rate: 0.0067)');
  assert.equal(convertToUsd(rates, { amount: '1,000', currency: ' eur ' }), '1000.00 EUR = 1090.00 USD (rate: 1.0900)');
  assert.equal(convertToUsd(rates, { amount: '50', currency: 'XYZ' }), '50.00 XYZ = 50.00 USD (rate: 1.0000)', 'an unknown currency counts 1:1, as getOrDefault says');
  assert.throws(() => convertToUsd(rates, { amount: 'abc', currency: 'JPY' }));
});

test('java: the tool is registered only while the SPI file names the provider', () => {
  assert.deepEqual(registeredJavaTools(SOURCES).map(t => t.name), ['convertToUSD']);
  assert.deepEqual(registeredJavaTools({ ...SOURCES, spi: '' }), []);
  assert.deepEqual(registeredJavaTools({ ...SOURCES, spi: '# tutorial.tool.TutorialToolProvider\n' }), []);
  assert.deepEqual(registeredJavaTools({ ...SOURCES, spi: 'tutorial.tool.OtherProvider\n' }), []);
});

test('runner: the agent calls the Java tool and puts its result into one sentence', async () => {
  const { runner } = setup();
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  const call = result.agentCalls[0];
  assert.deepEqual(call.tools.map(t => [t.name, t.java, t.params.map(p => p.name).join()]), [['convertToUSD', true, 'amount,currency']]);
  assert.deepEqual(call.steps.map(s => [s.name, s.arguments, s.result, s.java]), [['convertToUSD', { amount: '10560.00', currency: 'JPY' }, '10560.00 JPY = 70.75 USD (rate: 0.0067)', true]]);
  assert.equal(call.answer, SUMMARY);
  assert.equal(result.data.summary, SUMMARY);
  assert.equal(result.logs[result.logs.length - 1].message, SUMMARY);
  assert.equal(result.logs.filter(l => /REST service langChain/.test(l.message)).length, 2);
});

test('runner: without the registration, or without the selection, there is no tool and no conversion', async () => {
  const lost = setup({ ...SOURCES, spi: '' });
  const first = await lost.runner.run({ variablesText: VARIABLES });
  assert.equal(first.status, 'completed', 'nothing fails');
  assert.deepEqual(first.agentCalls[0].tools, []);
  assert.deepEqual(first.agentCalls[0].toolsNotFound, ['convertToUSD']);
  assert.equal(first.data.summary, 'Invoice INV-2024-00123 from Acme Supplies Ltd. totals JPY 10,560.00. I could not convert the amount to USD, because I have no tool for the conversion.');

  const unlisted = setup();
  delete agentConfig(unlisted.agent).tools;
  const second = await unlisted.runner.run({ variablesText: VARIABLES });
  assert.deepEqual(second.agentCalls[0].tools, []);
  assert.deepEqual(second.agentCalls[0].toolsNotFound, []);
  assert.equal(second.data.summary, first.data.summary);
});

test('runner: an exception in the Java tool goes back to the model as text', async () => {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature06.p.json' });
  const broken = [{ name: 'convertToUSD', description: '', params: [{ name: 'amount', type: 'String', description: 'amount' }], execute: () => { throw new Error('boom'); } }];
  const runner = new ProcessRunner({ model, brain: { respond }, io: {}, simulates: { tools: true }, javaTools: () => broken });
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  assert.equal(result.agentCalls[0].steps[0].result, "Error executing tool 'convertToUSD'");
  assert.match(result.data.summary, /The conversion did not work: Error executing tool 'convertToUSD'$/);
});

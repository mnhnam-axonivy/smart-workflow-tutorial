import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { respond } from '../features/feature-05/agent.js';
import { requestTokens, withDefaultInput, withDefaultModel } from '../features/appendix-04/tour.js';
import { strings } from '../features/appendix-04/text.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
// the lesson's variables.yaml (features/appendix-04/index.js, which imports the process files)
const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
`;
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));

async function run({ variables = VARIABLES, change } = {}) {
  const model = loadProcess(json('process/tutorial/features/Feature05.p.json'), json('dataclass/tutorial/Feature05Data.d.json'), {
    project: 'tutorial', file: 'Feature05.p.json', classes: [json('dataclass/tutorial/InvoiceDecision.d.json')],
    toolProcess: { file: 'Feature05Tools.p.json', process: json('process/tutorial/tools/Feature05Tools.p.json'), dataClass: json('dataclass/tutorial/Feature05ToolsData.d.json') }
  });
  const runner = new ProcessRunner({ model, brain: { respond }, io: {}, simulates: { tools: true, guardrails: true, structuredOutput: true, temperature: false } });
  if (change) change(agentConfig(elementById(model, 'f5')));
  return runner.run({ variablesText: variables });
}

test('one agent call, four requests: each carries the whole conversation so far', async () => {
  const result = await run();
  const call = result.agentCalls[0];
  assert.equal(result.agentCalls.length, 1);
  assert.equal(call.rounds.length, 4, 'three tools, one per turn, then the answer');
  const counts = requestTokens(call);
  assert.equal(counts.length, 4);
  counts.slice(1).forEach((n, i) => assert.ok(n > counts[i], 'request ' + (i + 2) + ' is longer than the one before'));
  assert.equal(result.data.invoiceDecision.__type, 'tutorial.InvoiceDecision', 'a typed result in the process data');
});

test('provider and model fall back: AI.DefaultProvider, then the provider default, unless the element or DefaultModel says otherwise', async () => {
  const empty = (await run()).agentCalls[0];
  assert.deepEqual([empty.provider, empty.model], ['OpenAI', 'gpt-4.1-mini']);
  const own = (await run({ change: cfg => { cfg.model = '"gpt-4.1"'; } })).agentCalls[0];
  assert.equal(own.model, 'gpt-4.1');
  const variables = withDefaultModel(VARIABLES);
  assert.match(variables, /\n {6}OpenAI:\n {8}APIKey: "sk-\.\.\."\n {8}DefaultModel: "gpt-4\.1"\n/);
  assert.equal((await run({ variables })).agentCalls[0].model, 'gpt-4.1', 'read on the next call');
});

test('an empty guardrail field inherits the application default, which blocks the multi-line invoice', async () => {
  const variables = withDefaultInput(VARIABLES);
  assert.match(variables, /\n {4}DefaultProvider: "OpenAI"\n {4}Guardrails:\n {6}DefaultInput: "PromptInjectionInputGuardrail"\n {4}Providers:/);
  const result = await run({ variables });
  const call = result.agentCalls[0];
  assert.equal(result.status, 'failed');
  assert.equal(call.status, 'blocked');
  assert.deepEqual(call.guardrails.map(g => [g.side, g.name, g.allowed]), [['input', 'PromptInjectionInputGuardrail', false]]);
  assert.equal(call.answer, undefined, 'the model is never asked');
});

test('an empty Available tools field means no tools: the model guesses every field', async () => {
  const call = (await run({ change: cfg => { cfg.tools = ''; } })).agentCalls[0];
  assert.deepEqual(call.tools, []);
  assert.deepEqual(call.steps, []);
  assert.deepEqual([...call.guessed].sort(), ['approverUsername', 'effectiveTaxRate', 'isAutoApprove']);
});

test('between calls nothing is carried over: a second run asks for the same tools again', async () => {
  const first = (await run()).agentCalls[0];
  const second = (await run()).agentCalls[0];
  assert.deepEqual(second.steps.map(s => s.name), first.steps.map(s => s.name));
  assert.ok(!second.restored);
});

test('every chapter has its heading and every note its texts, in both languages', async () => {
  const { tour } = await import('../features/appendix-04/tour.js');
  const source = readFileSync(fileURLToPath(new URL('../features/appendix-04/tour.js', import.meta.url)), 'utf8');
  const keys = [...source.matchAll(/d\.note\('(\w+)'/g)].map(m => m[1]);
  for (const lang of ['en', 'ja']) {
    tour.chapters.forEach(c => assert.ok(strings[lang]['tour.chapter.' + c.id], lang + ': chapter ' + c.id));
    keys.forEach(key => assert.ok(strings[lang]['tour.' + key + '.title'] && strings[lang]['tour.' + key + '.text'], lang + ': note ' + key));
  }
  const page = readFileSync(fileURLToPath(new URL('cms/Files/Appendix/appendix-04_en.md', tutorial)), 'utf8');
  const headings = [...page.matchAll(/^## (.+)$/gm)].map(m => m[1]).filter(h => h !== 'See also');
  assert.deepEqual(tour.chapters.map(c => strings.en['tour.chapter.' + c.id]), headings, 'the chapters follow the page');
});

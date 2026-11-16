/**
 * Appendix 05 — the causes the walkthrough adds to the Troubleshooting page, each run on the
 * Human in the Loop process (Feature13.p.json) as the walkthrough runs it: the symptom, and
 * the line the Runtime Log has for it (or the absence of one).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { respond } from '../features/feature-13/agent.js';
import { VARIABLES, SIMULATES, CMS } from '../features/appendix-05/settings.js';
import { CMS_PDF, CMS_WORD, CMS_TYPO, CMS_SYSTEM, TEST_NOTE, DEFAULT_GUARDRAIL, tour } from '../features/appendix-05/tour.js';
import { expandMacro, binaryText } from '../runtime/model/macro.js';
import { strings } from '../features/appendix-05/text.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const HIGH = 'f0';
const LOW = 'f0B';

function setup() {
  const model = loadProcess(json('process/tutorial/features/Feature13.p.json'), json('dataclass/tutorial/Feature13Data.d.json'), {
    project: 'tutorial', file: 'Feature13.p.json', classes: [json('dataclass/tutorial/HumanFeedback.d.json')], cms: CMS,
    toolProcess: { file: 'Feature13Tools.p.json', process: json('process/tutorial/tools/Feature13Tools.p.json'), dataClass: json('dataclass/tutorial/Feature13ToolsData.d.json') }
  });
  const logs = [];
  const io = { log: entry => logs.push(entry), dialog: () => ({ answer: 'A reason.' }), pause: () => {} };
  const runner = new ProcessRunner({ model, brain: { respond }, io, simulates: SIMULATES });
  return { runner, logs, agent: elementById(model, 'f5').config.userConfig };
}

async function run({ start = LOW, variables = VARIABLES, change } = {}) {
  const { runner, logs, agent } = setup();
  if (change) change(agent);
  const result = await runner.run({ variablesText: variables, start });
  const messages = logs.map(l => String(l.message));
  return { result, call: result.agentCalls[0], logs, messages, last: messages[messages.length - 1] };
}

test('cause: an inherited default guardrail blocks a valid note in the User message', async () => {
  const variables = VARIABLES.replace('    Providers:\n', DEFAULT_GUARDRAIL + '    Providers:\n');
  assert.match(variables, /\n {4}Guardrails:\n {6}DefaultInput: "PromptInjectionInputGuardrail"\n {4}Providers:\n/);
  const passed = await run({ variables });
  assert.equal(passed.call.status, 'answered', 'without the note the default lets the invoice through');
  const { result, call, last } = await run({ variables, change: a => { a.query = TEST_NOTE + a.query; } });
  assert.equal(call.status, 'blocked');
  assert.deepEqual(call.guardrails.map(g => [g.name, g.allowed]), [['PromptInjectionInputGuardrail', false]]);
  assert.equal(call.answer, undefined, 'the model was never asked');
  assert.equal(result.status, 'failed', 'the boundary event catches only human:decision');
  assert.match(last, /smartworkflow:guardrail:input:violation/);
});

test('cause: a file of an unsupported type skips the whole call', async () => {
  const { call, messages } = await run({ change: a => { a.query = a.query + ' ' + CMS_WORD; } });
  assert.equal(call.status, 'skipped');
  assert.equal(call.queryError, 'Unsupported CMS file type for object: PurchaseOrder with extension: docx');
  const skip = messages.indexOf('Agent call was skipped, since there was no user query');
  assert.ok(skip > 0, 'the same line as for an empty message');
  assert.equal(messages[skip - 1], call.queryError, 'the error is the line just before');
});

test('cause: without the tool named in the System message, the agent does not pause', async () => {
  const { call, result } = await run({ start: HIGH, change: a => { a.system = a.system.replace('use the askUserFeedback tool to ask', 'ask'); } });
  assert.deepEqual(call.tools.map(t => t.name), ['askUserFeedback'], 'the tool still goes with the request');
  assert.equal(call.steps.length, 0, 'but it is never called');
  assert.match(call.answer, /My instructions do not say how to get one/);
  assert.ok(!result.visited.includes('f26'), 'nobody is asked');
});

test('cause: a CMS path that does not exist attaches nothing, and nothing is logged', async () => {
  const { call, logs } = await run({ change: a => { a.query = a.query + ' ' + CMS_TYPO; } });
  assert.equal(call.status, 'answered');
  assert.deepEqual(call.files, []);
  assert.ok(call.userParts.some(p => p.type === 'missing' && p.path === '/Files/Documents/InvoiceSampel'));
  assert.ok(!logs.some(l => l.level === 'error' || l.level === 'warn'), 'no error or warning');
});

test('cause: a PDF sent to Ollama fails at the provider', async () => {
  const { call, result, last } = await run({ change: a => { a.provider = '"Ollama"'; a.query = a.query + ' ' + CMS_PDF; } });
  assert.equal(call.status, 'failed');
  assert.equal(result.status, 'failed');
  assert.equal(last, 'Ollama does not accept PDF files, so the call with InvoiceSample.pdf failed');
});

test('behaviour: a file in the System message is not read, only its toString() is sent', async () => {
  const { call, logs } = await run({ start: HIGH, change: a => { a.system = CMS_SYSTEM; } });
  assert.match(call.system, /^Binary@[0-9a-f]{6}$/);
  assert.equal(call.system, binaryText('/Files/Documents/mySystemPrompt'), 'the same text for the same file');
  assert.deepEqual(call.systemParts.map(p => p.type), ['binary']);
  assert.deepEqual(call.files, [], 'nothing is attached');
  assert.equal(call.steps.length, 0, 'without its rules the agent does not ask anyone');
  assert.match(call.answer, /My instructions do not say how to get one/);
  assert.ok(!logs.some(l => l.level === 'error' || l.level === 'warn'), 'and nothing is logged');
});

test('macro: files are attached in the User message, turned into text in the System message', () => {
  const ctx = { cms: CMS };
  const user = expandMacro('Rules: ' + CMS_SYSTEM, ctx);
  assert.deepEqual(user.files.map(f => f.name), ['mySystemPrompt.pdf']);
  const system = expandMacro('Rules: ' + CMS_SYSTEM, ctx, { attachFiles: false });
  assert.deepEqual(system.files, []);
  assert.equal(system.text, 'Rules: ' + binaryText('/Files/Documents/mySystemPrompt'));
  // a Word file is not an error there either: it is turned into text the same way
  assert.equal(expandMacro(CMS_WORD, ctx, { attachFiles: false }).error, null);
  assert.equal(expandMacro(CMS_WORD, ctx).error.message, 'Unsupported CMS file type for object: PurchaseOrder with extension: docx');
});

test('behaviour: an expression without its closing %> goes to the model as raw text', async () => {
  const { call } = await run({ change: a => { a.query = '<%=in.query%'; } });
  assert.equal(call.user, '<%=in.query%');
  assert.equal(call.answer, 'I could not find an invoice total in your message.');
});

test('problem: a variable called Model instead of DefaultModel is ignored', async () => {
  const variables = VARIABLES.replace('        APIKey: "sk-..."\n', '        APIKey: "sk-..."\n        Model: "gpt-4o"\n');
  assert.equal((await run({ variables })).call.model, 'gpt-4.1-mini');
  assert.equal((await run({ variables: variables.replace('Model:', 'DefaultModel:') })).call.model, 'gpt-4o');
});

test('the walkthrough: every cause is a part of its chapter, with its texts in both languages', () => {
  const source = readFileSync(fileURLToPath(new URL('../features/appendix-05/tour.js', import.meta.url)), 'utf8');
  // per problem: 6 causes, 11 causes, 4 behaviours, 7 problems, 3 messages
  const split = tour.chapters.filter(c => c.parts);
  assert.deepEqual(split.map(c => [c.id, c.label, c.parts.length]), [
    ['noAnswer', 'cause', 6], ['unexpected', 'cause', 11], ['messages', 'behaviour', 4], ['configuration', 'problem', 7], ['humanInTheLoop', 'message', 3]]);
  const parts = split.flatMap(c => c.parts.map(p => p.id));
  assert.equal(new Set(parts).size, parts.length, 'every part has its own id');
  split.flatMap(c => c.parts).forEach(p => assert.equal(typeof p.play, 'function', p.id));
  // every quoted name in the walkthrough that is not a field, tab, panel or label is a note
  const NOT_NOTES = new Set(['cause', 'behaviour', 'problem', 'message', 'ask', 'model', 'provider', 'temperature', 'inputGuardrails',
    'outputGuardrails', 'tools', 'guardrails', 'query', 'system', 'resultMapping', 'resultType', 'configuration', 'general', 'output',
    'error', 'variables', 'vars', 'process', 'chat', 'log']);
  const notes = [...new Set([...source.matchAll(/'([a-z][A-Za-z]+)'/g)].map(m => m[1]))]
    .filter(key => !NOT_NOTES.has(key) && !/^f[A-Z0-9]/.test(key) && !tour.chapters.some(c => c.id === key) && !parts.includes(key)); // fL etc. are element ids
  assert.ok(notes.length > 80, notes.length + ' notes');
  for (const lang of ['en', 'ja']) {
    parts.forEach(id => assert.ok(strings[lang]['tour.' + id + '.title'], lang + ': the name of ' + id));
    notes.forEach(key => {
      assert.ok(strings[lang]['tour.' + key + '.title'], lang + ': tour.' + key + '.title');
      assert.ok(strings[lang]['tour.' + key + '.text'], lang + ': tour.' + key + '.text');
    });
    ['cause', 'behaviour', 'problem', 'message'].forEach(label => {
      assert.match(strings[lang]['tour.screen.' + label], /\{n\}.*\{total\}/, lang + ': ' + label);
      assert.match(strings[lang]['tour.count.' + label], /\{n\}/, lang + ': count of ' + label);
    });
    tour.chapters.forEach(c => assert.ok(strings[lang]['tour.chapter.' + c.id], lang + ': chapter ' + c.id));
  }
});

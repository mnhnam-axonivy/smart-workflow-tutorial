import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig, toolStarts, docOf, docView, startElement, restore, TOOLS_PREFIX } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { runScript, mapJson } from '../runtime/model/ivyscript.js';
import { respond, plannedTools } from '../features/feature-05/agent.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const processJson = json('process/tutorial/features/Feature05.p.json');
const dataClassJson = json('dataclass/tutorial/Feature05Data.d.json');
const decisionJson = json('dataclass/tutorial/InvoiceDecision.d.json');
const toolsJson = json('process/tutorial/tools/Feature05Tools.p.json');
const toolsDataJson = json('dataclass/tutorial/Feature05ToolsData.d.json');

const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n';
const TAX = TOOLS_PREFIX + 'f10';
const DECISION = { __type: 'tutorial.InvoiceDecision', approverUsername: 'bob.smith', effectiveTaxRate: '8%', isAutoApprove: false };

function setup() {
  const model = loadProcess(processJson, dataClassJson, {
    project: 'tutorial', file: 'Feature05.p.json', classes: [decisionJson],
    toolProcess: { file: 'Feature05Tools.p.json', process: toolsJson, dataClass: toolsDataJson }
  });
  const events = [];
  const io = {
    enter: e => { events.push('enter:' + e.id); },
    agent: (phase, p) => { events.push('agent:' + phase + (p.step ? ':' + p.step.name : '')); },
    pause: (e, reason, p) => { events.push('pause:' + e.id + ':' + reason + ':' + ((p && p.user) || '')); },
    note: (key, p) => { if (/gateway/.test(key)) events.push(key + ':' + p.condition + '→' + p.target.name); }
  };
  const runner = new ProcessRunner({ model, brain: { respond }, io, simulates: { tools: true, structuredOutput: true } });
  return { model, runner, events, agent: elementById(model, 'f5') };
}

const run = (runner, variablesText = VARIABLES) => runner.run({ variablesText });

// ── The two files ────────────────────────────────────────────────────────────

test('model: the tools file is part of the model, with ids of its own', () => {
  const { model } = setup();
  assert.deepEqual(model.docs.map(d => d.id + ' ' + d.file + ' ' + d.dataClass.name), ['process Feature05.p.json tutorial.Feature05Data', 'tools Feature05Tools.p.json tutorial.Feature05ToolsData']);
  assert.equal(docView(model, 'process').elements.length, 9);
  assert.equal(docView(model, 'tools').elements.length, 9);
  assert.equal(new Set(model.elements.map(e => e.id)).size, 18, 'every id is unique');
  assert.equal(startElement(model).id, 'f0', 'a run starts in the process, not in a tool');
  const start = elementById(model, TAX);
  assert.equal(start.rawId, 'f10');
  assert.equal(docOf(model, start).id, 'tools');
  assert.deepEqual(start.outgoing.map(c => c.to), [TOOLS_PREFIX + 'f13']);
  assert.deepEqual(start.tags, ['tool']);
  assert.match(start.description, /^Use this tool to look up the applicable VAT rate/);
});

test('tools: every start tagged "tool" is offered with name, description and parameters', () => {
  const { model } = setup();
  const tools = toolStarts(model);
  assert.deepEqual(tools.map(t => t.name), ['lookupApprovalPolicy', 'calculateEffectiveTaxRate', 'chooseApprover']);
  const tax = tools[1];
  assert.deepEqual(tax.params, [{ name: 'currency', type: 'String', description: 'ISO 4217 currency code of the invoice' }]);
  assert.deepEqual(tax.result, [{ name: 'taxRate', type: 'String', description: 'Effective tax rate as a percentage string, e.g. 21%' }]);
  assert.deepEqual(tax.inputMap, { 'out.currency': 'param.currency' });
  assert.deepEqual(tax.resultMap, { 'result.taxRate': 'in.taxRate' });
  elementById(model, TAX).tags = [];
  assert.deepEqual(toolStarts(model).map(t => t.name), ['lookupApprovalPolicy', 'chooseApprover'], 'without the tag it is no tool');
  restore(model, model.original);
  assert.equal(toolStarts(model).length, 3, 'reset brings the tag back');
});

test('tools: the scripts of the three tools run as written', () => {
  const { model } = setup();
  const fields = model.docs[1].dataClass.fields;
  const script = id => elementById(model, TOOLS_PREFIX + id).config.output.code;
  const out = (id, data) => { runScript(script(id), { data, fields }); return data; };
  assert.equal(out('f3', { amount: ' 10560.00 ' }).policy, 'REQUIRES_APPROVAL');
  assert.equal(out('f3', { amount: '5000' }).policy, 'STANDARD');
  assert.equal(out('f3', { amount: 'JPY 10,560.00' }).policy, 'STANDARD', 'not a number: the catch block decides');
  assert.deepEqual(['EUR', 'gbp', 'USD', 'JPY', 'CHF', ''].map(c => out('f13', { currency: c }).taxRate), ['21%', '20%', '10%', '8%', '10%', '10%']);
  assert.deepEqual(['60000', '10560.00', '10000', 'x'].map(a => out('f23', { amount: a }).approver), ['alice.chen', 'bob.smith', 'carol.jones', 'carol.jones']);
  assert.equal(mapJson({ taxRate: '8%' }), '{\n  "taxRate" : "8%"\n}');
});

// ── The stand-in model ───────────────────────────────────────────────────────

test('agent: it asks for the tools the system message names, in that order, one per turn', () => {
  const { model, agent } = setup();
  const system = agentConfig(agent).system;
  const tools = toolStarts(model);
  assert.deepEqual(plannedTools(system, tools).map(t => t.name), ['calculateEffectiveTaxRate', 'lookupApprovalPolicy', 'chooseApprover']);
  const invoice = 'Total Amount Due: JPY 10,560.00\n';
  assert.deepEqual(respond({ system, user: invoice, tools }).toolCalls, [{ name: 'calculateEffectiveTaxRate', arguments: { currency: 'JPY' } }]);
  assert.deepEqual(respond({ system, user: invoice, tools, toolResults: [{ name: 'calculateEffectiveTaxRate', values: { taxRate: '8%' } }] }).toolCalls,
    [{ name: 'lookupApprovalPolicy', arguments: { amount: '10560.00' } }]);
  assert.equal(respond({ system, user: invoice, tools: [] }).toolCalls, undefined, 'a tool that did not come with the request cannot be asked for');
  assert.equal(respond({ system: 'Decide.', user: invoice, tools }).toolCalls, undefined, 'nor one the system message does not name');
  assert.equal(respond({ system, user: 'hello', tools }).toolCalls, undefined, 'and without an invoice there is nothing to look up');
});

// ── The run ──────────────────────────────────────────────────────────────────

test('runner: three tool calls, then the decision, then the gateway sends it to Manager Review', async () => {
  const { runner, events } = setup();
  const result = await run(runner);
  assert.equal(result.status, 'completed');
  const call = result.agentCalls[0];
  assert.deepEqual(call.tools.map(t => t.name), ['lookupApprovalPolicy', 'calculateEffectiveTaxRate', 'chooseApprover']);
  assert.deepEqual(call.toolsNotFound, []);
  assert.deepEqual(call.steps.map(s => [s.name, s.arguments, s.values]), [
    ['calculateEffectiveTaxRate', { currency: 'JPY' }, { taxRate: '8%' }],
    ['lookupApprovalPolicy', { amount: '10560.00' }, { policy: 'REQUIRES_APPROVAL' }],
    ['chooseApprover', { amount: '10560.00' }, { approver: 'bob.smith' }]]);
  assert.equal(call.steps[0].result, '{\n  "taxRate" : "8%"\n}');
  assert.equal(call.answer, '{\n  "approverUsername": "bob.smith",\n  "effectiveTaxRate": "8%",\n  "isAutoApprove": false\n}');
  assert.deepEqual(call.guessed, []);
  assert.deepEqual(result.data.invoiceDecision, DECISION);
  assert.equal(result.logs.filter(l => /REST service langChain/.test(l.message)).length, 4, 'one HTTP call per turn of the model');
  assert.equal(result.logs[result.logs.length - 1].message, '{\n  "approverUsername" : "bob.smith",\n  "effectiveTaxRate" : "8%",\n  "isAutoApprove" : false\n}');
  // each tool runs its sub-process between the model asking and getting the result
  const from = events.indexOf('agent:tool-call:calculateEffectiveTaxRate');
  assert.deepEqual(events.slice(from, from + 5), ['agent:tool-call:calculateEffectiveTaxRate', 'enter:tools-f10', 'enter:tools-f13', 'enter:tools-f11', 'agent:tool-result:calculateEffectiveTaxRate']);
  assert.deepEqual(result.routes, [{ gateway: 'fG', connectorId: 'cG2', condition: 'in.invoiceDecision.isAutoApprove == false', to: 'f8' }]);
  assert.ok(events.includes('gateway:in.invoiceDecision.isAutoApprove == false→Manager Review'));
  assert.deepEqual(result.tasks, [{ elementId: 'f8', name: 'Manager Review', description: '', user: 'bob.smith' }]);
  assert.ok(events.includes('pause:f8:task:bob.smith'));
  assert.deepEqual(result.visited.slice(-3), ['fG', 'f8', 'f9']);
  assert.ok(!result.visited.some(id => id.startsWith(TOOLS_PREFIX)), 'the tool elements are not steps of the process');
});

test('runner: a small invoice is auto-approved', async () => {
  const { runner, model } = setup();
  const mock = elementById(model, 'fA');
  mock.config.output.code = mock.config.output.code.replace('JPY 10,560.00', 'EUR 480.00');
  const result = await run(runner);
  assert.deepEqual(result.data.invoiceDecision, { __type: 'tutorial.InvoiceDecision', approverUsername: 'carol.jones', effectiveTaxRate: '21%', isAutoApprove: true });
  assert.deepEqual(result.routes.map(r => r.connectorId + ' ' + r.condition + ' ' + r.to), ['cG1  f1']);
  assert.deepEqual(result.tasks, []);
  assert.equal(result.visited[result.visited.length - 1], 'f1');
});

test('runner: a renamed signature drops the tool without an error, and the model guesses', async () => {
  const { runner, model } = setup();
  elementById(model, TAX).config.signature = 'calculateTaxRate';
  const result = await run(runner);
  assert.equal(result.status, 'completed', 'nothing fails');
  const call = result.agentCalls[0];
  assert.deepEqual(call.tools.map(t => t.name), ['lookupApprovalPolicy', 'chooseApprover']);
  assert.deepEqual(call.toolsNotFound, ['calculateEffectiveTaxRate']);
  assert.deepEqual(call.steps.map(s => s.name), ['lookupApprovalPolicy', 'chooseApprover']);
  assert.equal(result.data.invoiceDecision.effectiveTaxRate, '10%', 'the rate printed on the invoice, not the 8% of the rule');
  assert.deepEqual(call.guessed, ['effectiveTaxRate']);
  assert.ok(call.insights.some(i => i.id === 'guessed-not-offered' && i.field === 'effectiveTaxRate'));
  // "Show result from AI" logs with ivy.log.error; nothing else may complain
  assert.ok(!result.logs.some(l => l.category !== 'USER' && (l.level === 'error' || l.level === 'warn')));
});

test('runner: a tool the system message no longer names is not called', async () => {
  const { runner, agent } = setup();
  const cfg = agentConfig(agent);
  cfg.system = cfg.system.split('\n').filter(line => !line.includes('chooseApprover')).join('\n');
  const result = await run(runner);
  const call = result.agentCalls[0];
  assert.equal(call.tools.length, 3, 'it is still offered');
  assert.deepEqual(call.steps.map(s => s.name), ['calculateEffectiveTaxRate', 'lookupApprovalPolicy']);
  assert.deepEqual(call.guessed, ['approverUsername']);
  assert.equal(result.data.invoiceDecision.approverUsername, 'finance.manager');
  assert.ok(call.insights.some(i => i.id === 'tool-unused' && i.names.join() === 'chooseApprover'));
});

test('runner: without selected tools the agent has none', async () => {
  const { runner, agent } = setup();
  delete agentConfig(agent).tools;
  const result = await run(runner);
  const call = result.agentCalls[0];
  assert.deepEqual(call.tools, []);
  assert.deepEqual(call.steps, []);
  assert.deepEqual(call.guessed, ['approverUsername', 'effectiveTaxRate', 'isAutoApprove']);
  assert.equal(result.logs.filter(l => /REST service langChain/.test(l.message)).length, 1);
});

test('runner: an error in a tool script fails the agent step', async () => {
  const { runner, model, events } = setup();
  elementById(model, TOOLS_PREFIX + 'f13').config.output.code = 'in.taxRate = in.missing;';
  const result = await run(runner);
  assert.equal(result.status, 'failed');
  assert.equal(result.failedAt, 'f5');
  assert.equal(result.error.kind, 'tool');
  assert.match(result.error.message, /^The tool calculateEffectiveTaxRate failed: IvyScript error in line 1: Field 'missing' does not exist on tutorial\.Feature05ToolsData$/);
  assert.equal(result.agentCalls[0].status, 'failed');
  assert.ok(events.includes('agent:failed') && !events.includes('agent:response'));
});

test('runner: lessons that do not simulate tools offer none, whatever is selected', async () => {
  const { model } = setup();
  const runner = new ProcessRunner({ model, brain: { respond }, io: {}, simulates: { structuredOutput: true } });
  const result = await run(runner);
  assert.deepEqual(result.agentCalls[0].tools, []);
  assert.deepEqual(result.agentCalls[0].toolsNotFound, []);
});

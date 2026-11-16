import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig, startElement, connectors, restore, configList } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { respond, extractInvoiceFacts, readInstructions } from '../features/feature-01/agent.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const processJson = json('process/tutorial/features/Feature01.p.json');
const dataClassJson = json('dataclass/tutorial/Feature01Data.d.json');

const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n';
const EXPECTED = 'The invoice INV-2024-00123 from Acme Supplies Ltd. has a total amount of JPY 10,560.00 and is due on 2024-06-30.';

function setup() {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature01.p.json' });
  const events = [];
  const io = {
    travel: c => { events.push('travel:' + c.from.id + '>' + c.to.id); },
    enter: e => { events.push('enter:' + e.id); },
    leave: (e, outcome) => { events.push('leave:' + e.id + ':' + outcome); },
    agent: phase => { events.push('agent:' + phase); },
    note: key => { events.push('note:' + key); },
    data: (field) => { events.push('data:' + field); }
  };
  const runner = new ProcessRunner({ model, brain: { respond }, io, now: () => new Date(2026, 5, 29, 14, 41, 33, 550) });
  return { model, runner, events, agent: elementById(model, 'f5') };
}

// ── Process model ────────────────────────────────────────────────────────────

test('process: loads the real Feature01 process', () => {
  const { model } = setup();
  assert.equal(model.id, '19EFE795311DA223');
  assert.equal(model.dataClass.name, 'tutorial.Feature01Data');
  assert.deepEqual(model.dataClass.fields.map(f => f.name), ['invoiceText', 'summary']);
  assert.deepEqual(model.elements.map(e => e.kind).sort(), ['agent', 'end', 'script', 'script', 'start', 'task']);
  assert.equal(startElement(model).name, 'Acme Corp invoice processing');
  assert.equal(connectors(model).length, 5);
  const mock = elementById(model, 'f7');
  assert.equal(mock.color, '#fbff00');
  assert.match(mock.config.output.code, /^in\.invoiceText = "INVOICE\\n" \+\n/);
  const agent = elementById(model, 'f5');
  assert.equal(agent.isAgent, true);
  assert.equal(agentConfig(agent).query, '<%=in.invoiceText%>');
  assert.ok(!agentConfig(agent).system.includes('\r'), 'prompts are normalised to LF');
});

test('process: restore brings back the original configuration', () => {
  const { model, agent } = setup();
  agentConfig(agent).system = 'changed';
  agent.removed = true;
  restore(model, model.original);
  assert.match(agentConfig(agent).system, /^You are an invoice summary agent/);
  assert.equal(agent.removed, false);
});

test('process: configList reads the stored list formats', () => {
  assert.deepEqual(configList('["a", "b"]'), ['a', 'b']);
  assert.deepEqual(configList('"OpenAI"'), ['OpenAI']);
  assert.deepEqual(configList(''), []);
  assert.deepEqual(configList(undefined), []);
});

// ── Runner: the happy path matches what the real engine logs ─────────────────

test('runner: the unchanged process produces the summary shown in the tutorial', async () => {
  const { runner, events } = setup();
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.visited, ['f0', 'f7', 'f3', 'f5', 'f9', 'f1']);
  assert.equal(result.data.summary, EXPECTED);
  assert.match(result.data.invoiceText, /^INVOICE\nInvoice Number: INV-2024-00123\n/);

  const [rest, user] = result.logs;
  assert.equal(result.logs.length, 2);
  assert.deepEqual([rest.level, rest.project, rest.category, rest.context], ['info', 'tutorial', 'REST_CLIENT', '19EFE795311DA223-f5']);
  assert.match(rest.message, /^REST service langChain \(langChain\) call to POST https:\/\/api\.openai\.com\/v1\/chat\/completions successful executed in \d \[s\]\. Response status was 200 OK$/);
  assert.deepEqual([user.level, user.category, user.context, user.message], ['error', 'USER', '19EFE795311DA223-f9', EXPECTED]);

  const call = result.agentCalls[0];
  assert.equal(call.status, 'answered');
  assert.equal(call.provider, 'OpenAI');
  assert.equal(call.model, 'gpt-4.1-mini');
  assert.match(call.system, /^You are an invoice summary agent for Acme Corp\./);
  assert.match(call.user, /^INVOICE\n/);
  assert.equal(call.mapping, 'mapped');
  assert.deepEqual(events.filter(e => e.startsWith('agent:')), ['agent:request', 'agent:thinking', 'agent:response', 'agent:mapped', 'agent:end']);
  assert.ok(events.indexOf('travel:f3>f5') < events.indexOf('enter:f5'));
});

test('runner: edits to the mock data flow through to the summary', async () => {
  const { runner, model } = setup();
  const mock = elementById(model, 'f7');
  mock.config.output.code = mock.config.output.code.replace('INV-2024-00123', 'INV-2026-00777').replace('JPY 10,560.00', 'USD 99.00');
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.data.summary, 'The invoice INV-2026-00777 from Acme Supplies Ltd. has a total amount of USD 99.00 and is due on 2024-06-30.');
});

// ── Runner: behaviour copied from AgentCallExecutor ──────────────────────────

test('runner: without a user message the agent call is skipped and the process continues', async () => {
  for (const query of ['', undefined, '<%=in.summary%>', '   ']) {
    const { runner, agent } = setup();
    agentConfig(agent).query = query;
    const result = await runner.run({ variablesText: VARIABLES });
    assert.equal(result.status, 'completed', 'query=' + JSON.stringify(query));
    assert.equal(result.agentCalls[0].status, 'skipped');
    assert.equal(result.logs[0].message, 'Agent call was skipped, since there was no user query');
    assert.equal(result.logs[0].level, 'info');
    assert.equal(result.logs[result.logs.length - 1].message, '', 'the result script logs an empty summary');
  }
});

test('runner: a broken expression in the user message is logged and skips the call', async () => {
  const { runner, agent } = setup();
  agentConfig(agent).query = '<%=in.invoiceTxt%>';
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  assert.equal(result.agentCalls[0].reason, 'query-error');
  assert.equal(result.logs[0].level, 'error');
  assert.match(result.logs[0].message, /invoiceTxt/);
  assert.equal(result.logs[1].message, 'Agent call was skipped, since there was no user query');
});

test('runner: literal text around the expression is part of the user message', async () => {
  const { runner, agent } = setup();
  agentConfig(agent).query = 'Please summarize:\n<%=in.invoiceText%>';
  const result = await runner.run({ variablesText: VARIABLES });
  assert.match(result.agentCalls[0].user, /^Please summarize:\nINVOICE\n/);
  assert.equal(result.data.summary, EXPECTED);
});

test('runner: without a mapping the answer is discarded; a wrong mapping is logged but not fatal', async () => {
  let s = setup();
  agentConfig(s.agent).resultMapping = '';
  let result = await s.runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  assert.equal(result.agentCalls[0].answer, EXPECTED);
  assert.equal(result.agentCalls[0].mapping, 'none');
  assert.equal(result.data.summary, undefined);

  s = setup();
  agentConfig(s.agent).resultMapping = 'in.sumary';
  result = await s.runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  assert.equal(result.agentCalls[0].mapping, 'failed');
  assert.ok(result.logs.some(l => l.level === 'error' && l.message === 'Failed to map result to in.sumary'));

  s = setup();
  agentConfig(s.agent).resultMapping = 'in.invoiceText';
  result = await s.runner.run({ variablesText: VARIABLES });
  assert.equal(result.data.invoiceText, EXPECTED);
});

test('runner: a missing API key fails the agent step and stops the process', async () => {
  const { runner, events } = setup();
  const result = await runner.run({ variablesText: 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n' });
  assert.equal(result.status, 'failed');
  assert.equal(result.failedAt, 'f5');
  assert.equal(result.error.kind, 'auth');
  assert.equal(result.error.variable, 'AI.Providers.OpenAI.APIKey');
  assert.deepEqual(result.visited, ['f0', 'f7', 'f3', 'f5']);
  assert.ok(events.includes('leave:f5:error'));
  assert.ok(!events.includes('enter:f9'));
});

test('runner: provider resolution follows ChatModelFactory', async () => {
  let s = setup();
  let result = await s.runner.run({ variablesText: 'Variables:\n  AI:\n    DefaultProvider: "Mistral"\n' });
  assert.equal(result.status, 'failed');
  assert.equal(result.error.message, 'Unknown model provider Mistral');

  s = setup();
  result = await s.runner.run({ variablesText: 'Variables:\n  AI:\n    Providers:\n      OpenAI:\n        APIKey: k\n' });
  assert.equal(result.agentCalls[0].provider, 'OpenAI', 'falls back to OpenAI when DefaultProvider is not set');

  s = setup();
  agentConfig(s.agent).provider = '"Ollama"';
  agentConfig(s.agent).model = '"llama3.2"';
  result = await s.runner.run({ variablesText: '' });
  assert.equal(result.status, 'completed');
  assert.equal(result.agentCalls[0].url, 'http://localhost:11434/api/chat');
});

test('runner: invalid variables.yaml and script errors stop the run at the right element', async () => {
  let s = setup();
  let result = await s.runner.run({ variablesText: 'Variables:\n\tAI: x\n' });
  assert.equal(result.failedAt, 'f5');
  assert.equal(result.error.kind, 'variables');

  s = setup();
  elementById(s.model, 'f7').config.output.code = 'in.invoiceText = "open';
  result = await s.runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'failed');
  assert.equal(result.failedAt, 'f7');
  assert.equal(result.error.kind, 'script');
  assert.deepEqual(result.visited, ['f0', 'f7']);
});

test('runner: a removed agent leaves the process incomplete', async () => {
  const { runner, agent } = setup();
  agent.removed = true;
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.missing, 'f5');
  assert.deepEqual(result.visited, ['f0', 'f7', 'f3']);
});

/** A runner whose pauses are recorded and released by the test. */
function pausable(model) {
  const state = { paused: [], entered: [], release: null };
  state.runner = new ProcessRunner({
    model,
    brain: { respond },
    io: {
      enter: el => { state.entered.push(el.id); },
      pause: (el, reason) => { state.paused.push(el.id + ':' + reason); return new Promise(r => { state.release = r; }); }
    }
  });
  return state;
}
const tick = () => new Promise(r => setTimeout(r, 5));

test('runner: step mode runs one element, waits before the next, and cancel stops the run', async () => {
  const s = pausable(loadProcess(processJson, dataClassJson, { project: 'tutorial' }));
  const pending = s.runner.run({ variablesText: VARIABLES, stepMode: true, breakpoints: new Set(['f7']) });
  await tick();
  assert.deepEqual(s.entered, ['f0'], 'the first step executes the start element');
  assert.deepEqual(s.paused, ['f7:step'], 'and waits before the next one');
  s.release();
  await tick();
  assert.deepEqual(s.entered, ['f0', 'f7'], 'a breakpoint does not halt again where a step already did');
  assert.deepEqual(s.paused, ['f7:step', 'f3:step']);
  s.runner.cancel();
  s.release();
  assert.equal((await pending).status, 'cancelled');
  assert.equal(s.runner.running, false);
});

test('runner: a breakpoint halts before its element; leaving step mode lets the run finish', async () => {
  const s = pausable(loadProcess(processJson, dataClassJson, { project: 'tutorial' }));
  const pending = s.runner.run({ variablesText: VARIABLES, breakpoints: new Set(['f5']) });
  await tick();
  assert.deepEqual(s.paused, ['f5:breakpoint']);
  assert.deepEqual(s.entered, ['f0', 'f7', 'f3']);
  s.runner.setStepMode(true);
  s.release();
  await tick();
  assert.deepEqual(s.paused, ['f5:breakpoint', 'f9:step']);
  s.runner.setStepMode(false);
  s.release();
  const result = await pending;
  assert.equal(result.status, 'completed');
  assert.equal(result.data.summary, EXPECTED);
});

test('runner: a task without Skip Tasklist waits until someone continues it', async () => {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial' });
  elementById(model, 'f3').config.task.skipTasklist = false;
  const s = pausable(model);
  const pending = s.runner.run({ variablesText: VARIABLES });
  await tick();
  assert.deepEqual(s.paused, ['f3:task']);
  s.release();
  assert.equal((await pending).status, 'completed');
});

// ── The simulated model ──────────────────────────────────────────────────────

const INVOICE = 'INVOICE\nInvoice Number: INV-2024-00123\nDate: 2024-06-01\nDue Date: 2024-06-30\n\nSupplier:\nAcme Supplies Ltd.\n123 Commerce Street, Tokyo, Japan\n\nBill To:\nAcme Corp\n456 Business Avenue, Osaka, Japan\n\nDescription                  Qty   Unit Price   Total\nOffice Supplies              10    500.00       5,000.00\nPrinter Paper (A4, 500 pcs)   5    800.00       4,000.00\nDesk Organizer                3    200.00         600.00\n\nSubtotal: JPY 9,600.00\nTax (10%): JPY 960.00\nTotal Amount Due: JPY 10,560.00\n\nPayment Terms: Net 30\nBank: Sumitomo Mitsui Banking Corporation\nAccount Number: 1234567890\n';
const SYSTEM = 'You are an invoice summary agent for Acme Corp.\nRead the invoice text and return a single sentence summary containing:\nthe invoice number, supplier name, total amount, and due date.\nDo not add any other commentary.';

test('agent: reads the facts out of the invoice text', () => {
  const f = extractInvoiceFacts(INVOICE);
  assert.equal(f.number, 'INV-2024-00123');
  assert.equal(f.date, '2024-06-01');
  assert.equal(f.due, '2024-06-30');
  assert.equal(f.supplier, 'Acme Supplies Ltd.');
  assert.equal(f.billTo, 'Acme Corp');
  assert.equal(f.total, 'JPY 10,560.00');
  assert.equal(f.subtotal, 'JPY 9,600.00');
  assert.equal(f.tax, 'JPY 960.00');
  assert.equal(f.terms, 'Net 30');
  assert.deepEqual(f.items.map(i => i.description), ['Office Supplies', 'Printer Paper (A4, 500 pcs)', 'Desk Organizer']);
});

test('agent: interprets the tutorial system prompt', () => {
  const i = readInstructions(SYSTEM);
  assert.deepEqual(i.fields, ['number', 'supplier', 'total', 'due']);
  assert.equal(i.singleSentence, true);
  assert.equal(i.noCommentary, true);
  assert.equal(i.language, 'en');
  assert.equal(readInstructions('   '), null);
});

test('agent: the tutorial configuration gives the sentence from the tutorial', () => {
  assert.equal(respond({ system: SYSTEM, user: INVOICE }).text, EXPECTED);
});

test('agent: only the requested facts are reported', () => {
  const noDue = SYSTEM.replace(', and due date', '').replace('total amount', 'and total amount');
  assert.equal(respond({ system: noDue, user: INVOICE }).text, 'The invoice INV-2024-00123 from Acme Supplies Ltd. has a total amount of JPY 10,560.00.');
  assert.equal(respond({ system: 'Return a single sentence with the supplier only. Do not add commentary.', user: INVOICE }).text, 'The invoice is from Acme Supplies Ltd.');
  assert.equal(respond({ system: 'Return one sentence with the invoice number and payment terms. No commentary.', user: INVOICE }).text, 'The invoice INV-2024-00123 has payment terms of Net 30.');
  assert.equal(respond({ system: 'One sentence: the subtotal. Nothing else.', user: INVOICE }).text, 'The invoice has a subtotal of JPY 9,600.00.');
});

test('agent: dropping "no commentary" or "single sentence" changes the shape of the answer', () => {
  const chatty = respond({ system: SYSTEM.replace('\nDo not add any other commentary.', ''), user: INVOICE });
  assert.ok(chatty.text.startsWith('Sure! Here is the summary of the invoice:'));
  assert.ok(chatty.text.includes(EXPECTED));
  assert.ok(chatty.insights.some(i => i.id === 'chatty'));

  const several = respond({ system: SYSTEM.replace('a single sentence summary', 'a summary'), user: INVOICE });
  assert.equal(several.text, 'Invoice INV-2024-00123 was issued by Acme Supplies Ltd. The total amount is JPY 10,560.00. Payment is due on 2024-06-30.');
});

test('agent: bullet lists, JSON and Japanese answers', () => {
  assert.equal(respond({ system: SYSTEM.replace('a single sentence summary', 'a bullet list'), user: INVOICE }).text,
    '- Invoice number: INV-2024-00123\n- Supplier: Acme Supplies Ltd.\n- Total amount: JPY 10,560.00\n- Due date: 2024-06-30');
  assert.deepEqual(JSON.parse(respond({ system: SYSTEM + '\nAnswer as JSON.', user: INVOICE }).text),
    { invoiceNumber: 'INV-2024-00123', supplierName: 'Acme Supplies Ltd.', totalAmount: 'JPY 10,560.00', dueDate: '2024-06-30' });
  const ja = respond({ system: SYSTEM + '\nAnswer in Japanese.', user: INVOICE });
  assert.equal(ja.text, '請求書 INV-2024-00123（Acme Supplies Ltd. 発行）の合計金額は JPY 10,560.00、支払期限は 2024-06-30 です。');
  assert.ok(ja.insights.some(i => i.id === 'language' && i.language === 'ja'));
  const jaPrompt = respond({ system: 'あなたはAcme Corpの請求書要約エージェントです。請求書番号、サプライヤー、合計金額、支払期限を一文で返してください。余計なコメントは不要です。', user: INVOICE });
  assert.equal(jaPrompt.text, ja.text);
});

test('agent: facts missing from the text are named, not invented', () => {
  const noDue = INVOICE.replace('Due Date: 2024-06-30\n', '');
  const reply = respond({ system: SYSTEM, user: noDue });
  assert.equal(reply.text, 'The invoice INV-2024-00123 from Acme Supplies Ltd. has a total amount of JPY 10,560.00, but the invoice text does not state the due date.');
  assert.deepEqual(reply.insights.find(i => i.id === 'missing').fields, ['due']);
  assert.equal(respond({ system: SYSTEM, user: 'Hello there' }).text, 'I could not find any invoice details in the text you provided.');
});

test('agent: without a system message the answers are inconsistent between runs', () => {
  const answers = [0, 1, 2].map(runIndex => respond({ system: '', user: INVOICE, runIndex }).text);
  assert.equal(new Set(answers).size, 3);
  assert.ok(answers.every(a => !a.includes(EXPECTED)));
  assert.equal(respond({ system: '', user: INVOICE, runIndex: 3 }).text, answers[0]);
  assert.deepEqual(respond({ system: '', user: INVOICE, runIndex: 1 }).insights, [{ id: 'no-system', variant: 2 }]);
});

test('agent: a system prompt that names no fields falls back to the core facts', () => {
  const reply = respond({ system: 'Summarize this in a single sentence. Do not add commentary.', user: INVOICE });
  assert.equal(reply.text, EXPECTED);
  assert.ok(reply.insights.some(i => i.id === 'default-fields'));
});

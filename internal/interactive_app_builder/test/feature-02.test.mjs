import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { evalExpression, assignTo, validateScript, validateExpression, toJson, IvyScriptError } from '../runtime/model/ivyscript.js';
import { respond, valueFor, amountOf, currencyOf, toIsoDate, listedFields } from '../features/feature-02/agent.js';
import { respond as respond01 } from '../features/feature-01/agent.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const processJson = json('process/tutorial/features/Feature02.p.json');
const dataClassJson = json('dataclass/tutorial/Feature02Data.d.json');
const invoiceDataJson = json('dataclass/tutorial/InvoiceData.d.json');

const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n';
const INVOICE = { __type: 'tutorial.InvoiceData', invoiceNumber: 'INV-2024-00123', supplierName: 'Acme Supplies Ltd.', totalAmount: '10560.00', currency: 'JPY', invoiceDate: '2024-06-01' };
const LOGGED = '{\n  "invoiceNumber" : "INV-2024-00123",\n  "supplierName" : "Acme Supplies Ltd.",\n  "totalAmount" : 10560.00,\n  "currency" : "JPY",\n  "invoiceDate" : "2024-06-01"\n}';
const ANSWER = '{\n  "invoiceNumber": "INV-2024-00123",\n  "supplierName": "Acme Supplies Ltd.",\n  "totalAmount": 10560.00,\n  "currency": "JPY",\n  "invoiceDate": "2024-06-01"\n}';

function setup() {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature02.p.json', classes: [invoiceDataJson] });
  const events = [];
  const io = {
    enter: e => { events.push('enter:' + e.id); },
    agent: phase => { events.push('agent:' + phase); },
    data: field => { events.push('data:' + field); }
  };
  const runner = new ProcessRunner({ model, brain: { respond }, io, simulates: { structuredOutput: true } });
  return { model, runner, events, agent: elementById(model, 'f5') };
}

const context = model => ({ data: {}, fields: model.dataClass.fields, dataClassName: model.dataClass.name, classes: model.classes });

// ── Model and IvyScript ──────────────────────────────────────────────────────

test('process: the result class is loaded next to the process data', () => {
  const { model } = setup();
  assert.deepEqual(model.dataClass.fields.map(f => f.name + ':' + f.type), ['invoiceText:String', 'result:tutorial.InvoiceData']);
  assert.deepEqual(model.classes['tutorial.InvoiceData'].fields.map(f => f.name + ':' + f.type),
    ['invoiceNumber:String', 'supplierName:String', 'totalAmount:java.math.BigDecimal', 'currency:String', 'invoiceDate:java.time.LocalDate']);
});

test('ivyscript: fields of a data class object can be read', () => {
  const ctx = context(setup().model);
  assert.equal(evalExpression('in.result.totalAmount', ctx), null, 'null while there is no object');
  ctx.data.result = { ...INVOICE };
  assert.equal(evalExpression('in.result.totalAmount', ctx), '10560.00');
  assert.equal(evalExpression('"Due: " + in.result.invoiceDate', ctx), 'Due: 2024-06-01');
  assert.throws(() => evalExpression('in.result.vat', ctx), /'in\.result\.vat' cannot be read: result has no field vat/);
  assert.equal(validateExpression('in.result.currency', ctx), null);
  assert.match(validateExpression('in.result.vat', ctx).message, /has no field vat/);
  assert.match(validateExpression('in.invoiceText.length', ctx).message, /invoiceText has no field length/);
});

test('ivyscript: only an object of the right class fits a class-typed field', () => {
  const ctx = context(setup().model);
  assignTo('in.result', { ...INVOICE }, ctx);
  assert.equal(ctx.data.result.currency, 'JPY');
  assert.throws(() => assignTo('in.result', 'some text', ctx), e => e instanceof IvyScriptError && /A String cannot be assigned to result, which is a tutorial\.InvoiceData/.test(e.message));
  assert.throws(() => assignTo('in.invoiceText', { ...INVOICE }, ctx), /A tutorial\.InvoiceData object cannot be assigned to invoiceText, which is a String/);
  assignTo('in.result', null, ctx);
  assert.equal(ctx.data.result, null);
});

test('ivyscript: Json.toJson prints an object the way the tutorial process logs it', () => {
  const ctx = context(setup().model);
  assert.equal(toJson({ ...INVOICE }, ctx), LOGGED);
  assert.equal(toJson({ ...INVOICE, totalAmount: null }, ctx).split('\n')[3], '  "totalAmount" : null,');
  assert.equal(toJson(null, ctx), 'null');
  assert.equal(toJson('text', ctx), '"text"');
  assert.equal(validateScript('ivy.log.error(dev.langchain4j.internal.Json.toJson(in.result));', ctx), null);
  assert.match(validateScript('ivy.log.error(dev.langchain4j.internal.Json.toJson(in.nope));', ctx).message, /Field 'nope' does not exist/);
  assert.match(validateScript('ivy.log.error(com.example.Util.dump(in.result));', ctx).message, /Unknown variable 'com'/);
});

// ── The stand-in model ───────────────────────────────────────────────────────

test('agent: reads amount, currency and field values by name', () => {
  assert.equal(amountOf('JPY 10,560.00'), '10560.00');
  assert.equal(amountOf('1.234'), '1.234');
  assert.equal(amountOf(''), null);
  assert.equal(currencyOf('JPY 10,560.00'), 'JPY');
  assert.equal(currencyOf('€ 5,000.00'), 'EUR');
  assert.equal(currencyOf('5,000.00'), null);
  const facts = { number: 'INV-1', supplier: 'ACME', total: 'USD 12.50', date: '2024-06-01', due: '30 June 2024' };
  assert.equal(valueFor('invoiceNumber', facts), 'INV-1');
  assert.equal(valueFor('supplierName', facts), 'ACME');
  assert.equal(valueFor('totalAmount', facts), '12.50');
  assert.equal(valueFor('currency', facts), 'USD');
  assert.equal(valueFor('invoiceDate', facts), '2024-06-01');
  assert.equal(valueFor('dueDate', facts), '2024-06-30', 'a date written with a month name is converted to yyyy-MM-dd');
  assert.equal(valueFor('dueDate', { ...facts, due: 'end of next month' }), null, 'anything else does not fit a LocalDate');
  assert.equal(toIsoDate('January 15, 2024'), '2024-01-15');
  assert.equal(toIsoDate('Feb 3 2025'), '2025-02-03');
  assert.equal(toIsoDate('2024-06-01'), '2024-06-01');
  assert.equal(toIsoDate('15/01/2024'), null);
  assert.equal(valueFor('approver', facts), null);
  assert.deepEqual(listedFields('Extract:\n- invoiceNumber (String)\n* currency\n  - invoiceDate (LocalDate)\nDo not add commentary.'), ['invoiceNumber', 'currency', 'invoiceDate']);
});

test('agent: with a result class it answers with JSON for exactly that class', () => {
  const { model, agent } = setup();
  const user = "INVOICE\nInvoice Number: INV-9\nSupplier:\nNorthwind\nTotal Amount Due: EUR 99.00\n";
  const reply = respond({ system: agentConfig(agent).system, user, resultClass: model.classes['tutorial.InvoiceData'] });
  assert.deepEqual(reply.value, { __type: 'tutorial.InvoiceData', invoiceNumber: 'INV-9', supplierName: 'Northwind', totalAmount: '99.00', currency: 'EUR', invoiceDate: null });
  assert.equal(reply.text, '{\n  "invoiceNumber": "INV-9",\n  "supplierName": "Northwind",\n  "totalAmount": 99.00,\n  "currency": "EUR",\n  "invoiceDate": null\n}');
  assert.deepEqual(reply.insights.map(i => i.id), ['schema', 'null', 'schema-decides']);
  assert.deepEqual(reply.insights[1].fields, ['invoiceDate']);
  const nothing = respond({ system: 'x', user: 'hello', resultClass: model.classes['tutorial.InvoiceData'] });
  assert.ok(Object.keys(nothing.value).filter(k => k !== '__type').every(k => nothing.value[k] === null));
  assert.deepEqual(nothing.insights.map(i => i.id), ['schema', 'no-invoice', 'schema-decides']);
});

test('agent: without a result class it answers in plain text', () => {
  const { agent } = setup();
  const user = 'Invoice Number: INV-9\nSupplier: Northwind\nDate: 2024-06-01\nTotal: EUR 99.00\n';
  const listed = respond({ system: agentConfig(agent).system, user });
  assert.equal(listed.value, undefined);
  assert.equal(listed.text, 'invoiceNumber: INV-9\nsupplierName: Northwind\ntotalAmount: 99.00\ncurrency: EUR\ninvoiceDate: 2024-06-01');
  assert.deepEqual(listed.insights.map(i => i.id), ['plain', 'listed']);
  assert.deepEqual(respond({ system: 'Summarise the invoice.', user }).insights.map(i => i.id), ['plain', 'usual']);
  assert.deepEqual(respond({ system: '', user }).insights.map(i => i.id), ['plain', 'no-system']);
  assert.deepEqual(respond({ system: 'x', user: 'hello' }).insights.map(i => i.id), ['plain', 'no-invoice']);
});

// ── The run ──────────────────────────────────────────────────────────────────

test('runner: the agent returns an InvoiceData object and the next step logs it as JSON', async () => {
  const { runner, events } = setup();
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  const call = result.agentCalls[0];
  assert.equal(call.status, 'answered');
  assert.deepEqual(call.schema, { name: 'tutorial.InvoiceData', fields: [
    { name: 'invoiceNumber', type: 'String' }, { name: 'supplierName', type: 'String' }, { name: 'totalAmount', type: 'java.math.BigDecimal' },
    { name: 'currency', type: 'String' }, { name: 'invoiceDate', type: 'java.time.LocalDate' }] });
  assert.equal(call.options.structuredOutput, 'tutorial.InvoiceData');
  assert.equal(call.answer, ANSWER);
  assert.deepEqual(call.value, INVOICE);
  assert.equal(call.mapping, 'mapped');
  assert.deepEqual(result.data.result, INVOICE);
  assert.ok(events.includes('data:result'));
  assert.equal(result.logs[result.logs.length - 1].message, LOGGED);
});

test('runner: without a result type the answer is text and cannot be stored in in.result', async () => {
  const { runner, agent } = setup();
  delete agentConfig(agent).resultType;
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed', 'a failing mapping does not stop the process');
  const call = result.agentCalls[0];
  assert.equal(call.schema, null);
  assert.equal(call.value, undefined);
  assert.equal(call.answer, 'invoiceNumber: INV-2024-00123\nsupplierName: Acme Supplies Ltd.\ntotalAmount: 10560.00\ncurrency: JPY\ninvoiceDate: 2024-06-01');
  assert.equal(call.mapping, 'failed');
  assert.match(call.mappingError, /A String cannot be assigned to result, which is a tutorial\.InvoiceData/);
  assert.ok(result.logs.some(l => l.message === 'Failed to map result to in.result'));
  assert.equal(result.logs[result.logs.length - 1].message, 'null');
  assert.ok(result.data.result === undefined || result.data.result === null);
});

test('runner: a result type without ".class" fails the step before the model is called', async () => {
  const { runner, agent, events } = setup();
  agentConfig(agent).resultType = 'tutorial.InvoiceData';
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'failed');
  assert.equal(result.failedAt, 'f5');
  assert.equal(result.error.kind, 'config');
  assert.equal(result.error.message, "Failed to extract config 'resultType' for value 'tutorial.InvoiceData'");
  assert.ok(!events.includes('agent:request'));
  assert.ok(!events.includes('enter:f9'));
});

test('runner: a class that is not in the project fails the step too', async () => {
  const { runner, agent } = setup();
  agentConfig(agent).resultType = 'tutorial.Receipt.class';
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'failed');
  assert.equal(result.error.message, "Failed to extract config 'resultType' for value 'tutorial.Receipt.class'");
  assert.match(result.error.detail, /The class tutorial\.Receipt does not exist in this project/);
});

test('runner: a lesson that does not simulate result types keeps treating them as text', async () => {
  const model = loadProcess(json('process/tutorial/features/Feature01.p.json'), json('dataclass/tutorial/Feature01Data.d.json'), { project: 'tutorial' });
  agentConfig(elementById(model, 'f5')).resultType = 'tutorial.InvoiceData.class';
  const runner = new ProcessRunner({ model, brain: { respond: respond01 }, simulates: { structuredOutput: false } });
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  assert.equal(result.agentCalls[0].options.structuredOutput, 'tutorial.InvoiceData');
  assert.match(result.data.summary, /^The invoice INV-2024-00123/);
});

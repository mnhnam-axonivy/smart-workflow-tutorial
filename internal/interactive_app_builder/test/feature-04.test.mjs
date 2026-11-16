import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { parseMacro, expandMacro, validateMacro, missingCms, cmsPathOf } from '../runtime/model/macro.js';
import { extractInvoiceFacts } from '../features/shared/invoice-facts.js';
import { respond } from '../features/shared/invoice-extractor.js';
import { INVOICE_SAMPLE } from '../features/feature-04/document.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const processJson = json('process/tutorial/features/Feature04.p.json');
const dataClassJson = json('dataclass/tutorial/Feature04Data.d.json');
const invoiceDataJson = json('dataclass/tutorial/InvoiceData.d.json');

const VARIABLES = 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n      xAI:\n        APIKey: "xai-..."\n';
const SAMPLE = '/Files/Documents/InvoiceSample';
const CMS = { [SAMPLE]: { name: 'InvoiceSample', extension: 'pdf', reads: INVOICE_SAMPLE } };
const EXTRACTED = { __type: 'tutorial.InvoiceData', invoiceNumber: 'INV-0001-0002', supplierName: 'Demo Company AG', totalAmount: '29727.50', currency: 'CHF', invoiceDate: '2024-01-15' };
const LOGGED = '{\n  "invoiceNumber" : "INV-0001-0002",\n  "supplierName" : "Demo Company AG",\n  "totalAmount" : 29727.50,\n  "currency" : "CHF",\n  "invoiceDate" : "2024-01-15"\n}';

function setup(cms = CMS) {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature04.p.json', classes: [invoiceDataJson], cms });
  const events = [];
  const io = { enter: e => { events.push('enter:' + e.id); }, agent: phase => { events.push('agent:' + phase); } };
  const runner = new ProcessRunner({ model, brain: { respond }, io, simulates: { structuredOutput: true } });
  return { model, runner, events, agent: elementById(model, 'f5') };
}

// ── The sample in the CMS ────────────────────────────────────────────────────

test('cms: the process names the sample invoice that the tutorial project ships as a PDF', () => {
  const { agent } = setup();
  assert.equal(agentConfig(agent).query, 'Extract the invoice data from this document:\n<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>');
  assert.ok(existsSync(fileURLToPath(new URL('cms/Files/Documents/InvoiceSample.pdf', tutorial))), 'cms/Files/Documents/InvoiceSample.pdf');
});

test('reader: the facts of the sample invoice are found in its text', () => {
  const facts = extractInvoiceFacts(INVOICE_SAMPLE);
  assert.equal(facts.number, 'INV-0001-0002');
  assert.equal(facts.date, 'January 15, 2024');
  assert.equal(facts.due, 'February 14, 2024');
  assert.equal(facts.supplier, 'Demo Company AG', 'the name under the heading "From"');
  assert.equal(facts.total, '29,727.50', '"Total Due" without a colon');
});

// ── Macros with CMS objects ──────────────────────────────────────────────────

test('macro: only the exact ivy.cms.co("…") form is a CMS reference', () => {
  assert.equal(cmsPathOf('ivy.cms.co("/Files/Documents/InvoiceSample")'), SAMPLE);
  assert.equal(cmsPathOf(" ivy.cms.co('/a/b') "), '/a/b');
  assert.equal(cmsPathOf('ivy.cms.co("/a") + "x"'), null);
  assert.equal(cmsPathOf('in.invoiceText'), null);
  assert.equal(parseMacro('<%=ivy.cms.co("/a")%>')[0].cms, '/a');
});

test('macro: a PDF or image is attached, text files and text objects become text', () => {
  const ctx = { data: {}, fields: [], cms: {
    ...CMS,
    '/img': { name: 'Scan', extension: 'JPG', reads: 'x' },
    '/notes': { name: 'Notes', extension: 'md', reads: '# Notes' },
    '/label': { name: 'Label', text: 'Hello' },
    '/sheet': { name: 'Sheet', extension: 'xlsx' }
  } };
  const pdf = expandMacro('Read this:\n<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>', ctx);
  assert.equal(pdf.error, null);
  assert.equal(pdf.text, 'Read this:\n');
  assert.deepEqual(pdf.files.map(f => [f.name, f.kind, f.mime, f.path]), [['InvoiceSample.pdf', 'pdf', 'application/pdf', SAMPLE]]);
  assert.equal(pdf.files[0].reads, INVOICE_SAMPLE);
  assert.deepEqual(expandMacro('<%=ivy.cms.co("/img")%>', ctx).files.map(f => [f.name, f.kind, f.mime]), [['Scan.jpg', 'image', 'image/jpeg']]);
  assert.equal(expandMacro('<%=ivy.cms.co("/notes")%>', ctx).text, '# Notes');
  assert.equal(expandMacro('A <%=ivy.cms.co("/label")%> B', ctx).text, 'A Hello B');
  assert.equal(expandMacro('<%=ivy.cms.co("/sheet")%>', ctx).error.message, 'Unsupported CMS file type for object: Sheet with extension: xlsx');
});

test('macro: a path that does not exist attaches nothing and is not an error', () => {
  const ctx = { data: {}, fields: [], cms: CMS };
  const out = expandMacro('Read this:\n<%=ivy.cms.co("/Files/Documents/InvoiceSampel")%>', ctx);
  assert.equal(out.error, null);
  assert.equal(out.text, 'Read this:\n');
  assert.deepEqual(out.files, []);
  assert.deepEqual(out.parts.map(p => p.type), ['text', 'missing']);
  assert.equal(validateMacro('<%=ivy.cms.co("/Files/Documents/InvoiceSampel")%>', ctx), null);
  assert.deepEqual(missingCms('<%=ivy.cms.co("/Files/Documents/InvoiceSampel")%> <%=ivy.cms.co("/Files/Documents/InvoiceSample")%>', ctx), ['/Files/Documents/InvoiceSampel']);
  assert.match(validateMacro('<%=ivy.cms.cr("/x")%>', ctx).message, /not available in this simulation/);
});

// ── The run ──────────────────────────────────────────────────────────────────

test('runner: the PDF goes to the model with the message and comes back as an InvoiceData object', async () => {
  const { runner } = setup();
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed');
  const call = result.agentCalls[0];
  assert.equal(call.user, 'Extract the invoice data from this document:\n');
  assert.deepEqual(call.files, [{ name: 'InvoiceSample.pdf', kind: 'pdf', mime: 'application/pdf', path: SAMPLE }]);
  assert.deepEqual(call.userParts.map(p => p.type), ['text', 'file']);
  assert.deepEqual(call.value, EXTRACTED);
  assert.deepEqual(call.insights.map(i => i.id), ['document', 'schema', 'schema-decides']);
  assert.deepEqual(result.data.invoiceResult, EXTRACTED);
  assert.equal(result.logs[result.logs.length - 1].message, LOGGED);
});

test('runner: with a wrong path nothing is attached and every field is null', async () => {
  const { runner, agent } = setup();
  agentConfig(agent).query = agentConfig(agent).query.replace('InvoiceSample', 'InvoiceSampel');
  const result = await runner.run({ variablesText: VARIABLES });
  assert.equal(result.status, 'completed', 'nothing fails');
  const call = result.agentCalls[0];
  assert.deepEqual(call.files, []);
  assert.deepEqual(call.userParts.map(p => p.type), ['text', 'missing']);
  assert.ok(['invoiceNumber', 'supplierName', 'totalAmount', 'currency', 'invoiceDate'].every(f => call.value[f] === null));
  assert.deepEqual(call.insights.map(i => i.id), ['schema', 'no-invoice', 'schema-decides']);
});

test('runner: Ollama and xAI reject the PDF, the other providers take it', async () => {
  for (const provider of ['Ollama', 'xAI']) {
    const { runner, agent, events } = setup();
    agentConfig(agent).provider = JSON.stringify(provider);
    const result = await runner.run({ variablesText: VARIABLES });
    assert.equal(result.status, 'failed', provider);
    assert.equal(result.failedAt, 'f5');
    assert.equal(result.error.kind, 'input');
    assert.equal(result.error.message, provider + ' does not accept PDF files, so the call with InvoiceSample.pdf failed');
    assert.ok(events.includes('agent:request') && events.includes('agent:failed') && !events.includes('agent:response'));
  }
  const { runner, agent } = setup({ [SAMPLE]: { name: 'InvoiceSample', extension: 'png', reads: INVOICE_SAMPLE } });
  agentConfig(agent).provider = '"Ollama"';
  const image = await runner.run({ variablesText: VARIABLES });
  assert.equal(image.status, 'completed', 'an image is not a PDF');
  assert.equal(image.agentCalls[0].files[0].mime, 'image/png');
});

test('runner: a file alone is a user message; an unsupported file type skips the call', async () => {
  const alone = setup();
  agentConfig(alone.agent).query = '<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>';
  const result = await alone.runner.run({ variablesText: VARIABLES });
  assert.equal(result.agentCalls[0].status, 'answered');
  assert.equal(result.data.invoiceResult.invoiceNumber, 'INV-0001-0002');

  const sheet = setup({ [SAMPLE]: { name: 'InvoiceSample', extension: 'xlsx' } });
  const skipped = await sheet.runner.run({ variablesText: VARIABLES });
  assert.equal(skipped.status, 'completed');
  assert.equal(skipped.agentCalls[0].status, 'skipped');
  assert.ok(skipped.logs.some(l => l.message === 'Unsupported CMS file type for object: InvoiceSample with extension: xlsx'));
  assert.ok(skipped.logs.some(l => l.message === 'Agent call was skipped, since there was no user query'));
});

// ── Texts of all lessons ─────────────────────────────────────────────────────

test('lessons: every walkthrough has its chapter names and notes in English and Japanese', async () => {
  const features = new URL('../features/', import.meta.url);
  const names = readdirSync(fileURLToPath(features)).filter(n => /^feature-\d+$/.test(n));
  assert.ok(names.length >= 4);
  for (const name of names) {
    const { strings } = await import(new URL(name + '/text.js', features));
    const { tour } = await import(new URL(name + '/tour.js', features));
    assert.deepEqual(Object.keys(strings.ja).sort(), Object.keys(strings.en).sort(), name + ': same keys in both languages');
    tour.chapters.forEach(c => assert.ok(strings.en['tour.chapter.' + c.id], name + ': title of chapter ' + c.id));
    const source = readFileSync(fileURLToPath(new URL(name + '/tour.js', features)), 'utf8');
    // d.note('key', …), or a helper of the lesson that shows a note: explain(ID, 'key'), onMemory(d, 'key')
    const used = new Set([...source.matchAll(/(?:note|explain|on[A-Z]\w*)\((?:\w+, )?'(\w+)'/g)].map(m => m[1]));
    assert.ok(used.size > 0, name + ': notes found in tour.js');
    used.forEach(key => {
      assert.ok(strings.en['tour.' + key + '.title'], name + ': tour.' + key + '.title');
      assert.ok(strings.en['tour.' + key + '.text'], name + ': tour.' + key + '.text');
    });
    Object.keys(strings.en).filter(k => /^tour\.\w+\.title$/.test(k) && !k.startsWith('tour.intro.')).forEach(k => {
      assert.ok(used.has(k.split('.')[1]), name + ': ' + k + ' is shown by the walkthrough');
    });
  }
});

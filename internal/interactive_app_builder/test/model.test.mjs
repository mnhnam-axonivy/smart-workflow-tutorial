import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runScript, evalExpression, assignTo, validateScript, validateExpression, IvyScriptError, positionOf } from '../runtime/model/ivyscript.js';
import { parseMacro, expandMacro, validateMacro } from '../runtime/model/macro.js';
import { parseYaml, readVariable, hasBlock } from '../runtime/model/yaml.js';
import { resolveProvider } from '../runtime/model/providers.js';

const fields = [{ name: 'invoiceText', type: 'String' }, { name: 'summary', type: 'String' }];
const context = (data = {}, extra = {}) => ({ data, fields, dataClassName: 'tutorial.Feature01Data', ...extra });

// ── IvyScript ────────────────────────────────────────────────────────────────

test('ivyscript: assigns concatenated strings with escapes', () => {
  const ctx = context();
  runScript('in.invoiceText = "INVOICE\\n" +\n"Invoice Number: INV-1\\n" +\n"Total: \\"10\\"";', ctx);
  assert.equal(ctx.data.invoiceText, 'INVOICE\nInvoice Number: INV-1\nTotal: "10"');
});

test('ivyscript: in and out share the same process data', () => {
  const ctx = context();
  runScript('in.summary = "a"; out.invoiceText = out.summary + "b";', ctx);
  assert.deepEqual(ctx.data, { summary: 'a', invoiceText: 'ab' });
});

test('ivyscript: ivy.log calls reach the log callback with the evaluated message', () => {
  const lines = [];
  runScript('ivy.log.error(out.summary);\nivy.log.info("n=" + 2);', context({ summary: 'done' }, { log: (level, message) => lines.push([level, message]) }));
  assert.deepEqual(lines, [['error', 'done'], ['info', 'n=2']]);
});

test('ivyscript: unset String fields read as empty text', () => {
  const lines = [];
  runScript('ivy.log.error(out.summary);', context({}, { log: (l, m) => lines.push(m) }));
  assert.deepEqual(lines, ['']);
});

test('ivyscript: comments, numbers and string methods', () => {
  const ctx = context({ invoiceText: '  abc ' });
  runScript('// set it\nin.summary = in.invoiceText.trim().toUpperCase() + /* inline */ (1 + 2);', ctx);
  assert.equal(ctx.data.summary, 'ABC3');
});

test('ivyscript: unknown fields are reported with the data class name', () => {
  assert.throws(() => runScript('in.sumary = "x";', context()), e => e instanceof IvyScriptError && e.kind === 'field' && /sumary.*tutorial\.Feature01Data/.test(e.message));
  assert.throws(() => evalExpression('in.missing', context()), /does not exist/);
});

test('ivyscript: unsupported constructs explain themselves instead of misbehaving', () => {
  assert.throws(() => runScript('for (;;) { in.summary = "x"; }', context()), e => e.kind === 'unsupported');
  assert.throws(() => runScript('in.summary = new String("x");', context()), e => e.kind === 'unsupported');
  assert.throws(() => runScript('try { in.summary = "x"; } finally { }', context()), e => e.kind === 'unsupported');
  assert.throws(() => runScript('ivy.wf.foo();', context()), e => e.kind === 'unsupported');
});

test('ivyscript: conditions, arithmetic and local variables', () => {
  const ctx = context();
  runScript('double n = Double.parseDouble(" 12.5 ");\nString label = n > 10 ? "big" : "small";\n' +
    'if (n >= 100) { in.summary = "huge"; } else if (n > 10 && !(label == "small")) in.summary = label + (n - 2.5) * 2;\nelse in.summary = "tiny";', ctx);
  assert.equal(ctx.data.summary, 'big20');
  assert.equal(evalExpression('1 + 2 * 3 == 7 && "a" != "b" || false', context()), true);
  assert.equal(evalExpression('-3 + 10 % 4', context()), -1);
  assert.equal(evalExpression('in.summary == null', context()), false, 'an unset String is empty text, not null');
  assert.equal(evalExpression('"EUR".equals(in.summary.toUpperCase())', context({ summary: 'eur' })), true);
  assert.equal(evalExpression('param.amount', context({}, { vars: { param: { amount: '5' } } })), '5');
  assert.throws(() => evalExpression('"a" > 1', context()), /is not a number/);
  assert.throws(() => runScript('if ("yes") in.summary = "x";', context()), /neither true nor false/);
  assert.equal(validateScript('String c = in.summary;\nif (c.isEmpty()) { in.summary = "none"; }', context()), null);
  assert.match(validateScript('if (d.isEmpty()) { in.summary = "none"; }', context()).message, /Unknown variable 'd'/);
});

test('ivyscript: try/catch takes the Java exception it names', () => {
  const run = (code, data = {}) => { const ctx = context(data); runScript(code, ctx); return ctx.data.summary; };
  const parse = 'try { double a = Double.parseDouble(in.invoiceText.trim()); in.summary = a > 5000 ? "HIGH" : "LOW"; } catch (NumberFormatException e) { in.summary = "NONE: " + e.getMessage(); }';
  assert.equal(run(parse, { invoiceText: ' 10560.00 ' }), 'HIGH');
  assert.equal(run(parse, { invoiceText: '99' }), 'LOW');
  assert.equal(run(parse, { invoiceText: '10,560' }), 'NONE: For input string: "10,560"');
  assert.equal(run(parse, {}), 'NONE: empty String');
  assert.equal(run('try { in.summary = "" + Integer.parseInt("1.5"); } catch (Exception e) { in.summary = "caught"; }'), 'caught');
  assert.throws(() => run('try { in.summary = "" + Integer.parseInt("x"); } catch (NullPointerException e) { in.summary = "caught"; }'), e => e.javaType === 'NumberFormatException');
});

test('ivyscript: syntax errors carry a position', () => {
  const code = 'in.summary = "ok";\nin.invoiceText = "open;';
  const err = validateScript(code, context());
  assert.ok(err);
  assert.equal(positionOf(code, err.pos).line, 2);
  assert.ok(validateScript('in.summary = ;', context()));
  assert.equal(validateScript('in.summary = "fine";', context()), null);
});

test('ivyscript: validateScript never changes data or logs', () => {
  const ctx = context({}, { log: () => assert.fail('must not log') });
  assert.equal(validateScript('in.summary = "x"; ivy.log.info(in.summary);', ctx), null);
  assert.deepEqual(ctx.data, {});
});

test('ivyscript: class literals and mapping targets', () => {
  assert.deepEqual(evalExpression('tutorial.InvoiceData.class', context()), { __class: 'tutorial.InvoiceData' });
  const ctx = context();
  assignTo('in.summary', 'result text', ctx);
  assert.equal(ctx.data.summary, 'result text');
  assert.equal(validateExpression('in.summary', context(), { assignable: true }), null);
  assert.ok(validateExpression('in.nope', context(), { assignable: true }));
  assert.ok(validateExpression('"text"', context(), { assignable: true }));
  assert.throws(() => assignTo('summary', 'x', context()), IvyScriptError);
});

// ── Macros ───────────────────────────────────────────────────────────────────

test('macro: splits literal text and expressions', () => {
  assert.deepEqual(parseMacro('Summarize: <%=in.invoiceText%> now'), [
    { type: 'text', value: 'Summarize: ' },
    { type: 'expr', raw: '<%=in.invoiceText%>', code: 'in.invoiceText', cms: null },
    { type: 'text', value: ' now' }
  ]);
  assert.deepEqual(parseMacro(''), []);
});

test('macro: expands against process data', () => {
  const out = expandMacro('A <%= in.invoiceText %> B', context({ invoiceText: 'X' }));
  assert.equal(out.text, 'A X B');
  assert.equal(out.error, null);
});

test('macro: reports a broken expression but still returns text', () => {
  const out = expandMacro('<%=in.nope%>', context());
  assert.ok(out.error instanceof IvyScriptError);
  assert.equal(out.text, '');
  assert.ok(validateMacro('<%=in.nope%>', context()));
  assert.ok(validateMacro('text <%=in.summary', context()));
  assert.equal(validateMacro('plain <%=in.summary%>', context()), null);
});

// ── YAML ─────────────────────────────────────────────────────────────────────

const MINIMAL = `# comment
Variables:
  AI:
    DefaultProvider: "OpenAI"   # trailing comment
    Providers:
      OpenAI:
        APIKey: "sk-..."
`;

test('yaml: reads nested variables as strings', () => {
  const { value, errors } = parseYaml(MINIMAL);
  assert.deepEqual(errors, []);
  assert.equal(readVariable(value, 'AI.DefaultProvider'), 'OpenAI');
  assert.equal(readVariable(value, 'AI.Providers.OpenAI.APIKey'), 'sk-...');
  assert.equal(readVariable(value, 'AI.Providers.Anthropic.APIKey'), '');
  assert.equal(hasBlock(value, 'AI.Providers.OpenAI'), true);
  assert.equal(hasBlock(value, 'AI.Providers.Ollama'), false);
});

test('yaml: unquoted values, single quotes, colons and hashes inside quotes', () => {
  const { value, errors } = parseYaml("Variables:\n  A: plain value\n  B: 'it''s'\n  C: \"http://x:1/#frag\"\n  D: ${decrypt:}\n  E:\n  F: \"\"\n");
  assert.deepEqual(errors, []);
  assert.equal(readVariable(value, 'A'), 'plain value');
  assert.equal(readVariable(value, 'B'), "it's");
  assert.equal(readVariable(value, 'C'), 'http://x:1/#frag');
  assert.equal(readVariable(value, 'D'), '${decrypt:}');
  assert.equal(readVariable(value, 'E'), '');
  assert.equal(readVariable(value, 'F'), '');
});

test('yaml: reports bad indentation, tabs and stray lines with line numbers', () => {
  assert.equal(parseYaml('Variables:\n  AI:\n    A: 1\n   B: 2\n').errors[0].line, 4);
  assert.match(parseYaml('Variables:\n\tAI: x\n').errors[0].message, /tabs/);
  assert.equal(parseYaml('Variables:\n  just text\n').errors[0].line, 2);
  assert.match(parseYaml('Variables:\n  A: 1\n  A: 2\n').errors[0].message, /twice/);
  assert.equal(parseYaml('Variables:\n  A: "x"\n    B: y\n').errors.length, 1);
});

test('yaml: returning to an outer level closes the nested maps', () => {
  const { value, errors } = parseYaml('Variables:\n  AI:\n    Providers:\n      OpenAI:\n        APIKey: k\n    DefaultProvider: OpenAI\n  Other: 1\n');
  assert.deepEqual(errors, []);
  assert.equal(readVariable(value, 'AI.DefaultProvider'), 'OpenAI');
  assert.equal(readVariable(value, 'Other'), '1');
});

// ── Providers ────────────────────────────────────────────────────────────────

test('providers: element setting, then AI.DefaultProvider, then OpenAI', () => {
  const vars = parseYaml(MINIMAL).value;
  assert.deepEqual(resolveProvider(vars, '', ''), { ok: true, name: 'OpenAI', model: 'gpt-4.1-mini', url: 'https://api.openai.com/v1/chat/completions', missingKey: null, pdf: true });
  assert.equal(resolveProvider({}, '', '').name, 'OpenAI');
  assert.equal(resolveProvider({}, '', '').missingKey, 'AI.Providers.OpenAI.APIKey');
  const anthropic = resolveProvider(vars, 'Anthropic', 'claude-haiku-4-5');
  assert.equal(anthropic.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(anthropic.model, 'claude-haiku-4-5');
  assert.equal(anthropic.missingKey, 'AI.Providers.Anthropic.APIKey');
});

test('providers: unknown names fail, Ollama needs no key, blank password counts as missing', () => {
  assert.deepEqual(resolveProvider(parseYaml('Variables:\n  AI:\n    DefaultProvider: Nope\n').value, '', ''), { ok: false, name: 'Nope', message: 'Unknown model provider Nope' });
  const ollama = resolveProvider({}, 'Ollama', '');
  assert.equal(ollama.missingKey, null);
  assert.equal(ollama.url, 'http://localhost:11434/api/chat');
  const blank = parseYaml('Variables:\n  AI:\n    Providers:\n      OpenAI:\n        APIKey: ${decrypt:}\n        DefaultModel: gpt-4o\n        BaseUrl: "http://proxy:8000/"\n').value;
  const openai = resolveProvider(blank, '', '');
  assert.equal(openai.missingKey, 'AI.Providers.OpenAI.APIKey');
  assert.equal(openai.model, 'gpt-4o');
  assert.equal(openai.url, 'http://proxy:8000/v1/chat/completions');
});

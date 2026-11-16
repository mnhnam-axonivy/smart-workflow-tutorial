/**
 * Stand-in for the model behind the "Invoice Approval Agent" of the Callable Process Tools
 * lesson. No model is called. It behaves the way the tutorial describes tool use:
 *
 *   - It can only ask for a tool that came with the request, and it only asks for one the
 *     system message names. Tools are asked for one per turn, in the order the system message
 *     names them, each with the fact its parameter asks for (the amount, the currency).
 *   - Once nothing is left to ask for, it answers with the decision: every field comes from
 *     the result of its tool — or, where that tool was never called, from a guess.
 *
 * Which tool feeds which field is read from the tools themselves (the name of what they
 * return), so a renamed tool that is selected and named again works like the original.
 */
import { extractInvoiceFacts } from '../shared/invoice-facts.js';
import { amountOf, currencyOf } from '../shared/invoice-extractor.js';

/**
 * The fields of the decision: the tool result each one is taken from, and what the model
 * falls back on without that result.
 */
const FIELDS = [
  {
    field: /taxrate/i,
    result: /tax|rate/i,
    read: value => String(value),
    // the only tax figure the model can see: the one printed on the invoice
    guess: facts => { const m = /(\d+(?:\.\d+)?)\s*%/.exec(facts.taxLine); return m ? m[1] + '%' : null; }
  },
  {
    field: /autoapprove/i,
    result: /policy/i,
    read: value => String(value).trim().toUpperCase() === 'STANDARD',
    guess: () => true
  },
  {
    field: /approver/i,
    result: /approver/i,
    read: value => String(value),
    guess: () => 'finance.manager'
  }
];

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const namedIn = (system, name) => new RegExp('\\b' + escapeRegExp(name) + '\\b').exec(String(system || ''));

/** The tools the model will ask for: offered with the request and named in the system message, in that order. */
export function plannedTools(system, tools) {
  return (tools || [])
    .map(tool => ({ tool, at: (namedIn(system, tool.name) || { index: -1 }).index }))
    .filter(entry => entry.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(entry => entry.tool);
}

/** The value a parameter asks for, judged by its name and description. */
function argumentFor(param, facts) {
  const hint = (param.name + ' ' + param.description).toLowerCase();
  if (/currency/.test(hint)) return facts.currency;
  if (/amount|total/.test(hint)) return facts.amount;
  return null;
}

/** The JSON a model returns for the schema: one line per field. */
function jsonText(fields, value) {
  return '{\n' + fields.map(f => '  ' + JSON.stringify(f.name) + ': ' + JSON.stringify(value[f.name])).join(',\n') + '\n}';
}

/**
 * @param {Object} request
 * @param {string} request.system
 * @param {string} request.user
 * @param {{name:string, description:string, params:Object[], result:Object[]}[]} [request.tools]  offered with the request
 * @param {{name:string, values?:Object}[]} [request.toolResults]  what has been called so far
 * @param {{name:string, fields:{name:string,type:string}[]}} [request.resultClass]
 * @returns {{ text: string, toolCalls?: Object[], value?: Object, insights?: Object[] }}
 */
export function respond({ system, user, tools = [], toolResults = [], resultClass }) {
  const read = extractInvoiceFacts(user);
  const facts = { amount: amountOf(read.total), currency: currencyOf(read.total), taxLine: (/^[ \t]*(?:tax|vat)[^\n]*$/im.exec(String(user || '')) || [''])[0] };
  const found = Boolean(facts.amount);
  const planned = found ? plannedTools(system, tools) : [];

  // 1 — something left to ask for: one tool per turn
  const next = planned.find(tool => !toolResults.some(r => r.name === tool.name));
  if (next) {
    const args = {};
    next.params.forEach(p => { args[p.name] = argumentFor(p, facts); });
    return { text: '', toolCalls: [{ name: next.name, arguments: args }] };
  }

  // 2 — the decision
  const names = resultClass ? resultClass.fields.map(f => f.name) : ['effectiveTaxRate', 'isAutoApprove', 'approverUsername'];
  const value = {};
  const fromTools = [];
  const guessed = [];
  names.forEach(name => {
    const rule = FIELDS.find(r => r.field.test(name));
    if (!found || !rule) { value[name] = null; return; }
    const tool = tools.find(t => (t.result || []).some(p => rule.result.test(p.name)));
    const done = tool ? toolResults.find(r => r.name === tool.name && r.values) : null;
    const key = done ? Object.keys(done.values).find(k => rule.result.test(k)) : null;
    if (key) {
      value[name] = rule.read(done.values[key]);
      fromTools.push({ field: name, tool: tool.name });
    } else {
      value[name] = rule.guess(facts);
      guessed.push({ field: name, why: tool ? 'not-asked' : 'not-offered' });
    }
  });

  const insights = [];
  if (!found) insights.push({ id: 'no-invoice' });
  if (toolResults.length) insights.push({ id: 'tools-called', names: toolResults.map(r => r.name) });
  else if (found) insights.push({ id: 'no-tools' });
  fromTools.forEach(entry => insights.push({ id: 'from-tool', ...entry }));
  guessed.forEach(entry => insights.push({ id: 'guessed-' + entry.why, field: entry.field }));
  const unused = found ? tools.filter(t => !planned.includes(t)).map(t => t.name) : [];
  if (unused.length) insights.push({ id: 'tool-unused', names: unused });

  const fields = resultClass ? resultClass.fields : names.map(name => ({ name }));
  if (resultClass) {
    return { text: jsonText(fields, value), value: { __type: resultClass.name, ...value }, guessed: guessed.map(g => g.field), insights };
  }
  return { text: names.map(name => name + ': ' + (value[name] === null ? 'null' : value[name])).join('\n'), guessed: guessed.map(g => g.field), insights: insights.concat([{ id: 'plain' }]) };
}

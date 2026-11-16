/**
 * Stand-in for the model behind the "Invoice Analyst Agent" of the Java Tools lesson. No
 * model is called. It follows the system message as far as its tools allow:
 *
 *   - a tool that came with the request and that the system message names is asked for
 *     once, with the amount and the currency of the invoice;
 *   - then it answers in one sentence: invoice number, supplier, total, and the USD
 *     equivalent the tool returned;
 *   - without such a tool it says that it cannot convert the amount. It does not invent a
 *     rate (a real model might).
 */
import { extractInvoiceFacts } from '../shared/invoice-facts.js';
import { amountOf, currencyOf } from '../shared/invoice-extractor.js';

const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function argumentFor(param, facts) {
  const hint = (param.name + ' ' + param.description).toLowerCase();
  if (/currency/.test(hint) && !/amount/.test(param.name.toLowerCase())) return facts.currency;
  if (/amount|total/.test(hint)) return facts.amount;
  return null;
}

/**
 * @param {{ system: string, user: string, tools?: Object[], toolResults?: Object[] }} request
 * @returns {{ text: string, toolCalls?: Object[], insights?: Object[] }}
 */
export function respond({ system, user, tools = [], toolResults = [] }) {
  const read = extractInvoiceFacts(user);
  const facts = { number: read.number, supplier: read.supplier, total: read.total, amount: amountOf(read.total), currency: currencyOf(read.total) };
  if (!facts.amount) {
    return { text: 'I could not find an invoice total in the text you provided.', insights: [{ id: 'no-invoice' }] };
  }
  const named = tools.filter(tool => new RegExp('\\b' + escapeRegExp(tool.name) + '\\b').test(String(system || '')));
  const next = named.find(tool => !toolResults.some(r => r.name === tool.name));
  if (next) {
    const args = {};
    next.params.forEach(p => { args[p.name] = argumentFor(p, facts); });
    return { text: '', toolCalls: [{ name: next.name, arguments: args }] };
  }

  const head = 'Invoice ' + (facts.number || '(no number)') + ' from ' + (facts.supplier || 'an unknown supplier') + ' totals ' + facts.total;
  const done = toolResults[toolResults.length - 1];
  if (!done) {
    const unused = tools.filter(tool => !named.includes(tool)).map(tool => tool.name);
    return {
      text: head + '. I could not convert the amount to USD, because I have no tool for the conversion.',
      insights: [unused.length ? { id: 'tool-unused', names: unused } : { id: 'no-tool' }]
    };
  }
  const converted = /=\s*([\d.,]+)\s*USD\s*\(rate:\s*([\d.]+)\)/.exec(String(done.result));
  if (!converted) {
    return { text: head + '. The conversion did not work: ' + String(done.result), insights: [{ id: 'tool-failed', tool: done.name }] };
  }
  return {
    text: head + ', which is equivalent to approximately ' + converted[1] + ' USD at a rate of ' + converted[2] + '.',
    insights: [{ id: 'tool-called', tool: done.name }, { id: 'from-tool', tool: done.name }]
  };
}

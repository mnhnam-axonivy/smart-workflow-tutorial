/**
 * Stand-in for an LLM that extracts invoice fields — the "Invoice Analysis Agent" of the
 * Structured Output lesson and the lessons that build on it.
 *
 * No model is called. The reply follows what the tutorials teach about structured output:
 *   - with a result type  → one value per field of that class, as JSON that matches the class;
 *                           the runner turns it into an object of the class
 *   - without one         → plain text, as in Basic Agent Setup
 *
 * The invoice is read from the user message and from attached files (their `reads` text is
 * what a model would read in them). Which fact belongs to which field is decided by the
 * field's name, the way a model reads a schema. Each reply comes with `insights` naming what
 * was recognised.
 */
import { extractInvoiceFacts } from './invoice-facts.js';

/** Reported when the system message names no fields of its own. */
const USUAL_FIELDS = ['invoiceNumber', 'supplierName', 'totalAmount', 'currency', 'invoiceDate'];

const NUMERIC = /(^|\.)(BigDecimal|BigInteger|Number|Integer|Long|Double|Float|Short)$/;
const SYMBOLS = { '$': 'USD', '€': 'EUR', '¥': 'JPY', '£': 'GBP' };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "JPY 10,560.00" → "10560.00" */
export function amountOf(total) {
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(String(total || ''));
  return m ? m[0].replace(/,/g, '') : null;
}

/** "JPY 10,560.00" → "JPY" (ISO 4217); a currency symbol is translated. */
export function currencyOf(total) {
  const text = String(total || '');
  const code = /\b[A-Z]{3}\b/.exec(text);
  if (code) return code[0];
  const symbol = Object.keys(SYMBOLS).find(s => text.includes(s));
  return symbol ? SYMBOLS[symbol] : null;
}

/** A date as yyyy-MM-dd: already in that form, or written with a month name. Otherwise null. */
export function toIsoDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const pad = n => String(n).padStart(2, '0');
  const monthOf = name => MONTHS.findIndex(m => m === name.toLowerCase() || m.slice(0, 3) === name.toLowerCase().replace(/\.$/, ''));
  let m = /^([A-Za-z]{3,9}\.?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(text); // January 15, 2024
  if (m && monthOf(m[1]) >= 0) return m[3] + '-' + pad(monthOf(m[1]) + 1) + '-' + pad(m[2]);
  m = /^(\d{1,2})(?:st|nd|rd|th)?\.?\s+([A-Za-z]{3,9}\.?),?\s+(\d{4})$/.exec(text); // 15 January 2024
  if (m && monthOf(m[2]) >= 0) return m[3] + '-' + pad(monthOf(m[2]) + 1) + '-' + pad(m[1]);
  return null;
}

/** The fact a field asks for, judged by its name. Null when the invoice does not state it. */
export function valueFor(name, facts) {
  const n = String(name).toLowerCase();
  if (/currency/.test(n)) return facts.currency !== undefined ? facts.currency : currencyOf(facts.total);
  if (/total|amount/.test(n)) return amountOf(facts.total);
  if (/due/.test(n)) return toIsoDate(facts.due);
  if (/date/.test(n)) return toIsoDate(facts.date);
  if (/supplier|vendor|seller/.test(n)) return facts.supplier || null;
  if (/number|invoiceno|invoiceid/.test(n)) return facts.number || null;
  return null;
}

/** Field names listed in the system message as "- name (Type)". */
export function listedFields(system) {
  const names = [];
  const pattern = /^[ \t]*[-*•][ \t]*([A-Za-z_]\w*)/gm;
  let m;
  while ((m = pattern.exec(String(system || '')))) names.push(m[1]);
  return names;
}

/** The JSON a model returns for the schema: one line per field, numbers unquoted. */
function jsonText(fields, value) {
  const lines = fields.map(f => {
    const v = value[f.name];
    const literal = v === null ? 'null' : NUMERIC.test(f.type) ? String(v) : JSON.stringify(v);
    return '  ' + JSON.stringify(f.name) + ': ' + literal;
  });
  return '{\n' + lines.join(',\n') + '\n}';
}

/**
 * @param {{ system: string, user: string, files?: {name:string, reads?:string}[],
 *           resultClass?: { name: string, fields: {name:string,type:string}[] } }} request
 * @returns {{ text: string, value?: Object, insights: Object[] }}
 */
export function respond({ system, user, files = [], resultClass }) {
  const source = [String(user || '')].concat(files.map(f => f.reads || '')).join('\n');
  const facts = extractInvoiceFacts(source);
  // a currency named once for a whole column, e.g. "Total (CHF)"
  facts.currency = currencyOf(facts.total) || (/\(([A-Z]{3})\)/.exec(source) || [])[1] || null;
  const found = Boolean(facts.number || facts.supplier || facts.total || facts.date);
  const document = files.length ? [{ id: 'document', name: files.map(f => f.name).join(', ') }] : [];

  if (resultClass) {
    const value = { __type: resultClass.name };
    resultClass.fields.forEach(f => { value[f.name] = found ? valueFor(f.name, facts) : null; });
    const insights = document.concat([{ id: 'schema', name: resultClass.name.split('.').pop(), fields: resultClass.fields.map(f => f.name) }]);
    const empty = resultClass.fields.filter(f => value[f.name] === null).map(f => f.name);
    if (!found) insights.push({ id: 'no-invoice' });
    else if (empty.length) insights.push({ id: 'null', fields: empty });
    insights.push({ id: 'schema-decides' });
    return { text: jsonText(resultClass.fields, value), value, insights };
  }

  if (!String(system || '').trim()) {
    return { text: 'Could you tell me what you would like me to do with this text?', insights: document.concat([{ id: 'plain' }, { id: 'no-system' }]) };
  }
  if (!found) {
    return { text: 'I could not find any invoice details in the text you provided.', insights: document.concat([{ id: 'plain' }, { id: 'no-invoice' }]) };
  }
  const listed = listedFields(system);
  const names = listed.length ? listed : USUAL_FIELDS;
  const text = names.map(name => {
    const v = valueFor(name, facts);
    return name + ': ' + (v === null ? 'null' : v);
  }).join('\n');
  return { text, insights: document.concat([{ id: 'plain' }, { id: listed.length ? 'listed' : 'usual', fields: names }]) };
}

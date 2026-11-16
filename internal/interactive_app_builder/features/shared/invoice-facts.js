/**
 * Reads the facts out of an invoice text, going by the labels a typical invoice carries.
 * Shared by the stand-in models of the lessons that work on the Acme Corp invoice.
 */

const line = (text, pattern) => {
  const m = pattern.exec(text);
  return m ? m[1].trim() : '';
};

/** The value on the same line as the label, or on the first non-empty line after it. */
const afterLabel = (text, label) => {
  const m = new RegExp('^[ \\t]*(?:' + label + ')[ \\t]*[:：][ \\t]*(.*)$', 'im').exec(text);
  if (!m) return '';
  if (m[1].trim()) return m[1].trim();
  const rest = text.slice(m.index + m[0].length).split(/\r?\n/).map(s => s.trim());
  for (let i = 1; i < rest.length; i++) {
    if (rest[i]) return /[:：]\s*$/.test(rest[i]) ? '' : rest[i];
  }
  return '';
};

/** The first non-empty line after a line that consists of the label alone, as under a heading. */
const afterHeading = (text, label) => {
  const m = new RegExp('^[ \\t]*(?:' + label + ')[ \\t]*$', 'im').exec(text);
  if (!m) return '';
  const rest = text.slice(m.index + m[0].length).split(/\r?\n/).map(s => s.trim());
  return rest.find(Boolean) || '';
};

/** Reads the invoice facts out of free text using the labels a typical invoice carries. */
export function extractInvoiceFacts(input) {
  const text = String(input == null ? '' : input);
  const items = [];
  text.split(/\r?\n/).forEach(row => {
    const m = /^\s*(\S.*?)\s{2,}(\d+)\s+([\d.,]+)\s+([\d.,]+)\s*$/.exec(row);
    if (m) items.push({ description: m[1].trim(), quantity: m[2], unitPrice: m[3], total: m[4] });
  });
  return {
    number: line(text, /invoice\s*(?:number|no\.?|#|id)\s*[:：]?\s*([A-Za-z0-9][\w\-\/.]*)/i) || line(text, /請求書番号\s*[:：]?\s*([A-Za-z0-9][\w\-\/.]*)/),
    date: line(text, /^[ \t]*(?:invoice\s+date|issue\s+date|date|発行日|請求日)[ \t]*[:：][ \t]*(.+)$/im),
    due: line(text, /^[ \t]*(?:due\s*date|payment\s+due|due|支払期限|支払期日)[ \t]*[:：][ \t]*(.+)$/im),
    supplier: afterLabel(text, 'supplier|vendor|seller|from|サプライヤー|仕入先|発行元') || afterHeading(text, 'supplier|vendor|seller|from|サプライヤー|仕入先|発行元'),
    billTo: afterLabel(text, 'bill\\s*to|billed\\s*to|customer|buyer|請求先|宛先'),
    total: line(text, /^[ \t]*(?:total\s+amount\s+due|amount\s+due|grand\s+total|total\s+amount|total|請求合計|合計金額|合計)[ \t]*[:：][ \t]*(.+)$/im) ||
      line(text, /^[ \t]*(?:total\s+amount\s+due|total\s+due|amount\s+due|grand\s+total)[ \t]+([^:：\n]*\d[^\n]*)$/im),
    subtotal: line(text, /^[ \t]*(?:subtotal|sub-total|小計)[ \t]*[:：][ \t]*(.+)$/im),
    tax: line(text, /^[ \t]*(?:tax|vat|消費税|税額)[^:：\n]*[:：][ \t]*(.+)$/im),
    terms: line(text, /^[ \t]*(?:payment\s+terms|terms|支払条件)[ \t]*[:：][ \t]*(.+)$/im),
    bank: line(text, /^[ \t]*(?:bank|銀行)[ \t]*[:：][ \t]*(.+)$/im),
    items
  };
}

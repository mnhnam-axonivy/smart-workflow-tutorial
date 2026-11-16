/**
 * Stand-in for the LLM behind Feature 01's "Invoice Summary Agent".
 *
 * No model is called. The reply is derived from the two things the tutorial teaches:
 *   - the user message  → the invoice facts are read out of whatever text arrives
 *   - the system message → decides which facts are reported, in which shape and language
 *
 * Only a handful of instructions are recognised (listed in `readInstructions`). Each reply
 * comes with `insights` naming what was recognised, so the UI can show cause and effect.
 */

import { extractInvoiceFacts } from '../shared/invoice-facts.js';

export { extractInvoiceFacts };

const JAPANESE = /[぀-ヿ一-龯]/;

const FIELD_ORDER = ['number', 'supplier', 'total', 'due', 'date', 'billTo', 'terms', 'subtotal', 'tax', 'bank', 'items'];
const CORE_FIELDS = ['number', 'supplier', 'total', 'due'];

const FIELD_PATTERNS = {
  number: /invoice\s*(number|no\b|no\.|id\b|#)|請求書番号/i,
  supplier: /supplier|vendor|seller|サプライヤー|仕入先|発行元/i,
  total: /total|amount\s+due|合計|総額/i,
  due: /due\s*date|\bdue\b|payment\s+deadline|支払期限|支払期日/i,
  date: /invoice\s+date|issue\s+date|date\s+of\s+issue|発行日|請求日/i,
  billTo: /bill(ed)?[\s-]*to|customer|buyer|recipient|請求先|宛先/i,
  terms: /payment\s+terms|terms\s+of\s+payment|支払条件/i,
  subtotal: /sub-?total|小計/i,
  tax: /\btax\b|\bvat\b|消費税|税額/i,
  bank: /\bbank|銀行/i,
  items: /line\s+items|\bitems\b|products|明細|品目/i
};

/** Interprets the system message. Returns null when there is none. */
export function readInstructions(system) {
  const sys = String(system == null ? '' : system).trim();
  if (!sys) return null;
  const withoutSubtotal = sys.replace(/sub-?total|小計/gi, ' ');
  const fields = FIELD_ORDER.filter(f => FIELD_PATTERNS[f].test(f === 'total' ? withoutSubtotal : sys));

  let language = 'en';
  let languageExplicit = true;
  if (/日本語|\bin\s+japanese\b|\bjapanese\b/i.test(sys)) language = 'ja';
  else if (/\bin\s+english\b|\benglish\b|英語/i.test(sys)) language = 'en';
  else {
    languageExplicit = false;
    const letters = sys.replace(/\s/g, '');
    const japanese = (letters.match(new RegExp(JAPANESE.source, 'g')) || []).length;
    if (letters.length && japanese / letters.length > 0.2) language = 'ja';
  }

  return {
    fields,
    usedDefaultFields: fields.length === 0,
    language,
    languageExplicit,
    singleSentence: /single\s+sentence|one\s+sentence|1\s+sentence|a\s+sentence\b|一文|1文|１文/i.test(sys),
    bullets: /bullet|as\s+a\s+list|list\s+form|箇条書き/i.test(sys),
    json: /\bjson\b/i.test(sys),
    noCommentary: /(do\s+not|don't|never|no)\s+(add\s+|include\s+)?(any\s+)?(other\s+|additional\s+|extra\s+|further\s+)?(commentary|comments?|explanations?|preamble|remarks?)|nothing\s+else|only\s+(return|output|respond|reply)|余計|以外.{0,12}(不要|書かない|含めない)|(コメント|解説|説明).{0,10}(不要|しない|加えない|追加しない|付けない)/i.test(sys)
  };
}

// ── Wording ──────────────────────────────────────────────────────────────────

const endSentence = (s, stop) => (s.endsWith(stop) || (stop === '.' && /[.!?]$/.test(s)) ? s : s + stop);

function joinEnglish(parts) {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return parts[0] + ' and ' + parts[1];
  return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
}

const itemNames = facts => facts.items.map(i => i.description);

const EN = {
  labels: { number: 'Invoice number', supplier: 'Supplier', total: 'Total amount', due: 'Due date', date: 'Invoice date', billTo: 'Bill to', terms: 'Payment terms', subtotal: 'Subtotal', tax: 'Tax', bank: 'Bank', items: 'Line items' },
  names: { number: 'invoice number', supplier: 'supplier', total: 'total amount', due: 'due date', date: 'invoice date', billTo: 'recipient', terms: 'payment terms', subtotal: 'subtotal', tax: 'tax', bank: 'bank', items: 'line items' },
  single(f, has, missing) {
    let subject = 'The invoice';
    if (has.number) subject += ' ' + f.number;
    if (has.supplier) subject += ' from ' + f.supplier;
    const preds = [];
    if (has.total) preds.push('has a total amount of ' + f.total);
    if (has.due) preds.push('is due on ' + f.due);
    if (has.date) preds.push('was issued on ' + f.date);
    if (has.billTo) preds.push('is billed to ' + f.billTo);
    if (has.terms) preds.push('has payment terms of ' + f.terms);
    if (has.subtotal) preds.push('has a subtotal of ' + f.subtotal);
    if (has.tax) preds.push('includes tax of ' + f.tax);
    if (has.bank) preds.push('is payable via ' + f.bank);
    if (has.items) preds.push('covers ' + joinEnglish(itemNames(f)));
    let sentence;
    if (preds.length) sentence = subject + ' ' + joinEnglish(preds);
    else if (has.number && has.supplier) sentence = 'The invoice ' + f.number + ' is from ' + f.supplier;
    else if (has.number) sentence = 'The invoice number is ' + f.number;
    else if (has.supplier) sentence = 'The invoice is from ' + f.supplier;
    else sentence = '';
    if (missing.length) {
      const gap = 'the invoice text does not state the ' + joinEnglish(missing.map(m => EN.names[m]));
      sentence = sentence ? sentence.replace(/\.$/, '') + ', but ' + gap : gap.charAt(0).toUpperCase() + gap.slice(1);
    }
    return endSentence(sentence, '.');
  },
  multi(f, has, missing) {
    const out = [];
    if (has.number && has.supplier) out.push('Invoice ' + f.number + ' was issued by ' + f.supplier);
    else if (has.number) out.push('The invoice number is ' + f.number);
    else if (has.supplier) out.push('The invoice was issued by ' + f.supplier);
    if (has.total) out.push('The total amount is ' + f.total);
    if (has.due) out.push('Payment is due on ' + f.due);
    if (has.date) out.push('It was issued on ' + f.date);
    if (has.billTo) out.push('It is billed to ' + f.billTo);
    if (has.terms) out.push('The payment terms are ' + f.terms);
    if (has.subtotal) out.push('The subtotal is ' + f.subtotal);
    if (has.tax) out.push('The tax is ' + f.tax);
    if (has.bank) out.push('The bank is ' + f.bank);
    if (has.items) out.push('It covers ' + joinEnglish(itemNames(f)));
    if (missing.length) out.push('The invoice text does not state the ' + joinEnglish(missing.map(m => EN.names[m])));
    return out.map(s => endSentence(s, '.')).join(' ');
  },
  chatty: body => 'Sure! Here is the summary of the invoice:\n\n' + body + '\n\nLet me know if you need anything else.',
  noInvoice: 'I could not find any invoice details in the text you provided.',
  unclear: 'Could you tell me what you would like me to do with this text?',
  guess(f, variant) {
    const n = f.items.length;
    if (variant === 1) {
      return 'I received an invoice' + (f.number ? ' (' + f.number + ')' : '') + '. What would you like me to do with it? I can summarize it, pull out fields such as the total or the due date, or check the calculations.';
    }
    if (variant === 2) return 'Here are the details I found:\n' + bulletList(f, FIELD_ORDER.filter(k => present(f, k)), EN);
    let s = 'This looks like an invoice' + (f.number ? ' (' + f.number + ')' : '') + (f.supplier ? ' from ' + f.supplier.replace(/\.$/, '') : '') + (f.billTo ? ' to ' + f.billTo : '') + (f.date ? ', dated ' + f.date : '') + '.';
    if (n) s += ' It lists ' + n + ' line item' + (n === 1 ? '' : 's') + ': ' + joinEnglish(itemNames(f)) + '.';
    const money = [];
    if (f.subtotal) money.push('the subtotal is ' + f.subtotal);
    if (f.tax) money.push('tax is ' + f.tax);
    if (f.total) money.push('the total amount due is ' + f.total);
    if (money.length) { const m = joinEnglish(money); s += ' ' + m.charAt(0).toUpperCase() + m.slice(1) + '.'; }
    if (f.due) s += ' Payment is due on ' + f.due + (f.terms ? ' (' + f.terms + ')' : '') + '.';
    return s + ' Would you like me to summarize it, extract specific fields, or check the calculations?';
  }
};

const JA = {
  labels: { number: '請求書番号', supplier: 'サプライヤー', total: '合計金額', due: '支払期限', date: '発行日', billTo: '請求先', terms: '支払条件', subtotal: '小計', tax: '税額', bank: '銀行', items: '品目' },
  names: null,
  single(f, has, missing) {
    let subject = '請求書';
    if (has.number) subject += ' ' + f.number;
    if (has.supplier) subject += '（' + f.supplier + ' 発行）';
    const parts = [];
    if (has.total) parts.push('合計金額は ' + f.total);
    if (has.due) parts.push('支払期限は ' + f.due);
    if (has.date) parts.push('発行日は ' + f.date);
    if (has.billTo) parts.push('請求先は ' + f.billTo);
    if (has.terms) parts.push('支払条件は ' + f.terms);
    if (has.subtotal) parts.push('小計は ' + f.subtotal);
    if (has.tax) parts.push('税額は ' + f.tax);
    if (has.bank) parts.push('銀行は ' + f.bank);
    if (has.items) parts.push('品目は ' + itemNames(f).join('、'));
    let sentence;
    if (parts.length) sentence = subject + 'の' + parts.join('、') + ' です';
    else if (has.number && has.supplier) sentence = '請求書 ' + f.number + ' の発行元は ' + f.supplier + ' です';
    else if (has.number) sentence = '請求書番号は ' + f.number + ' です';
    else if (has.supplier) sentence = '請求書の発行元は ' + f.supplier + ' です';
    else sentence = '';
    if (missing.length) {
      const gap = missing.map(m => JA.labels[m]).join('・') + 'の記載はありません';
      sentence = sentence ? sentence + '（' + gap + '）' : '請求書テキストに' + gap;
    }
    return endSentence(sentence, '。');
  },
  multi(f, has, missing) {
    const out = [];
    if (has.number) out.push('請求書番号は ' + f.number + ' です');
    if (has.supplier) out.push('発行元は ' + f.supplier + ' です');
    if (has.total) out.push('合計金額は ' + f.total + ' です');
    if (has.due) out.push('支払期限は ' + f.due + ' です');
    if (has.date) out.push('発行日は ' + f.date + ' です');
    if (has.billTo) out.push('請求先は ' + f.billTo + ' です');
    if (has.terms) out.push('支払条件は ' + f.terms + ' です');
    if (has.subtotal) out.push('小計は ' + f.subtotal + ' です');
    if (has.tax) out.push('税額は ' + f.tax + ' です');
    if (has.bank) out.push('銀行は ' + f.bank + ' です');
    if (has.items) out.push('品目は ' + itemNames(f).join('、') + ' です');
    if (missing.length) out.push(missing.map(m => JA.labels[m]).join('・') + 'は請求書テキストに記載されていません');
    return out.map(s => endSentence(s, '。')).join('');
  },
  chatty: body => '承知しました。請求書の要約は次のとおりです。\n\n' + body + '\n\n他にお手伝いできることがあればお知らせください。',
  noInvoice: '提供されたテキストから請求書の情報を見つけられませんでした。',
  unclear: 'このテキストについて、何をすればよいか教えていただけますか？',
  guess(f, variant) {
    if (variant === 1) {
      return '請求書' + (f.number ? '（' + f.number + '）' : '') + 'を受け取りました。この請求書について何をすればよいでしょうか？要約、合計金額や支払期限などの抽出、計算の確認ができます。';
    }
    if (variant === 2) return '確認できた内容は次のとおりです。\n' + bulletList(f, FIELD_ORDER.filter(k => present(f, k)), JA);
    let s = 'これは' + (f.supplier ? ' ' + f.supplier + ' から' : '') + (f.billTo ? ' ' + f.billTo + ' 宛て' : '') + 'の請求書' + (f.number ? '（' + f.number + '）' : '') + 'のようです。';
    if (f.items.length) s += '品目は ' + f.items.length + ' 件（' + itemNames(f).join('、') + '）です。';
    if (f.total) s += '請求合計は ' + f.total + ' です。';
    if (f.due) s += '支払期限は ' + f.due + ' です。';
    return s + '要約、特定項目の抽出、計算の確認など、どのような対応をご希望ですか？';
  }
};
JA.names = JA.labels;

const WORDING = { en: EN, ja: JA };

function present(facts, key) {
  return key === 'items' ? facts.items.length > 0 : Boolean(facts[key]);
}

function valueOf(facts, key) {
  return key === 'items' ? itemNames(facts).join(', ') : facts[key];
}

function bulletList(facts, keys, words) {
  return keys.map(k => '- ' + words.labels[k] + ': ' + valueOf(facts, k)).join('\n');
}

const JSON_KEYS = { number: 'invoiceNumber', supplier: 'supplierName', total: 'totalAmount', due: 'dueDate', date: 'invoiceDate', billTo: 'billTo', terms: 'paymentTerms', subtotal: 'subtotal', tax: 'tax', bank: 'bank', items: 'items' };

/**
 * @param {{ system: string, user: string, runIndex?: number }} request
 * @returns {{ text: string, insights: Object[] }}
 */
export function respond({ system, user, runIndex = 0 }) {
  const facts = extractInvoiceFacts(user);
  const found = CORE_FIELDS.some(k => present(facts, k));
  const instructions = readInstructions(system);

  if (!instructions) {
    const words = JAPANESE.test(String(user)) && !/[A-Za-z]{4,}\s+[A-Za-z]{4,}/.test(String(user)) ? JA : EN;
    const variant = ((runIndex % 3) + 3) % 3;
    return {
      text: found ? words.guess(facts, variant) : words.unclear,
      insights: [{ id: 'no-system', variant: variant + 1 }]
    };
  }

  const words = WORDING[instructions.language];
  const insights = [];
  const wanted = instructions.usedDefaultFields ? CORE_FIELDS : instructions.fields;
  insights.push({ id: instructions.usedDefaultFields ? 'default-fields' : 'fields', fields: wanted });
  if (instructions.languageExplicit || instructions.language !== 'en') insights.push({ id: 'language', language: instructions.language });

  if (!found) {
    insights.push({ id: 'no-invoice' });
    return { text: words.noInvoice, insights };
  }

  const has = {};
  wanted.forEach(k => { has[k] = present(facts, k); });
  const missing = wanted.filter(k => !has[k]);
  if (missing.length) insights.push({ id: 'missing', fields: missing });

  let body;
  if (instructions.json) {
    const obj = {};
    wanted.forEach(k => { obj[JSON_KEYS[k]] = has[k] ? (k === 'items' ? itemNames(facts) : facts[k]) : null; });
    body = JSON.stringify(obj, null, 2);
    insights.push({ id: 'json' });
  } else if (instructions.bullets) {
    body = bulletList(facts, wanted.filter(k => has[k]), words);
    insights.push({ id: 'bullets' });
  } else if (instructions.singleSentence) {
    body = words.single(facts, has, missing);
    insights.push({ id: 'single-sentence' });
  } else {
    body = words.multi(facts, has, missing);
    insights.push({ id: 'several-sentences' });
  }

  if (instructions.noCommentary) {
    insights.push({ id: 'no-commentary' });
    return { text: body, insights };
  }
  insights.push({ id: 'chatty' });
  return { text: words.chatty(body), insights };
}

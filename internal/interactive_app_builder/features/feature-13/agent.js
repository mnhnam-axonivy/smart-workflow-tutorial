/**
 * Stand-in for the model behind the "Invoice Approval Agent" of the Human in the Loop lesson.
 * No model is called. It follows its system message:
 *
 *   - the limit is the amount the system message names ("exceeds $2,000");
 *   - an invoice above the limit needs a reason from a human: it asks for one through the
 *     tool the system message names, with a single direct question, and once the answer is
 *     there it confirms the approval with that reason;
 *   - an invoice that does not exceed the limit is approved at once, without the tool;
 *   - above the limit and without that tool it says that it cannot ask, and approves
 *     nothing. A real model might decide by itself instead;
 *   - a tool that came with the request but that the system message does not name is not
 *     used: it says that its instructions do not tell it how to get a reason.
 */
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const number = text => parseFloat(String(text).replace(/[^0-9.]/g, ''));

/** "Invoice #INV-1 from Apex Solutions Ltd. Total: $12,500 USD. …" → { id, supplier, total, amount } */
export function readInvoice(message) {
  const text = String(message || '');
  const id = (/invoice\s+#?([A-Za-z0-9][\w-]*)/i.exec(text) || [])[1] || '';
  const total = (/total:\s*(\$?\s?[\d,]+(?:\.\d+)?(?:\s*[A-Z]{3}\b)?)/i.exec(text) || [])[1] || '';
  let supplier = (/\bfrom\s+(.+?)\s+total:/i.exec(text) || [])[1] || '';
  // the full stop that ends the sentence is not part of the name, the one of "Ltd." is
  if (/\.$/.test(supplier) && !/\b(Ltd|Inc|Co|Corp|GmbH|AG)\.$/.test(supplier)) supplier = supplier.slice(0, -1);
  return { id, supplier, total: total.trim(), amount: total ? number(total) : NaN };
}

/** The limit in the system message: "exceeds $2,000" → 2000. */
export function limitOf(system) {
  const m = /exceeds\s+\$?\s?([\d,]+(?:\.\d+)?)/i.exec(String(system || ''));
  return m ? number(m[1]) : 2000;
}

const dollars = n => '$' + n.toLocaleString('en-US');

/**
 * @param {{ system: string, user: string, tools?: Object[], toolResults?: Object[] }} request
 * @returns {{ text: string, toolCalls?: Object[], insights?: Object[] }}
 */
export function respond({ system, user, tools = [], toolResults = [] }) {
  const invoice = readInvoice(user);
  if (Number.isNaN(invoice.amount)) {
    return { text: 'I could not find an invoice total in your message.', insights: [{ id: 'no-invoice' }] };
  }
  const limit = limitOf(system);
  const name = 'Invoice ' + (invoice.id || '(no number)') + (invoice.supplier ? ' from ' + invoice.supplier : '');
  const facts = { total: invoice.total, limit: dollars(limit) };

  if (invoice.amount <= limit) {
    return {
      text: name + ' for ' + invoice.total + ' is approved automatically: the total does not exceed ' + dollars(limit) + '. An approval task will be created.',
      insights: [{ id: 'below', ...facts }]
    };
  }
  const ask = tools.find(tool => new RegExp('\\b' + escapeRegExp(tool.name) + '\\b').test(String(system || '')));
  if (!ask && tools.length) {
    return {
      text: name + ' totals ' + invoice.total + ', which is above ' + dollars(limit) + ' and needs a justification from a human. My instructions do not say how to get one, so I cannot approve this invoice.',
      insights: [{ id: 'not-told', ...facts, tool: tools.map(tool => tool.name).join(', ') }]
    };
  }
  if (!ask) {
    return {
      text: name + ' totals ' + invoice.total + ', which is above ' + dollars(limit) + ' and needs a justification from a human. I have no tool to ask for one, so I cannot approve this invoice.',
      insights: [{ id: 'no-tool', ...facts }]
    };
  }
  const answered = toolResults.find(result => result.name === ask.name);
  if (!answered) {
    const question = name + ' totals ' + invoice.total + ', which is above ' + dollars(limit) + '. What is your justification reason for approving it?';
    const param = (ask.params[0] || { name: 'feedback' }).name;
    return { text: '', toolCalls: [{ name: ask.name, arguments: { [param]: { question } } }], insights: [{ id: 'asked', tool: ask.name, ...facts }] };
  }
  const reason = String(answered.result == null ? '' : answered.result).trim();
  return {
    text: name + ' for ' + invoice.total + ' is approved. ' +
      (reason ? 'An approval task will be created with the justification reason: "' + reason + '"' : 'No justification reason was given, so the approval task will be created without one.'),
    insights: [{ id: 'asked', tool: ask.name, ...facts }, { id: 'answered' }]
  };
}

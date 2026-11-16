/**
 * Stand-in for the model behind the two "Reminder Subject" agents of the Model
 * Settings lesson. No model is called. It writes one subject line for the invoice, and the
 * temperature decides how much it varies from run to run:
 *
 *   - at 0.0 it is always the same line;
 *   - the higher the temperature, the more wordings it chooses from, and each run takes
 *     another one.
 *
 * A real model varies at random; here the run number picks the wording, so that the
 * walkthrough shows the same thing every time.
 */
import { extractInvoiceFacts } from '../shared/invoice-facts.js';

/** One wording per entry; the first is what the model writes at temperature 0.0. */
const WORDINGS = [
  f => 'Friendly reminder: invoice ' + f.number + ' is past due',
  f => 'A quick nudge about invoice ' + f.number + ' (due ' + f.due + ')',
  f => 'Invoice ' + f.number + ' from ' + f.supplier + ' is still open',
  f => 'Could you take a look at invoice ' + f.number + '?',
  f => f.total + ' outstanding on invoice ' + f.number,
  f => 'Just checking in on invoice ' + f.number,
  f => 'Payment reminder for invoice ' + f.number + ', due since ' + f.due,
  f => 'Gentle follow-up: invoice ' + f.number + ' awaits payment'
];

/** How many wordings are in play at a temperature: 1 at 0.0, six at 1.0, all from 1.4 on. */
export const variety = temperature => Math.max(1, Math.min(WORDINGS.length, 1 + Math.round((Number(temperature) || 0) * 5)));

/**
 * @param {{ user: string, temperature: number, runIndex: number }} request
 * @returns {{ text: string, insights: Object[] }}
 */
export function respond({ user, temperature, runIndex = 0 }) {
  const read = extractInvoiceFacts(user);
  if (!read.number) {
    return { text: 'Friendly reminder: an invoice is past due', insights: [{ id: 'no-invoice' }] };
  }
  const facts = { number: read.number, supplier: read.supplier || 'your supplier', total: read.total || 'An amount', due: read.due || 'the due date' };
  const n = variety(temperature);
  const pick = n === 1 ? 0 : (runIndex + 1) % n;
  return { text: WORDINGS[pick](facts), insights: [{ id: n === 1 ? 'fixed' : 'varied', count: n, temperature: Number(temperature) || 0 }] };
}

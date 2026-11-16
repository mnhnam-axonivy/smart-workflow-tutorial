/**
 * Stand-in for the three models of Feature 03. No model is called, whichever provider an
 * agent names: the provider and model decide where the call goes, not what comes back.
 *
 *   Invoice Analysis Agent  → the shared invoice extractor (a result type is set)
 *   Urgency Classifier      → URGENT / NORMAL / LOW from the amount, with the limits the
 *                             system message states
 *   Supplier Risk Check     → LOW / MEDIUM / HIGH from what the supplier name looks like
 *
 * Which of the three answers is decided by what the call asks for, not by the element.
 */
import { respond as extract } from '../shared/invoice-extractor.js';

const number = text => {
  const m = /-?\d[\d,]*(?:\.\d+)?/.exec(String(text || ''));
  return m ? parseFloat(m[0].replace(/,/g, '')) : NaN;
};

/** The limits the system message gives: "URGENT: amount is 10000 or above", "LOW: amount is below 1000". */
export function urgencyLimits(system) {
  const urgent = number((/URGENT[^\n]*?(\d[\d,.]*)/.exec(String(system || '')) || [])[1]);
  const low = number((/LOW[^\n]*?below\s+(\d[\d,.]*)/i.exec(String(system || '')) || [])[1]);
  return { urgent: Number.isNaN(urgent) ? 10000 : urgent, low: Number.isNaN(low) ? 1000 : low };
}

export function classifyUrgency(system, user) {
  const amount = number(user);
  if (Number.isNaN(amount)) {
    return { text: 'I need a total amount to classify the urgency.', insights: [{ id: 'urgency-missing' }] };
  }
  const limits = urgencyLimits(system);
  const text = amount >= limits.urgent ? 'URGENT' : amount >= limits.low ? 'NORMAL' : 'LOW';
  return { text, insights: [{ id: 'urgency', amount: String(amount), urgent: String(limits.urgent), low: String(limits.low), result: text }] };
}

const COMPANY = /(^|[\s,])(Ltd|Limited|Inc|Incorporated|GmbH|AG|Corp|Corporation|LLC|PLC|Co|K\.K|S\.A|SA|BV|Pty)\.?($|[\s,])|株式会社|有限会社/i;

export function classifyRisk(user) {
  const name = String(user || '').trim();
  const words = name.split(/\s+/).filter(Boolean);
  let text;
  let reason;
  if (!name || words.length < 2 || !/[A-Za-z぀-鿿]{3}/.test(name) || !/[aeiou぀-鿿]/i.test(name)) {
    text = 'HIGH';
    reason = 'risk-high';
  } else if (COMPANY.test(name)) {
    text = 'LOW';
    reason = 'risk-low';
  } else {
    text = 'MEDIUM';
    reason = 'risk-medium';
  }
  return { text, insights: [{ id: reason, name }] };
}

/**
 * @param {{ system: string, user: string, resultClass?: Object }} request
 * @returns {{ text: string, value?: Object, insights: Object[] }}
 */
export function respond(request) {
  const system = String(request.system || '');
  if (!request.resultClass && /URGENT/.test(system) && /NORMAL/.test(system)) return classifyUrgency(system, request.user);
  if (!request.resultClass && /risk/i.test(system) && /HIGH/.test(system) && /MEDIUM/.test(system)) return classifyRisk(request.user);
  return extract(request);
}

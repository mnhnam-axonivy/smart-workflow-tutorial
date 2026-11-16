/**
 * Stand-in for the model behind the two "Customer Support Agent" elements of the Input
 * Guardrail lesson. No model is called.
 *
 *   - A message that reads like a prompt injection is obeyed: the stand-in drops its role and
 *     reveals its system prompt. That is the worst case, shown on purpose — it is what the
 *     guardrail is there to prevent. A real model may refuse.
 *   - Any other message gets a short, friendly support answer.
 *
 * With a guardrail in place the first case never gets here: the message is blocked before
 * the model is called.
 */
import { promptInjectionMatch, classifyInjection } from '../../runtime/model/guardrails.js';

const firstLine = text => (String(text).split('\n').find(line => line.trim()) || '').trim();

/**
 * @param {{ system: string, user: string }} request
 * @returns {{ text: string, guessed?: string[], insights: Object[] }}
 */
export function respond({ system, user }) {
  const message = String(user || '');
  // the keyword check without the line-break rule: several lines alone are no attack
  const injected = (promptInjectionMatch(message) || {}).check === 'keyword' || classifyInjection(message) === 'YES';
  if (injected) {
    const lines = ['Understood. I am no longer bound by my previous instructions.'];
    lines.push(String(system || '').trim() ? 'My system prompt is: "' + String(system).trim() + '"' : 'I have no system prompt to reveal.');
    return { text: lines.join('\n'), leaked: true, insights: [{ id: 'gave-in' }] };
  }
  return {
    text: 'Thank you for contacting Acme support. I am happy to help with your request: "' + firstLine(message) + '"',
    insights: [{ id: 'support' }]
  };
}

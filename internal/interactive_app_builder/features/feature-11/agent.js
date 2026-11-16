/**
 * Stand-in for the model behind the "Customer Support Agent" of the PII Masking lesson. No
 * model is called. The user message asks it to echo a list of fields back, and it does:
 * one line per field, "Label: value".
 *
 * It only ever sees what the input guardrail lets through, so with masking on, the values are
 * <TYPE_hash> placeholders. What it does with those depends on its system message:
 *   - told that they are placeholders to repeat as they are, it repeats them exactly;
 *   - not told, it describes each one in words — which is what breaks the restoration, and
 *     what the tutorial warns about. A real model may or may not do this.
 */
const LABELS = { mac: 'MAC', email: 'Email', phone: 'Phone', card: 'Card', ssn: 'SSN', born: 'Born', ip: 'IP' };
const PLACEHOLDER = /<([A-Z_]+)_[0-9a-f]{6,}>/g;

const label = word => LABELS[word.toLowerCase()] || word.charAt(0).toUpperCase() + word.slice(1);
/** <DATE_OF_BIRTH_1a2b…> → "(an anonymised date of birth)" */
const describe = type => '(an anonymised ' + type.toLowerCase().replace(/_/g, ' ') + ')';

/**
 * @param {{ system: string, user: string }} request
 * @returns {{ text: string, insights: Object[] }}
 */
export function respond({ system, user }) {
  const message = String(user || '').trim();
  const colon = message.indexOf(':');
  const fields = colon < 0 ? [] : message.slice(colon + 1).replace(/\.\s*$/, '').split(/,\s*/).map(part => part.trim()).filter(Boolean)
    .map(part => { const space = part.indexOf(' '); return space < 0 ? null : { name: label(part.slice(0, space)), value: part.slice(space + 1).trim() }; });
  if (!fields.length || fields.includes(null)) {
    return { text: 'You wrote: ' + message, insights: [{ id: 'plain' }] };
  }
  const explained = /placeholder/i.test(String(system || ''));
  const masked = fields.some(f => /<[A-Z_]+_[0-9a-f]{6,}>/.test(f.value));
  const lines = fields.map(f => f.name + ': ' + (explained ? f.value : f.value.replace(PLACEHOLDER, (all, type) => describe(type))));
  const insights = [{ id: 'echoed', count: fields.length }];
  if (masked) insights.push({ id: explained ? 'kept' : 'paraphrased' });
  return { text: lines.join('\n'), insights };
}

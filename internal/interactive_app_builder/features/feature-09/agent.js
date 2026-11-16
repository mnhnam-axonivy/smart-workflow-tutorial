/**
 * Stand-in for the model behind the "Assistant Agent" of the Output Guardrail lesson. No model
 * is called. It has one prepared answer: asked for the format of an API key, it explains the
 * format and adds two example keys — which is what the output guardrail is there to stop.
 * The keys are made up for this simulation.
 */
const KEY_ANSWER = [
  'OpenAI API keys start with the prefix "sk-", followed by a long random string of letters and digits. Project keys start with "sk-proj-".',
  'Examples:',
  '- sk-proj-4f8Kq2ZtY7mN1xLb9RcV3wHs6Jd0PaEu',
  '- sk-T7pQ2mX9vL4sW8yZ1aC5dE6fG3hJ0kNb'
].join('\n');

/**
 * @param {{ user: string }} request
 * @returns {{ text: string, insights: Object[] }}
 */
export function respond({ user }) {
  const question = String(user || '');
  if (/\b(api|secret|access)[ -]?(key|token)s?\b/i.test(question)) {
    return { text: KEY_ANSWER, insights: [{ id: 'key-examples' }] };
  }
  return {
    text: 'I can help with that. (This simulated assistant has one prepared answer: ask it for the format of an OpenAI API key.)',
    insights: [{ id: 'generic' }]
  };
}

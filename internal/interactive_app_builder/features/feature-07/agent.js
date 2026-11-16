/**
 * Stand-in for the model behind the "Web Search Agent". No model is called. What it does:
 *
 *   - when webSearch came with the request and the system message names it, it searches for
 *     the user's question, once;
 *   - with results it answers with the summary of the first one and cites its URL, as the
 *     system message asks;
 *   - with no results it says so, and does not make up an answer (a real model might);
 *   - without the search it says that it can only answer from training data.
 */
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {{ system: string, user: string, tools?: Object[], toolResults?: Object[] }} request
 * @returns {{ text: string, toolCalls?: Object[], insights?: Object[] }}
 */
export function respond({ system, user, tools = [], toolResults = [] }) {
  const question = String(user || '').trim();
  const named = tools.filter(tool => new RegExp('\\b' + escapeRegExp(tool.name) + '\\b').test(String(system || '')));
  const searchTool = named.find(tool => tool.params.some(p => p.name === 'query'));
  const done = toolResults[toolResults.length - 1];

  if (searchTool && !done) {
    return { text: '', toolCalls: [{ name: searchTool.name, arguments: { query: question } }] };
  }
  if (!done) {
    const unused = tools.filter(tool => !named.includes(tool)).map(tool => tool.name);
    return {
      text: 'I do not have current information about this. Without a web search I can only answer from my training data, which may be out of date.',
      insights: [unused.length ? { id: 'tool-unused', names: unused } : { id: 'no-tool' }]
    };
  }
  if (done.failed || !done.data) {
    return { text: 'The web search did not work: ' + String(done.result), insights: [{ id: 'search-failed' }] };
  }
  const results = done.data.results || [];
  if (!results.length) {
    return { text: 'The web search returned no results for this question, so I cannot give a sourced answer.', insights: [{ id: 'no-results', note: done.data.note || '' }] };
  }
  return {
    text: results[0].snippet + ' Source: ' + results[0].url,
    insights: [{ id: 'searched', query: question }, { id: 'cited', count: results.length, url: results[0].url }]
  };
}

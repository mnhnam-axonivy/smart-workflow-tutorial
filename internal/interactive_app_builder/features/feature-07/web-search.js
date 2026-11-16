/**
 * The built-in `webSearch` tool, without the internet: the guide has to work offline, so the
 * search engine is a list of three pages. Everything around it follows Smart Workflow's
 * WebSearchTool (14.0.0): the engine is chosen by AI.Tool.WebSearch.Engine, at most
 * MaxResults results are asked for, WhitelistDomains filters them, and the result carries a
 * note when nothing is left.
 */
import { parseYaml, readVariable } from '../../runtime/model/yaml.js';

const DEFAULT_MAX_RESULTS = 5;

/**
 * The simulated web. The first page summarises Axon Ivy 14 in the words of this tutorial's
 * own example output; the other two are placeholders on other domains, there to show what
 * MaxResults and the domain whitelist do.
 */
export const PAGES = [
  {
    title: 'Axon Ivy 14.0 Release Notes',
    url: 'https://developer.axonivy.com/release-notes/14.0',
    snippet: 'Axon Ivy 14 introduces Smart Workflow — an AI agent framework built directly into the process engine. Key features include AgenticProcessCall for embedding LLM agents in processes, support for six AI providers (OpenAI, Anthropic, Ollama, Mistral, Gemini, Azure OpenAI), callable process tools, Java tools, web search, guardrails, and observability via Arize Phoenix.'
  },
  {
    title: 'Axon Ivy 14: a first look',
    url: 'https://blog.example.com/axon-ivy-14-first-look',
    snippet: 'A sample page of this simulation on another domain. It stands for the blog posts a real search would also return.'
  },
  {
    title: 'What is new in Axon Ivy 14? (discussion)',
    url: 'https://forum.example.org/t/axon-ivy-14',
    snippet: 'A sample page of this simulation on a third domain. It stands for forum threads and other unofficial sources.'
  }
];

/** The engine: every page for a question about Axon Ivy, nothing for anything else. */
export function search(query, maxResults) {
  return /\bivy\b/i.test(String(query || '')) ? PAGES.slice(0, Math.max(0, maxResults)) : [];
}

export function readMaxResults(value) {
  const configured = String(value || '').trim();
  return /^[-+]?\d+$/.test(configured) ? parseInt(configured, 10) : DEFAULT_MAX_RESULTS;
}

/** WhitelistDomainFilter: a host passes when it is a listed domain or a subdomain of one. */
export function allowedBy(whitelist, url) {
  const domains = String(whitelist || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
  if (!domains.length) return true;
  const host = (/^[a-z]+:\/\/([^/:?#]+)/i.exec(url) || [])[1];
  return Boolean(host) && domains.some(domain => host === domain || host.endsWith('.' + domain));
}

/** WebSearchTool.execute with the given settings: { query, results, note? }. */
export function webSearch(query, { engine = '', maxResults = '', whitelist = '' } = {}) {
  const name = String(engine || '').trim();
  if (name && name.toLowerCase() !== 'duckduckgo') {
    throw new Error('No SmartWebSearchEngine found. Register a SmartWebSearchEngineProvider via META-INF/services.');
  }
  const raw = search(query, readMaxResults(maxResults));
  const results = raw.filter(page => allowedBy(whitelist, page.url));
  const out = { query: String(query), results };
  if (!results.length) {
    out.note = raw.length
      ? 'All ' + raw.length + ' result(s) were excluded by the configured domain whitelist.'
      : 'No results returned by the search engine. The source may be rate-limited or the query may have no indexed matches. Do not speculate about the cause; report to the user that no results were found.';
  }
  return out;
}

/** The tool as Smart Workflow registers it; its settings come from variables.yaml. */
export function builtinTools(sources, { variablesText = '' } = {}) {
  const yaml = parseYaml(variablesText);
  const read = name => (yaml.errors.length ? '' : readVariable(yaml.value, 'AI.Tool.WebSearch.' + name));
  return [{
    name: 'webSearch',
    description: 'Search the web for current information using the given query.\nReturns a list of search results with titles, URLs, and content snippets.\nUse this tool to find up-to-date or factual information from the internet.',
    params: [{ name: 'query', description: 'The search query to look up on the web', type: 'java.lang.String' }],
    execute: args => webSearch(args.query, { engine: read('Engine'), maxResults: read('MaxResults'), whitelist: read('WhitelistDomains') })
  }];
}

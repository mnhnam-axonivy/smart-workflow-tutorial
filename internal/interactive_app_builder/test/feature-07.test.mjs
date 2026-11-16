import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadProcess, elementById, agentConfig } from '../runtime/model/process.js';
import { ProcessRunner } from '../runtime/model/runner.js';
import { prettyJson } from '../runtime/model/ivyscript.js';
import { respond } from '../features/feature-07/agent.js';
import { webSearch, allowedBy, readMaxResults, builtinTools, PAGES } from '../features/feature-07/web-search.js';

const tutorial = new URL('../../../tutorial/', import.meta.url);
const json = path => JSON.parse(readFileSync(fileURLToPath(new URL(path, tutorial)), 'utf8'));
const processJson = json('process/tutorial/features/Feature07.p.json');
const dataClassJson = json('dataclass/tutorial/Feature07Data.d.json');

const variables = (settings = '') => 'Variables:\n  AI:\n    DefaultProvider: "OpenAI"\n    Providers:\n      OpenAI:\n        APIKey: "sk-..."\n' + (settings ? '    Tool:\n      WebSearch:\n' + settings : '');
const QUESTION = 'What are the latest features in Axon Ivy 14?';
// the example output of the tutorial
const ANSWER = 'Axon Ivy 14 introduces Smart Workflow — an AI agent framework built directly into the process engine. Key features include AgenticProcessCall for embedding LLM agents in processes, support for six AI providers (OpenAI, Anthropic, Ollama, Mistral, Gemini, Azure OpenAI), callable process tools, Java tools, web search, guardrails, and observability via Arize Phoenix. Source: https://developer.axonivy.com/release-notes/14.0';

async function run(variablesText, change) {
  const model = loadProcess(processJson, dataClassJson, { project: 'tutorial', file: 'Feature07.p.json' });
  if (change) change(agentConfig(elementById(model, 'f5')), model);
  const runner = new ProcessRunner({ model, brain: { respond }, io: {}, simulates: { tools: true }, javaTools: () => builtinTools({}, { variablesText }) });
  return runner.run({ variablesText });
}

test('search: the settings act as in WebSearchTool', () => {
  assert.equal(webSearch(QUESTION).results.length, 3);
  assert.equal(webSearch(QUESTION).note, undefined);
  assert.equal(webSearch(QUESTION, { maxResults: '2' }).results.length, 2);
  assert.equal(readMaxResults(''), 5);
  assert.equal(readMaxResults('many'), 5, 'not a number: the default');
  assert.deepEqual(webSearch(QUESTION, { whitelist: 'developer.axonivy.com' }).results.map(r => r.url), ['https://developer.axonivy.com/release-notes/14.0']);
  assert.equal(webSearch(QUESTION, { whitelist: ' AxonIvy.com , example.org ' }).results.length, 2, 'subdomains pass, case and spaces do not matter');
  assert.equal(webSearch(QUESTION, { whitelist: 'docs.example.net' }).note, 'All 3 result(s) were excluded by the configured domain whitelist.');
  assert.match(webSearch('weather in Zug').note, /^No results returned by the search engine\./);
  assert.equal(webSearch(QUESTION, { engine: 'DuckDuckGo' }).results.length, 3);
  assert.throws(() => webSearch(QUESTION, { engine: 'bing' }), /No SmartWebSearchEngine found/);
  assert.equal(allowedBy('ivy.com', 'https://developer.axonivy.com/x'), false, 'axonivy.com is not a subdomain of ivy.com');
  assert.ok(PAGES.slice(1).every(p => /example\.(com|org)/.test(p.url)), 'the placeholder pages use reserved example domains');
});

test('json: an object result is written as Json.toJson writes it', () => {
  assert.equal(prettyJson({ query: 'q', results: [{ title: 'T', url: 'u' }], note: null }), '{\n  "query" : "q",\n  "results" : [ {\n    "title" : "T",\n    "url" : "u"\n  } ]\n}');
  assert.equal(prettyJson({ results: [] }), '{\n  "results" : [ ]\n}');
});

test('runner: the agent searches for the question and answers with the first result and its URL', async () => {
  const result = await run(variables());
  assert.equal(result.status, 'completed');
  const call = result.agentCalls[0];
  assert.deepEqual(call.tools.map(t => t.name + '(' + t.params.map(p => p.name).join() + ')'), ['webSearch(query)']);
  assert.deepEqual(call.steps.map(s => [s.name, s.arguments]), [['webSearch', { query: QUESTION }]]);
  assert.equal(call.steps[0].data.results.length, 3);
  assert.match(call.steps[0].result, /^\{\n {2}"query" : "What are the latest features in Axon Ivy 14\?",\n {2}"results" : \[ \{\n {4}"title" : "Axon Ivy 14\.0 Release Notes",/);
  assert.equal(result.data.searchResult, ANSWER);
  assert.equal(result.logs[result.logs.length - 1].message, ANSWER);
});

test('runner: variables.yaml decides what reaches the model', async () => {
  const trusted = await run(variables('        WhitelistDomains: "developer.axonivy.com"\n'));
  assert.equal(trusted.agentCalls[0].steps[0].data.results.length, 1);
  assert.equal(trusted.data.searchResult, ANSWER);
  const narrow = await run(variables('        WhitelistDomains: "docs.example.net"\n'));
  assert.equal(narrow.agentCalls[0].steps[0].data.note, 'All 3 result(s) were excluded by the configured domain whitelist.');
  assert.equal(narrow.data.searchResult, 'The web search returned no results for this question, so I cannot give a sourced answer.');
  const engine = await run(variables('        Engine: "bing"\n'));
  assert.equal(engine.status, 'completed');
  assert.equal(engine.agentCalls[0].steps[0].result, "Error executing tool 'webSearch'");
  assert.equal(engine.data.searchResult, "The web search did not work: Error executing tool 'webSearch'");
});

test('runner: a system message that does not name the tool means no search', async () => {
  const result = await run(variables(), cfg => { cfg.system = cfg.system.replace('Use the webSearch tool to look up current information on the internet.\n', ''); });
  const call = result.agentCalls[0];
  assert.equal(call.tools.length, 1, 'the tool still goes with the request');
  assert.deepEqual(call.steps, []);
  assert.match(result.data.searchResult, /^I do not have current information about this\./);
  assert.deepEqual(call.insights, [{ id: 'tool-unused', names: ['webSearch'] }]);
});

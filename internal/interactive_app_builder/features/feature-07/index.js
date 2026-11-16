/**
 * Feature 07 — Web Search Tool.
 *
 * The simulated process is the tutorial's real Feature07.p.json. The `webSearch` tool is
 * built into Smart Workflow, so there is no source file to show; its settings are in
 * variables.yaml. What is added here is the lesson: that variables.yaml, a search engine
 * that needs no internet (web-search.js), the stand-in for the model, and the walkthrough.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature07.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature07Data.d.json';
import { respond } from './agent.js';
import { builtinTools } from './web-search.js';
import { strings, describeInsight } from './text.js';
import { tour } from './tour.js';

/** The minimum configuration plus the web search settings of "Step 3", with their defaults. */
const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
    Tool:
      WebSearch:
        # Search engine: "duckduckgo" (default) or name of a custom SmartWebSearchEngine
        Engine: "duckduckgo"
        # Maximum results returned per query
        MaxResults: "5"
        # Restrict results to these domains (empty = all domains allowed)
        WhitelistDomains: ""
`;

export default {
  id: 'feature-07',
  file: 'Feature07.p.json',
  project: 'tutorial',
  process,
  dataClass,
  javaTools: builtinTools,
  variables: VARIABLES,
  variablesPath: 'config/variables.yaml',
  brain: { respond },
  strings,
  describeInsight,
  tour,

  // What the real editor would offer besides: the tools of other lessons. They exist in name only.
  tools: [
    { value: 'lookupApprovalPolicy', label: 'lookupApprovalPolicy (amount)', icon: '🧰️' },
    { value: 'calculateEffectiveTaxRate', label: 'calculateEffectiveTaxRate (currency)', icon: '🧰️' },
    { value: 'chooseApprover', label: 'chooseApprover (amount)', icon: '🧰️' },
    { value: 'askUserFeedback', label: 'askUserFeedback (feedback)', icon: '🧰️' },
    { value: 'convertToUSD', icon: '☕️' }
  ],

  // Settings this lesson shows but does not act on, and the tutorial that covers each.
  simulates: { tools: true, guardrails: false, structuredOutput: false, temperature: false },
  seeAlso: { guardrails: 'ref.guardrails', structuredOutput: 'ref.structuredOutput', temperature: 'ref.temperature' }
};

/**
 * Feature 05 — Callable Process Tools.
 *
 * Two files of the tutorial project are simulated, both imported at build time: the process
 * Feature05.p.json with the Invoice Approval Agent, and Feature05Tools.p.json, the callable
 * sub-process whose three starts are the agent's tools. What is added here is the lesson:
 * the example variables.yaml, the stand-in for the model, and the walkthrough.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature05.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature05Data.d.json';
import invoiceDecision from '../../../../tutorial/dataclass/tutorial/InvoiceDecision.d.json';
import toolsProcess from '../../../../tutorial/process/tutorial/tools/Feature05Tools.p.json';
import toolsDataClass from '../../../../tutorial/dataclass/tutorial/Feature05ToolsData.d.json';
import { respond } from './agent.js';
import { strings, describeInsight } from './text.js';
import { tour } from './tour.js';

/** The "Minimum required configuration" from Basic Agent Setup. */
const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
`;

export default {
  id: 'feature-05',
  file: 'Feature05.p.json',
  project: 'tutorial',
  process,
  dataClass,
  classes: [invoiceDecision], // what "Expect result of type" names
  // the callable sub-process with the tools: a second editor tab, and what a tool call runs
  toolProcess: { file: 'Feature05Tools.p.json', process: toolsProcess, dataClass: toolsDataClass },
  variables: VARIABLES,
  variablesPath: 'config/variables.yaml',
  brain: { respond },
  strings,
  describeInsight,
  tour,

  // Besides the three tools of Feature05Tools.p.json, the real editor would also offer these
  // (a tool of a later lesson and the Java tools). They do not exist in this simulation.
  tools: [
    { value: 'askUserFeedback', label: 'askUserFeedback (feedback)', icon: '🧰️' },
    { value: 'convertToUSD', icon: '☕️' },
    { value: 'webSearch', icon: '☕️' }
  ],

  // Settings this lesson shows but does not act on, and the tutorial that covers each.
  simulates: { tools: true, guardrails: false, structuredOutput: true, temperature: false },
  seeAlso: { guardrails: 'ref.guardrails', temperature: 'ref.temperature' }
};

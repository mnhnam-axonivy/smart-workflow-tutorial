/**
 * Feature 02 — Structured Output.
 *
 * The simulated process is the tutorial's real one: Feature02.p.json, its data class and the
 * InvoiceData class the agent returns are imported from the tutorial project at build time.
 * What is added here is the lesson: the example variables.yaml, the stand-in for the model,
 * and the walkthrough.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature02.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature02Data.d.json';
import invoiceData from '../../../../tutorial/dataclass/tutorial/InvoiceData.d.json';
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
  id: 'feature-02',
  file: 'Feature02.p.json',
  project: 'tutorial',
  process,
  dataClass,
  classes: [invoiceData], // what "Expect result of type" can name
  variables: VARIABLES,
  variablesPath: 'config/variables.yaml',
  brain: { respond },
  strings,
  describeInsight,
  tour,

  // What the real editor would offer in this project (tools of the later lessons).
  tools: [
    { value: 'lookupApprovalPolicy', label: 'lookupApprovalPolicy (amount)', icon: '🧰️' },
    { value: 'calculateEffectiveTaxRate', label: 'calculateEffectiveTaxRate (currency)', icon: '🧰️' },
    { value: 'chooseApprover', label: 'chooseApprover (amount)', icon: '🧰️' },
    { value: 'askUserFeedback', label: 'askUserFeedback (feedback)', icon: '🧰️' },
    { value: 'convertToUSD', icon: '☕️' },
    { value: 'webSearch', icon: '☕️' }
  ],

  // Settings this lesson shows but does not act on, and the tutorial that covers each.
  simulates: { tools: false, guardrails: false, structuredOutput: true, temperature: false },
  seeAlso: { tools: 'ref.tools', guardrails: 'ref.guardrails', temperature: 'ref.temperature' }
};

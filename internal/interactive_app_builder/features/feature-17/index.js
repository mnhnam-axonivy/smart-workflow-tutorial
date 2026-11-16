/**
 * Feature 17 — Model Settings.
 *
 * The simulated process is the tutorial's real Feature17.p.json: two agents that write a
 * subject line for the same invoice, one at temperature 0.0 and one at the temperature in
 * the process data. What is added here is the lesson: the example variables.yaml, the
 * stand-in for the model, and the walkthrough.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature17.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature17Data.d.json';
import { respond } from './agent.js';
import { strings, describeInsight } from './text.js';
import { tour } from './tour.js';

/** The "Minimum required configuration" from Basic Agent Setup. Temperature has no variable. */
const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
`;

export default {
  id: 'feature-17',
  file: 'Feature17.p.json',
  project: 'tutorial',
  process,
  dataClass,
  variables: VARIABLES,
  variablesPath: 'config/variables.yaml',
  brain: { respond },
  strings,
  describeInsight,
  tour,

  // What the real editor would offer in this project. The tools exist here in name only.
  tools: [
    { value: 'lookupApprovalPolicy', label: 'lookupApprovalPolicy (amount)', icon: '🧰️' },
    { value: 'calculateEffectiveTaxRate', label: 'calculateEffectiveTaxRate (currency)', icon: '🧰️' },
    { value: 'chooseApprover', label: 'chooseApprover (amount)', icon: '🧰️' },
    { value: 'askUserFeedback', label: 'askUserFeedback (feedback)', icon: '🧰️' },
    { value: 'convertToUSD', icon: '☕️' },
    { value: 'webSearch', icon: '☕️' }
  ],

  // Settings this lesson shows but does not act on, and the tutorial that covers each.
  simulates: { tools: false, guardrails: false, structuredOutput: false, temperature: true },
  seeAlso: { tools: 'ref.tools', guardrails: 'ref.guardrails', structuredOutput: 'ref.structuredOutput' }
};

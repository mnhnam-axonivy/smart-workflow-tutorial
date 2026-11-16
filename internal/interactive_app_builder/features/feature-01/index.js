/**
 * Feature 01 — Basic Agent Setup.
 *
 * The simulated process is the tutorial's real one: Feature01.p.json and its data class are
 * imported from the tutorial project at build time. What is added here is the lesson:
 * the example variables.yaml, the stand-in for the model, and the walkthrough.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature01.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature01Data.d.json';
import { respond } from './agent.js';
import { strings, describeInsight } from './text.js';
import { tour } from './tour.js';

/** The "Minimum required configuration" from the guide. */
const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
`;

export default {
  id: 'feature-01',
  file: 'Feature01.p.json',
  project: 'tutorial',
  process,
  dataClass,
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
  simulates: { tools: false, guardrails: false, structuredOutput: false, temperature: false },
  seeAlso: { tools: 'ref.tools', guardrails: 'ref.guardrails', structuredOutput: 'ref.structuredOutput', temperature: 'ref.temperature' }
};

/**
 * Feature 10 — Input Guardrail.
 *
 * The simulated process is the tutorial's real Feature10.p.json: two flows in one file, one
 * with the regex guardrail and one with the classifier guardrail, each with an Error Boundary
 * Event on its agent. What is added here is the lesson: the example variables.yaml, the
 * stand-in for the model, and the walkthrough. The guardrails are part of the runtime
 * (runtime/model/guardrails.js).
 */
import process from '../../../../tutorial/process/tutorial/features/Feature10.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature10Data.d.json';
import { respond } from './agent.js';
import { strings, describeInsight } from './text.js';
import { tour } from './tour.js';

/** The "Minimum required configuration" from Basic Agent Setup. The classifier uses the same provider. */
const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
`;

export default {
  id: 'feature-10',
  file: 'Feature10.p.json',
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
  simulates: { tools: false, guardrails: true, structuredOutput: false, temperature: false },
  seeAlso: { tools: 'ref.tools', structuredOutput: 'ref.structuredOutput', temperature: 'ref.temperature' }
};

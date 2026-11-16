/**
 * Feature 09 — Output Guardrail.
 *
 * The simulated process is the tutorial's real Feature09.p.json, with the Error Boundary
 * Event on its agent. What is added here is the lesson: the example variables.yaml, the
 * stand-in for the model, and the walkthrough. The guardrail itself is part of the runtime
 * (runtime/model/guardrails.js), with the patterns of the real class.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature09.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature09Data.d.json';
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
  id: 'feature-09',
  file: 'Feature09.p.json',
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

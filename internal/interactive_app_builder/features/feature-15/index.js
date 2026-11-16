/**
 * Feature 15 — Circuit Breaker.
 *
 * The simulated process is the tutorial's real Feature15.p.json: the Invoice Summary Agent
 * with an Error Boundary Event for smartworkflow:stop, and two more starts whose scripts
 * switch the circuit breaker on and off. What is added here is the lesson: a variables.yaml
 * with the switch, and the walkthrough. The agent is the one of Basic Agent Setup, so its
 * stand-in model is reused; the circuit breaker is part of the runtime.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature15.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature15Data.d.json';
import { respond } from '../feature-01/agent.js';
import { strings, describeInsight } from './text.js';
import { tour } from './tour.js';

/** The minimum configuration plus the switch, as the tutorial shows it. */
const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
    # Emergency circuit breaker.
    CircuitBreaker:
      # "true" stops ALL AI agent calls in this application. "false" (or blank) allows them again.
      Enabled: "false"
`;

export default {
  id: 'feature-15',
  file: 'Feature15.p.json',
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

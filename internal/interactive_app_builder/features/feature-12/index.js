/**
 * Feature 12 — Conversation Memory.
 *
 * The tutorial names Feature13.p.json (Human in the Loop) as the place to see aiMemoryId at
 * work, so this lesson simulates that process and its tools file, with the same stand-in
 * model. What is its own is the walkthrough: it follows the memory id through one run.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature13.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature13Data.d.json';
import humanFeedback from '../../../../tutorial/dataclass/tutorial/HumanFeedback.d.json';
import toolsProcess from '../../../../tutorial/process/tutorial/tools/Feature13Tools.p.json';
import toolsDataClass from '../../../../tutorial/dataclass/tutorial/Feature13ToolsData.d.json';
import { respond } from '../feature-13/agent.js';
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
  id: 'feature-12',
  file: 'Feature13.p.json',
  project: 'tutorial',
  process,
  dataClass,
  classes: [humanFeedback],
  toolProcess: { file: 'Feature13Tools.p.json', process: toolsProcess, dataClass: toolsDataClass },
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
    { value: 'convertToUSD', icon: '☕️' },
    { value: 'webSearch', icon: '☕️' }
  ],

  // Settings this lesson shows but does not act on, and the tutorial that covers each.
  simulates: { tools: true, guardrails: false, structuredOutput: false, temperature: false },
  seeAlso: { guardrails: 'ref.guardrails', structuredOutput: 'ref.structuredOutput', temperature: 'ref.temperature' }
};

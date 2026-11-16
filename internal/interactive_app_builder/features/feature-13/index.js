/**
 * Feature 13 — Human in the Loop.
 *
 * Two files of the tutorial project are simulated: the process Feature13.p.json with the
 * Invoice Approval Agent, its Error Boundary Event and the user task, and
 * Feature13Tools.p.json with the askUserFeedback tool, which ends in an Error End. What is
 * added here is the lesson: the example variables.yaml, the stand-in for the model, and the
 * walkthrough. The user dialog of the task is simulated by the runtime.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature13.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature13Data.d.json';
import humanFeedback from '../../../../tutorial/dataclass/tutorial/HumanFeedback.d.json';
import toolsProcess from '../../../../tutorial/process/tutorial/tools/Feature13Tools.p.json';
import toolsDataClass from '../../../../tutorial/dataclass/tutorial/Feature13ToolsData.d.json';
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
  id: 'feature-13',
  file: 'Feature13.p.json',
  project: 'tutorial',
  process,
  dataClass,
  classes: [humanFeedback], // what the tool is called with, and what in.decision holds
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

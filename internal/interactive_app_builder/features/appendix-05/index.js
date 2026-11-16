/**
 * Appendix 05 — Troubleshooting.
 *
 * The page has no process of its own: it starts from a symptom. The lesson takes the process
 * of Human in the Loop (Feature13.p.json), because it has every part the page talks about —
 * a system and a user message, a tool, a mapped result, an Error Boundary Event and a
 * DecisionMaker — and breaks it in the ways the page lists, one at a time: each chapter shows
 * the symptom, and the log line that names its cause. The model is the stand-in of Human in
 * the Loop. Guardrails are simulated so that the circuit breaker acts.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature13.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature13Data.d.json';
import humanFeedback from '../../../../tutorial/dataclass/tutorial/HumanFeedback.d.json';
import toolsProcess from '../../../../tutorial/process/tutorial/tools/Feature13Tools.p.json';
import toolsDataClass from '../../../../tutorial/dataclass/tutorial/Feature13ToolsData.d.json';
import { respond } from '../feature-13/agent.js';
import { strings, describeInsight } from './text.js';
import { tour } from './tour.js';
import { VARIABLES, SIMULATES } from './settings.js';

export default {
  id: 'appendix-05',
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
  simulates: SIMULATES,
  seeAlso: { structuredOutput: 'ref.structuredOutput', temperature: 'ref.temperature' }
};

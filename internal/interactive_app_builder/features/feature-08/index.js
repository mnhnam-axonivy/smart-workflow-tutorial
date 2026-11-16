/**
 * Feature 08 — Observability.
 *
 * The tutorial has no process of its own for this feature: it says to run any of them with
 * tracing switched on. The lesson runs Feature05.p.json, whose agent calls three tools, so its
 * trace has every kind of span Smart Workflow writes. Both files are imported at build time;
 * the model stand-in is the one of Feature 05.
 *
 * What is added here: a tab with the VS Code Settings of the Axon Ivy PRO Designer 14, where
 * the -Dotel… options go into Engine: Vm Args (settings.js), and a tab that stands in for Arize
 * Phoenix (phoenix.js), filled after every run with what the engine would export (trace.js).
 */
import process from '../../../../tutorial/process/tutorial/features/Feature05.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature05Data.d.json';
import invoiceDecision from '../../../../tutorial/dataclass/tutorial/InvoiceDecision.d.json';
import toolsProcess from '../../../../tutorial/process/tutorial/tools/Feature05Tools.p.json';
import toolsDataClass from '../../../../tutorial/dataclass/tutorial/Feature05ToolsData.d.json';
import { respond } from '../feature-05/agent.js';
import { strings as feature05Strings, describeInsight } from '../feature-05/text.js';
import { strings as ownStrings } from './text.js';
import { tour } from './tour.js';
import { createSettingsView } from './settings.js';
import { createPhoenixView } from './phoenix.js';

/** The tutorial project's variables.yaml: the minimum configuration, and the Ivy channel it switches on. */
export const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
    Observability:
      Ivy:
        # Record every agent conversation so the Governance Dashboard (Feature 16) has data to show.
        Enabled: "true"
`;

// the walkthrough texts of Feature 05 are not needed, its insight texts are
const merge = lang => ({ ...feature05Strings[lang], ...ownStrings[lang] });

export default {
  id: 'feature-08',
  file: 'Feature05.p.json',
  project: 'tutorial',
  process,
  dataClass,
  classes: [invoiceDecision],
  toolProcess: { file: 'Feature05Tools.p.json', process: toolsProcess, dataClass: toolsDataClass },
  views: [
    { id: 'settings', file: 'Settings', icon: 'settings', create: createSettingsView },
    { id: 'phoenix', file: 'Phoenix · localhost:6006', icon: 'trace', create: createPhoenixView }
  ],
  variables: VARIABLES,
  variablesPath: 'config/variables.yaml',
  brain: { respond },
  strings: { en: merge('en'), ja: merge('ja') },
  describeInsight,
  tour,
  tools: [
    { value: 'askUserFeedback', label: 'askUserFeedback (feedback)', icon: '🧰️' },
    { value: 'convertToUSD', icon: '☕️' },
    { value: 'webSearch', icon: '☕️' }
  ],
  simulates: { tools: true, guardrails: true, structuredOutput: true, temperature: true },
  seeAlso: {}
};

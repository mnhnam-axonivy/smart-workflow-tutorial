/**
 * Appendix 04 — Key Concepts.
 *
 * The page explains the vocabulary of Smart Workflow without a process of its own. The lesson
 * shows each concept on one process that has nearly all of them: Feature05.p.json, the Invoice
 * Approval Agent with three tools, a typed result and a manager review after it. Both files are
 * imported at build time; the model stand-in is the one of Feature 05.
 *
 * What is its own is the walkthrough: one chapter per section of the page.
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

/** The "Minimum required configuration" from Basic Agent Setup. */
export const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
`;

// the walkthrough texts of Feature 05 are not needed, its insight texts are
const merge = lang => ({ ...feature05Strings[lang], ...ownStrings[lang] });

export default {
  id: 'appendix-04',
  file: 'Feature05.p.json',
  project: 'tutorial',
  process,
  dataClass,
  classes: [invoiceDecision],
  toolProcess: { file: 'Feature05Tools.p.json', process: toolsProcess, dataClass: toolsDataClass },
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
  simulates: { tools: true, guardrails: true, structuredOutput: true, temperature: false },
  seeAlso: { temperature: 'ref.temperature' }
};

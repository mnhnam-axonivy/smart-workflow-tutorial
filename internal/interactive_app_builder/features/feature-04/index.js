/**
 * Feature 04 — File Extraction.
 *
 * The simulated process is the tutorial's real one: Feature04.p.json, its data class and the
 * InvoiceData class the agent returns are imported from the tutorial project at build time.
 * What is added here is the lesson: the sample invoice of the CMS as the model would read it,
 * the example variables.yaml, the stand-in for the model, and the walkthrough.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature04.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature04Data.d.json';
import invoiceData from '../../../../tutorial/dataclass/tutorial/InvoiceData.d.json';
import { respond } from '../shared/invoice-extractor.js';
import { INVOICE_SAMPLE } from './document.js';
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
  id: 'feature-04',
  file: 'Feature04.p.json',
  project: 'tutorial',
  process,
  dataClass,
  classes: [invoiceData],
  // tutorial/cms/Files/Documents/InvoiceSample.pdf — what ivy.cms.co(...) in the query finds
  cms: {
    '/Files/Documents/InvoiceSample': { name: 'InvoiceSample', extension: 'pdf', reads: INVOICE_SAMPLE }
  },
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
  simulates: { tools: false, guardrails: false, structuredOutput: true, temperature: false },
  seeAlso: { tools: 'ref.tools', guardrails: 'ref.guardrails', temperature: 'ref.temperature' }
};

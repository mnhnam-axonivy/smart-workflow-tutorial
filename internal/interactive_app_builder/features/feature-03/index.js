/**
 * Feature 03 — Model Provider Selection.
 *
 * The simulated process is the tutorial's real one: Feature03.p.json, its data class and the
 * InvoiceData class the first agent returns are imported from the tutorial project at build
 * time. What is added here is the lesson: a variables.yaml with the three providers the
 * process calls, the stand-in for their models, and the walkthrough.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature03.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature03Data.d.json';
import invoiceData from '../../../../tutorial/dataclass/tutorial/InvoiceData.d.json';
import { respond } from './agent.js';
import { strings, describeInsight } from './text.js';
import { tour } from './tour.js';

/**
 * The global default and one block per provider the process uses. The variable names are the
 * ones Smart Workflow 14.0.0 reads (config/variables.yaml of smart-workflow-openai, -anthropic
 * and -ollama): the model of a provider is `DefaultModel`.
 */
const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
        DefaultModel: "gpt-4.1-mini"
      Anthropic:
        APIKey: "sk-ant-..."
      Ollama:
        BaseUrl: "http://localhost:11434"
`;

export default {
  id: 'feature-03',
  file: 'Feature03.p.json',
  project: 'tutorial',
  process,
  dataClass,
  classes: [invoiceData],
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

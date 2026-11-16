/**
 * Feature 06 — Java Tools.
 *
 * The simulated process is the tutorial's real Feature06.p.json. The three source files that
 * make the Java tool known to Smart Workflow — the tool class, its provider and the SPI
 * registration file — are imported from the tutorial project too and shown in editor tabs.
 * What is added here is the lesson: the example variables.yaml, the stand-in for the model,
 * a JavaScript twin of the tool's calculation, and the walkthrough.
 */
import process from '../../../../tutorial/process/tutorial/features/Feature06.p.json';
import dataClass from '../../../../tutorial/dataclass/tutorial/Feature06Data.d.json';
import toolSource from '../../../../tutorial/src/tutorial/tool/FxRateConverterTool.java';
import providerSource from '../../../../tutorial/src/tutorial/tool/TutorialToolProvider.java';
import spiSource from '../../../../tutorial/src/META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider';
import { respond } from './agent.js';
import { registeredJavaTools } from './java-tool.js';
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

const normal = text => text.replace(/\r\n/g, '\n');

export default {
  id: 'feature-06',
  file: 'Feature06.p.json',
  project: 'tutorial',
  process,
  dataClass,
  // the files that make the Java tool known; the Java is shown, the SPI file can be edited
  sources: [
    { id: 'tool', file: 'FxRateConverterTool.java', path: 'src/tutorial/tool/FxRateConverterTool.java', language: 'java', text: normal(toolSource), readOnly: true },
    { id: 'provider', file: 'TutorialToolProvider.java', path: 'src/tutorial/tool/TutorialToolProvider.java', language: 'java', text: normal(providerSource), readOnly: true },
    {
      id: 'spi', file: 'SmartWorkflowToolsProvider', language: 'text', text: normal(spiSource),
      path: 'src/META-INF/services/com.axonivy.utils.smart.workflow.tools.provider.SmartWorkflowToolsProvider'
    }
  ],
  javaTools: registeredJavaTools,
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
    { value: 'askUserFeedback', label: 'askUserFeedback (feedback)', icon: '🧰️' },
    { value: 'webSearch', icon: '☕️' }
  ],

  // Settings this lesson shows but does not act on, and the tutorial that covers each.
  simulates: { tools: true, guardrails: false, structuredOutput: false, temperature: false },
  seeAlso: { guardrails: 'ref.guardrails', structuredOutput: 'ref.structuredOutput', temperature: 'ref.temperature' }
};

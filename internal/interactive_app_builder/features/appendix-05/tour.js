/**
 * Appendix 05 — the walkthrough. Its chapters carry the headings of the Troubleshooting page;
 * the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for what the
 * director `d` can do.
 *
 * The page lists, for each problem, its causes one by one. So does the walkthrough: each cause
 * is a part of its chapter. The runtime puts the process and variables.yaml back before a part,
 * opens it with a screen of its own ("Cause 2 of 6" and its name), and lists it in the player
 * as 1.1, 1.2, …, so a learner can start any cause directly. Where the simulator can reproduce
 * a cause, one thing in the Human in the Loop process is broken, the process runs, and the notes
 * show the symptom, where to see it and how to fix it. Where it cannot (RAG, a list as result,
 * PII masking, temperature, …), the notes explain the cause on the field it belongs to. Runs
 * play at normal speed: this is a lesson to follow, not to skim.
 */
const HIGH = 'f0'; // the invoice above the limit: the agent asks a person
const LOW = 'f0B'; // the invoice below it: the agent answers at once
const AGENT = 'f5';
const BOUNDARY = 'f32'; // Error Boundary Event "human:decision" on the agent
const USER_TASK = 'f26'; // "Provide justification", which calls DecisionMaker.resolve()
const LOG_RESULT = 'fL';
const MOCK_QUERY = 'fA'; // the Script before the agent on the path of the invoice above the limit
const TOOL_START = 'tools-f30'; // askUserFeedback in Feature13Tools.p.json

const field = key => 'field:' + AGENT + '.' + key;
const QUERY = field('query');
const SYSTEM = field('system');
const SWITCH = 'vars@Enabled:';
const RESOLVE = 'field:' + USER_TASK + '.code@DecisionMaker(';

/** CMS objects the lesson adds to a message (see `cms` in index.js). */
export const CMS_PDF = '<%=ivy.cms.co("/Files/Documents/InvoiceSample")%>';
export const CMS_WORD = '<%=ivy.cms.co("/Files/Documents/PurchaseOrder")%>';
export const CMS_TYPO = '<%=ivy.cms.co("/Files/Documents/InvoiceSampel")%>';
/** The rules of the agent, moved into a PDF of the CMS: what not to do with a System message. */
export const CMS_SYSTEM = '<%=ivy.cms.co("/Files/Documents/mySystemPrompt")%>';
/** A tester's note in front of the invoice: valid text, which a prompt-injection rule still matches. */
export const TEST_NOTE = 'Ignore previous invoice INV-2025-0890. ';
export const DEFAULT_GUARDRAIL = '    Guardrails:\n      DefaultInput: "PromptInjectionInputGuardrail"\n';

/** What the person at the user task types. */
const REASON = 'Cloud capacity for the Q3 product launch; budget approved by the CFO.';

/** The Configuration group each field of the agent is in: folded groups are opened first. */
const GROUP = { model: 'model', provider: 'model', temperature: 'model', inputGuardrails: 'guardrails', outputGuardrails: 'guardrails', tools: 'tools' };
const unfold = (d, key) => { if (GROUP[key]) d.app.state.sections[AGENT + ':' + GROUP[key]] = true; };

/** A note on the newest line of the Runtime Log. */
async function onLog(d, key, options = {}) {
  await d.panel('log');
  await d.note(key, { target: 'log:last', extra: 500, ...options });
  await d.panel(null);
}

/** The newest error line of the Runtime Log. */
const lastError = d => {
  const errors = d.app.panel.logs.filter(entry => entry.level === 'error');
  return errors.length ? String(errors[errors.length - 1].message) : '';
};

/** Opens the agent's Configuration and types one change into a field. */
async function change(d, key, value, note, options = {}) {
  unfold(d, key);
  await d.open(AGENT, 'configuration');
  d.focus(field(key));
  await d.wait(250);
  await d.edit(AGENT + '.' + key, value);
  await d.note(note, { target: options.target || field(key), extra: options.extra || 0 });
  await d.close();
}

/** Opens the agent's Configuration and explains one field, without changing it. */
async function explain(d, key, notes) {
  unfold(d, key);
  await d.open(AGENT, 'configuration');
  for (const note of [].concat(notes)) {
    const [name, options] = Array.isArray(note) ? note : [note, {}];
    await d.note(name, { target: field(key), extra: 400, ...options });
  }
  await d.close();
}

/** Types one change into variables.yaml. */
async function changeVariables(d, from, to, note, target) {
  await d.tab('variables');
  d.focus(target);
  await d.wait(250);
  await d.edit('vars', text => text.replace(from, to));
  await d.note(note, { target, extra: 300 });
  await d.tab('process');
}

/** The person answers, wherever the run asks. */
const answering = d => ({ ['dialog:' + USER_TASK]: () => d.answer(REASON) });

// ── 1 — The agent did not answer ───────────────────────────────────────────


const noAnswer = {
  id: 'noAnswer',
  label: 'cause',
  play: async d => {
    await d.note('logFirst');
  },
  parts: [
    {
      id: 'causeBreaker', // 1 — the circuit breaker is on
      play: async d => {
        await changeVariables(d, 'Enabled: "false"', 'Enabled: "true"', 'breakerOn', SWITCH);
        await d.run({ start: LOW, on: { 'agent:blocked': () => d.note('breakerStops', { target: 'el:' + AGENT }) } });
        await onLog(d, 'breakerLog');
        await d.note('breakerFix');
      }
    },
    {
      id: 'causeBlank', // 2 — the User message was blank (failing to expand comes in "Messages and expressions")
      play: async d => {
        await change(d, 'query', '', 'blankQuery');
        await d.run({
          start: LOW,
          on: {
            'agent:skipped': () => onLog(d, 'skippedLog'),
            ['after:' + LOG_RESULT]: async () => {
              await d.note('carriesOn', { target: 'el:' + LOG_RESULT });
              d.stop();
            }
          }
        });
        await d.note('blankFix', { target: QUERY });
      }
    },
    {
      id: 'causeGuardrail', // 3 — a guardrail blocked it, though the agent has none of its own
      play: async d => {
        await changeVariables(d, '    Providers:\n', DEFAULT_GUARDRAIL + '    Providers:\n', 'defaultGuardrail', 'vars@DefaultInput');
        await explain(d, 'inputGuardrails', 'emptyInherits');
        await change(d, 'query', text => TEST_NOTE + text, 'testNote', { target: QUERY + '@Ignore previous', extra: 300 });
        await d.run({
          start: LOW,
          on: {
            'agent:guard': async () => {
              await d.panel('chat');
              await d.note('guardBlocked', { target: 'chat:guards', extra: 400 });
              await d.panel(null);
            }
          }
        });
        await onLog(d, 'guardLog');
        await d.note('guardFix');
      }
    },
    {
      id: 'causeMapping', // 4 — the result did not map
      play: async d => {
        await change(d, 'resultMapping', 'in.decision', 'wrongTarget');
        await d.run({
          start: LOW,
          on: {
            'agent:map-failed': () => onLog(d, 'mapLog'),
            'agent:end': () => d.stop()
          }
        });
        await d.note('mapFix', { target: 'el:' + AGENT });
      }
    },
    {
      id: 'causeFile', // 5 — a file of an unsupported type takes the whole User message down
      play: async d => {
        await change(d, 'query', text => text + ' ' + CMS_WORD, 'fileAdded', { target: QUERY + '@PurchaseOrder', extra: 300 });
        await d.run({
          start: LOW,
          on: {
            'agent:skipped': ({ call }) => onLog(d, 'fileSkipped', { quote: [{ text: call.queryError, wrong: true }] }),
            ['after:' + LOG_RESULT]: () => d.stop()
          }
        });
        await d.note('fileFix');
      }
    },
    {
      id: 'causeNoTools', // 6 — no tools were selected (the run itself is the first cause of the next chapter)
      play: async d => {
        await change(d, 'tools', '', 'toolsEmptied', { extra: 300 });
        await d.note('toolsWhy', { target: 'el:' + USER_TASK });
      }
    }
  ]
};

// ── 2 — The agent answered, but not as expected ─────────────────────────────


const unexpected = {
  id: 'unexpected',
  label: 'cause',
  parts: [
    {
      id: 'causeExplains', // 1 — it explains what it would do instead of doing it
      play: async d => {
        await change(d, 'tools', '', 'noTools');
        await d.run({
          start: HIGH,
          on: {
            'agent:response': ({ call }) => d.note('explains', { quote: call.answer, extra: 600 }),
            'agent:end': () => d.stop()
          }
        });
        await d.note('explainsFix', { target: 'el:' + AGENT });
      }
    },
    {
      id: 'causeNoCall', // 2 — it never calls a tool you expected
      play: async d => {
        await d.tab('tools');
        await d.open(TOOL_START, 'general');
        d.focus('field:' + TOOL_START + '.tags');
        await d.wait(300);
        await d.edit(TOOL_START + '.tags', '');
        await d.note('noTag', { target: 'el:' + TOOL_START, extra: 300 });
        await d.close();
        await d.tab('process');
        await d.run({
          start: HIGH,
          on: {
            'agent:request': ({ call }) => d.note('dropped', { quote: call.toolsNotFound.map(name => ({ text: name, wrong: true })) }),
            'agent:response': ({ call }) => d.note('neverCalls', { quote: call.answer, extra: 600 }),
            'agent:end': () => d.stop()
          }
        });
        await d.note('noCallFix');
      }
    },
    {
      id: 'causeIgnores', // 3 — it ignores its own instructions, or replies with a raw expression
      play: async d => {
        await explain(d, 'system', ['ignoresWhy', 'ignoresWhere']);
      }
    },
    {
      id: 'causeRag', // 4 — it answers from general knowledge instead of your documents
      play: async d => {
        await explain(d, 'system', ['ragWhy', 'ragFix']);
      }
    },
    {
      id: 'causeNoPause', // 5 — it never pauses for a human
      play: async d => {
        await change(d, 'system', text => text.replace('use the askUserFeedback tool to ask', 'ask'), 'notNamed', { target: SYSTEM + '@pause and ask', extra: 400 });
        await d.run({
          start: HIGH,
          on: {
            'agent:request': ({ call }) => d.note('stillOffered', { quote: call.tools.map(tool => ({ text: tool.name })) }),
            'agent:response': ({ call }) => d.note('noPause', { quote: call.answer, extra: 600 }),
            'agent:end': () => d.stop()
          }
        });
        await d.note('noPauseFix', { target: 'el:' + AGENT });
      }
    },
    {
      id: 'causeNoDocument', // 6 — it behaves as though it never saw your document
      play: async d => {
        await change(d, 'query', text => text + ' ' + CMS_TYPO, 'pathTypo', { target: QUERY + '@InvoiceSampel', extra: 300 });
        await d.run({
          start: LOW,
          on: {
            'agent:request': async () => {
              await d.panel('chat');
              await d.note('nothingAttached', { target: 'chat:user', extra: 500 });
              await d.panel('log');
              await d.note('nothingLogged', { target: 'log:last' });
              await d.panel(null);
              d.stop();
            }
          }
        });
        await d.note('documentFix');
      }
    },
    {
      id: 'causeFileType', // 7 — the provider cannot read that file type
      play: async d => {
        await change(d, 'provider', '"Ollama"', 'toOllama');
        await change(d, 'query', text => text + ' ' + CMS_PDF, 'pdfAdded', { target: QUERY + '@InvoiceSample', extra: 300 });
        await d.run({ start: LOW, on: { 'agent:failed': () => onLog(d, 'pdfRejected') } });
        await d.note('fileTypeFix');
      }
    },
    {
      id: 'causeList', // 8 to 11 — the simulator does not reproduce these: explained on their fields
      play: async d => {
        await explain(d, 'resultType', ['listWhy', 'listFix']);
      }
    },
    {
      id: 'causePii',
      play: async d => {
        await explain(d, 'inputGuardrails', ['piiWhy', 'piiFix']);
      }
    },
    {
      id: 'causeOllamaSchema',
      play: async d => {
        await explain(d, 'provider', ['ollamaWhy', 'ollamaFix']);
      }
    },
    {
      id: 'causeTemperature',
      play: async d => {
        await explain(d, 'temperature', ['temperatureWhy', 'temperatureFix']);
      }
    }
  ]
};

// ── 3 — Messages and expressions ───────────────────────────────────────────


const messages = {
  id: 'messages',
  label: 'behaviour',
  parts: [
    {
      id: 'behaviourFile', // 1 — a file in the System message is not read
      play: async d => {
        await change(d, 'system', CMS_SYSTEM, 'systemToFile', { extra: 400 });
        await d.run({
          start: HIGH,
          on: {
            'agent:request': async ({ call }) => {
              await d.panel('chat');
              await d.note('binarySent', { target: 'chat:system', quote: [{ text: call.system, wrong: true }], extra: 600 });
              await d.panel(null);
            },
            'agent:response': ({ call }) => d.note('noRulesAnswer', { quote: call.answer, extra: 600 }),
            'agent:end': () => d.stop()
          }
        });
        await d.note('systemFileFix', { target: SYSTEM });
        await d.note('systemFromScript', {
          target: 'el:' + MOCK_QUERY,
          quote: [
            { text: '// a Script before the agent' },
            { text: 'in.systemPrompt = …the text of mySystemPrompt.pdf…;' },
            { text: '' },
            { text: '// System message' },
            { text: '<%=in.systemPrompt%>' }
          ],
          extra: 1200
        });
      }
    },
    {
      id: 'behaviourRaw', // 2 — an expression that is not recognised goes to the model as raw text
      play: async d => {
        await change(d, 'query', '<%=in.query%', 'unclosed', { extra: 300 });
        await d.run({
          start: LOW,
          on: {
            'agent:request': async () => {
              await d.panel('chat');
              await d.note('rawSent', { target: 'chat:user', extra: 300 });
              await d.panel(null);
            },
            'agent:response': ({ call }) => d.note('rawAnswer', { quote: call.answer }),
            'agent:end': () => d.stop()
          }
        });
        await d.note('rawFix', { target: QUERY });
      }
    },
    {
      id: 'behaviourSkipped', // 3 — the User message fails to expand: the whole call is skipped
      play: async d => {
        await change(d, 'query', '<%=in.qeury%>', 'queryTypo', { target: QUERY + '@qeury' });
        await d.run({
          start: LOW,
          on: {
            'agent:skipped': ({ call }) => onLog(d, 'queryFailed', { quote: [{ text: call.queryError, wrong: true }] }),
            ['after:' + LOG_RESULT]: () => d.stop()
          }
        });
        await d.note('queryFix', { target: QUERY });
      }
    },
    {
      id: 'behaviourNoSystem', // 4 — the System message fails to expand: the agent runs without one
      play: async d => {
        await change(d, 'system', text => text.replace('exceeds $2,000', 'exceeds <%=in.limit%>'), 'systemTypo', { target: SYSTEM + '@<%=in.limit%>' });
        await d.run({
          start: HIGH,
          on: {
            'agent:request': async () => {
              await d.panel('log');
              await d.note('systemError', { target: 'log:last', quote: [{ text: lastError(d), wrong: true }] });
              await d.panel('chat');
              await d.note('noSystem', { extra: 600 });
              await d.panel(null);
            },
            'agent:response': ({ call }) => d.note('withoutRules', { quote: call.answer, extra: 600 }),
            'agent:end': () => d.stop()
          }
        });
      }
    }
  ]
};

// ── 4 — Configuration ──────────────────────────────────────────────────────


const configuration = {
  id: 'configuration',
  label: 'problem',
  parts: [
    {
      id: 'problemProvider', // 1 — Unknown model provider
      play: async d => {
        await changeVariables(d, 'DefaultProvider: "OpenAI"', 'DefaultProvider: "Open AI"', 'providerTypo', 'vars@DefaultProvider');
        await d.run({ start: LOW });
        await onLog(d, 'unknownProvider');
        await d.note('providerFix');
      }
    },
    {
      id: 'problemKey', // 2 — an authentication error from the provider
      play: async d => {
        await changeVariables(d, 'APIKey: "sk-..."', 'APIKey: ""', 'noKey', 'vars@APIKey');
        await d.run({ start: LOW });
        await onLog(d, 'unauthorized');
        await d.note('keyFix');
      }
    },
    {
      id: 'problemQuotes', // 3 — a model name does not compile
      play: async d => {
        await change(d, 'model', 'gpt-4o', 'unquoted');
        await d.run({ start: LOW });
        await onLog(d, 'modelLog');
      }
    },
    {
      id: 'problemDefaultModel', // 4 — the default model is ignored
      play: async d => {
        await changeVariables(d, '        APIKey: "sk-..."\n', '        APIKey: "sk-..."\n        Model: "gpt-4o"\n', 'wrongVariable', 'vars@Model: "gpt-4o"');
        await d.run({
          start: LOW,
          on: {
            'agent:request': async ({ call }) => {
              await d.panel('chat');
              await d.note('stillDefault', { target: 'chat:head', params: { model: call.model } });
              await d.panel(null);
              d.stop();
            }
          }
        });
        await d.note('defaultModelFix');
      }
    },
    {
      id: 'problemNoEffect', // 5 — a variable change had no effect
      play: async d => {
        await d.tab('variables');
        await d.note('readEachCall', { target: 'vars' });
        await d.tab('process');
      }
    },
    {
      id: 'problemTestData', // 6 — a guardrail blocks valid test data
      play: async d => {
        await explain(d, 'inputGuardrails', ['testDataWhy', 'testDataFix']);
      }
    },
    {
      id: 'problemSpi', // 7 — a custom tool or guardrail is missing from the pickers
      play: async d => {
        await explain(d, 'tools', ['spiWhy', 'spiFix']);
      }
    }
  ]
};

// ── 5 — Human in the loop ──────────────────────────────────────────────────


const humanInTheLoop = {
  id: 'humanInTheLoop',
  label: 'message',
  play: async d => {
    await d.note('resolveThrows', { target: 'el:' + USER_TASK });
  },
  parts: [
    {
      id: 'messageMemory', // 1 — Found no pending ChatMemory for id
      play: async d => {
        await d.open(USER_TASK, 'output');
        d.focus(RESOLVE);
        await d.wait(250);
        await d.edit(USER_TASK + '.code', code => code.replace('DecisionMaker(in.aiMemoryId)', 'DecisionMaker(in.invoiceId)'));
        await d.note('wrongId', { target: RESOLVE });
        await d.close();
        await d.run({ start: HIGH, on: answering(d) });
        await onLog(d, 'noMemory', { extra: 900 });
        await d.note('memoryFix', { target: 'el:' + USER_TASK });
      }
    },
    {
      id: 'messageAiMessage', // 2 — Found no pending AiMessage for id (not reproduced by the simulator)
      play: async d => {
        await d.note('aiMessageWhy', { target: 'el:' + AGENT });
      }
    },
    {
      id: 'messageRequest', // 3 — Found no pending ToolExecutionRequest for id
      play: async d => {
        await d.open(USER_TASK, 'output');
        await d.edit(USER_TASK + '.code', code => code + '\nnew DecisionMaker(in.aiMemoryId).resolve(result.answer);');
        await d.note('twice', { target: 'field:' + USER_TASK + '.code' });
        await d.close();
        await d.run({ start: HIGH, on: answering(d) });
        await onLog(d, 'noRequest', { extra: 900 });
        await d.note('notBpm', { target: 'el:' + BOUNDARY });
      }
    }
  ]
};

// ── 6 — Errors you can catch ───────────────────────────────────────────────

async function catchable(d) {
  await d.open(BOUNDARY, 'error');
  await d.note('boundaryCode', { target: 'field:' + BOUNDARY + '.errorCode' });
  await d.close();
  await changeVariables(d, 'Enabled: "false"', 'Enabled: "true"', 'breakerAgain', SWITCH);
  await d.run({
    start: HIGH,
    on: { 'agent:blocked': () => d.note('stopCode', { quote: 'smartworkflow:stop', target: 'el:' + BOUNDARY }) }
  });
  await onLog(d, 'unhandled');
  await d.note('codes');
}

// ── 7 — Finding out what really happened ───────────────────────────────────

async function observe(d) {
  await d.run({
    start: HIGH,
    on: {
      'agent:suspended': async () => {
        await d.panel('chat');
        await d.note('conversation', { extra: 900 });
        await d.panel(null);
        d.stop();
      }
    }
  });
  await d.note('inTheEngine');
}

export const tour = {
  chapters: [
    noAnswer,
    unexpected,
    messages,
    configuration,
    humanInTheLoop,
    { id: 'catchable', play: catchable },
    { id: 'observe', play: observe }
  ]
};

/**
 * Appendix 04 — the walkthrough: one chapter per section of Key Concepts, each shown on the
 * Feature05 process. The chapters carry the headings of the page, word for word; the notes
 * are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for what `d` can do.
 */
import { tokens } from '../feature-08/trace.js';

const AGENT = 'f5';
const GATEWAY = 'fG';
const REVIEW = 'f8';
// calculateEffectiveTaxRate in Feature05Tools.p.json: its start and its Script
const TAX = { start: 'tools-f10', script: 'tools-f13' };

export const DEFAULT_INPUT = '    Guardrails:\n      DefaultInput: "PromptInjectionInputGuardrail"\n';
export const DEFAULT_MODEL = '        DefaultModel: "gpt-4.1"\n';

/** variables.yaml with an application default for the input guardrails. */
export const withDefaultInput = text => text.replace(/(\n    DefaultProvider: [^\n]*\n)/, '$1' + DEFAULT_INPUT);
/** variables.yaml with a default model for OpenAI. */
export const withDefaultModel = text => text.replace(/(\n        APIKey: [^\n]*\n)/, '$1' + DEFAULT_MODEL);

const callText = step => step.name + '(' + Object.keys(step.arguments).map(key => key + ': ' + JSON.stringify(step.arguments[key])).join(', ') + ')';
const oneLine = text => String(text).replace(/\s+/g, ' ').trim();
/** The answer line by line; the fields the model made up are marked. */
/** Opens sections of the agent's Configuration tab that are folded while their fields are empty, as a learner would. */
const unfold = (d, ...sections) => sections.forEach(id => { d.app.state.sections[AGENT + ':' + id] = true; });
const marked = call => call.answer.split('\n').map(text => ({ text, wrong: (call.guessed || []).some(field => text.includes('"' + field + '"')) }));

/**
 * What each request of one agent call carried, in tokens (estimated as in the Phoenix lesson,
 * four characters to a token): the messages, the tool definitions, the schema, and every tool
 * call and result before it. The model gets the whole conversation again with each request.
 */
export function requestTokens(call) {
  const fixed = [call.system || '', call.user || '', JSON.stringify(call.tools || []), call.schema ? JSON.stringify(call.schema) : ''].join('\n');
  const rounds = call.rounds && call.rounds.length ? call.rounds : [{ stepsBefore: 0 }];
  return rounds.map(round => tokens(fixed + call.steps.slice(0, round.stepsBefore).map(step => callText(step) + '\n' + String(step.result || '')).join('\n')));
}

/** 1 — one element, and the three places all its knowledge comes from. */
async function agent(d) {
  await d.note('oneElement', { target: 'el:' + AGENT });
  await d.open(AGENT, 'configuration');
  await d.note('fromSystem', { target: 'field:' + AGENT + '.system' });
  await d.note('fromUser', { target: 'field:' + AGENT + '.query' });
  await d.note('fromTools', { target: 'field:' + AGENT + '.tools' });
  await d.close();
  await d.run({
    fast: true,
    on: {
      ['after:' + AGENT]: async () => {
        await d.panel('data');
        await d.note('writes', { target: 'data:invoiceDecision' });
        await d.panel(null);
        d.stop();
      }
    }
  });
  await d.note('nothingElse');
}

/** 2 — the two messages, and the prompt that is all of the request. */
async function messages(d) {
  await d.run({
    on: {
      'agent:request': async () => {
        await d.panel('chat');
        await d.note('system', { target: 'chat:system' });
        await d.note('user', { target: 'chat:user' });
        await d.note('prompt', { target: 'chat' });
        await d.note('knowledge', { target: 'chat:user' });
        d.stop();
      }
    }
  });
}

/** 3 — what the model had, and what it costs. */
async function context(d) {
  await d.run({
    fast: true,
    on: {
      'agent:end': async ({ call }) => {
        await d.panel('chat');
        await d.note('context', { target: 'chat' });
        await d.note('toolDefs', { target: 'chat:tools' });
        const counts = requestTokens(call);
        await d.note('tokens', {
          params: { n: counts.length },
          quote: counts.map((n, i) => ({ text: d.app.t('ki.request', { n: i + 1, tokens: n.toLocaleString('en-US') }) }))
            .concat([{ text: d.app.t('ki.total', { tokens: counts.reduce((a, b) => a + b, 0).toLocaleString('en-US') }) }]),
          extra: 600
        });
        await d.note('budget');
        d.stop();
      }
    }
  });
}

/** 4 — two empty fields that fall back, and a model of the element's own. */
async function provider(d) {
  unfold(d, 'model');
  await d.open(AGENT, 'configuration');
  await d.note('emptyProvider', { target: 'field:' + AGENT + '.provider' });
  await d.note('emptyModel', { target: 'field:' + AGENT + '.model' });
  await d.close();
  await d.tab('variables');
  await d.note('defaultProvider', { target: 'vars@DefaultProvider' });
  await d.tab('process');
  const resolved = note => ({
    'agent:request': async ({ call }) => {
      await d.panel('chat');
      await d.note(note, { target: 'chat:head', params: { provider: call.provider, model: call.model } });
      d.stop();
    }
  });
  await d.run({ fast: true, on: resolved('resolved') });

  unfold(d, 'model');
  await d.open(AGENT, 'configuration');
  await d.edit(AGENT + '.model', '"gpt-4.1"');
  await d.note('ownModel', { target: 'field:' + AGENT + '.model' });
  await d.close();
  await d.run({ fast: true, on: resolved('resolvedOwn') });
  await d.note('capabilities');
}

/** 5 — offered, not invoked: what the model sees of a tool, and what it never sees. */
async function tools(d) {
  await d.open(AGENT, 'configuration');
  await d.note('offered', { target: 'field:' + AGENT + '.tools' });
  await d.close();
  await d.tab('tools');
  await d.open(TAX.start, 'general');
  await d.note('seen', { target: 'field:' + TAX.start + '.description' });
  await d.open(TAX.start, 'start');
  await d.note('params', { target: 'field:' + TAX.start + '.params' });
  await d.close();
  await d.note('notSeen', { target: 'el:' + TAX.script });
  await d.tab('process');
  await d.run({
    fast: true,
    on: {
      'agent:tool-call': async ({ step }) => {
        await d.note('chooses', { quote: callText(step) });
        d.stop();
      }
    }
  });
  await d.note('mustHappen', { target: 'el:' + REVIEW });
}

/** 6 — a class instead of a String: the schema goes out, an object comes back. */
async function structured(d) {
  await d.open(AGENT, 'configuration');
  await d.note('resultType', { target: 'field:' + AGENT + '.resultType' });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:request': async () => {
        await d.panel('chat');
        await d.note('schema', { target: 'chat:schema' });
      },
      'agent:response': () => d.note('json', { target: 'chat:assistant' }),
      ['after:' + AGENT]: async () => {
        await d.panel('data');
        await d.note('object', { target: 'data:invoiceDecision' });
        await d.panel(null);
      },
      ['enter:' + GATEWAY]: async () => {
        await d.open(GATEWAY, 'condition');
        await d.note('usable', { target: 'field:' + GATEWAY + '.conditions' });
        await d.close();
        d.stop();
      }
    }
  });
}

/** 7 — the two defaults that point in opposite directions. */
async function guardrails(d) {
  unfold(d, 'guardrails');
  await d.open(AGENT, 'configuration');
  await d.note('emptyGuardrails', { target: 'field:' + AGENT + '.inputGuardrails' });
  await d.close();
  await d.tab('variables');
  await d.edit('vars', withDefaultInput);
  await d.note('defaultInput', { target: 'vars@DefaultInput', extra: 400 });
  await d.tab('process');
  await d.run({
    fast: true,
    on: {
      'agent:guard': async () => {
        await d.panel('chat');
        await d.note('inherited', { target: 'chat:guards' });
      },
      'agent:blocked': () => d.note('blocked', { target: 'el:' + AGENT, quote: 'smartworkflow:guardrail:input:violation' })
    }
  });

  d.reset();
  await d.open(AGENT, 'configuration');
  await d.edit(AGENT + '.tools', '');
  await d.note('noTools', { target: 'field:' + AGENT + '.tools' });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:request': async () => {
        await d.panel('chat');
        await d.note('noneOffered', { target: 'chat' });
      },
      'agent:response': ({ call }) => d.note('guessed', { quote: marked(call), extra: 800 }),
      'agent:end': () => d.stop()
    }
  });
}

/** 8 — the conversation within a call, and none between calls. */
async function memory(d) {
  await d.run({
    fast: true,
    on: {
      'agent:end': async () => {
        await d.panel('chat');
        await d.note('within', { target: 'chat:tool@last' });
        d.stop();
      }
    }
  });
  await d.run({
    fast: true,
    on: {
      'agent:request': async () => {
        await d.panel('chat');
        await d.note('fresh', { target: 'chat' });
      },
      'agent:tool-call': async ({ step }) => {
        await d.note('again', { quote: callText(step) });
        d.stop();
      }
    }
  });
  await d.note('suspended');
}

/** 9 — an approval the process enforces, and a question the agent may ask. */
async function humanInTheLoop(d) {
  await d.run({
    fast: true,
    on: {
      ['enter:' + GATEWAY]: async () => {
        await d.open(GATEWAY, 'condition');
        await d.note('gate', { target: 'field:' + GATEWAY + '.conditions' });
        await d.close();
      },
      ['pause:' + REVIEW]: async ({ user }) => {
        await d.note('person', { target: 'el:' + REVIEW, params: { user } });
        d.stop();
      }
    }
  });
  await d.note('notPrompt', { target: 'el:' + REVIEW });
  await d.open(AGENT, 'configuration');
  await d.note('askTool', { target: 'field:' + AGENT + '.tools' });
  await d.close();
}

/** 10 — where retrieved passages would arrive: in the context, like a tool result. */
async function rag(d) {
  await d.run({
    fast: true,
    on: {
      'agent:tool-result': async ({ step }) => {
        await d.panel('chat');
        await d.note('retrieved', { target: 'chat:tool@last', quote: oneLine(step.result) });
        await d.note('grounded', { target: 'chat' });
        d.stop();
      }
    }
  });
}

/** 11 — one AI block of variables, read on every call. */
async function configuration(d) {
  await d.tab('variables');
  await d.note('aiBlock', { target: 'vars' });
  await d.note('secret', { target: 'vars@APIKey' });
  await d.edit('vars', withDefaultModel);
  await d.note('changed', { target: 'vars@DefaultModel' });
  await d.tab('process');
  await d.run({
    fast: true,
    on: {
      'agent:request': async ({ call }) => {
        await d.panel('chat');
        await d.note('immediate', { target: 'chat:head', params: { model: call.model } });
        d.stop();
      }
    }
  });
}

export const tour = {
  chapters: [
    { id: 'agent', play: agent },
    { id: 'messages', play: messages },
    { id: 'context', play: context },
    { id: 'provider', play: provider },
    { id: 'tools', play: tools },
    { id: 'structured', play: structured },
    { id: 'guardrails', play: guardrails },
    { id: 'memory', play: memory },
    { id: 'humanInTheLoop', play: humanInTheLoop },
    { id: 'rag', play: rag },
    { id: 'configuration', play: configuration }
  ]
};

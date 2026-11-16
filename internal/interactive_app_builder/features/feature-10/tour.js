/**
 * Feature 10 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
// flow A: the regex guardrail
const A = { start: 'f0', mock: 'fA', agent: 'f5', boundary: 'fE', handler: 'fC' };
// flow B: the classifier guardrail
const B = { start: 'f10', mock: 'fA2', agent: 'f15', boundary: 'fE2', handler: 'fC2' };

const guardrails = flow => 'field:' + flow.agent + '.inputGuardrails';
const showLog = d => async () => {
  await d.panel('log');
  await d.note('log', { target: 'log:last', extra: 1500 });
  await d.panel(null);
};

/** 1 — what happens to the attack of flow A when nothing stands in its way. */
async function why(d) {
  await d.open(A.agent, 'configuration');
  d.focus(guardrails(A));
  await d.wait(900);
  await d.edit(A.agent + '.inputGuardrails', '');
  await d.note('unguarded', { target: guardrails(A) });
  await d.close();
  await d.run({
    start: A.start,
    on: {
      ['after:' + A.mock]: () => d.note('attack', { target: 'el:' + A.mock, quote: d.app.data.query }),
      'agent:response': ({ call }) => d.note('leak', { quote: call.answer.split('\n').map(text => ({ text, wrong: true })), extra: 800 }),
      'agent:end': () => d.stop()
    }
  });
}

/** 2 — the same attack against the regex guardrail. */
async function regex(d) {
  await d.run({
    start: A.start,
    fast: true,
    on: {
      ['enter:' + A.agent]: async () => {
        await d.open(A.agent, 'configuration');
        await d.note('inputGuardrail', { target: guardrails(A) });
        await d.close();
      },
      'agent:guard': ({ verdict }) => d.note('matched', { quote: (verdict.match && verdict.match.text) || '' }),
      'agent:blocked': () => d.note('never', { quote: 'smartworkflow:guardrail:input:violation' }),
      ['enter:' + A.boundary]: () => d.note('caught', { target: 'el:' + A.boundary }),
      ['after:' + A.handler]: showLog(d)
    }
  });
}

/** 3 — an attack in disguise against the classifier guardrail. */
async function classifier(d) {
  await d.run({
    start: B.start,
    on: {
      ['after:' + B.mock]: () => d.note('subtle', { target: 'el:' + B.mock, quote: d.app.data.query }),
      ['enter:' + B.agent]: async () => {
        await d.open(B.agent, 'configuration');
        await d.note('aiGuardrail', { target: guardrails(B) });
        await d.close();
      },
      'agent:classify': ({ classifier }) => d.note('extraCall', { params: classifier }),
      'agent:guard': ({ verdict }) => d.note('classified', { params: verdict.classifier }),
      ['enter:' + B.boundary]: () => d.note('caught', { target: 'el:' + B.boundary }),
      ['after:' + B.handler]: showLog(d)
    }
  });
}

/** 4 — the wrong error code, and a role-play that is no attack. */
async function mistakes(d) {
  const code = 'field:' + A.boundary + '.errorCode';
  await d.open(A.boundary, 'error');
  await d.edit(A.boundary + '.errorCode', value => value.replace(':input:', ':output:'));
  await d.note('wrongCode', { target: code, extra: 600 });
  await d.close();
  await d.run({ start: A.start, fast: true });
  await d.wait(600);
  await d.note('unhandled', { target: 'el:' + A.agent, extra: 800 });

  d.reset();
  await d.open(B.mock, 'output');
  await d.edit(B.mock + '.code', 'in.query = "Please act as a patient teacher and explain your refund policy.";');
  await d.note('benignEdit', { target: 'field:' + B.mock + '.code', extra: 400 });
  await d.close();
  await d.run({
    start: B.start,
    fast: true,
    on: {
      'agent:guard': ({ verdict }) => d.note('benign', { params: verdict.classifier }),
      'agent:response': ({ call }) => d.note('served', { quote: call.answer }),
      'agent:end': () => d.stop()
    }
  });
}

export const tour = {
  chapters: [
    { id: 'why', play: why },
    { id: 'regex', play: regex },
    { id: 'classifier', play: classifier },
    { id: 'mistakes', play: mistakes }
  ]
};

/**
 * Feature 01 — the walkthrough. Five chapters, each starting from the process as the tutorial
 * ships it; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const MOCK_DATA = 'f7';
const AGENT = 'f5';
const SHOW_RESULT = 'f9';

const answerOf = result => ((result.agentCalls || [])[0] || {}).answer || '';

/** The four facts the invoice summary is meant to contain; any other field in a list is one too many. */
const WANTED = /^- (Invoice number|Supplier|Total amount|Due date|請求書番号|サプライヤー|合計金額|支払期限):/;
const markUnwanted = answer => answer.split('\n').map(text => ({ text, wrong: /^- /.test(text) && !WANTED.test(text) }));

/** Without a system message the stand-in model answers in one of three ways; this one lists everything it finds. */
const LIST_EVERYTHING = 2;

/** 1 — the unchanged process, explained element by element. */
async function oneRun(d) {
  await d.run({
    on: {
      ['enter:' + MOCK_DATA]: () => d.note('mock', { target: 'el:' + MOCK_DATA }),
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('query', { target: 'field:' + AGENT + '.query' });
        await d.note('system', { target: 'field:' + AGENT + '.system' });
        await d.note('mapping', { target: 'field:' + AGENT + '.resultMapping' });
        await d.close();
      },
      'agent:request': ({ call }) => d.note('call', { params: { provider: call.provider } }),
      'agent:mapped': ({ call }) => d.note('answer', { quote: call.answer }),
      ['after:' + SHOW_RESULT]: async () => {
        await d.panel('log');
        await d.note('log', { target: 'log:last' });
        await d.panel(null);
      }
    }
  });
}

/** 2 — change the instruction, then take it away. */
async function systemMessage(d) {
  const field = 'field:' + AGENT + '.system';
  await d.open(AGENT, 'configuration');
  d.focus(field);
  await d.edit(AGENT + '.system', text => text.replace('a single sentence summary', 'a bullet list'));
  await d.note('systemEdit', { target: field, wait: 1300 });
  await d.close();
  const listed = await d.run({ fast: true });
  await d.note('systemList', { target: 'el:' + AGENT, quote: answerOf(listed) });

  await d.open(AGENT, 'configuration');
  d.focus(field);
  await d.edit(AGENT + '.system', '');
  await d.note('systemEmpty', { target: field, wait: 1200 });
  await d.close();
  const guessed = await d.run({ fast: true, runIndex: LIST_EVERYTHING });
  await d.note('systemGuess', { target: 'el:' + AGENT, quote: markUnwanted(answerOf(guessed)) });
}

/** 3 — other data in, other summary out. */
async function userMessage(d) {
  const line = 'field:' + MOCK_DATA + '.code@Total Amount Due';
  await d.open(MOCK_DATA, 'output');
  d.focus(line);
  await d.wait(300);
  await d.edit(MOCK_DATA + '.code', code => code.replace('JPY 10,560.00', 'JPY 99,000.00'));
  await d.note('dataEdit', { target: line, wait: 1500 });
  await d.close();
  const result = await d.run({ fast: true });
  await d.note('dataResult', { target: 'el:' + AGENT, quote: answerOf(result) });
}

/** 4 — an answer with nowhere to go. */
async function mapResult(d) {
  const field = 'field:' + AGENT + '.resultMapping';
  await d.open(AGENT, 'configuration');
  d.focus(field);
  await d.wait(250);
  await d.edit(AGENT + '.resultMapping', '');
  await d.note('mappingEdit', { target: field, wait: 1200 });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:unmapped': ({ call }) => d.note('mappingLost', { quote: call.answer }),
      ['after:' + SHOW_RESULT]: async () => {
        await d.panel('log');
        await d.note('mappingLog', { target: 'log:last' });
        await d.panel(null);
      }
    }
  });
}

/** 5 — where provider and key come from, and what happens without the key. */
async function variables(d) {
  await d.tab('variables');
  await d.note('varsProvider', { target: 'vars@DefaultProvider' });
  await d.note('varsKey', { target: 'vars@APIKey' });
  d.focus('vars@APIKey');
  await d.edit('vars', text => text.replace('"sk-..."', '""'));
  await d.note('varsRemove', { target: 'side', wait: 1300 });
  await d.tab('process');
  let provider = 'OpenAI';
  await d.run({ fast: true, on: { 'agent:failed': ({ call }) => { provider = (call && call.provider) || provider; } } });
  await d.note('varsFailed', { target: 'el:' + AGENT, params: { provider } });
}

export const tour = {
  voice: true, // the notes are read aloud (runtime/ui/voice.js)
  chapters: [
    { id: 'run', play: oneRun },
    { id: 'system', play: systemMessage },
    { id: 'data', play: userMessage },
    { id: 'mapping', play: mapResult },
    { id: 'variables', play: variables }
  ]
};

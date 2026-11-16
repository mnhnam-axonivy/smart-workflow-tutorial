/**
 * Feature 17 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const MOCK = 'fA';
const FIXED = 'f5'; // Reminder Subject (deterministic)
const CREATIVE = 'f7'; // Reminder Subject (creative)
const SHOW_RESULT = 'f9';

const temperatureOf = id => 'field:' + id + '.temperature';
/** Opens an agent's Configuration with the Model group unfolded. */
async function openModel(d, id) {
  d.app.state.sections[id + ':model'] = true;
  await d.open(id, 'configuration');
}

/** 1 — the field, under Optional Settings in the Model group. */
async function where(d) {
  await openModel(d, FIXED);
  await d.note('model', { target: 'field:' + FIXED + '.modelGroup' });
  await d.note('optional', { target: temperatureOf(FIXED) });
  await d.close();
}

/** 2 — one run: the same invoice at 0.0 and at the temperature from the process data. */
async function temperature(d) {
  await d.run({
    runIndex: 0,
    on: {
      ['enter:' + FIXED]: async () => {
        await openModel(d, FIXED);
        await d.note('zero', { target: temperatureOf(FIXED) });
        await d.close();
      },
      ['enter:' + CREATIVE]: async () => {
        await openModel(d, CREATIVE);
        await d.note('fromData', { target: temperatureOf(CREATIVE) });
        await d.close();
      },
      'agent:response': ({ call, element }) => (element.id === FIXED ? d.note('plain', { quote: call.answer }) : d.note('lively', { quote: call.answer })),
      ['after:' + SHOW_RESULT]: async () => {
        await d.panel('log');
        await d.note('log', { target: 'log:last' });
        await d.panel(null);
      }
    }
  });
}

/** 3 — the same process three times over. */
async function result(d) {
  const lines = [];
  for (let run = 0; run < 3; run++) {
    const outcome = await d.run({ fast: true, runIndex: run });
    lines.push({ text: 'run ' + (run + 1) + '   0.0  ' + outcome.data.deterministicSubject });
    lines.push({ text: '        ' + outcome.data.temperature + '  ' + outcome.data.creativeSubject });
    const quote = lines.slice();
    if (run === 0) await d.note('first', { quote });
    else if (run === 1) await d.note('second', { quote });
    else await d.note('third', { quote, extra: 600 });
  }
}

/** 4 — a value that is no temperature is not an error. */
async function mistakes(d) {
  const line = 'field:' + MOCK + '.code@in.temperature';
  await d.open(MOCK, 'output');
  await d.edit(MOCK + '.code', code => code.replace('in.temperature = "1.0";', 'in.temperature = "high";'));
  await d.note('badValue', { target: line, extra: 400 });
  await d.close();
  const outcome = await d.run({
    fast: true,
    runIndex: 0,
    on: {
      'agent:request': ({ call, element }) => (element.id === CREATIVE ? d.note('silent', { params: { sent: call.temperature.toFixed(1) } }) : null)
    }
  });
  await d.note('noVariety', { quote: [{ text: '0.0   ' + outcome.data.deterministicSubject }, { text: 'high  ' + outcome.data.creativeSubject }], extra: 600 });
}

export const tour = {
  chapters: [
    { id: 'where', play: where },
    { id: 'temperature', play: temperature },
    { id: 'result', play: result },
    { id: 'mistakes', play: mistakes }
  ]
};

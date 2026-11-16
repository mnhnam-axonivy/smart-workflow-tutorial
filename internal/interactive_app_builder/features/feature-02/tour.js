/**
 * Feature 02 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const AGENT = 'f5';
const SHOW_RESULT = 'f9';
const TYPE_FIELD = 'field:' + AGENT + '.resultType';
const RESULT_CLASS = 'tutorial.InvoiceData';

const shortType = type => String(type).split('.').pop();

/** The fields of the result class, one per line: "totalAmount  BigDecimal". */
function classLines(d) {
  const cls = d.app.model.classes[RESULT_CLASS];
  const width = Math.max(...cls.fields.map(f => f.name.length));
  return cls.fields.map(f => ({ text: f.name.padEnd(width + 2) + shortType(f.type) }));
}

/** 1 — the class goes out as a schema, JSON comes back; then the same call without the type. */
async function expectType(d) {
  await d.run({
    on: {
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('type', { target: TYPE_FIELD });
        await d.note('dataClass', { target: TYPE_FIELD, quote: classLines(d) });
        await d.close();
      },
      'agent:request': () => d.note('schema'),
      'agent:response': ({ call }) => d.note('json', { quote: call.answer })
    }
  });

  await d.open(AGENT, 'configuration');
  d.focus(TYPE_FIELD);
  await d.wait(300);
  await d.edit(AGENT + '.resultType', '');
  await d.note('typeEmpty', { target: TYPE_FIELD, wait: 1500 });
  await d.close();
  await d.run({ fast: true, on: { 'agent:map-failed': ({ call }) => d.note('plain', { quote: call.answer }) } });
}

/** 2 — where the object goes, and what the next step gets. */
async function mapResult(d) {
  await d.run({
    fast: true,
    on: {
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('mapping', { target: 'field:' + AGENT + '.resultMapping' });
        await d.close();
      },
      ['after:' + AGENT]: async () => {
        await d.panel('data');
        await d.note('typed', { target: 'data:result' });
        await d.panel(null);
      },
      ['after:' + SHOW_RESULT]: async () => {
        await d.panel('log');
        await d.note('log', { target: 'log:last' });
        await d.panel(null);
      }
    }
  });
}

/**
 * 3 — the mistake that is easiest to make: the type without ".class". Played slowly: first
 * the suffix is pointed at, then it is deleted character by character, and the run that
 * follows is not sped up.
 */
async function mistakes(d) {
  await d.open(AGENT, 'configuration');
  await d.note('suffix', { target: TYPE_FIELD + '@.class', extra: 600 });
  await d.edit(AGENT + '.resultType', value => value.replace(/\.class$/, ''));
  await d.note('suffixEdit', { target: TYPE_FIELD, extra: 800 });
  await d.close();
  await d.run();
  await d.wait(700); // the failed step is on screen before it is explained
  await d.note('suffixFailed', { target: 'el:' + AGENT, extra: 1200 });
  await d.panel('log');
  await d.note('suffixLog', { target: 'log:last', extra: 1800 }); // the log line is read too
  await d.panel(null);
}

export const tour = {
  chapters: [
    { id: 'type', play: expectType },
    { id: 'mapping', play: mapResult },
    { id: 'mistakes', play: mistakes }
  ]
};

/**
 * Feature 04 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const AGENT = 'f5';
const QUERY_FIELD = 'field:' + AGENT + '.query';

/** 1 — a file in the user message: where it comes from, how it travels, what comes back. */
async function passingFile(d) {
  await d.run({
    on: {
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('query', { target: QUERY_FIELD });
        await d.close();
      },
      'agent:request': ({ call }) => d.note('attached', { params: { name: (call.files[0] || {}).name || '' } }),
      'agent:response': ({ call }) => d.note('json', { quote: call.answer }),
      ['after:' + AGENT]: async () => {
        await d.panel('data');
        await d.note('result', { target: 'data:invoiceResult' });
        await d.panel(null);
      }
    }
  });
}

/** 2 — a path that does not exist, and a provider that takes no PDF. */
async function mistakes(d) {
  await d.open(AGENT, 'configuration');
  d.focus(QUERY_FIELD);
  await d.wait(300);
  await d.edit(AGENT + '.query', text => text.replace('InvoiceSample', 'InvoiceSampel'));
  await d.note('pathEdit', { target: QUERY_FIELD, wait: 1700 });
  await d.close();
  await d.run({ fast: true, on: { 'agent:response': ({ call }) => d.note('nothing', { quote: call.answer }) } });

  // put the path back, then send the PDF to a provider that takes none
  d.app.state.sections[AGENT + ':model'] = true; // the Model group is closed while it is empty
  await d.open(AGENT, 'configuration');
  await d.edit(AGENT + '.query', text => text.replace('InvoiceSampel', 'InvoiceSample'));
  d.focus('field:' + AGENT + '.provider');
  await d.edit(AGENT + '.provider', '"Ollama"');
  await d.note('providerEdit', { target: 'field:' + AGENT + '.provider', wait: 1700 });
  await d.close();
  await d.run({ fast: true });
  await d.note('pdfRefused', { target: 'el:' + AGENT });
}

export const tour = {
  chapters: [
    { id: 'query', play: passingFile },
    { id: 'mistakes', play: mistakes }
  ]
};

/**
 * Feature 07 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const AGENT = 'f5';
const SYSTEM_FIELD = 'field:' + AGENT + '.system';

const callText = step => step.name + '(' + Object.keys(step.arguments).map(key => key + ': ' + JSON.stringify(step.arguments[key])).join(', ') + ')';
/** What came back from the search, one URL per line. */
const urls = step => ((step.data && step.data.results) || []).map(page => ({ text: page.url }));

/** 1 — the one setting that is needed. */
async function add(d) {
  await d.run({
    on: {
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('selected', { target: 'field:' + AGENT + '.tools' });
        await d.close();
        d.stop(); // the search itself is the next chapter
      }
    }
  });
}

/** 2 — the instruction that makes the model search, and one search from question to answer. */
async function instruct(d) {
  await d.run({
    fast: true,
    on: {
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('prompt', { target: SYSTEM_FIELD });
        await d.close();
      },
      'agent:tool-call': ({ step }) => d.note('searches', { quote: callText(step) }),
      'agent:tool-result': ({ step }) => d.note('results', { quote: urls(step) }),
      'agent:response': ({ call }) => d.note('answer', { quote: call.answer, extra: 600 })
    }
  });
}

/** 3 — the three variables, and what a whitelist does to the results. */
async function configure(d) {
  await d.tab('variables');
  await d.note('engine', { target: 'vars@Engine:' });
  await d.note('max', { target: 'vars@MaxResults:' });
  await d.note('whitelist', { target: 'vars@WhitelistDomains:' });
  await d.edit('vars', text => text.replace('WhitelistDomains: ""', 'WhitelistDomains: "developer.axonivy.com"'));
  await d.note('trusted', { target: 'vars@WhitelistDomains:' });
  await d.tab('process');
  await d.run({
    fast: true,
    on: {
      'agent:tool-result': ({ step }) => d.note('filtered', { quote: urls(step) }),
      'agent:end': () => d.stop()
    }
  });
}

/** 4 — a system message that does not ask for a search, and a whitelist nothing passes. */
async function mistakes(d) {
  await d.open(AGENT, 'configuration');
  await d.edit(AGENT + '.system', text => text.replace('Use the webSearch tool to look up current information on the internet.\n', ''));
  await d.note('silent', { target: SYSTEM_FIELD, extra: 600 });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:response': ({ call }) => d.note('ignored', { quote: call.answer, extra: 600 }),
      'agent:end': () => d.stop()
    }
  });

  d.reset();
  await d.tab('variables');
  await d.edit('vars', text => text.replace('WhitelistDomains: ""', 'WhitelistDomains: "docs.example.net"'));
  await d.note('narrow', { target: 'vars@WhitelistDomains:' });
  await d.tab('process');
  await d.run({
    fast: true,
    on: {
      'agent:tool-result': ({ step }) => d.note('excluded', { quote: (step.data && step.data.note) || '' }),
      'agent:response': ({ call }) => d.note('empty', { quote: call.answer }),
      'agent:end': () => d.stop()
    }
  });
}

export const tour = {
  chapters: [
    { id: 'add', play: add },
    { id: 'instruct', play: instruct },
    { id: 'configure', play: configure },
    { id: 'mistakes', play: mistakes }
  ]
};

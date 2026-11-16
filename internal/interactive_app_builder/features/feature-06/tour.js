/**
 * Feature 06 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const AGENT = 'f5';
const SHOW_RESULT = 'fB';
const TOOLS_FIELD = 'field:' + AGENT + '.tools';

const callText = step => step.name + '(' + Object.keys(step.arguments).map(key => key + ': ' + JSON.stringify(step.arguments[key])).join(', ') + ')';

/** 1 — the four methods of the tool class. */
async function implement(d) {
  await d.tab('src:tool');
  await d.note('name', { target: 'src:tool@return "convertToUSD"' });
  await d.note('description', { target: 'src:tool@public String description()' });
  await d.note('parameters', { target: 'src:tool@public List<ToolParameter> parameters()' });
  await d.note('execute', { target: 'src:tool@public Object execute' });
}

/** 2 — the provider that lists the tool. */
async function provider(d) {
  await d.tab('src:provider');
  await d.note('provider', { target: 'src:provider@return List.of' });
}

/** 3 — the file that makes the provider known. */
async function spi(d) {
  await d.tab('src:spi');
  await d.note('spi', { target: 'src:spi@tutorial.tool.TutorialToolProvider' });
}

/** 4 — the agent that may use the tool, and one call of it. */
async function agent(d) {
  await d.run({
    on: {
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('selected', { target: TOOLS_FIELD });
        await d.close();
      },
      'agent:tool-call': ({ step }) => d.note('asks', { quote: callText(step) }),
      'agent:tool-result': ({ step }) => d.note('computed', { quote: step.result }),
      'agent:response': ({ call }) => d.note('summary', { quote: call.answer }),
      ['after:' + SHOW_RESULT]: async () => {
        await d.panel('log');
        await d.note('log', { target: 'log:last' });
        await d.panel(null);
      }
    }
  });
}

/** 5 — a provider nobody registered, and a tool nobody listed. */
async function mistakes(d) {
  await d.tab('src:spi');
  await d.edit('src:spi', '');
  await d.note('unregistered', { target: 'src:spi', extra: 600 });
  await d.tab('process');
  await d.open(AGENT, 'configuration');
  await d.note('unknown', { target: TOOLS_FIELD });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:response': ({ call }) => d.note('cannot', { quote: call.answer, extra: 600 }),
      'agent:end': () => d.stop()
    }
  });

  d.reset();
  await d.open(AGENT, 'configuration');
  d.focus(TOOLS_FIELD);
  await d.wait(900);
  await d.edit(AGENT + '.tools', '');
  await d.note('notListed', { target: TOOLS_FIELD, extra: 600 });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:response': ({ call }) => d.note('same', { quote: call.answer }),
      'agent:end': () => d.stop()
    }
  });
}

export const tour = {
  chapters: [
    { id: 'implement', play: implement },
    { id: 'provider', play: provider },
    { id: 'spi', play: spi },
    { id: 'agent', play: agent },
    { id: 'mistakes', play: mistakes }
  ]
};

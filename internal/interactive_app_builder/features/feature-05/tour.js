/**
 * Feature 05 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const AGENT = 'f5';
const GATEWAY = 'fG';
const REVIEW = 'f8';
// calculateEffectiveTaxRate in Feature05Tools.p.json: its start, its Script, its end
const TAX = { start: 'tools-f10', script: 'tools-f13', end: 'tools-f11' };

const callText = step => step.name + '(' + Object.keys(step.arguments).map(key => key + ': ' + JSON.stringify(step.arguments[key])).join(', ') + ')';
const oneLine = text => String(text).replace(/\s+/g, ' ').trim();
/** The answer line by line; the fields the model made up are marked. */
const marked = call => call.answer.split('\n').map(text => ({ text, wrong: (call.guessed || []).some(field => text.includes('"' + field + '"')) }));

/** 1 — which tools the agent may use, and how a tool call goes back and forth. */
async function tools(d) {
  await d.run({
    on: {
      ['enter:' + AGENT]: async () => {
        await d.open(AGENT, 'configuration');
        await d.note('available', { target: 'field:' + AGENT + '.tools' });
        await d.note('prompt', { target: 'field:' + AGENT + '.system' });
        await d.close();
      },
      'agent:request': ({ call }) => d.note('offered', { quote: call.tools.map(tool => ({ text: tool.name + '(' + tool.params.map(p => p.name).join(', ') + ')' })) }),
      'agent:tool-call': ({ call, step }) => {
        if (call.steps.length === 1) return d.note('asks', { quote: callText(step) });
        return call.steps.length === 2 ? d.note('again', { quote: callText(step) }) : null;
      },
      'agent:tool-result': ({ call, step }) => (call.steps.length === 1 ? d.note('answers', { quote: oneLine(step.result) }) : null),
      'agent:response': ({ call }) => d.note('decision', { quote: call.answer }),
      'agent:end': () => d.stop() // what the process does with the decision is chapter 3
    }
  });
}

/** 2 — the file with the tools: what makes a start a tool, then one call seen from inside. */
async function toolProcess(d) {
  const field = name => 'field:' + TAX.start + '.' + name;
  await d.tab('tools');
  await d.note('file');
  await d.open(TAX.start, 'general');
  await d.note('tag', { target: field('tags') });
  await d.note('description', { target: field('description') });
  await d.open(TAX.start, 'start');
  await d.note('signature', { target: field('signature') });
  await d.note('input', { target: field('params') });
  await d.open(TAX.start, 'result');
  await d.note('output', { target: field('resultParams') });
  await d.open(TAX.script, 'output');
  await d.note('implementation', { target: 'field:' + TAX.script + '.code' });
  await d.close();

  // the agent calls this tool: follow the call into the tools file and back
  await d.tab('process');
  let passed = '';
  let followed = false;
  await d.run({
    fast: true,
    on: {
      'agent:tool-call': async ({ step }) => {
        passed = String(step.arguments.currency);
        await d.tab('tools');
      },
      ['enter:' + TAX.start]: () => d.note('called', { target: 'el:' + TAX.start, params: { value: passed } }),
      ['enter:' + TAX.script]: () => d.note('rule', { target: 'el:' + TAX.script }),
      'agent:tool-done': async ({ step }) => {
        await d.note('returned', { target: 'el:' + TAX.end, quote: oneLine(step.result) });
        await d.tab('process');
        followed = true;
      },
      'agent:tool-result': () => { if (followed) d.stop(); }
    }
  });
}

/** 3 — the decision as an object, and what the process does with it. */
async function result(d) {
  await d.run({
    fast: true,
    on: {
      ['after:' + AGENT]: async () => {
        await d.panel('data');
        await d.note('object', { target: 'data:invoiceDecision' });
        await d.panel(null);
      },
      ['enter:' + GATEWAY]: async () => {
        await d.open(GATEWAY, 'condition');
        await d.note('gateway', { target: 'field:' + GATEWAY + '.conditions' });
        await d.close();
      },
      ['pause:' + REVIEW]: ({ user }) => d.note('review', { target: 'el:' + REVIEW, params: { user } })
    }
  });
}

/** 4 — a renamed signature, and a tool the system message does not mention. */
async function mistakes(d) {
  const signature = 'field:' + TAX.start + '.signature';
  await d.tab('tools');
  await d.open(TAX.start, 'start');
  await d.note('rename', { target: signature });
  await d.edit(TAX.start + '.signature', name => name.replace('Effective', ''));
  await d.note('renamed', { target: signature, extra: 600 });
  await d.close();
  await d.tab('process');
  await d.run({
    fast: true,
    on: {
      'agent:request': ({ call }) => d.note('dropped', { quote: call.tools.map(tool => ({ text: tool.name })) }),
      'agent:response': ({ call }) => d.note('guessed', { quote: marked(call), extra: 800 }),
      'agent:end': () => d.stop()
    }
  });

  d.reset();
  await d.open(AGENT, 'configuration');
  await d.edit(AGENT + '.system', text => text.split('\n').filter(line => !line.includes('chooseApprover')).join('\n'));
  await d.note('unprompted', { target: 'field:' + AGENT + '.system', extra: 600 });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:response': ({ call }) => d.note('invented', { quote: marked(call), extra: 800 }),
      'agent:end': () => d.stop()
    }
  });
}

export const tour = {
  chapters: [
    { id: 'tools', play: tools },
    { id: 'toolProcess', play: toolProcess },
    { id: 'result', play: result },
    { id: 'mistakes', play: mistakes }
  ]
};

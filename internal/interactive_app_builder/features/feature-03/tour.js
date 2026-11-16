/**
 * Feature 03 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do.
 */
const ANALYSIS = 'f5';
const URGENCY = 'f7';
const RISK = 'f9';
const SHOW_RESULT = 'fB';

const modelGroup = id => 'field:' + id + '.modelGroup';

/** 1 — where the default provider and each provider's settings live. */
async function globalDefault(d) {
  await d.tab('variables');
  await d.note('varsDefault', { target: 'vars@DefaultProvider' });
  await d.note('varsModel', { target: 'vars@DefaultModel' });
  await d.note('varsOthers', { target: 'vars@Ollama:' });
  await d.tab('process');
}

/** 2 — three agents, three providers; then one of them without its own setting. */
async function perAgent(d) {
  const explain = (id, key) => async () => {
    await d.open(id, 'configuration');
    await d.note(key, { target: modelGroup(id) });
    await d.close();
  };
  await d.run({
    on: {
      ['enter:' + ANALYSIS]: explain(ANALYSIS, 'analysis'),
      ['enter:' + URGENCY]: explain(URGENCY, 'urgency'),
      ['enter:' + RISK]: explain(RISK, 'risk'),
      ['after:' + SHOW_RESULT]: async () => {
        await d.panel('log');
        await d.note('log', { target: 'log:last' });
        await d.panel(null);
      }
    }
  });

  await d.open(URGENCY, 'configuration');
  d.focus(modelGroup(URGENCY));
  await d.wait(300);
  await d.edit(URGENCY + '.provider', '');
  await d.edit(URGENCY + '.model', '');
  await d.note('cleared', { target: modelGroup(URGENCY), wait: 1500 });
  await d.close();
  await d.run({
    fast: true,
    on: {
      'agent:request': ({ call, element }) => (element.id === URGENCY
        ? d.note('fallback', { params: { provider: call.provider, model: call.model } })
        : null)
    }
  });
}

export const tour = {
  chapters: [
    { id: 'global', play: globalDefault },
    { id: 'override', play: perAgent }
  ]
};

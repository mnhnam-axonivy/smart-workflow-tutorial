/**
 * Feature 08 — the walkthrough. Its chapters carry the headings of the tutorial sections they
 * belong to; the notes are in text.js (tour.<key>.title / .text). See runtime/ui/tour.js for
 * what the director `d` can do, and phoenix.js / settings.js for the parts of the Phoenix and
 * Settings tabs a note can point at ('view:phoenix@<part>', 'view:settings@<part>').
 *
 * Every chapter starts from the process as the tutorial ships it, without traces. The first one
 * types the settings; the others put them in place at once and run the process for their data.
 */
const AGENT = 'f5';
const VIEW = 'view:phoenix';
const at = part => VIEW + '@' + part;

/** What goes into the Designer's setting Engine: Vm Args (a standalone engine: jvm.options, one per line). */
export const VM_ARGS = '-Dotel.traces.exporter=otlp -Dotel.exporter.otlp.endpoint=http://localhost:6006 -Dotel.resource.attributes=openinference.project.name=smart-workflow';

const IVY_LINE = '        Enabled: "true"\n';
/** variables.yaml with the Openinference block after the Ivy one (and optionally the two Hide… lines). */
export const withOpeninference = (text, hide = false) => text.replace(IVY_LINE, IVY_LINE +
  '      Openinference:\n        Enabled: "true"\n' + (hide ? '        HideInputMessages: "true"\n        HideOutputMessages: "true"\n' : ''));
const withHide = text => text.replace('      Openinference:\n        Enabled: "true"\n', '      Openinference:\n        Enabled: "true"\n        HideInputMessages: "true"\n        HideOutputMessages: "true"\n');

/** Both parts of the setup, without typing them. */
function tracingOn(d, { hide = false, jvm = true, variable = true } = {}) {
  if (jvm) d.app.views.settings.setValue(VM_ARGS);
  if (variable) d.app.setVariables(withOpeninference(d.app.def.variables, hide));
}

/** One run of Feature05 up to the end of the agent call: that is all the traces need. */
const runOnce = (d, on = {}) => d.run({ fast: true, on: { ...on, 'agent:end': () => d.stop() } });

const phoenix = d => d.app.views.phoenix;

/** Types `text` into a field of a lesson tab, through its setter, with the spotlight on it. */
async function typeInto(d, target, set, text, maxSteps = 24) {
  d.focus(target);
  await d.wait(400);
  const steps = Math.min(text.length, maxSteps);
  for (let k = 1; k <= steps; k++) {
    set(text.slice(0, Math.round(text.length * k / steps)));
    await d.wait(45);
  }
  await d.wait(500);
}

/** Types a filter condition into Phoenix's filter bar. */
const typeFilter = (d, text) => typeInto(d, at('filter'), value => phoenix(d).setFilter(value), text);

/** Phoenix with All spans, filtered to the LLM calls, the newest (or another) one opened. */
async function openLlm(d, index = 0) {
  const view = phoenix(d);
  await d.tab(VIEW);
  view.setRootOnly(false);
  view.setFilter("span_kind == 'LLM'");
  view.setDetailTab('info');
  view.openSpan({ kind: 'llm', index });
  await d.wait(500);
}

/** 1 — Step 2 and Step 3: the Designer's Vm Args, the variable, and the first traces. */
async function setup(d) {
  await d.tab(VIEW);
  await d.note('phoenix', { target: at('empty') });
  await d.tab('view:settings');
  await d.note('settings', { target: 'view:settings@vmArgs' });
  await typeInto(d, 'view:settings@vmArgs:input', value => d.app.views.settings.setValue(value), VM_ARGS, 40);
  await d.note('optExporter', { target: 'view:settings@opt:otel.traces.exporter' });
  await d.note('optEndpoint', { target: 'view:settings@opt:otel.exporter.otlp.endpoint' });
  await d.note('optProject', { target: 'view:settings@opt:otel.resource.attributes', extra: 400 });
  await d.note('reload', { target: 'view:settings@vmArgs' });
  await d.note('engine', { target: 'view:settings@vmArgs' });
  await d.tab('variables');
  await d.edit('vars', old => withOpeninference(old));
  await d.note('enable', { target: 'vars@Openinference' });
  await d.tab('process');
  await runOnce(d, { 'agent:request': () => d.note('running', {}) });
  await d.tab(VIEW);
  await d.note('arrived', { target: at('table'), extra: 600 });
}

/** 2 — the filter, Root Spans against All, and one LLM span opened. */
async function finding(d) {
  tracingOn(d);
  await runOnce(d);
  const view = phoenix(d);
  await d.tab(VIEW);
  await typeFilter(d, "span_kind == 'LLM'");
  await d.note('noRoots', { target: at('empty') });
  d.focus(at('all'));
  await d.wait(600);
  view.setRootOnly(false);
  await d.wait(300);
  await d.note('all', { target: at('table'), extra: 400 });
  view.openSpan({ kind: 'llm', index: 3 }); // the first of the four calls: it asks for a tool
  await d.wait(500);
  await d.note('tree', { target: at('tree'), extra: 800 });
  await d.note('messages', { target: at('info:input'), extra: 600 });
  await d.note('caseIds', { target: at('info:ids'), extra: 400 });
  view.selectSpan({ kind: 'tool' });
  await d.wait(400);
  await d.note('tool', { target: at('detail'), extra: 400 });
}

/** 3 — llm.invocation_parameters: empty, then with a temperature set on the agent. */
async function params(d) {
  tracingOn(d);
  await runOnce(d);
  await openLlm(d);
  await d.note('noParams', { target: at('info:params') });
  d.app.state.sections[AGENT + ':model'] = true;
  await d.open(AGENT, 'configuration');
  await d.edit(AGENT + '.temperature', '0.2');
  await d.note('temperature', { target: 'field:' + AGENT + '.temperature' });
  await d.close();
  await runOnce(d);
  await openLlm(d);
  await d.note('params', { target: at('info:params'), extra: 400 });
}

/** 4 — HideInputMessages / HideOutputMessages: the content goes, the numbers stay. */
async function hiding(d) {
  tracingOn(d);
  await d.tab('variables');
  await d.edit('vars', withHide);
  await d.note('hide', { target: 'vars@HideInputMessages' });
  await d.tab('process');
  await runOnce(d);
  await openLlm(d, 3);
  await d.note('hidden', { target: at('info:input'), extra: 400 });
  phoenix(d).setDetailTab('attributes');
  await d.wait(400);
  await d.note('kept', { target: at('attr:llm.token_count'), extra: 600 });
}

/** 5 — one span per guardrail evaluation. */
async function guardrails(d) {
  tracingOn(d);
  d.app.state.sections[AGENT + ':guardrails'] = true;
  await d.open(AGENT, 'configuration');
  await d.edit(AGENT + '.outputGuardrails', '["SensitiveDataOutputGuardrail"]');
  await d.note('addGuardrail', { target: 'field:' + AGENT + '.outputGuardrails' });
  await d.close();
  await runOnce(d);
  const view = phoenix(d);
  await d.tab(VIEW);
  view.setRootOnly(false);
  await typeFilter(d, "span_kind == 'GUARDRAIL'");
  await d.note('guardrailSpans', { target: at('table'), extra: 600 });
  view.openSpan({ name: 'SensitiveDataOutputGuardrail' });
  await d.wait(500);
  await d.note('guardrailInfo', { target: at('info:guardrail'), extra: 600 });
}

/** 6 — each part alone is not enough. */
async function mistakes(d) {
  tracingOn(d, { jvm: false });
  await d.tab('view:settings');
  await d.note('noJvm', { target: 'view:settings@vmArgs' });
  await d.tab('process');
  await runOnce(d);
  await d.tab(VIEW);
  await d.note('nothing', { target: at('empty') });

  d.reset();
  tracingOn(d, { variable: false });
  await runOnce(d);
  const view = phoenix(d);
  await d.tab(VIEW);
  view.setRootOnly(false);
  await d.note('noAi', { target: at('table'), extra: 600 });
}

export const tour = {
  chapters: [
    { id: 'setup', play: setup },
    { id: 'finding', play: finding },
    { id: 'params', play: params },
    { id: 'hiding', play: hiding },
    { id: 'guardrails', play: guardrails },
    { id: 'mistakes', play: mistakes }
  ]
};

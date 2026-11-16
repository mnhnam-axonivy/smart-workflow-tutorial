/**
 * Feature 08 — an editor tab that stands in for Arize Phoenix at http://localhost:6006: the
 * spans of a project with a filter and the Root Spans / All switch, and a trace opened next to
 * them with its span tree, the Info of a span and its Attributes. It is drawn in the
 * simulator's own style and shows only what the lesson needs.
 *
 * After every run it asks trace.js what the engine would have exported, given the Designer's
 * Vm Args and variables.yaml at that moment, and keeps it: like Phoenix, it collects traces run after run.
 *
 * The controller (app.views.phoenix) is what the walkthrough uses: setFilter, setRootOnly,
 * openSpan, selectSpan, setDetailTab, closeDetail, and rect(part) / reveal(part) for its notes:
 *   'filter' 'roots' 'all' 'table' 'stats' 'empty' 'row:<n>' 'tree' 'node:<name>' 'node:kind:<kind>'
 *   'detail' 'info:input' 'info:output' 'info:params' 'info:guardrail' 'info:ids' 'tab:attributes'
 *   'attr:<dotted.key>'
 */
import { h, clear } from '../../runtime/util.js';
import { icon } from '../../runtime/ui/icons.js';
import { exportRun, parseFilter, nestAttributes, cost, otelSettings } from './trace.js';

const CSS = `
.px { display: grid; grid-template-rows: auto auto minmax(0, 1fr); height: 100%; min-height: 0; background: #151515; color: var(--text); }
.px-head { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--edge); background: #1b1b1b; min-width: 0; }
.px-url { display: flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 10px; background: #262626; color: var(--muted); font: 11.5px var(--mono); }
.px-crumbs { color: var(--muted); font-size: 13px; white-space: nowrap; }
.px-crumbs strong { color: var(--text); font-weight: 600; }
.px-sim { padding: 1px 7px; border: 1px solid #5a4a8a; border-radius: 9px; color: #c8b6ff; font-size: 11px; }
.px-stats { display: flex; gap: 16px; margin-left: auto; font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.px-stats b { display: block; color: var(--text); font: 600 13px var(--mono); }
.px-bar { display: flex; gap: 8px; padding: 8px 14px; border-bottom: 1px solid var(--edge); }
.px-filter { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; padding: 0 9px; border: 1px solid var(--line); border-radius: 5px; background: #1e1e1e; }
.px-filter.bad { border-color: #b65050; }
.px-filter input { flex: 1; min-width: 0; padding: 6px 0; border: 0; outline: none; background: transparent; color: #f0b27a; font: 12.5px var(--mono); }
.px-filter input::placeholder { color: var(--faint); }
.px-seg { display: flex; border: 1px solid var(--line); border-radius: 5px; overflow: hidden; }
.px-seg button { padding: 4px 11px; color: var(--muted); font-size: 12.5px; }
.px-seg button.on { background: #3a3a3a; color: var(--text); }
.px-body { display: grid; grid-template-columns: minmax(0, 1fr); min-height: 0; }
.px-body.open { grid-template-columns: minmax(240px, 0.85fr) minmax(0, 1.6fr); }
.px-scroll { overflow: auto; min-height: 0; }
.px-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.px-table th { position: sticky; top: 0; z-index: 1; padding: 6px 8px; background: #1b1b1b; border-bottom: 1px solid var(--line); color: var(--muted); font-weight: 600; text-align: left; white-space: nowrap; }
.px-table td { padding: 5px 8px; border-bottom: 1px solid #262626; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.px-table tr.row { cursor: pointer; }
.px-table tr.row:hover td { background: #1f2430; }
.px-table tr.row.sel td { background: #233150; }
.px-name { color: #8db8ff; }
.px-dim { color: var(--faint); }
.px-ok { color: var(--ok); }
.px-err { color: var(--err); }
.px-kind { display: inline-block; padding: 0 7px; border-radius: 8px; font: 11px/17px var(--mono); background: #333; color: #bbb; }
.px-kind.llm { background: #4a3320; color: #f2b27a; }
.px-kind.agent { background: #263347; color: #9fc0ef; }
.px-kind.tool { background: #23402c; color: #8fd9a0; }
.px-kind.guardrail { background: #3a2b52; color: #c8b0ff; }
.px-empty { display: grid; justify-items: center; align-content: center; gap: 8px; height: 100%; min-height: 160px; padding: 24px; color: var(--muted); text-align: center; }
.px-empty strong { color: var(--text); font-size: 14px; }
.px-hint { max-width: 460px; padding: 7px 10px; border-radius: 5px; background: rgba(141, 184, 255, 0.1); color: #b9cff5; font-size: 12.5px; }
.px-detail { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; border-left: 1px solid var(--edge); background: #181818; }
.px-dhead { display: flex; align-items: center; gap: 14px; padding: 7px 12px; border-bottom: 1px solid var(--edge); font-size: 12px; color: var(--muted); }
.px-dhead b { color: var(--text); font-family: var(--mono); font-weight: 600; }
.px-dhead .px-close { margin-left: auto; padding: 2px; border-radius: 4px; color: var(--muted); }
.px-dbody { display: grid; grid-template-columns: minmax(150px, 0.7fr) minmax(0, 1.5fr); min-height: 0; }
.px-tree { padding: 6px 0; border-right: 1px solid var(--edge); }
.px-node { display: flex; align-items: center; gap: 6px; width: 100%; padding: 3px 8px; font-size: 12.5px; text-align: left; white-space: nowrap; }
.px-node:hover { background: #222; }
.px-node.sel { background: #26324a; }
.px-node .dot { flex: none; width: 9px; height: 9px; border-radius: 3px; background: #555; }
.px-node .dot.llm { background: #e39a55; } .px-node .dot.agent { background: #7aa3dc; } .px-node .dot.tool { background: #6cc483; } .px-node .dot.guardrail { background: #a98ae8; }
.px-node .lbl { overflow: hidden; text-overflow: ellipsis; }
.px-node .ms { margin-left: auto; padding-left: 6px; color: var(--faint); font: 11px var(--mono); }
.px-span { padding: 10px 12px 16px; display: grid; align-content: start; gap: 10px; }
.px-stitle { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.px-status { padding: 0 6px; border-radius: 4px; font: 600 11px/17px var(--mono); background: rgba(93, 195, 106, 0.15); color: var(--ok); }
.px-status.ERROR { background: rgba(241, 76, 76, 0.15); color: var(--err); }
.px-status.UNSET { background: #2a2a2a; color: var(--muted); }
.px-meta { color: var(--faint); font: 11.5px var(--mono); }
.px-tabs { display: flex; gap: 14px; border-bottom: 1px solid var(--line); }
.px-tabs button { padding: 3px 0 5px; color: var(--muted); font-size: 12.5px; border-bottom: 2px solid transparent; }
.px-tabs button.on { color: var(--text); border-bottom-color: #e39a55; }
.px-sec { border: 1px solid #303030; border-radius: 6px; background: #1d1d1d; }
.px-sec > header { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid #2c2c2c; font-weight: 600; font-size: 12.5px; }
.px-sec > header .px-dim { font-weight: 400; font-family: var(--mono); font-size: 11.5px; }
.px-sec > div { padding: 8px 10px; display: grid; gap: 8px; }
.px-msg { border: 1px solid #2f2f2f; border-radius: 5px; }
.px-msg > b { display: block; padding: 3px 8px; border-bottom: 1px solid #2f2f2f; color: var(--muted); font: 600 11.5px var(--mono); }
.px-msg.assistant { border-color: #2d4a7a; }
.px-msg pre, .px-pre { margin: 0; padding: 6px 8px; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.5 var(--mono); color: #d8d8d8; }
.px-none { color: var(--faint); font-size: 12px; font-style: italic; }
.px-attrs { padding: 6px 10px; border: 1px solid #303030; border-radius: 6px; background: #1d1d1d; font: 12px/1.6 var(--mono); }
.px-attr { white-space: pre-wrap; overflow-wrap: anywhere; }
.px-attr .k { color: #9cdcfe; }
.px-attr .s { color: #ce9178; }
.px-attr .n { color: #b5cea8; }
.px-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 3px 12px; font-size: 12.5px; }
.px-kv span:nth-child(odd) { color: var(--muted); font-family: var(--mono); font-size: 12px; }
.px-kv span:nth-child(even) { overflow-wrap: anywhere; }
`;

const fmtMs = ms => (ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : Math.round(ms) + 'ms');
const fmtCost = usd => (usd == null ? '—' : usd < 0.01 ? '<$0.01' : '$' + usd.toFixed(2));
const oneLine = text => String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
const spanCost = s => (s.kind === 'llm' && s.attributes['llm.token_count.total'] !== undefined
  ? cost(s.attributes['llm.model_name'], s.attributes['llm.token_count.prompt'], s.attributes['llm.token_count.completion']) : null);
const sumCost = spans => {
  const costs = spans.map(spanCost).filter(c => c != null);
  return costs.length ? costs.reduce((a, b) => a + b, 0) : null;
};
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** The messages of an LLM span, read back from llm.input_messages / llm.output_messages. */
function messagesOf(attributes, prefix) {
  const out = [];
  for (let i = 0; attributes[prefix + i + '.message.role'] !== undefined; i++) {
    out.push({ role: attributes[prefix + i + '.message.role'], content: attributes[prefix + i + '.message.content'] });
  }
  return out;
}

export function createPhoenixView(app, container) {
  const t = app.t;
  const state = {
    spans: [], // every span that has arrived, newest first
    project: 'smart-workflow',
    filter: '',
    rootOnly: true,
    traceId: null,
    spanId: null,
    tab: 'info',
    seq: 0,
    last: null // what the last run exported: { exported, reason, aiSpans }
  };
  const parts = {}; // nodes the walkthrough can point at
  let root;

  const off = app.events.on(event => {
    // spans are exported as they close, so a run stopped halfway still sends what it did
    if (event.type === 'run' && event.result) {
      state.seq += 1;
      const out = exportRun(event.result, { variablesText: app.variablesText, jvmText: vmArgs(), seq: state.seq });
      state.last = out;
      if (out.exported) {
        state.project = out.project;
        state.spans = out.spans.slice().reverse().concat(state.spans);
      }
      render();
    } else if (event.type === 'reset') {
      Object.assign(state, { spans: [], filter: '', rootOnly: true, traceId: null, spanId: null, tab: 'info', last: null });
      render();
    }
  });

  const style = h('style', null, CSS);
  // the options the engine was started with: the Designer's setting Engine: Vm Args
  const vmArgs = () => (app.views.settings ? app.views.settings.value() : '');

  function visible() {
    const filter = parseFilter(state.filter);
    if (filter.error) return { error: filter.error, rows: [] };
    return { rows: state.spans.filter(s => (!state.rootOnly || !s.parentId) && filter.test(s)) };
  }

  function render() {
    for (const key of Object.keys(parts)) delete parts[key];
    const { rows, error } = visible();
    const traces = new Set(state.spans.map(s => s.traceId));
    const roots = state.spans.filter(s => !s.parentId);

    // header: where we are, and the project's numbers
    const stats = h('div.px-stats', null,
      h('span', null, t('px.stats.traces'), h('b', null, String(traces.size))),
      h('span', null, t('px.stats.cost'), h('b', null, fmtCost(sumCost(state.spans)))),
      h('span', null, t('px.stats.p50'), h('b', null, roots.length ? fmtMs(percentile(roots.map(s => s.latencyMs), 0.5)) : '—')));
    parts.stats = stats;
    const head = h('div.px-head', null,
      h('span.px-url', null, icon('search', 11), 'localhost:6006'),
      h('span.px-crumbs', null, t('px.projects') + ' › ', h('strong', null, state.project)),
      h('span.px-sim', { title: t('px.simulated.tip') }, t('px.simulated')),
      stats);

    // filter and Root Spans / All
    const input = h('input', { type: 'text', value: state.filter, spellcheck: false, placeholder: t('px.filter.placeholder'), 'aria-label': t('px.filter.label') });
    input.addEventListener('input', () => { state.filter = input.value; renderBody(); });
    const filterBox = h('label.px-filter' + (error ? '.bad' : ''), null, icon('list', 13), input);
    parts.filter = filterBox;
    const seg = (on, label, value) => h('button' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': String(on), onclick: () => { state.rootOnly = value; render(); } }, label);
    parts.roots = seg(state.rootOnly, t('px.roots'), true);
    parts.all = seg(!state.rootOnly, t('px.all'), false);
    const bar = h('div.px-bar', null, filterBox, h('div.px-seg', null, parts.roots, parts.all));

    body = h('div.px-body');
    fillBody(body, rows, error);
    root = h('div.px', null, head, bar, body);
    clear(container).append(style, root);
  }
  let body;

  /** Re-renders the table and detail only, so typing in the filter keeps its focus. */
  function renderBody() {
    const { rows, error } = visible();
    parts.filter.classList.toggle('bad', Boolean(error));
    const fresh = h('div.px-body');
    fillBody(fresh, rows, error);
    body.replaceWith(fresh);
    body = fresh;
  }

  function fillBody(target, rows, error) {
    const trace = state.traceId ? state.spans.filter(s => s.traceId === state.traceId) : null;
    target.classList.toggle('open', Boolean(trace && trace.length));
    const list = h('div.px-scroll');
    parts.table = list;
    if (!state.spans.length || !rows.length) list.append(emptyState(error));
    else {
      const tbody = h('tbody');
      rows.forEach((s, i) => {
        const tr = h('tr.row' + (s.id === state.spanId ? '.sel' : ''), { onclick: () => openSpan(s) },
          h('td', null, s.status === 'ERROR' ? h('span.px-err', null, '✕') : s.status === 'OK' ? h('span.px-ok', null, '✓') : h('span.px-dim', null, '–')),
          h('td', null, h('span.px-kind.' + s.kind, null, s.kind)),
          h('td.px-name', { title: s.name }, s.name),
          h('td', { title: s.attributes['input.value'] || '' }, oneLine(s.attributes['input.value']) || h('span.px-dim', null, '—')),
          h('td', { title: s.attributes['output.value'] || '' }, oneLine(s.attributes['output.value']) || h('span.px-dim', null, '—')),
          h('td', null, s.attributes['llm.token_count.total'] !== undefined ? String(s.attributes['llm.token_count.total']) : h('span.px-dim', null, '—')),
          h('td.px-dim', null, fmtMs(s.latencyMs)));
        parts['row:' + i] = tr;
        tbody.append(tr);
      });
      list.append(h('table.px-table', null,
        h('thead', null, h('tr', null, ['', t('px.col.kind'), t('px.col.name'), t('px.col.input'), t('px.col.output'), t('px.col.tokens'), t('px.col.latency')].map(c => h('th', null, c)))),
        tbody));
    }
    target.append(list);
    if (trace && trace.length) target.append(detail(trace));
  }

  function emptyState(error) {
    const box = h('div.px-empty');
    parts.empty = box;
    if (error) {
      box.append(h('strong', null, t('px.empty.invalid')), h('code', null, error));
      return box;
    }
    if (state.spans.length) {
      box.append(h('strong', null, t('px.empty.noMatch')));
      // the classic: LLM spans are never roots
      if (state.rootOnly && state.spans.some(s => s.parentId && parseFilter(state.filter).test(s))) box.append(h('div.px-hint', null, t('px.hint.children')));
      return box;
    }
    box.append(h('strong', null, t('px.empty.none')));
    const last = state.last;
    const why = !last ? 'px.hint.run'
      : !last.exported ? (otelSettings(vmArgs()).exporter !== 'otlp' ? 'px.hint.jvm' : 'px.hint.endpoint')
        : null;
    if (why) box.append(h('div.px-hint', null, t(why)));
    return box;
  }

  function detail(trace) {
    const span = trace.find(s => s.id === state.spanId) || trace[0];
    const rootSpan = trace.find(s => !s.parentId) || trace[0];
    const close = h('button.px-close', { type: 'button', title: t('px.close'), 'aria-label': t('px.close'), onclick: closeDetail }, icon('close', 14));
    const head = h('div.px-dhead', null,
      h('span', null, t('px.trace') + ' ', h('b', null, rootSpan.traceId.slice(0, 16) + '…')),
      h('span', null, t('px.col.status') + ' ', h('b', null, rootSpan.status)),
      h('span', null, t('px.stats.cost') + ' ', h('b', null, fmtCost(sumCost(trace)))),
      h('span', null, t('px.col.latency') + ' ', h('b', null, fmtMs(rootSpan.latencyMs))),
      close);

    // the span tree
    const tree = h('div.px-tree.px-scroll');
    parts.tree = tree;
    const kids = {};
    trace.forEach(s => { (kids[s.parentId || ''] = kids[s.parentId || ''] || []).push(s); });
    Object.values(kids).forEach(list => list.sort((a, b) => a.start - b.start));
    const walk = (s, depth) => {
      const node = h('button.px-node' + (s.id === span.id ? '.sel' : ''), { type: 'button', style: { paddingLeft: (8 + depth * 14) + 'px' }, onclick: () => selectSpan(s) },
        h('span.dot.' + s.kind), h('span.lbl', null, s.name), h('span.ms', null, fmtMs(s.latencyMs)));
      if (!parts['node:' + s.name]) parts['node:' + s.name] = node;
      if (!parts['node:kind:' + s.kind]) parts['node:kind:' + s.kind] = node;
      tree.append(node);
      (kids[s.id] || []).forEach(c => walk(c, depth + 1));
    };
    (kids[''] || []).forEach(r => walk(r, 0));
    trace.filter(s => s.parentId && !trace.some(p => p.id === s.parentId)).forEach(s => walk(s, 0));

    return h('div.px-detail', null, head, h('div.px-dbody', null, tree, h('div.px-scroll', null, spanView(span))));
  }

  function spanView(span) {
    const a = span.attributes;
    const tokens = a['llm.token_count.total'];
    const box = h('div.px-span');
    parts.detail = box;
    const tabs = h('div.px-tabs', null,
      ['info', 'attributes'].map(id => {
        const b = h('button' + (state.tab === id ? '.on' : ''), { type: 'button', onclick: () => setDetailTab(id) }, t('px.tab.' + id) + (id === 'attributes' ? ' ' + Object.keys(a).length : ''));
        parts['tab:' + id] = b;
        return b;
      }));
    box.append(
      h('div.px-stitle', null, h('span.px-kind.' + span.kind, null, span.kind), span.name, h('span.px-status.' + span.status, null, span.status)),
      h('div.px-meta', null, [span.id, fmtMs(span.latencyMs), tokens !== undefined ? tokens + ' ' + t('px.tokens') : null, span.kind === 'llm' ? fmtCost(spanCost(span)) : null].filter(Boolean).join(' · ')),
      tabs);
    if (state.tab === 'attributes') box.append(attributesView(a));
    else box.append(...infoView(span));
    return box;
  }

  const section = (key, title, extra, children) => {
    const node = h('section.px-sec', null, h('header', null, title, extra ? h('span.px-dim', null, extra) : null), h('div', null, children));
    parts['info:' + key] = node;
    return node;
  };
  const message = m => h('div.px-msg.' + m.role, null, h('b', null, m.role), h('pre', null, m.content == null ? '' : String(m.content)));
  const none = text => h('div.px-none', null, text);

  function infoView(span) {
    const a = span.attributes;
    if (span.kind === 'llm') {
      const input = messagesOf(a, 'llm.input_messages.');
      const output = messagesOf(a, 'llm.output_messages.');
      // one key per line, the values exactly as sent (JSON.parse would turn 0.0 into 0)
      const raw = String(a['llm.invocation_parameters'] || '{}');
      const flat = /^\{([^{}]+)\}$/.exec(raw);
      const params = flat ? '{\n' + flat[1].split(',').map(p => '  ' + p.replace(':', ': ')).join(',\n') + '\n}' : raw;
      const nodes = [
        section('ids', t('px.info.ivy'), null, h('div.px-kv', null, h('span', null, 'ivy.case'), h('span', null, a['ivy.case']), h('span', null, 'ivy.task'), h('span', null, a['ivy.task']))),
        section('input', t('px.info.input'), a['llm.model_name'], [
          section('params', t('px.info.params'), 'llm.invocation_parameters', h('pre.px-pre', null, params || '{}')),
          input.length ? input.map(message) : none(t('px.info.hiddenInput'))
        ]),
        section('output', t('px.info.output'), null, output.length ? output.map(message) : none(span.status === 'ERROR' ? span.statusMessage || t('px.info.failed') : t('px.info.hiddenOutput')))
      ];
      return nodes;
    }
    if (span.kind === 'tool') {
      return [
        section('input', t('px.info.input'), a['tool.name'], a['input.value'] !== undefined ? h('pre.px-pre', null, a['input.value']) : none(t('px.info.hiddenInput'))),
        section('output', t('px.info.output'), null, a['output.value'] !== undefined ? h('pre.px-pre', null, a['output.value']) : none(t('px.info.hiddenOutput')))
      ];
    }
    if (span.kind === 'guardrail') {
      const rows = [['validator_name', a.validator_name], ['guardrail.type', a['guardrail.type']], ['guardrail.result', a['guardrail.result']], ['output.value', a['output.value']]];
      if (a['guardrail.failure_message']) rows.push(['guardrail.failure_message', a['guardrail.failure_message']]);
      return [
        section('guardrail', t('px.info.guardrail'), null, h('div.px-kv', null, rows.flatMap(([k, v]) => [h('span', null, k), h('span', null, String(v))]))),
        section('input', t('px.info.checked'), null, a['input.value'] !== undefined ? h('pre.px-pre', null, a['input.value']) : none(t('px.info.hiddenInput')))
      ];
    }
    return [section('input', t('px.info.input'), null, span.statusMessage ? h('pre.px-pre', null, span.statusMessage) : none(t('px.info.noInput')))];
  }

  function attributesView(flat) {
    const box = h('div.px-attrs');
    parts['info:attributes'] = box;
    const value = v => (typeof v === 'number' ? h('span.n', null, String(v)) : h('span.s', null, JSON.stringify(v)));
    const walk = (node, path, depth) => {
      const keys = Array.isArray(node) ? node.map((_, i) => i) : Object.keys(node);
      keys.forEach(key => {
        const full = path ? path + '.' + key : String(key);
        const v = node[key];
        const pad = '  '.repeat(depth);
        const row = h('div.px-attr', null, pad, h('span.k', null, Array.isArray(node) ? '[' + key + ']' : String(key)), ': ', v !== null && typeof v === 'object' ? (Array.isArray(v) ? '[' : '{') : value(v));
        if (!parts['attr:' + full]) parts['attr:' + full] = row;
        box.append(row);
        if (v !== null && typeof v === 'object') {
          walk(v, full, depth + 1);
          box.append(h('div.px-attr', null, pad + (Array.isArray(v) ? ']' : '}')));
        }
      });
    };
    walk(nestAttributes(flat), '', 0);
    return box;
  }

  // ── what the walkthrough and the learner do ─────────────────────────────────

  function openSpan(span) {
    state.traceId = span.traceId;
    state.spanId = span.id;
    renderBody();
  }
  function selectSpan(span) {
    state.spanId = span.id;
    renderBody();
  }
  function closeDetail() {
    state.traceId = null;
    state.spanId = null;
    renderBody();
  }
  function setDetailTab(tab) {
    state.tab = tab;
    renderBody();
  }
  /** The newest span that matches: { kind, name, index } (index: the n-th match, newest first). */
  function find(match) {
    const all = state.spans.filter(s => (!match.kind || s.kind === match.kind) && (!match.name || s.name === match.name) && (!match.traceId || s.traceId === match.traceId));
    return all[match.index || 0] || null;
  }

  render();
  return {
    state,
    render,
    shown: () => {},
    spans: () => state.spans,
    setFilter(text) { state.filter = text; render(); },
    setRootOnly(value) { state.rootOnly = value; render(); },
    openSpan(match) { const s = find(match); if (s) openSpan(s); return s; },
    selectSpan(match) {
      // within the open trace: the first span of that kind or name, in the order of the tree
      const trace = state.spans.filter(s => s.traceId === state.traceId).sort((a, b) => a.start - b.start);
      const all = trace.filter(s => (!match.kind || s.kind === match.kind) && (!match.name || s.name === match.name));
      const s = all[match.index || 0];
      if (s) selectSpan(s);
      return s || null;
    },
    setDetailTab,
    closeDetail,
    current: () => state.spans.find(s => s.id === state.spanId) || null,
    rect: part => parts[part] || null,
    reveal(part) {
      const node = parts[part];
      if (!node) return;
      const scroller = node.closest('.px-scroll');
      if (!scroller) return;
      const n = node.getBoundingClientRect();
      const b = scroller.getBoundingClientRect();
      if (n.top < b.top + 4 || n.bottom > b.bottom - 4) scroller.scrollTop += n.top - b.top - 24;
    },
    dispose() { off(); }
  };
}

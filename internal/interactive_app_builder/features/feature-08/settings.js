/**
 * Feature 08 — an editor tab that stands in for the VS Code Settings of the extension
 * "Axon Ivy PRO Designer 14" (@ext:axonivy.vscode-designer-14), with the setting the lesson
 * needs: Axonivy › Engine: Vm Args (axonivy.engine.vmArgs). The Designer starts its engine with
 * these options; a standalone engine reads the same ones from configuration/jvm.options.
 *
 * The controller (app.views.settings): value(), setValue(text), and rect(part) / reveal(part)
 * for the walkthrough's notes: 'vmArgs' (the whole setting), 'vmArgs:input', 'search', and
 * 'opt:<name>' for one option in the value, e.g. 'opt:otel.traces.exporter'.
 *
 * The value is shown in full, wrapped over as many lines as it needs. A hidden copy of it lies
 * exactly over the field, with each option in a span of its own: that is what a note about one
 * option points at.
 */
import { h, clear } from '../../runtime/util.js';
import { icon } from '../../runtime/ui/icons.js';

const CSS = `
.st { display: grid; grid-template-rows: auto auto minmax(0, 1fr); height: 100%; min-height: 0; background: #1f1f1f; color: var(--text); }
.st-search { margin: 12px 18px 0; display: flex; align-items: center; gap: 8px; padding: 5px 9px; border: 1px solid #3c3c3c; border-radius: 4px; background: #2a2a2a; font-size: 13px; }
.st-search code { padding: 0 3px; border-radius: 2px; background: #264f78; color: #e8e8e8; font: 13px var(--ui); }
.st-search .st-count { margin-left: auto; color: var(--muted); font-size: 11.5px; }
.st-scopes { display: flex; gap: 14px; padding: 10px 18px 8px; border-bottom: 1px solid #2b2b2b; font-size: 13px; }
.st-scopes span { padding: 2px 8px; border-radius: 3px; color: var(--muted); }
.st-scopes span.on { background: #37373d; color: var(--text); font-weight: 600; }
.st-list { overflow: auto; min-height: 0; padding: 6px 18px 18px; }
.st-item { margin: 6px 0; padding: 10px 14px 12px; border: 1px solid transparent; border-radius: 4px; }
.st-item.focus { border-color: #2d6d9e; background: #252526; box-shadow: inset 2px 0 0 #c08a2b; }
.st-title { font-size: 13.5px; color: #cccccc; }
.st-title b { color: #e7e7e7; }
.st-desc { margin: 4px 0 8px; color: #b0b0b0; font-size: 12.5px; line-height: 1.5; }
.st-desc code { padding: 1px 4px; border-radius: 3px; background: #2f2f2f; font: 11.5px var(--mono); }
.st-input { width: min(560px, 100%); padding: 5px 8px; border: 1px solid #3c3c3c; border-radius: 2px; outline: none; background: #313131; color: #e7e7e7; font: 13px var(--ui); }
.st-input:focus { border-color: #2d6d9e; }
.st-input[readonly] { color: #9a9a9a; }
.st-field { position: relative; width: 100%; }
textarea.st-input, .st-mirror { display: block; width: 100%; margin: 0; padding: 5px 8px; border: 1px solid #3c3c3c; border-radius: 2px; font: 13px/1.5 var(--ui); white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; box-sizing: border-box; }
textarea.st-input { resize: none; overflow: hidden; }
.st-mirror { position: absolute; inset: 0; visibility: hidden; pointer-events: none; border-color: transparent; }
`;

export function createSettingsView(app, container) {
  const state = { value: '' };
  const parts = {};
  let input = null;
  let mirror = null;

  /** The field as high as its text, and the hidden copy that knows where each option is. */
  function layout() {
    if (!input) return;
    input.style.height = 'auto';
    if (input.scrollHeight) input.style.height = input.scrollHeight + 'px';
    clear(mirror);
    Object.keys(parts).filter(k => k.startsWith('opt:')).forEach(k => delete parts[k]);
    state.value.split(/(\s+)/).forEach(token => {
      const m = /^-D([\w.]+)=/.exec(token);
      if (!m) { mirror.append(token); return; }
      const span = h('span', null, token);
      if (!parts['opt:' + m[1]]) parts['opt:' + m[1]] = span;
      mirror.append(span);
    });
  }

  const off = app.events.on(event => {
    if (event.type === 'reset') { state.value = ''; render(); }
  });

  function render() {
    for (const key of Object.keys(parts)) delete parts[key];
    const item = (name, description, field, focus) => h('div.st-item' + (focus ? '.focus' : ''), null,
      h('div.st-title', null, 'Axonivy › Engine: ', h('b', null, name)),
      h('div.st-desc', null, description),
      field);
    // one line in VS Code; here it wraps, so the whole value can be read
    input = h('textarea.st-input', { rows: 1, value: state.value, spellcheck: false, 'aria-label': 'Axonivy › Engine: Vm Args' });
    input.addEventListener('input', () => { state.value = input.value.replace(/\n/g, ' '); layout(); app.emit({ type: 'source', id: 'vmArgs' }); });
    mirror = h('div.st-mirror', { 'aria-hidden': 'true' });
    const vmArgs = item('Vm Args',
      ['Specifies extra VM arguments used to launch the Axon Ivy Engine. Eg. use ', h('code', null, '-agentlib:jdwp=transport=dt_socket,server=y,address=*:8000,suspend=n'), ' to enable remote debugging.'],
      h('div.st-field', null, input, mirror), true);
    parts.vmArgs = vmArgs;
    parts['vmArgs:input'] = input;
    const search = h('div.st-search', null, icon('search', 13), h('code', null, '@ext:axonivy.vscode-designer-14'), h('span.st-count', null, 'Axon Ivy PRO Designer 14'));
    parts.search = search;
    clear(container).append(h('style', null, CSS), h('div.st', null,
      search,
      h('div.st-scopes', null, h('span.on', null, 'User'), h('span', null, 'Workspace')),
      h('div.st-list', null,
        item('Release Train', "Release train of Axon Ivy Engine to be used as Developer Engine. Expected to be a release tag like '14.0' or an absolute path to an existing Axon Ivy Engine.", h('input.st-input', { type: 'text', value: '', readOnly: true, tabIndex: -1 })),
        item('Url', 'Url of the Axon Ivy Engine that will be used as backend. Only relevant if Axonivy › Engine: Run By Extension is set to false.', h('input.st-input', { type: 'text', value: 'http://localhost:8080/', readOnly: true, tabIndex: -1 })),
        vmArgs)));
    layout();
  }

  render();
  return {
    render,
    shown: layout,
    value: () => state.value,
    setValue(text) {
      state.value = text;
      if (input) input.value = text; // keeps the focus and the caret while the walkthrough types
      layout();
      app.emit({ type: 'source', id: 'vmArgs' });
    },
    rect: part => parts[part] || null,
    reveal(part) {
      const node = parts[part];
      const list = node && node.closest('.st-list');
      if (!list) return;
      const n = node.getBoundingClientRect();
      const b = list.getBoundingClientRect();
      if (n.top < b.top || n.bottom > b.bottom) list.scrollTop += n.top - b.top - 12;
    },
    dispose() { off(); }
  };
}

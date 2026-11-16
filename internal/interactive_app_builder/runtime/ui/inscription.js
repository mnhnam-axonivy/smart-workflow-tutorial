/**
 * The inscription view: the panel on the right where an element is configured.
 *
 * Tabs, group titles and field labels follow the real Designer. For the AgenticProcessCall
 * they are taken from Smart Workflow's AgentEditor (14.0.0), including the emoji in the
 * group titles. Fields that have no effect in a lesson stay visible and say so.
 */
import { h, clear } from '../util.js';
import { icon, elementGlyph } from './icons.js';
import { section, field, note, textBox, checkbox, macroArea, scriptInput, codeEditor, multiSelect } from './fields.js';
import { agentConfig, configList, toolStarts, docOf, elementById } from '../model/process.js';
import { validateMacro, missingCms } from '../model/macro.js';
import { validateExpression, validateScript, positionOf } from '../model/ivyscript.js';
import { PROVIDER_NAMES } from '../model/providers.js';
import { GUARDRAIL_NAMES } from '../model/guardrails.js';

const AI_NOTICE = 'Smart Workflow uses AI to process information, generate responses, or make decisions within workflows. Depending on the workflow configuration, AI may take actions automatically. AI outputs and decisions may be inaccurate or incomplete. Please always check the outcome.';

const INPUT_GUARDRAILS = GUARDRAIL_NAMES.input;
const OUTPUT_GUARDRAILS = GUARDRAIL_NAMES.output;

const DEFAULT_TAB = { agent: 'configuration', script: 'output', start: 'request', task: 'task', gateway: 'condition', boundary: 'error', usertask: 'dialog' };

export class Inscription {
  /** @param {Object} app  the DesignerApp  @param {HTMLElement} root */
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.checks = [];
    this.controls = {}; // the inputs the walkthrough types into, by config key
    this.title = null;
  }

  /** Rebuilds the whole view for the current selection. */
  render() {
    const { app } = this;
    const t = app.t;
    clear(this.root);
    this.checks = [];
    this.controls = {};
    this.title = null;
    const el = app.selected();

    const closeButton = h('button.icon-btn.inscription-close', { type: 'button', title: t('toggle.inscription'), 'aria-label': t('toggle.inscription'), onclick: () => app.setInscriptionOpen(false) }, icon('close', 14));

    if (!el) {
      this.root.append(
        h('div.inscription-head', null, h('span.inscription-title.muted', null, t('inscription.empty.title')), closeButton),
        h('div.inscription-empty', null, icon('panelRight', 28), h('p', null, t('inscription.empty.text'))));
      return;
    }

    this.title = h('span.inscription-title');
    this.updateTitle();
    this.root.append(h('div.inscription-head', null, elementGlyph(el), this.title,
      h('span.spacer'),
      h('span.icon-btn.inert', { title: t('quick.inert') }, icon('help', 14)),
      closeButton));

    const tabs = this.tabsFor(el);
    const wanted = app.state.inscriptionTabs[el.id] || (el.type === 'CallSubStart' ? 'start' : el.type === 'ErrorEnd' ? 'error' : DEFAULT_TAB[el.kind]) || 'general';
    const active = tabs.find(tab => tab.id === wanted) || tabs[0];
    this.root.append(h('div.inscription-tabs', { role: 'tablist' }, tabs.map(tab =>
      h('button.inscription-tab' + (tab === active ? '.active' : ''), {
        type: 'button', role: 'tab', 'aria-selected': String(tab === active), 'data-tab': tab.id,
        onclick: () => app.setInscriptionTab(el, tab.id)
      }, icon(tab.icon, 13), h('span', null, tab.label), tab.dot ? h('span.tab-dot') : null))));
    const body = h('div.inscription-body', { role: 'tabpanel' });
    this.root.append(body);
    active.render(body);
    this.validate();
  }

  updateTitle() {
    const el = this.app.selected();
    if (this.title && el) this.title.textContent = el.typeLabel + (el.name ? ' - ' + el.name.replace(/\n/g, ' ') : '');
  }

  /** Re-runs the field checks (validation messages) without rebuilding anything. */
  validate() {
    this.checks.forEach(fn => fn());
  }

  tabsFor(el) {
    const general = { id: 'general', label: 'General', icon: 'info', render: body => this.general(el, body) };
    if (el.kind === 'agent') {
      return [general,
        { id: 'javaBean', label: 'Java Bean', icon: 'code', dot: true, render: body => this.javaBean(el, body) },
        { id: 'error', label: 'Error', icon: 'spark', render: body => this.errorTab(body) },
        { id: 'configuration', label: 'Configuration', icon: 'settings', dot: Object.keys(agentConfig(el)).length > 0, render: body => this.configuration(el, body) }];
    }
    if (el.kind === 'script') return [general, { id: 'output', label: 'Output', icon: 'arrowRight', dot: true, render: body => this.scriptOutput(el, body) }];
    if (el.type === 'CallSubStart') {
      return [general,
        { id: 'start', label: 'Start', icon: 'play', dot: true, render: body => this.subStartTab(el, body) },
        { id: 'result', label: 'Result', icon: 'arrowRight', dot: true, render: body => this.subResultTab(el, body) }];
    }
    if (el.kind === 'boundary') {
      return [general,
        { id: 'error', label: 'Error', icon: 'spark', dot: true, render: body => this.boundaryErrorTab(el, body) },
        { id: 'output', label: 'Output', icon: 'arrowRight', dot: true, render: body => this.boundaryOutputTab(el, body) }];
    }
    if (el.kind === 'gateway') return [general, { id: 'condition', label: 'Condition', icon: 'list', dot: true, render: body => this.conditionTab(el, body) }];
    if (el.kind === 'start') {
      return [general,
        { id: 'start', label: 'Start', icon: 'play', dot: true, render: body => this.startTab(el, body) },
        { id: 'request', label: 'Request', icon: 'arrowRight', dot: true, render: body => this.requestTab(el, body) }];
    }
    if (el.kind === 'task') return [general, { id: 'task', label: 'Task', icon: 'list', dot: true, render: body => this.taskTab(el, body) }];
    if (el.kind === 'usertask') {
      return [general,
        { id: 'task', label: 'Task', icon: 'list', dot: true, render: body => this.taskTab(el, body) },
        { id: 'dialog', label: 'Dialog', icon: 'play', dot: true, render: body => this.dialogTab(el, body) },
        { id: 'output', label: 'Output', icon: 'arrowRight', dot: true, render: body => this.userTaskOutput(el, body) }];
    }
    if (el.type === 'ErrorEnd') return [general, { id: 'error', label: 'Error', icon: 'spark', dot: true, render: body => this.errorEndTab(el, body) }];
    return [general];
  }

  sectionState(el, id, fallback) {
    const key = el.id + ':' + id;
    const stored = this.app.state.sections[key];
    return { open: stored === undefined ? fallback : stored, onToggle: open => { this.app.state.sections[key] = open; } };
  }

  // ── tabs shared by all elements ────────────────────────────────────────────

  general(el, body) {
    const { app } = this;
    const description = field('Description', textBox({ value: el.description, rows: 2, onInput: v => app.changeElement(el, e => { e.description = v; }) }));
    description.setAttribute('data-tour', 'description');
    // a tag is what turns a sub-process start into a tool ("tool")
    const tags = el.tags || [];
    const tagList = tags.length
      ? [h('div.tags', { 'data-tour': 'tags' }, tags.map(tag => h('span.chip.plain', null, tag)))]
      : [note(app.t('inscription.orientation'))];
    body.append(
      section({ title: 'Name / Description', ...this.sectionState(el, 'name', true) },
        field('Name', textBox({ value: el.name, rows: 2, onInput: v => { app.changeElement(el, e => { e.name = v; }); this.updateTitle(); } })),
        description),
      section({ title: 'Tags', ...this.sectionState(el, 'tags', tags.length > 0) }, ...tagList));
  }

  // ── script ─────────────────────────────────────────────────────────────────

  scriptOutput(el, body) {
    const { app } = this;
    const editor = codeEditor({
      value: (el.config.output && el.config.output.code) || '',
      language: 'ivyscript',
      label: 'Code',
      onInput: v => app.changeElement(el, e => { e.config.output = { ...(e.config.output || {}), code: v }; }, 'code')
    });
    const codeField = field(null, editor);
    codeField.setAttribute('data-tour', 'code');
    this.controls.code = editor;
    this.checks.push(() => {
      const code = (el.config.output && el.config.output.code) || '';
      const error = validateScript(code, app.scriptContext(el));
      if (error) {
        const at = positionOf(code, error.pos);
        editor.setMarkers([{ line: at.line, message: error.message }]);
        codeField.setMessage('error', 'Line ' + at.line + ': ' + error.message);
      } else {
        editor.setMarkers([]);
        codeField.setMessage('', '');
      }
    });
    body.append(
      section({ title: 'Mapping', ...this.sectionState(el, 'mapping', false) },
        h('table.mapping', null,
          h('thead', null, h('tr', null, h('th', null, 'Attribute'), h('th', null, 'Type'), h('th', null, 'Expression'))),
          h('tbody', null, h('tr', null, h('td', null, 'out'), h('td', null, docOf(app.model, el).dataClass.simpleName), h('td', null, h('code', null, 'in'))))),
        note(app.t('inscription.orientation'))),
      section({ title: 'Code', ...this.sectionState(el, 'code', true) }, codeField),
      checkbox({ label: 'Disable Permission Checks (Execute this Script Step as SYSTEM)', disabled: true }));
  }

  // ── start and task ─────────────────────────────────────────────────────────

  startTab(el, body) {
    body.append(
      section({ title: 'Signature', ...this.sectionState(el, 'signature', true) },
        field('Name', textBox({ value: el.config.signature || 'start', readOnly: true, mono: true })),
        note(this.app.t('inscription.orientation'))),
      section({ title: 'Mapping', ...this.sectionState(el, 'mapping', false) }, note(this.app.t('inscription.orientation'))));
  }

  requestTab(el, body) {
    const request = el.config.request || {};
    body.append(
      checkbox({ label: 'Yes, this can be started with a HTTP-Request / -Link', checked: true, disabled: true }),
      section({ title: 'Name / Description', ...this.sectionState(el, 'request', true) },
        field('Name', textBox({ value: request.name || '', readOnly: true })),
        field('Description', textBox({ value: request.description || '', readOnly: true, rows: 2 })),
        field('Category', textBox({ value: request.category || '', readOnly: true })),
        note(this.app.t('inscription.orientation'))));
  }

  // ── callable sub-process start: a tool, when it carries the tag "tool" ──────

  paramTable(params, tour) {
    return h('table.mapping', { 'data-tour': tour },
      h('thead', null, h('tr', null, h('th', null, 'Name'), h('th', null, 'Type'), h('th', null, 'Description'))),
      h('tbody', null, (params || []).map(p => h('tr', null,
        h('td', null, h('code', null, p.name)), h('td', null, p.type || 'String'), h('td', null, p.desc || '')))));
  }

  mapTable(map, tour) {
    return h('table.mapping', { 'data-tour': tour },
      h('thead', null, h('tr', null, h('th', null, 'Attribute'), h('th', null, 'Expression'))),
      h('tbody', null, Object.keys(map || {}).map(key => h('tr', null,
        h('td', null, h('code', null, key)), h('td', null, h('code', null, map[key]))))));
  }

  subStartTab(el, body) {
    const { app } = this;
    const input = el.config.input || {};
    const signature = textBox({ value: el.config.signature || '', mono: true, onInput: v => app.changeElement(el, e => { e.config.signature = v; }, 'signature') });
    const signatureField = field('Name', signature);
    signatureField.setAttribute('data-tour', 'signature');
    this.controls.signature = signature;
    body.append(
      section({ title: 'Signature', ...this.sectionState(el, 'signature', true) }, signatureField,
        field('Definition', this.paramTable(input.params, 'params'))),
      section({ title: 'Mapping', ...this.sectionState(el, 'mapping', true) }, this.mapTable(input.map, 'inputMap')));
  }

  subResultTab(el, body) {
    const result = el.config.result || {};
    body.append(
      section({ title: 'Result', ...this.sectionState(el, 'result', true) }, field('Definition', this.paramTable(result.params, 'resultParams'))),
      section({ title: 'Mapping', ...this.sectionState(el, 'resultMapping', true) }, this.mapTable(result.map, 'resultMap')));
  }

  // ── error boundary event ───────────────────────────────────────────────────

  boundaryErrorTab(el, body) {
    const { app } = this;
    const code = textBox({ value: el.config.errorCode || '', mono: true, onInput: v => app.changeElement(el, e => { e.config.errorCode = v; }, 'errorCode') });
    const codeField = field('Error Code', code);
    codeField.setAttribute('data-tour', 'errorCode');
    this.controls.errorCode = code;
    body.append(section({ title: 'Error', ...this.sectionState(el, 'error', true) }, codeField, note(app.t('boundary.catches'))));
  }

  boundaryOutputTab(el, body) {
    const map = (el.config.output && el.config.output.map) || {};
    body.append(section({ title: 'Mapping', ...this.sectionState(el, 'mapping', true) }, this.mapTable(map, 'outputMap'), note(this.app.t('boundary.mapping'))));
  }

  // ── gateway ────────────────────────────────────────────────────────────────

  conditionTab(el, body) {
    const { app } = this;
    const conditions = el.config.conditions || {};
    const keys = Object.keys(conditions);
    el.outgoing.forEach(c => { if (!keys.includes(c.rawId)) keys.push(c.rawId); });
    const rows = keys.map(key => {
      const out = el.outgoing.find(c => c.rawId === key);
      const target = out ? elementById(app.model, out.to) : null;
      return h('tr', null,
        h('td', null, target ? target.name || target.typeLabel : key),
        h('td', null, conditions[key] ? h('code', null, conditions[key]) : h('span.muted', null, app.t('condition.none'))));
    });
    body.append(section({ title: 'Condition', ...this.sectionState(el, 'condition', true) },
      h('table.mapping', { 'data-tour': 'conditions' },
        h('thead', null, h('tr', null, h('th', null, app.t('condition.path')), h('th', null, 'Expression'))),
        h('tbody', null, rows)),
      note(app.t('condition.order'))));
  }

  /** A code field of an element: editable, checked like a script step. `vars` names what the code may use besides in/out. */
  codeField(el, read, write, vars) {
    const { app } = this;
    const editor = codeEditor({ value: read(), language: 'ivyscript', label: 'Code', onInput: v => app.changeElement(el, e => write(e, v), 'code') });
    const codeField = field(null, editor);
    codeField.setAttribute('data-tour', 'code');
    this.controls.code = editor;
    this.checks.push(() => {
      const code = read();
      const error = validateScript(code, app.scriptContext(el, vars));
      if (error) {
        const at = positionOf(code, error.pos);
        editor.setMarkers([{ line: at.line, message: error.message }]);
        codeField.setMessage('error', 'Line ' + at.line + ': ' + error.message);
      } else {
        editor.setMarkers([]);
        codeField.setMessage('', '');
      }
    });
    return codeField;
  }

  // ── user task ──────────────────────────────────────────────────────────────

  dialogTab(el, body) {
    const dialog = field('Dialog', textBox({ value: el.config.dialog || '', readOnly: true, mono: true }));
    dialog.setAttribute('data-tour', 'dialog');
    body.append(
      section({ title: 'Dialog', ...this.sectionState(el, 'dialog', true) }, dialog),
      section({ title: 'Mapping', ...this.sectionState(el, 'callMapping', true) }, this.mapTable((el.config.call && el.config.call.map) || {}, 'callMap')));
  }

  userTaskOutput(el, body) {
    const output = el.config.output || {};
    const text = value => (Array.isArray(value) ? value.join('\n') : value || '');
    body.append(
      section({ title: 'Mapping', ...this.sectionState(el, 'mapping', true) }, this.mapTable(output.map || {}, 'outputMap'), note(this.app.t('usertask.result'))),
      section({ title: 'Code', ...this.sectionState(el, 'code', true) },
        this.codeField(el, () => text((el.config.output || {}).code), (e, v) => { e.config.output = { ...(e.config.output || {}), code: v }; }, { result: {} })));
  }

  // ── error end ──────────────────────────────────────────────────────────────

  errorEndTab(el, body) {
    const text = value => (Array.isArray(value) ? value.join('\n') : value || '');
    const thrown = field('Error Code', textBox({ value: (el.config.throws && el.config.throws.error) || '', readOnly: true, mono: true }));
    thrown.setAttribute('data-tour', 'throws');
    body.append(
      section({ title: 'Error', ...this.sectionState(el, 'error', true) }, thrown),
      section({ title: 'Code', ...this.sectionState(el, 'code', true) },
        this.codeField(el, () => text(el.config.code), (e, v) => { e.config.code = v; }, { error: {} })));
  }

  taskTab(el, body) {
    const { app } = this;
    const tagged = (node, name) => { node.setAttribute('data-tour', name); return node; };
    const task = el.config.task || {};
    const responsible = task.responsible;
    const who = !responsible ? 'Role from Attr.  Everybody'
      : responsible.type === 'USER_FROM_ATTRIBUTE' ? 'User from Attr.  ' + (responsible.script || '')
        : (responsible.type || '') + '  ' + (responsible.script || '');
    const responsibleField = field('Responsible', textBox({ value: who, readOnly: true, mono: Boolean(responsible) }));
    responsibleField.setAttribute('data-tour', 'responsible');
    body.append(
      section({ title: 'Details', ...this.sectionState(el, 'details', true) },
        tagged(field('Name', textBox({ value: task.name || '', readOnly: true, placeholder: el.name })), 'taskName'),
        tagged(field('Description', textBox({ value: task.description || '', readOnly: true, rows: 2 })), 'taskDescription'),
        responsibleField),
      section({ title: 'Options', ...this.sectionState(el, 'options', true) },
        checkbox({
          label: 'Skip Tasklist',
          checked: Boolean(task.skipTasklist),
          onChange: checked => app.changeElement(el, e => { e.config.task = { ...(e.config.task || {}), skipTasklist: checked }; }, 'skipTasklist')
        }),
        checkbox({ label: 'Delay', disabled: true })));
  }

  // ── AgenticProcessCall ─────────────────────────────────────────────────────

  javaBean(el, body) {
    body.append(
      section({ title: 'Java Class', ...this.sectionState(el, 'class', true) },
        field(null, textBox({ value: el.config.javaClass || '', readOnly: true, mono: true })),
        note(this.app.t('inscription.orientation'))));
  }

  errorTab(body) {
    const el = this.app.selected();
    body.append(
      section({ title: 'Error', ...this.sectionState(el, 'error', true) },
        field('Error', textBox({ value: 'ivy:error:program:exception', readOnly: true, mono: true }))),
      section({ title: 'Timeout', ...this.sectionState(el, 'timeout', false) },
        field('Seconds', textBox({ value: '', readOnly: true })),
        field('Error', textBox({ value: 'ivy:error:program:timeout', readOnly: true, mono: true }))),
      note(this.app.t('inscription.orientation')));
  }

  configuration(el, body) {
    const { app } = this;
    const t = app.t;
    const cfg = agentConfig(el);
    const layer = app.layer;
    const attributes = app.model.dataClass.fields.map(f => ({ code: 'in.' + f.name, type: f.type, comment: f.comment }));
    const set = (key, value) => app.setAgentConfig(el, key, value);
    const seeAlso = app.def.seeAlso || {};
    const simulated = app.def.simulates || {};
    const notSimulated = (fieldEl, key, isSet) => {
      this.checks.push(() => {
        if (isSet() && !simulated[key] && seeAlso[key]) fieldEl.setMessage('info', t('check.notSimulated', { feature: t(seeAlso[key]) }));
        else fieldEl.setMessage('', '');
      });
    };

    // ✉️ Message
    const queryArea = macroArea({
      value: cfg.query || '', minRows: 2, attributes, browseTitle: t('browse.attribute'), layer, onInput: v => set('query', v)
    });
    const queryField = field('User message:', queryArea);
    this.checks.push(() => {
      const value = cfg.query || '';
      if (!value.trim()) { queryField.setMessage('warning', t('check.query.empty')); return; }
      const error = validateMacro(value, app.scriptContext());
      const missing = error ? [] : missingCms(value, app.scriptContext());
      if (missing.length) queryField.setMessage('warning', t('check.cms.missing', { path: missing[0] }));
      else queryField.setMessage(error ? 'error' : '', error ? error.message : '');
    });
    const systemArea = macroArea({
      value: cfg.system || '', minRows: 5, attributes, browseTitle: t('browse.attribute'), layer, onInput: v => set('system', v)
    });
    const systemField = field('System message:', systemArea);
    this.checks.push(() => {
      const value = cfg.system || '';
      if (!value.trim()) { systemField.setMessage('warning', t('check.system.empty')); return; }
      const error = validateMacro(value, app.scriptContext());
      systemField.setMessage(error ? 'error' : '', error ? error.message : '');
    });
    const empty = !cfg.query && !cfg.system && !cfg.resultMapping;
    const fill = empty && app.originalConfig(el) ? h('button.link-btn.fill', { type: 'button', onclick: () => app.fillFromOriginal(el) }, icon('bulb', 13), t('fill.example')) : null;

    // 🛠️ Tools
    const toolsSelect = multiSelect({
      values: configList(cfg.tools), options: this.toolOptions(), layer,
      onChange: v => set('tools', v.length ? JSON.stringify(v) : '')
    });
    const toolsField = field('Available tools:', toolsSelect);
    toolsField.setAttribute('data-tour', 'tools');
    notSimulated(toolsField, 'tools', () => configList(cfg.tools).length > 0);

    // 🛡️ Guardrails
    const inputSelect = multiSelect({
      values: configList(cfg.inputGuardrails), options: INPUT_GUARDRAILS.map(value => ({ value, icon: '➡️' })), layer,
      onChange: v => set('inputGuardrails', v.length ? JSON.stringify(v) : '')
    });
    const inputField = field('Input guardrails:', inputSelect);
    inputField.setAttribute('data-tour', 'inputGuardrails');
    notSimulated(inputField, 'guardrails', () => configList(cfg.inputGuardrails).length > 0);
    const outputSelect = multiSelect({
      values: configList(cfg.outputGuardrails), options: OUTPUT_GUARDRAILS.map(value => ({ value, icon: '⬅️' })), layer,
      onChange: v => set('outputGuardrails', v.length ? JSON.stringify(v) : '')
    });
    const outputField = field('Output guardrails:', outputSelect);
    outputField.setAttribute('data-tour', 'outputGuardrails');
    notSimulated(outputField, 'guardrails', () => configList(cfg.outputGuardrails).length > 0);

    // 🧠️ Model
    const providerSelect = multiSelect({
      values: configList(cfg.provider), options: PROVIDER_NAMES.map(value => ({ value })), layer,
      onChange: v => set('provider', v.length ? JSON.stringify(v) : '')
    });
    const providerField = field('Provider:', providerSelect, { help: 'Choose one of the supported providers. Keep empty to use default from variables.yaml' });
    this.checks.push(() => providerField.setMessage(configList(cfg.provider).length > 1 ? 'warning' : '', configList(cfg.provider).length > 1 ? t('check.provider.many') : ''));
    const modelInput = scriptInput({ value: cfg.model || '', layer, onInput: v => set('model', v) });
    const modelField = field('Model:', modelInput, { help: 'Keep empty to use default from variables.yaml' });
    this.checks.push(() => this.checkExpression(modelField, cfg.model, 'check.text'));
    const temperatureInput = scriptInput({ value: cfg.temperature || '', layer, onInput: v => set('temperature', v) });
    const temperatureField = field('Temperature:', temperatureInput, { help: "Specify the temperature for the model's output randomness." });
    temperatureField.setAttribute('data-tour', 'temperature');
    this.checks.push(() => {
      const raw = (cfg.temperature || '').trim();
      const error = raw ? validateExpression(raw, app.scriptContext()) : null;
      if (error) temperatureField.setMessage('error', error.message);
      else if (raw && !simulated.temperature && seeAlso.temperature) temperatureField.setMessage('info', t('check.notSimulated', { feature: t(seeAlso.temperature) }));
      else temperatureField.setMessage('', '');
    });

    // ➡️ Output
    const typeInput = scriptInput({ value: cfg.resultType || '', layer, onInput: v => set('resultType', v) });
    const typeField = field('Expect result of type:', typeInput);
    this.checks.push(() => {
      const raw = (cfg.resultType || '').trim();
      const error = raw ? validateExpression(raw, app.scriptContext()) : null;
      const known = error || !raw ? null : app.model.classes[raw.replace(/\.class$/, '')];
      if (error) typeField.setMessage('error', error.message);
      else if (raw && simulated.structuredOutput && !known) typeField.setMessage('error', t('check.type.unknown', { name: raw.replace(/\.class$/, '') }));
      else if (raw && !simulated.structuredOutput && seeAlso.structuredOutput) typeField.setMessage('info', t('check.notSimulated', { feature: t(seeAlso.structuredOutput) }));
      else typeField.setMessage('', '');
    });
    const mapInput = scriptInput({
      value: cfg.resultMapping || '', attributes, browseTitle: t('browse.attribute'), layer, onInput: v => set('resultMapping', v)
    });
    const mapField = field('Map result to:', mapInput);
    queryField.setAttribute('data-tour', 'query');
    systemField.setAttribute('data-tour', 'system');
    mapField.setAttribute('data-tour', 'resultMapping');
    typeField.setAttribute('data-tour', 'resultType');
    providerField.setAttribute('data-tour', 'provider');
    modelField.setAttribute('data-tour', 'model');
    Object.assign(this.controls, {
      query: queryArea,
      system: systemArea,
      resultMapping: mapInput,
      resultType: typeInput,
      model: modelInput,
      provider: { setValue: v => providerSelect.setValues(configList(v)) },
      tools: { setValue: v => toolsSelect.setValues(configList(v)) },
      temperature: temperatureInput,
      inputGuardrails: { setValue: v => inputSelect.setValues(configList(v)) },
      outputGuardrails: { setValue: v => outputSelect.setValues(configList(v)) }
    });
    const tagged = (node, name) => { node.setAttribute('data-tour', name); return node; };
    this.checks.push(() => {
      const raw = (cfg.resultMapping || '').trim();
      if (!raw) { mapField.setMessage('warning', t('check.mapping.empty')); return; }
      const error = validateExpression(raw, app.scriptContext(), { assignable: true });
      mapField.setMessage(error ? 'error' : '', error ? error.message : '');
    });

    const hasModel = Boolean(cfg.provider || cfg.model || cfg.temperature);
    body.append(
      section({ title: '✉️ Message', ...this.sectionState(el, 'message', true) }, fill, queryField, systemField, note(AI_NOTICE)),
      section({ title: '🛠️ Tools', ...this.sectionState(el, 'tools', Boolean(cfg.tools)) }, toolsField),
      section({ title: '🛡️ Guardrails', ...this.sectionState(el, 'guardrails', Boolean(cfg.inputGuardrails || cfg.outputGuardrails)) },
        note('Select guardrails to apply, or keep empty to use the default guardrails'), inputField, outputField),
      tagged(section({ title: '🧠️ Model', ...this.sectionState(el, 'model', hasModel) },
        providerField, modelField,
        note('Optional Settings (rarely need to be changed, the defaults work for most cases'), temperatureField), 'modelGroup'),
      section({ title: '➡️ Output', ...this.sectionState(el, 'output', true) }, typeField, mapField));
  }

  /**
   * What "Available tools" offers, as in AgentEditor: every callable sub-process start tagged
   * "tool" of the lesson's tools file, then the tools the lesson only lists (other lessons'
   * tools, Java tools).
   */
  toolOptions() {
    const { app } = this;
    const own = toolStarts(app.model).map(tool => ({
      value: tool.name,
      label: tool.name + (tool.params.length ? ' (' + tool.params.map(p => p.name).join(', ') + ')' : ''),
      icon: '🧰️',
      description: tool.description
    }));
    app.javaTools().forEach(tool => own.push({ value: tool.name, label: tool.name, icon: '☕️', description: tool.description }));
    return own.concat((app.def.tools || []).filter(option => !own.some(o => o.value === option.value)));
  }

  /** Script fields that expect text: point out missing quotes, the usual slip. */
  checkExpression(fieldEl, value, hintKey) {
    const raw = (value || '').trim();
    if (!raw) { fieldEl.setMessage('', ''); return; }
    const error = validateExpression(raw, this.app.scriptContext());
    if (!error) { fieldEl.setMessage('', ''); return; }
    const bare = !/^["']/.test(raw) && !/^(in|out)\./.test(raw);
    fieldEl.setMessage('error', bare ? this.app.t(hintKey, { value: raw }) : error.message);
  }
}

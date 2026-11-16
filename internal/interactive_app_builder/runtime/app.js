/**
 * DesignerApp: one mounted simulation. It owns the process model, creates the stage and the
 * UI parts, and turns a ProcessRunner run into what the learner sees — the token on the
 * canvas, the round trip to the model, log lines, the conversation and the process data.
 */
import { h, clear, Emitter, openPopover, debounce, toolCallText } from './util.js';
import { createTranslator, normalizeLanguage } from './i18n.js';
import { loadProcess, elementById, agentConfig, originalOf, restore, startElement, nextOf, docOf, docView } from './model/process.js';
import { ProcessRunner } from './model/runner.js';
import { parseYaml, readVariable, hasBlock } from './model/yaml.js';
import { circuitBreakerOn, circuitBreakerStatics } from './model/guardrails.js';
import { resolveProvider, PROVIDER_NAMES } from './model/providers.js';
import { ThreeStage } from './stage/three-stage.js';
import { CanvasStage } from './stage/canvas-stage.js';
import { attachController } from './stage/controller.js';
import { connectorPath } from './stage/layout.js';
import { icon } from './ui/icons.js';
import { codeEditor, field } from './ui/fields.js';
import { Inscription } from './ui/inscription.js';
import { BottomPanel } from './ui/panel.js';
import { Tour } from './ui/tour.js';

const NARROW = 1000;
const SMALL = 620;
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const firstLine = text => (String(text).split('\n').find(l => l.trim()) || '').trim();
const oneLine = text => String(text).replace(/\s+/g, ' ').trim();
const freshVisual = () => ({ executed: {}, connectors: {}, active: null, error: null, toolActive: null, toolError: null, breakpoints: new Set() });

export class DesignerApp {
  /**
   * @param {HTMLElement} root        container inside the shadow root
   * @param {Object} definition       the feature's app definition (see README)
   * @param {Object} [options]
   * @param {string} [options.lang]         'en' | 'ja' | 'jp'
   * @param {'webgl'|'canvas'} [options.renderer]  force a renderer (tests)
   * @param {number} [options.tourPace]     plays the walkthrough faster (tests)
   * @param {boolean} [options.autoplay]  start the walkthrough at once instead of on its opening card
   */
  constructor(root, definition, options = {}) {
    this.root = root;
    this.def = definition;
    this.options = options;
    this.lang = normalizeLanguage(options.lang);
    this.t = createTranslator(this.lang, definition.strings);
    this.model = loadProcess(definition.process, definition.dataClass, {
      file: definition.file, project: definition.project, classes: definition.classes, cms: definition.cms, toolProcess: definition.toolProcess
    });
    this.variablesText = definition.variables || '';
    // source files the lesson shows in editor tabs: { id, file, path, language, text, readOnly }
    this.sources = definition.sources || [];
    this.sourceText = {};
    this.sources.forEach(source => { this.sourceText[source.id] = source.text; });
    this.sourceCode = {}; // their editors, by id
    // further editor tabs a lesson brings, e.g. a trace viewer: { id, file, icon, create(app, container) }
    this.viewDefs = definition.views || [];
    this.views = {}; // their controllers, by id: { render(), shown(), rect(name), reveal(name), dispose() }
    this.events = new Emitter();
    const motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.reducedMotion = options.reducedMotion !== undefined ? options.reducedMotion : Boolean(motion && motion.matches);
    this.state = {
      tab: 'process',
      selection: null,
      hover: null,
      inscriptionOpen: true,
      inscriptionTabs: {},
      sections: {},
      panelTab: 'log',
      panelOpen: true,
      panelPinned: false,
      status: 'idle',
      statusParams: null
    };
    this.visual = freshVisual();
    this.data = null;
    this.resume = null;
    this.runGeneration = 0;
    this.caption = '';
    this.toastTimers = new Map();
    this.memo = {}; // scratch space for a feature's walkthrough
    this.mode = null; // 'intro' | 'tour' | 'explore'
    this.runHooks = null; // set by the walkthrough while it runs the process

    this.runner = new ProcessRunner({ model: this.model, brain: definition.brain, io: this.createIo(), simulates: definition.simulates, javaTools: () => this.javaTools() });
    this.buildSkeleton();
    this.createStage();
    this.inscription = new Inscription(this, this.inscriptionEl);
    this.panel = new BottomPanel(this, this.panelEl);
    this.viewDefs.forEach(v => { this.views[v.id] = v.create(this, this.viewEditors[v.id]); });
    this.tour = new Tour(this, definition.tour);
    this.renderChrome();
    if (!this.tour.available) this.setMode('explore');
    else if (options.autoplay) this.tour.start(0);
    else this.tour.showIntro();
  }

  // ── construction ───────────────────────────────────────────────────────────

  buildSkeleton() {
    const root = clear(this.root);
    root.classList.add('app');
    this.tabsEl = h('div.tabs');
    this.toolbarEl = h('div.toolbar');
    this.canvasHost = h('div.canvas-host');
    this.overlayEl = h('div.overlays');
    this.canvasHost.append(this.overlayEl);
    this.inscriptionEl = h('aside.inscription');
    this.processEditor = h('div.editor.editor-process', null,
      h('div.editor-main', null, this.toolbarEl, this.canvasHost), this.inscriptionEl);
    this.variablesEditor = h('div.editor.editor-variables', { hidden: true });
    this.sourceEditors = {};
    this.sources.forEach(source => { this.sourceEditors[source.id] = h('div.editor.editor-source', { hidden: true }); });
    this.viewEditors = {};
    this.viewDefs.forEach(v => { this.viewEditors[v.id] = h('div.editor.editor-view', { hidden: true, 'data-view': v.id }); });
    this.panelEl = h('div.panel');
    this.playerEl = h('div.player');
    this.layer = h('div.layer');
    root.append(this.tabsEl, h('div.workbench', null, this.processEditor, this.sources.map(source => this.sourceEditors[source.id]), this.variablesEditor, this.viewDefs.map(v => this.viewEditors[v.id])), this.panelEl, this.playerEl, this.layer);
  }

  /** One canvas per file of the lesson; the one of the open editor tab is shown. */
  createStage() {
    const wanted = this.options.renderer;
    this.stages = {};
    this.detachControllers = [];
    this.fellBack = false;
    this.model.docs.forEach(doc => {
      const view = docView(this.model, doc.id);
      const scene = { model: view, stateOf: id => this.stateOf(id), connectorState: route => this.connectorState(route) };
      let stage = null;
      if (wanted !== 'canvas' && ThreeStage.isSupported()) {
        try {
          stage = new ThreeStage(this.canvasHost, scene);
        } catch (e) {
          console.warn('[swInteractive] WebGL stage unavailable, using the 2D canvas instead.', e);
        }
      }
      if (!stage && wanted !== 'canvas') this.fellBack = true;
      if (!stage) stage = new CanvasStage(this.canvasHost, scene);
      this.canvasHost.insertBefore(stage.canvas, this.overlayEl);
      stage.canvas.setAttribute('role', 'application');
      stage.canvas.style.display = doc.id === 'process' ? '' : 'none';
      stage.setReducedMotion(this.reducedMotion);
      stage.needsFit = doc.id !== 'process'; // fitted when its tab is first opened
      this.stages[doc.id] = stage;

      this.detachControllers.push(attachController(stage, {
        model: () => view,
        select: el => this.select(el ? el.id : null),
        open: el => { this.select(el.id); this.setInscriptionOpen(true); },
        hover: el => {
          const previous = this.state.hover;
          this.state.hover = el ? el.id : null;
          if (previous) this.refresh(previous);
          if (el) this.refresh(el.id);
        },
        moved: el => stage.refresh(el.id),
        wheelZooms: () => true,
        wheelBlocked: () => {},
        key: key => this.canvasKey(key)
      }));
    });
    this.stage = this.stages.process; // where a run and the agent's round trip are shown

    const onResize = debounce(() => {
      this.updateLayout();
      this.viewStage().resize();
    }, 30);
    this.resizeObserver = new ResizeObserver(onResize);
    this.resizeObserver.observe(this.canvasHost);
    this.resizeObserver.observe(this.root);
    this.updateLayout(true);
    this.stage.resize();
  }

  /** The canvas of the open editor tab (the process while variables.yaml is open). */
  viewStage() {
    return this.stages[this.state.tab] || this.stage;
  }

  /** Repaints an element on the canvas of its file; 'all' and 'connectors' go to every canvas. */
  refresh(target) {
    const el = target === 'all' || target === 'connectors' ? null : elementById(this.model, target);
    Object.keys(this.stages).forEach(doc => {
      if (!el || el.doc === doc) this.stages[doc].refresh(target);
    });
  }

  /** Everything that carries text; rebuilt when the language changes. */
  renderChrome() {
    this.root.lang = this.lang;
    this.model.docs.forEach(doc => this.stages[doc.id].canvas.setAttribute('aria-label', this.t('canvas.label', { file: doc.file })));
    this.tour.render();
    this.renderTabs();
    this.renderToolbar();
    this.renderOverlays();
    this.inscription.render();
    this.renderVariables();
    this.renderSources();
    Object.values(this.views).forEach(view => view.render && view.render());
    this.panel.render();
    this.applyStatus();
    if (this.fellBack) {
      this.fellBack = false;
      this.toast(this.t('renderer.fallback'), { duration: 6000 });
    }
  }

  // ── painter state ──────────────────────────────────────────────────────────

  stateOf(id) {
    return {
      selected: this.state.selection === id,
      hover: this.state.hover === id,
      executed: this.visual.executed[id] || 0,
      active: this.visual.active === id || this.visual.toolActive === id,
      error: this.visual.error === id || this.visual.toolError === id,
      breakpoint: false,
      ghostLabel: null
    };
  }

  connectorState(route) {
    return { executed: (this.visual.connectors[route.id] || 0) > 0, dashed: route.from.removed || route.to.removed };
  }

  /** For checking scripts and expressions of an element: the data class is the one of its file. */
  scriptContext(el, vars) {
    const dataClass = el ? docOf(this.model, el).dataClass : this.model.dataClass;
    return {
      data: {}, fields: dataClass.fields, dataClassName: dataClass.name, classes: this.model.classes, cms: this.model.cms, vars,
      statics: circuitBreakerStatics(() => {}), constructors: { DecisionMaker: () => ({ __native: true, resolve: () => {} }) }
    };
  }

  // ── events ─────────────────────────────────────────────────────────────────

  emit(event) {
    this.events.emit(event);
  }

  /** Lets the walkthrough step in at a point of the run (see ui/tour.js). */
  async hook(name, payload) {
    const fn = this.runHooks && this.runHooks[name];
    if (fn) await fn(payload);
  }

  // ── modes: the walkthrough's opening card, its playback, the editable simulator ──

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.root.dataset.mode = mode;
    if (mode === 'explore') {
      this.setPanelOpen(true);
      if (this.root.dataset.layout !== 'narrow') this.setInscriptionOpen(true);
    } else {
      this.select(null);
      this.setInscriptionOpen(false);
      this.setPanelOpen(false);
    }
    requestAnimationFrame(() => {
      if (this.disposed) return;
      this.stage.resize();
      this.stage.fit({ animate: false });
    });
  }

  // ── editor tabs ────────────────────────────────────────────────────────────

  renderTabs() {
    const t = this.t;
    clear(this.tabsEl);
    const tab = (id, iconName, label, extra) => h('button.tab' + (this.state.tab === id ? '.active' : ''), {
      type: 'button', role: 'tab', 'aria-selected': String(this.state.tab === id), 'data-tab': id, onclick: () => this.setTab(id)
    }, icon(iconName, 14), h('span', null, label), extra);
    const changed = this.variablesText !== (this.def.variables || '');
    this.variablesDot = h('span.tab-mark' + (changed ? '.changed' : ''));
    this.aboutButton = h('button.badge', { type: 'button', 'aria-haspopup': 'dialog', onclick: () => this.showAbout() }, icon('info', 13), t('badge'));
    this.replayButton = this.tour.available
      ? h('button.badge.replay', { type: 'button', 'aria-haspopup': 'menu', onclick: () => this.showReplay() }, icon('play', 11), t('tour.replay'))
      : null;
    this.tabsEl.append(
      h('div.tab-strip', { role: 'tablist' },
        this.model.docs.map(doc => tab(doc.id, 'process', doc.file)),
        this.sources.map(source => tab('src:' + source.id, source.language === 'java' ? 'code' : 'yaml', source.file)),
        tab('variables', 'yaml', 'variables.yaml', this.variablesDot),
        this.viewDefs.map(v => tab('view:' + v.id, v.icon || 'list', v.file))),
      h('span.spacer'),
      this.replayButton,
      this.aboutButton);
  }

  setTab(id) {
    if (this.state.tab === id) return;
    this.state.tab = id;
    const stage = this.stages[id]; // a process file, or nothing for variables.yaml
    this.processEditor.hidden = !stage;
    this.variablesEditor.hidden = id !== 'variables';
    this.sources.forEach(source => { this.sourceEditors[source.id].hidden = id !== 'src:' + source.id; });
    this.viewDefs.forEach(v => { this.viewEditors[v.id].hidden = id !== 'view:' + v.id; });
    this.renderTabs();
    const view = id.startsWith('view:') ? this.views[id.slice(5)] : null;
    if (view && view.shown) view.shown();
    if (stage) {
      Object.keys(this.stages).forEach(doc => { this.stages[doc].canvas.style.display = doc === id ? '' : 'none'; });
      const selected = this.selected();
      if (selected && selected.doc !== id) this.select(null); // the inscription view shows an element of the open file
      stage.resize();
      if (stage.needsFit) {
        stage.needsFit = false;
        stage.fit({ animate: false });
      }
      stage.invalidate();
    } else if (id === 'variables' && this.variablesCode) this.variablesCode.textarea.focus();
    this.emit({ type: 'tab', tab: id });
  }

  showAbout() {
    const t = this.t;
    const rules = t('about.rules').split('|').filter(Boolean);
    const close = openPopover(this.layer, this.aboutButton, h('div.about', null,
      h('h3', null, t('about.title')),
      h('p', null, t('about.p1')),
      h('p', null, t('about.p2', { file: this.def.file })),
      h('p', null, t('about.p3')),
      rules.length ? h('ul', null, rules.map(r => h('li', null, r))) : null,
      h('div.about-actions', null, h('button.btn', { type: 'button', onclick: () => close() }, t('about.close')))), { align: 'right' });
  }

  /** The walkthrough again: from the start, or one chapter. */
  showReplay() {
    const t = this.t;
    const item = (label, index) => h('button.menu-item', { type: 'button', role: 'menuitem', onclick: () => { close(); this.tour.start(index); } }, label);
    const close = openPopover(this.layer, this.replayButton, h('div.menu', { role: 'menu' },
      item(t('tour.replay.all'), 0),
      h('div.menu-title', null, t('tour.replay.chapters')),
      this.tour.chapters.map((c, i) => item((i + 1) + ' · ' + t('tour.chapter.' + c.id), i))), { align: 'right' });
  }

  updateLayout(initial = false) {
    const width = this.root.clientWidth;
    if (!width) return;
    // Narrow: the inscription view slides over the canvas instead of taking space beside it,
    // so the process stays readable. Small: controls drop their labels.
    const narrow = width < NARROW;
    const was = this.root.dataset.layout;
    this.root.dataset.layout = narrow ? 'narrow' : 'wide';
    this.root.classList.toggle('small', width < SMALL);
    if ((initial || was === undefined) && narrow) this.setInscriptionOpen(false);
  }

  /** In the narrow layout the inscription view covers part of the canvas: keep the selection beside it. */
  revealSelection() {
    const el = this.selected();
    const stage = el ? this.stages[el.doc] : null;
    if (!el || this.root.dataset.layout !== 'narrow' || !this.state.inscriptionOpen || stage.view.tilt) return;
    const host = this.canvasHost.getBoundingClientRect();
    const free = this.inscriptionEl.getBoundingClientRect().left - host.left;
    if (free < 160) return;
    const x = stage.worldToClient(el.x, el.y).x - host.left;
    const half = (el.w / 2 + 28) * stage.view.zoom;
    if (x + half <= free && x - half >= 0) return;
    stage.effects.moveView({ x: stage.view.x + (x - free / 2) / stage.view.zoom }, 320);
  }

  // ── toolbar ────────────────────────────────────────────────────────────────

  renderToolbar() {
    const t = this.t;
    clear(this.toolbarEl);
    const inert = name => h('span.icon-btn.inert', { title: t('quick.inert') }, icon(name, 15));
    this.inscriptionToggle = h('button.icon-btn' + (this.state.inscriptionOpen ? '.active' : ''), {
      type: 'button', title: t('toggle.inscription'), 'aria-label': t('toggle.inscription'), 'aria-pressed': String(this.state.inscriptionOpen),
      onclick: () => this.setInscriptionOpen(!this.state.inscriptionOpen)
    }, icon('panelRight', 15));
    this.toolbarEl.append(
      h('div.tool-group', null, h('span.icon-btn.active', { title: 'Selection Tool' }, icon('pointer', 15)), inert('marquee'), h('span.tool-sep'), inert('undo'), inert('redo')),
      h('div.tool-group', null, inert('database'), inert('settings'), this.inscriptionToggle));
  }

  // ── overlays on the canvas ─────────────────────────────────────────────────

  renderOverlays() {
    const t = this.t;
    clear(this.overlayEl);
    this.runButton = h('button.run-btn.primary', { type: 'button', onclick: () => this.onRunButton() });
    this.stepButton = h('button.run-btn', { type: 'button', title: t('step.tip'), onclick: () => this.run({ step: true }) }, icon('step', 14), h('span', null, t('step')));
    this.resetButton = h('button.run-btn', { type: 'button', title: t('reset.tip'), onclick: () => this.reset() }, icon('reset', 14), h('span', null, t('reset')));
    this.statusEl = h('span.run-status', { role: 'status', 'aria-live': 'polite' });
    this.captionEl = h('div.caption', { hidden: !this.caption }, this.caption);
    this.toastEl = h('div.toasts', { 'aria-live': 'polite' });
    this.overlayEl.append(
      h('div.runbar', null, this.runButton, this.stepButton, this.resetButton, this.statusEl),
      h('div.zoombar', null,
        h('button.icon-btn', { type: 'button', title: t('zoom.out'), 'aria-label': t('zoom.out'), onclick: () => { this.viewStage().effects.userMovedView(); this.viewStage().zoomBy(1 / 1.25); } }, icon('minus', 14)),
        h('button.icon-btn', { type: 'button', title: t('zoom.fit'), 'aria-label': t('zoom.fit'), onclick: () => { this.viewStage().effects.userMovedView(); this.viewStage().fit({ animate: true }); } }, icon('fit', 14)),
        h('button.icon-btn', { type: 'button', title: t('zoom.in'), 'aria-label': t('zoom.in'), onclick: () => { this.viewStage().effects.userMovedView(); this.viewStage().zoomBy(1.25); } }, icon('plus', 14))),
      this.captionEl, this.toastEl);
  }

  setCaption(text) {
    this.caption = text || '';
    if (!this.captionEl) return;
    this.captionEl.textContent = this.caption;
    this.captionEl.hidden = !this.caption;
  }

  toast(text, { id = text, duration = 2800, tone = 'info' } = {}) {
    if (!this.toastEl) return;
    let node = [...this.toastEl.children].find(n => n.dataset.id === id);
    if (!node) {
      node = h('div.toast.' + tone, { 'data-id': id }, text);
      this.toastEl.append(node);
    } else node.textContent = text;
    clearTimeout(this.toastTimers.get(id));
    this.toastTimers.set(id, setTimeout(() => { node.remove(); this.toastTimers.delete(id); }, duration));
  }

  // ── selection and inscription ──────────────────────────────────────────────

  selected() {
    return this.state.selection ? elementById(this.model, this.state.selection) : null;
  }

  select(id) {
    if (this.state.selection === id) return;
    const previous = this.state.selection;
    this.state.selection = id;
    if (previous) this.refresh(previous);
    if (id) this.refresh(id);
    this.inscription.render();
    const element = this.selected();
    this.emit({ type: 'select', element });
    this.emitInscription();
    this.revealSelection();
  }

  emitInscription() {
    const element = this.selected();
    if (!element || !this.state.inscriptionOpen) return;
    const active = this.inscriptionEl.querySelector('.inscription-tab.active');
    this.emit({ type: 'inscription', element, tab: active ? active.dataset.tab : null });
  }

  setInscriptionOpen(open) {
    this.state.inscriptionOpen = open;
    this.processEditor.classList.toggle('inscription-closed', !open);
    if (this.inscriptionToggle) {
      this.inscriptionToggle.classList.toggle('active', open);
      this.inscriptionToggle.setAttribute('aria-pressed', String(open));
    }
    if (open) {
      this.emitInscription();
      requestAnimationFrame(() => this.revealSelection());
    }
  }

  setInscriptionTab(el, tabId) {
    this.state.inscriptionTabs[el.id] = tabId;
    this.inscription.render();
    this.emitInscription();
  }

  /** Applies an edit to an element and refreshes everything that shows it. */
  changeElement(el, mutate, key = 'name') {
    mutate(el);
    this.refresh(el.id);
    this.inscription.validate();
    this.emit({ type: 'config', element: el, key });
  }

  setAgentConfig(el, key, value) {
    const cfg = agentConfig(el);
    if (value === '' || value == null) delete cfg[key];
    else cfg[key] = value;
    this.inscription.validate();
    this.emit({ type: 'config', element: el, key });
  }

  originalConfig(el) {
    const original = originalOf(this.model, el.id);
    return original && original.config.userConfig ? original.config.userConfig : null;
  }

  fillFromOriginal(el) {
    const original = this.originalConfig(el);
    if (!original) return;
    el.config.userConfig = clone(original);
    this.inscription.render();
    this.emit({ type: 'config', element: el, key: 'all' });
  }

  canvasKey(key) {
    const el = this.selected();
    if (key === 'Enter' && el) { this.setInscriptionOpen(true); return true; }
    if (key === 'Escape' && el) { this.select(null); return true; }
    if ((key === 'ArrowRight' || key === 'ArrowLeft') && this.state.tab === 'process') {
      const order = [];
      for (let e = startElement(this.model); e && !order.includes(e); e = (nextOf(this.model, e) || {}).element) order.push(e);
      if (!order.length) return false;
      const index = el ? order.indexOf(el) : -1;
      const next = order[clamp(index + (key === 'ArrowRight' ? 1 : -1), 0, order.length - 1)] || order[0];
      this.select(next.id);
      return true;
    }
    return false;
  }

  // ── variables.yaml ─────────────────────────────────────────────────────────

  renderVariables() {
    const t = this.t;
    clear(this.variablesEditor);
    this.variablesInfo = h('div.var-info');
    this.variablesCode = codeEditor({
      value: this.variablesText,
      language: 'yaml',
      label: 'variables.yaml',
      onInput: value => {
        this.variablesText = value;
        this.updateVariablesInfo();
        if (this.variablesDot) this.variablesDot.classList.toggle('changed', value !== (this.def.variables || ''));
        this.emit({ type: 'variables' });
      }
    });
    this.variablesField = field(null, this.variablesCode);
    this.variablesEditor.append(
      h('div.var-main', null,
        h('div.var-path', null, icon('yaml', 13), this.def.variablesPath || 'config/variables.yaml'),
        this.variablesField),
      h('aside.var-side', null,
        h('h4', null, t('variables.title')),
        this.variablesInfo,
        h('p.field-note', null, t('variables.hint')),
        h('button.link-btn', { type: 'button', onclick: () => this.setVariables(this.def.variables || '') }, icon('reset', 13), t('variables.restore'))));
    this.updateVariablesInfo();
  }

  // ── source files ───────────────────────────────────────────────────────────

  renderSources() {
    const t = this.t;
    this.sources.forEach(source => {
      const code = codeEditor({
        value: this.sourceText[source.id],
        language: source.language || 'text',
        label: source.file,
        onInput: value => {
          this.sourceText[source.id] = value;
          this.inscription.render(); // the tools on offer may depend on it
          this.emit({ type: 'source', id: source.id });
        }
      });
      code.textarea.readOnly = Boolean(source.readOnly);
      this.sourceCode[source.id] = code;
      clear(this.sourceEditors[source.id]).append(h('div.var-main', null,
        h('div.var-path', null, icon(source.language === 'java' ? 'code' : 'yaml', 13), source.path || source.file,
          source.readOnly ? h('span.src-note', null, t('source.readOnly')) : null),
        field(null, code)));
    });
  }

  setSource(id, text) {
    this.sourceText[id] = text;
    if (this.sourceCode[id]) this.sourceCode[id].setValue(text);
    this.inscription.render();
    this.emit({ type: 'source', id });
  }

  /** The Java tools that are registered, judged by the lesson from the current source files. */
  javaTools() {
    return this.def.javaTools ? this.def.javaTools(this.sourceText, { variablesText: this.variablesText }) : [];
  }

  setVariables(text) {
    this.variablesText = text;
    if (this.variablesCode) this.variablesCode.setValue(text);
    if (this.variablesDot) this.variablesDot.classList.toggle('changed', text !== (this.def.variables || ''));
    this.updateVariablesInfo();
    this.emit({ type: 'variables' });
  }

  updateVariablesInfo() {
    const t = this.t;
    const info = clear(this.variablesInfo);
    const yaml = parseYaml(this.variablesText);
    const row = (label, value, hint, state) => h('div.var-row' + (state ? '.' + state : ''), null,
      h('span.var-label', null, label), h('span.var-value', null, value), hint ? h('span.var-hint', null, hint) : null);
    if (yaml.errors.length) {
      const first = yaml.errors[0];
      this.variablesCode.setMarkers(yaml.errors.map(e => ({ line: e.line, message: e.message })));
      this.variablesField.setMessage('error', t('variables.parseError', { line: first.line, message: first.message }));
      info.append(h('div.var-effect.bad', null, icon('error', 14), t('variables.effect.bad')));
      return;
    }
    this.variablesCode.setMarkers([]);
    this.variablesField.setMessage('', '');
    if (hasBlock(yaml.value, 'AI.CircuitBreaker')) {
      // the kill switch outranks everything else in the file
      const on = circuitBreakerOn(yaml.value);
      info.append(row(t('variables.breaker'), t(on ? 'variables.breaker.on' : 'variables.breaker.off'), 'AI.CircuitBreaker.Enabled', on ? 'bad' : 'ok'));
      if (on) {
        info.append(h('div.var-effect.bad', null, icon('error', 14), t('variables.breaker.effect')));
        return;
      }
    }
    const configured = readVariable(yaml.value, 'AI.DefaultProvider').trim();
    const provider = resolveProvider(yaml.value, '', '');
    if (!provider.ok) {
      info.append(
        row(t('variables.provider'), provider.name, t('variables.from.default'), 'bad'),
        h('div.var-effect.bad', null, icon('error', 14), t('variables.unknown', { name: provider.name, list: PROVIDER_NAMES.join(', ') })));
      return;
    }
    const needsKey = provider.missingKey !== null || /APIKey/.test(JSON.stringify(yaml.value)) || provider.name !== 'Ollama';
    info.append(
      row(t('variables.provider'), provider.name, configured ? t('variables.from.default') : t('variables.from.fallback'), configured ? 'ok' : 'warn'),
      row(t('variables.model'), provider.model || '—', readVariable(yaml.value, 'AI.Providers.' + provider.name + '.DefaultModel').trim() ? 'DefaultModel' : t('variables.model.default')),
      row(t('variables.key'), provider.missingKey ? t('variables.key.missing', { variable: provider.missingKey }) : needsKey ? t('variables.key.ok') : t('variables.key.notNeeded'), null, provider.missingKey ? 'bad' : 'ok'),
      row(t('variables.endpoint'), provider.url),
      h('div.var-effect.' + (provider.missingKey ? 'bad' : 'ok'), null, icon(provider.missingKey ? 'error' : 'check', 14), t(provider.missingKey ? 'variables.effect.bad' : 'variables.effect.ok')));
  }

  // ── bottom panel ───────────────────────────────────────────────────────────

  setPanelTab(id, byUser = false) {
    this.state.panelTab = id;
    if (byUser) { this.state.panelPinned = true; this.state.panelOpen = true; }
    this.panel.update();
  }

  setPanelOpen(open) {
    this.state.panelOpen = open;
    this.panel.update();
  }

  /** Explains an answer: what the feature's model recognised, and what this lesson ignores. */
  describeInsights(call) {
    const lines = [];
    (call.insights || []).forEach(insight => {
      const text = this.def.describeInsight ? this.def.describeInsight(insight, this.t) : null;
      if (text) lines.push(text);
    });
    const options = call.options || {};
    const simulated = this.def.simulates || {};
    const seeAlso = this.def.seeAlso || {};
    [['tools', (options.tools || []).length > 0], ['guardrails', (options.guardrails || []).length > 0],
      ['structuredOutput', Boolean(options.structuredOutput)], ['temperature', options.temperature != null]]
      .forEach(([key, used]) => {
        if (used && !simulated[key] && seeAlso[key]) lines.push(this.t('insight.ignored.' + key) + ' ' + this.t('check.notSimulated', { feature: this.t(seeAlso[key]) }));
      });
    return lines;
  }

  // ── running ────────────────────────────────────────────────────────────────

  setStatus(status, params = null) {
    this.state.status = status;
    this.state.statusParams = params;
    this.applyStatus();
  }

  applyStatus() {
    if (!this.runButton) return;
    const t = this.t;
    const { status, statusParams } = this.state;
    const running = status === 'running';
    const paused = status === 'paused' || status === 'waiting' || status === 'waiting-user' || status === 'dialog';
    clear(this.runButton).append(icon(running ? 'stop' : 'play', 14), h('span', null, t(running ? 'stop' : paused ? 'continue' : 'run')));
    this.runButton.title = running ? t('stop') : t('run.tip');
    this.runButton.classList.toggle('stop', running);
    this.stepButton.disabled = running;
    this.statusEl.textContent = status === 'idle' ? '' : t('status.' + status, statusParams || {});
    this.statusEl.className = 'run-status ' + status;
  }

  onRunButton() {
    if (this.state.status === 'running') this.stop();
    else this.run();
  }

  /** Starts a run, or continues a paused one. `step` pauses before every element. */
  async run({ step = false, runIndex = null, start = null } = {}) {
    if (this.runner.running) {
      if (!this.resume) return;
      this.runner.setStepMode(step);
      const resume = this.resume;
      this.resume = null;
      this.setStatus('running');
      resume();
      return;
    }
    if (this.state.tab !== 'process') this.setTab('process');
    const generation = ++this.runGeneration;
    Object.assign(this.visual, { active: null, error: null, toolActive: null, toolError: null });
    this.cancelEffects();
    this.data = {};
    this.panel.setData(this.data);
    this.state.panelPinned = false;
    this.setCaption('');
    this.refresh('all');
    this.setStatus('running');
    let result;
    try {
      // a process with several starts runs from the one that is selected, else from the first
      const selected = this.selected();
      const from = start || (selected && selected.type === 'RequestStart' ? selected.id : null);
      result = await this.runner.run({ variablesText: this.variablesText, stepMode: step, breakpoints: this.visual.breakpoints, runIndex, start: from });
    } catch (e) {
      console.error('[swInteractive] The simulated run stopped unexpectedly.', e);
      result = { status: 'failed', error: { kind: 'internal', message: String((e && e.message) || e) }, agentCalls: [], logs: [], visited: [] };
    }
    if (generation !== this.runGeneration) return;
    this.resume = null;
    const failedElement = result.failedAt ? elementById(this.model, result.failedAt) : null;
    if (result.status === 'failed') {
      this.visual.error = result.failedAt || null;
      if (failedElement) this.refresh(failedElement.id);
      if (result.error && result.error.kind === 'script') this.setCaption(this.t('note.script.failed', { message: result.error.message }));
      this.setStatus('failed', { name: failedElement ? failedElement.name || failedElement.typeLabel : '' });
    } else this.setStatus(result.status);
    if (!this.state.panelPinned && result.status !== 'cancelled') this.setPanelTab('log');
    this.emit({ type: 'run', result });
    return result;
  }

  stop() {
    if (!this.runner.running) return;
    this.runner.cancel();
    const resume = this.resume;
    this.resume = null;
    this.cancelEffects();
    if (resume) resume();
  }

  /**
   * The User Dialog of a user task, as far as the simulation has one: the question it was
   * started with, a field for the answer, and Submit. Resolves with { answer }.
   */
  openDialog(el, info) {
    const t = this.t;
    return new Promise(resolve => {
      const area = h('textarea.input.area', { rows: 3, spellcheck: false, 'aria-label': t('dialog.answer') });
      const box = h('div.task-dialog', { role: 'dialog', 'aria-label': info.name });
      const submit = () => {
        if (!this.dialog || this.dialog.box !== box) return;
        this.dialog = null;
        this.resume = null;
        box.remove();
        this.setStatus('running');
        resolve({ answer: area.value });
      };
      box.append(
        h('div.task-dialog-head', null, icon('list', 13), h('span', null, info.name)),
        h('p.task-dialog-question', null, info.question || t('dialog.noQuestion')),
        h('label.task-dialog-label', null, t('dialog.answer')), area,
        h('div.task-dialog-actions', null, h('button.run-btn.primary', { type: 'button', onclick: submit }, icon('check', 13), h('span', null, t('dialog.submit')))));
      this.overlayEl.append(box);
      this.dialog = { element: el, info, box, area, submit, setAnswer: value => { area.value = value; } };
      this.resume = submit; // "Continue" submits what has been typed
      this.setStatus('dialog', { name: info.name });
      if (this.data) this.panel.setData(this.data);
      if (this.runHooks) {
        // the walkthrough answers; if it has nothing to say, the dialog is submitted as it is
        Promise.resolve(this.hook('dialog:' + el.id, { element: el, ...info })).then(submit);
      } else area.focus({ preventScroll: true });
    });
  }

  /** Ends every animation on every canvas. */
  cancelEffects() {
    Object.keys(this.stages).forEach(doc => this.stages[doc].effects.cancelAll());
  }

  /** Clears the run and puts process and variables back to how the tutorial ships them. */
  reset() {
    this.runGeneration++;
    this.stop();
    this.cancelEffects();
    restore(this.model, this.model.original);
    this.variablesText = this.def.variables || '';
    this.sources.forEach(source => { this.sourceText[source.id] = source.text; });
    this.visual = freshVisual();
    this.data = null;
    this.panel.clearLog();
    this.panel.setCall(null, null);
    this.panel.setData(null);
    this.state.panelPinned = false;
    this.setPanelTab('log');
    this.setCaption('');
    this.setStatus('idle');
    this.refresh('all');
    Object.keys(this.stages).forEach(doc => {
      if (this.stages[doc] === this.viewStage()) this.stages[doc].fit({ animate: true });
      else this.stages[doc].needsFit = true;
    });
    this.renderTabs();
    this.renderVariables();
    this.renderSources();
    this.inscription.render();
    this.emit({ type: 'reset' });
  }

  createIo() {
    // Animation happens on the canvas of the element's file, and only while that file is the
    // open tab: a tool that runs behind the process tab runs at once.
    const shown = el => (this.state.tab === el.doc ? this.stages[el.doc].effects : null);
    const named = params => {
      const el = params && params.element;
      const target = params && params.target;
      return {
        name: el ? el.name || el.typeLabel : '',
        dataClass: this.model.dataClass.name,
        condition: (params && params.condition) || '',
        target: target ? target.name || target.typeLabel : '',
        user: (params && params.user) || '',
        code: (params && params.code) || '',
        tool: (params && params.tool) || ''
      };
    };
    return {
      travel: async connector => {
        await this.hook('after:' + connector.from.id, connector.from);
        const fx = shown(connector.from);
        if (fx) await fx.travel(connectorPath(connector));
        this.visual.connectors[connector.id] = (this.visual.connectors[connector.id] || 0) + 1;
        this.refresh('connectors');
      },
      enter: async el => {
        // while a tool runs, the agent that called it stays the active element of the process
        const slot = el.doc === 'process' ? 'active' : 'toolActive';
        const previous = this.visual[slot];
        this.visual[slot] = el.id;
        if (previous) this.refresh(previous);
        this.refresh(el.id);
        const fx = shown(el);
        if (fx) {
          fx.pulse(el, 'assistant');
          await fx.wait(el.kind === 'start' ? 320 : 220);
        }
        await this.hook('enter:' + el.id, el);
      },
      leave: (el, outcome) => {
        if (outcome === 'done') this.visual.executed[el.id] = (this.visual.executed[el.id] || 0) + 1;
        else this.visual[el.doc === 'process' ? 'error' : 'toolError'] = el.id;
        if (el.doc !== 'process' && el.kind === 'end') this.visual.toolActive = null;
        this.refresh(el.id);
      },
      pause: async (el, reason, info = {}) => {
        const waiting = new Promise(resolve => { this.resume = resolve; });
        const status = reason !== 'task' ? 'paused' : info.user ? 'waiting-user' : 'waiting';
        this.setStatus(status, { name: info.name || el.name || el.typeLabel, user: info.user || '' });
        if (this.data) this.panel.setData(this.data);
        if (this.runHooks) {
          // the walkthrough explains the stop, then carries on by itself
          await this.hook('pause:' + el.id, { element: el, reason, ...info });
          if (this.resume) {
            const go = this.resume;
            this.resume = null;
            this.setStatus('running');
            go();
          }
        }
        return waiting;
      },
      note: (key, params) => this.setCaption(this.t('note.' + key, named(params))),
      log: entry => {
        this.panel.addLog(entry);
        if (entry.category === 'USER' && !this.state.panelPinned) this.setPanelTab('log');
      },
      dialog: (el, info) => this.openDialog(el, info),
      // a script changed an Ivy variable: the simulation keeps its variables in variables.yaml
      variable: (name, value, text) => this.setVariables(text),
      data: (name, value) => {
        if (!this.data) return;
        this.data[name] = value;
        this.panel.setData(this.data, name);
      },
      agent: (phase, payload) => this.agentPhase(phase, payload)
    };
  }

  async agentPhase(phase, { call, element, ...p }) {
    const fx = this.stage.effects;
    const t = this.t;
    const showChat = () => { if (!this.state.panelPinned) this.setPanelTab('chat'); };
    switch (phase) {
      case 'request': {
        showChat();
        this.panel.setCall(call, 'request');
        this.setCaption(t('note.agent.request', { provider: call.provider, model: call.model }));
        await fx.agentOpen(element, { title: call.provider, subtitle: call.model });
        const packets = [];
        if (call.restored) {
          // a suspended conversation goes on: what is new is the human's answer and one fixed sentence
          const answered = call.steps[call.steps.length - 1];
          packets.push({ tone: 'tool', tag: 'result', text: oneLine(answered.result) }, { tone: 'user', tag: 'user', text: call.continuation });
          await fx.agentSend(packets);
          break;
        }
        if (call.system) packets.push({ tone: 'system', tag: 'system', text: firstLine(call.system) });
        if (firstLine(call.user)) packets.push({ tone: 'user', tag: 'user', text: firstLine(call.user) });
        (call.files || []).forEach(file => packets.push({ tone: 'user', tag: file.kind, text: file.name }));
        if ((call.tools || []).length) packets.push({ tone: 'tool', tag: 'tools', text: call.tools.map(tool => tool.name).join(', ') });
        await fx.agentSend(packets);
        break;
      }
      case 'tool-call':
        // the model does not answer yet: it asks the agent to run a tool
        showChat();
        this.panel.setCall(call, 'tool-call');
        this.setCaption(t('note.agent.tool-call', { name: p.step.name }));
        await fx.agentReceive({ tone: 'tool', tag: 'tool', text: toolCallText(p.step) });
        break;
      case 'tool-result':
        // 'agent:tool-done': the tool has finished, its result is not yet on its way to the model
        await this.hook('agent:tool-done', { call, element, ...p });
        this.panel.setCall(call, 'tool-result');
        this.setCaption(t('note.agent.tool-result', { name: p.step.name }));
        await fx.agentSend([{ tone: 'tool', tag: 'result', text: oneLine(p.step.result) }]);
        break;
      case 'thinking':
        this.panel.setCall(call, 'thinking');
        this.setCaption(t('note.agent.thinking'));
        await fx.agentThink(p.failing ? 800 : 1200, { failing: Boolean(p.failing) });
        break;
      case 'response':
        this.panel.setCall(call, 'response');
        this.setCaption(t('note.agent.response'));
        await fx.agentReceive({ tone: 'assistant', tag: 'assistant', text: firstLine(call.answer) });
        break;
      case 'mapped':
        this.panel.setCall(call, 'done');
        this.setCaption(t('note.agent.mapped', { target: p.target }));
        await fx.chip(element, '→ ' + p.target, 'assistant');
        break;
      case 'unmapped':
        this.panel.setCall(call, 'done');
        this.setCaption(t('note.agent.unmapped'));
        await fx.chip(element, t('chip.unmapped'), 'neutral');
        break;
      case 'map-failed':
        this.panel.setCall(call, 'done');
        this.setCaption(t('note.agent.map-failed', { target: p.target }));
        await fx.chip(element, t('chip.mapFailed'), 'error');
        break;
      case 'skipped':
        showChat();
        this.panel.setCall(call, 'skipped');
        this.setCaption(t('note.agent.skipped'));
        await fx.chip(element, t('chip.skipped'), 'neutral');
        break;
      case 'classify': {
        // an AI guardrail sends the message to the provider in a call of its own, before the
        // agent's call: a full round trip that answers YES (attack) or NO
        const c = p.classifier;
        const attack = String(c.verdict).trim().toUpperCase().startsWith('YES');
        showChat();
        this.setCaption(t('note.guard.classify', { name: p.name, provider: c.provider, model: c.model }));
        await fx.agentOpen(element, { title: c.provider, subtitle: t('fx.classifier', { model: c.model }), width: 236 });
        await fx.agentSend([
          { tone: 'system', tag: 'system', text: t('fx.classifier.prompt') },
          { tone: 'user', tag: 'user', text: firstLine(p.message) }
        ]);
        this.setCaption(t('note.guard.classifying'));
        await fx.agentThink(900);
        this.setCaption(t('note.guard.classified', { verdict: c.verdict }));
        await fx.agentReceive({ tone: attack ? 'error' : 'assistant', tag: 'classifier', text: String(c.verdict) });
        this.panel.setCall(call, 'guard'); // the conversation lists the classifier call with its answer
        await this.hook('agent:classify', { call, element, ...p });
        await fx.agentClose();
        return;
      }
      case 'guard': {
        // a guardrail has looked at the message: it passed, it was rewritten, or it is blocked
        const verdict = p.verdict;
        showChat();
        this.panel.setCall(call, 'guard');
        this.setCaption(t(!verdict.allowed ? 'note.guard.blocked' : verdict.rewritten != null ? 'note.guard.rewrote' : 'note.guard.passed', { name: p.name }));
        await fx.chip(element, (verdict.allowed ? '✓ ' : '✕ ') + p.name, verdict.allowed ? 'assistant' : 'error');
        break;
      }
      case 'suspended':
        // a tool threw an error on purpose: the agent stops here and waits for a human
        showChat();
        this.panel.setCall(call, 'suspended');
        this.setCaption(t('note.agent.suspended', { name: p.step.name }));
        if (fx.agent) { await fx.wait(600); await fx.agentClose(); }
        await fx.chip(element, t('chip.suspended'), 'tool');
        break;
      case 'blocked':
        showChat();
        this.panel.setCall(call, 'blocked');
        this.setCaption(t('note.agent.blocked', { name: p.name }));
        if (fx.agent) { await fx.wait(700); await fx.agentClose(); }
        break;
      case 'failed':
        showChat();
        this.panel.setCall(call, 'failed');
        this.setCaption(p.kind === 'auth' ? t('note.agent.failed.auth', { provider: call.provider }) : t('note.agent.failed', { message: p.message || call.error || '' }));
        if (fx.agent) { await fx.wait(900); await fx.agentClose(); }
        else await fx.chip(element, t('chip.failed'), 'error');
        break;
      case 'end':
        await fx.agentClose();
        break;
      default:
    }
    await this.hook('agent:' + phase, { call, element, ...p });
  }

  // ── language and teardown ──────────────────────────────────────────────────

  setLanguage(lang) {
    const next = normalizeLanguage(lang);
    if (next === this.lang) return;
    this.lang = next;
    this.t = createTranslator(next, this.def.strings);
    this.setCaption('');
    this.renderChrome();
    this.refresh('all');
  }

  dispose() {
    this.disposed = true;
    this.runGeneration++;
    this.stop();
    this.toastTimers.forEach(timer => clearTimeout(timer));
    Object.values(this.views).forEach(view => view.dispose && view.dispose());
    this.detachControllers.forEach(detach => detach());
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.tour.dispose();
    Object.keys(this.stages).forEach(doc => this.stages[doc].dispose());
    clear(this.root);
  }
}

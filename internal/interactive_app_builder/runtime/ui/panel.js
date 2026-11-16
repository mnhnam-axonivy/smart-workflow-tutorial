/**
 * The panel below the editor: the Axon Ivy Runtime Log, the conversation of the last agent
 * call, and the process data — the three places where a run becomes visible.
 */
import { h, clear, toolCallText } from '../util.js';
import { formatTemperature } from '../model/providers.js';
import { icon } from './icons.js';

const pad = (n, width = 2) => String(n).padStart(width, '0');
const shortType = type => String(type || 'String').split('.').pop();

export function formatTime(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
    pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds()) + '.' + pad(date.getMilliseconds(), 3);
}

/** Message text with URLs marked up, as the log viewer does. */
function logMessage(text) {
  const parts = [];
  let last = 0;
  const pattern = /https?:\/\/[^\s)]+/g;
  let m;
  while ((m = pattern.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(h('span.log-url', null, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export class BottomPanel {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.logs = [];
    this.call = null;
    this.phase = null;
    this.data = null;
    this.changed = null;
    this.typing = 0;
    this.render();
  }

  render() {
    const { app } = this;
    const t = app.t;
    clear(this.root);
    const tabs = [['log', 'list', t('panel.log')], ['chat', 'chat', t('panel.chat')], ['data', 'braces', t('panel.data')]];
    this.tabButtons = {};
    this.counter = h('span.panel-count');
    const head = h('div.panel-head', { role: 'tablist' },
      tabs.map(([id, iconName, label]) => {
        const button = h('button.panel-tab', { type: 'button', role: 'tab', 'data-tab': id, onclick: () => app.setPanelTab(id, true) },
          icon(iconName, 13), h('span', null, label), id === 'log' ? this.counter : null);
        this.tabButtons[id] = button;
        return button;
      }),
      h('span.spacer'),
      h('button.icon-btn', { type: 'button', title: t('panel.clear'), 'aria-label': t('panel.clear'), onclick: () => this.clearLog() }, icon('trash', 14)),
      h('button.icon-btn.panel-toggle', { type: 'button', title: t('panel.toggle'), 'aria-label': t('panel.toggle'), onclick: () => app.setPanelOpen(!app.state.panelOpen) }, icon('chevronDown', 14)));
    this.logView = h('div.panel-view.log', { role: 'log', tabIndex: 0 });
    this.chatView = h('div.panel-view.chat', { tabIndex: 0 });
    this.dataView = h('div.panel-view.data', { tabIndex: 0 });
    this.root.append(head, h('div.panel-body', null, this.logView, this.chatView, this.dataView));
    this.renderLog();
    this.renderChat();
    this.renderData();
    this.update();
  }

  /** Reflects the app state (active tab, open/closed). */
  update() {
    const { panelTab, panelOpen } = this.app.state;
    Object.keys(this.tabButtons).forEach(id => {
      this.tabButtons[id].classList.toggle('active', id === panelTab);
      this.tabButtons[id].setAttribute('aria-selected', String(id === panelTab));
    });
    this.logView.hidden = panelTab !== 'log';
    this.chatView.hidden = panelTab !== 'chat';
    this.dataView.hidden = panelTab !== 'data';
    this.root.classList.toggle('collapsed', !panelOpen);
    if (panelTab === 'log') this.logView.scrollTop = this.logView.scrollHeight;
  }

  // ── Runtime log ────────────────────────────────────────────────────────────

  logLine(entry) {
    const line = h('div.log-line', null,
      h('span.log-time', null, formatTime(entry.time)), ' ',
      h('span.log-level.' + entry.level, null, '[' + entry.level + ']'), ' ',
      '[' + entry.project + '] ', entry.category ? '[' + entry.category + '] ' : '',
      h('span.log-ctx', null, '[' + entry.context + ']'), ' ',
      logMessage(entry.message));
    return entry.detail ? [line, h('div.log-detail', null, entry.detail)] : [line];
  }

  renderLog() {
    clear(this.logView);
    if (!this.logs.length) this.logView.append(h('div.panel-empty', null, this.app.t('log.empty')));
    else this.logs.forEach(entry => this.logView.append(...this.logLine(entry)));
    this.counter.textContent = this.logs.length ? String(this.logs.length) : '';
    this.counter.hidden = !this.logs.length;
  }

  addLog(entry) {
    if (!this.logs.length) clear(this.logView);
    this.logs.push(entry);
    this.logView.append(...this.logLine(entry));
    this.logView.scrollTop = this.logView.scrollHeight;
    this.counter.textContent = String(this.logs.length);
    this.counter.hidden = false;
  }

  clearLog() {
    this.logs = [];
    this.renderLog();
  }

  // ── Agent conversation ─────────────────────────────────────────────────────

  /** Shows the given agent call in its current phase ('request', 'thinking', 'response', …). */
  setCall(call, phase) {
    this.call = call;
    this.phase = phase;
    this.renderChat(phase === 'response');
  }

  renderChat(typewriter = false) {
    const { app } = this;
    const t = app.t;
    const call = this.call;
    cancelAnimationFrame(this.typing);
    clear(this.chatView);
    if (!call) { this.chatView.append(h('div.panel-empty', null, t('chat.empty'))); return; }

    if (call.status === 'skipped') {
      this.chatView.append(h('div.chat-note.warning', null, icon('warning', 14), h('span', null, t('chat.skipped') + (call.queryError ? ' ' + call.queryError : ''))));
      return;
    }
    if (call.restored) {
      this.chatView.append(h('div.chat-note.info', null, icon('info', 14), h('span', null, t('chat.restored', { id: call.memoryId }))));
    }
    if (call.provider) {
      this.chatView.append(h('div.chat-head', null, icon('spark', 14),
        h('strong', null, call.provider), h('span', null, call.model),
        call.temperature !== undefined ? h('span.chat-temp', null, 'temperature ' + formatTemperature(call.temperature)) : null,
        h('span.chat-url', null, 'POST ' + call.url)));
    }
    if (call.user !== undefined) {
      this.chatView.append(call.system
        ? h('div.msg.system', null, h('div.msg-role', null, t('chat.system')), h('div.msg-text', null, call.system))
        : h('div.msg.system.none', null, h('div.msg-role', null, t('chat.system')), h('div.msg-text', null, t('chat.noSystem'))));
      const userText = h('div.msg-text');
      (call.userParts || [{ type: 'text', value: call.user }]).forEach(part => {
        const code = '<%=' + part.code + '%>';
        if (part.type === 'file') userText.append(h('span.file-chip', { title: code }, icon('yaml', 12), part.name, h('span.file-mime', null, part.mime)));
        else if (part.type === 'missing') userText.append(h('span.file-chip.missing', { title: code }, icon('warning', 12), t('chat.noFile', { path: part.path })));
        else if (part.type === 'expr') userText.append(h('span.resolved', { title: t('chat.resolved', { code }) }, part.value));
        else userText.append(part.value);
      });
      const guardLine = g => {
        const what = !g.allowed ? t('chat.guard.blocked', { reason: g.reason })
          : g.masked ? t('chat.guard.masked', { n: g.masked })
            : g.restored ? t('chat.guard.restored', { n: g.restored })
              : g.rewritten != null ? t('chat.guard.rewrote') : t('chat.guard.passed');
        return h('div.guard.' + (g.allowed ? 'ok' : 'bad'), null, icon(g.allowed ? 'check' : 'error', 12),
          h('span', null, h('strong', null, g.name), ' ' + what + (g.classifier && g.classifier.verdict ? ' ' + t('chat.guard.classifier', { provider: g.classifier.provider, model: g.classifier.model, verdict: g.classifier.verdict }) : '')));
      };
      const guards = side => (call.guardrails || []).filter(g => g.side === side);
      if (call.userOriginal !== undefined) {
        this.chatView.append(h('div.msg.user.before', null, h('div.msg-role', null, t('chat.user.before')), h('div.msg-text', null, call.userOriginal)));
      }
      if (guards('input').length) this.chatView.append(h('div.guards', null, h('div.msg-role', null, t('chat.guard.input')), guards('input').map(guardLine)));
      this.guardLine = guardLine;
      this.chatView.append(h('div.msg.user', null, h('div.msg-role', null, t(call.userOriginal !== undefined ? 'chat.user.sent' : 'chat.user')), userText));
      if (call.schema) {
        this.chatView.append(h('div.msg.schema', null, h('div.msg-role', null, t('chat.schema', { name: call.schema.name })),
          h('div.msg-text', null, call.schema.fields.map(f => f.name + ': ' + shortType(f.type)).join('\n'))));
      }
      // the tools that go with the request: name, parameters and description of each
      if (call.tools && call.tools.length) {
        this.chatView.append(h('div.msg.tools', null, h('div.msg-role', null, t('chat.tools')),
          h('div.msg-text', null, call.tools.map(tool => h('div.tool-spec', null,
            h('code', null, tool.name + '(' + tool.params.map(p => p.name + ': ' + shortType(p.type)).join(', ') + ')'),
            h('span', null, tool.description))))));
      }
      if (call.toolsNotFound && call.toolsNotFound.length) {
        this.chatView.append(h('div.chat-note.warning', null, icon('warning', 14), h('span', null, t('chat.toolsNotFound', { list: call.toolsNotFound.join(', ') }))));
      }
      // what happened before the final answer: the model asked for a tool, the tool answered
      (call.steps || []).forEach(step => {
        this.chatView.append(h('div.msg.toolcall', null, h('div.msg-role', null, t('chat.toolCall')), h('div.msg-text', null, toolCallText(step))));
        if (step.result !== undefined) {
          this.chatView.append(h('div.msg.tool', null,
            h('div.msg-role', null, t('chat.toolResult', { name: step.name }), step.human ? h('span.msg-tag', null, t('chat.human')) : null),
            h('div.msg-text', null, step.result)));
        }
      });
      if (call.continuation) {
        this.chatView.append(h('div.msg.user', null, h('div.msg-role', null, t('chat.user')), h('div.msg-text', null, call.continuation)));
      }
    }

    const outputGuards = (call.guardrails || []).filter(g => g.side === 'output');
    if (call.status === 'suspended') {
      this.chatView.append(h('div.chat-note.warning', null, icon('warning', 14), h('span', null, t('chat.suspended', { id: call.memoryId }))));
    } else if (call.status === 'blocked') {
      // an input guardrail stops the call before the model; an output guardrail discards the answer
      if (call.blockedBy.side === 'output') {
        this.chatView.append(h('div.msg.assistant.discarded', null,
          h('div.msg-role', null, t('chat.assistant'), h('span.msg-tag.bad', null, t('chat.discarded'))), h('div.msg-text', null, call.answer || '')));
        this.chatView.append(h('div.guards', null, h('div.msg-role', null, t('chat.guard.output')), outputGuards.map(this.guardLine)));
      }
      this.chatView.append(h('div.chat-note.error', null, icon('error', 14), h('span', null, t('chat.blocked', { side: call.blockedBy.side, message: call.error || '' }))));
    } else if (call.status === 'failed') {
      this.chatView.append(h('div.chat-note.error', null, icon('error', 14), h('span', null, t('chat.failed', { message: call.error || '' }))));
    } else if (call.answer === undefined) {
      if (this.phase === 'thinking' || this.phase === 'request') {
        this.chatView.append(h('div.msg.assistant.pending', null, h('div.msg-role', null, t('chat.assistant')), h('div.msg-text', null, t('chat.thinking'))));
      }
    } else {
      const text = h('div.msg-text');
      const foot = h('div.msg-foot');
      this.chatView.append(h('div.msg.assistant', null,
        h('div.msg-role', null, t('chat.assistant'), h('span.msg-tag', null, t('chat.simulated'))), text, foot));
      if (call.answerFromModel !== undefined) {
        this.chatView.insertBefore(h('div.msg.assistant.before', null, h('div.msg-role', null, t('chat.assistant.before')), h('div.msg-text', null, call.answerFromModel)), this.chatView.lastChild);
      }
      if (outputGuards.length) {
        this.chatView.insertBefore(h('div.guards', null, h('div.msg-role', null, t('chat.guard.output')), outputGuards.map(this.guardLine)), this.chatView.lastChild);
      }
      const finish = () => {
        text.textContent = call.answer;
        clear(foot);
        if (call.mapping === 'mapped') foot.append(h('span.ok', null, icon('check', 12), t('chat.mapped', { target: call.mapTarget })));
        else if (call.mapping === 'none') foot.append(h('span.warn', null, icon('warning', 12), t('chat.unmapped')));
        else if (call.mapping === 'failed') foot.append(h('span.err', null, icon('error', 12), t('chat.mapFailed', { target: call.mapTarget, message: call.mappingError })));
      };
      if (typewriter && !app.reducedMotion) {
        const started = performance.now();
        const duration = Math.min(1100, 260 + call.answer.length * 5) / (app.stage.effects.speed || 1);
        const tick = now => {
          const k = Math.min(1, (now - started) / duration);
          text.textContent = call.answer.slice(0, Math.round(call.answer.length * k));
          if (k < 1) this.typing = requestAnimationFrame(tick);
          else finish();
        };
        this.typing = requestAnimationFrame(tick);
      } else finish();

      const insights = app.describeInsights(call);
      if (insights.length) {
        this.chatView.append(h('div.insights', null,
          h('div.insights-title', null, icon('bulb', 13), t('chat.why')),
          h('ul', null, insights.map(line => h('li', null, line)))));
      }
    }
    if (typewriter || this.phase === 'request' || /^tool/.test(this.phase || '')) this.chatView.scrollTop = this.phase === 'request' ? 0 : this.chatView.scrollHeight;
  }

  // ── Process data ───────────────────────────────────────────────────────────

  setData(data, changedField = null) {
    this.data = data;
    this.changed = changedField;
    this.renderData();
  }

  /** A value of the process data: text, or the fields of a data class object. */
  dataValue(value) {
    if (!(value && typeof value === 'object' && value.__type)) return h('pre.data-value', null, String(value));
    const cls = this.app.model.classes[value.__type];
    const fields = cls ? cls.fields : Object.keys(value).filter(k => !k.startsWith('__')).map(name => ({ name, type: '' }));
    return h('table.data-object', null, h('tbody', null, fields.map(f => {
      const v = value[f.name];
      return h('tr', null,
        h('td', null, h('code', null, f.name)),
        h('td', { title: f.type }, f.type ? shortType(f.type) : ''),
        h('td', null, v === null || v === undefined ? h('span.muted', null, 'null') : String(v)));
    })));
  }

  renderData() {
    const { app } = this;
    const t = app.t;
    clear(this.dataView);
    if (!this.data) { this.dataView.append(h('div.panel-empty', null, t('data.empty'))); return; }
    const dataClass = app.model.dataClass;
    this.dataView.append(
      h('div.data-class', null, icon('braces', 13), h('code', null, 'in'), h('span', null, dataClass.name)),
      h('table.data-table', null,
        h('thead', null, h('tr', null, h('th', null, t('data.field')), h('th', null, t('data.type')), h('th', null, t('data.value')))),
        h('tbody', null, dataClass.fields.map(f => {
          const value = this.data[f.name];
          const empty = value === undefined || value === null || value === '';
          return h('tr' + (this.changed === f.name ? '.changed' : ''), { 'data-field': f.name },
            h('td', null, h('code', null, f.name), f.comment ? h('div.data-comment', null, f.comment) : null),
            h('td', { title: f.type }, shortType(f.type)),
            h('td', null, empty ? h('span.muted', null, t('data.unset')) : this.dataValue(value)));
        }))));
  }
}

/**
 * Form widgets of the simulated inscription view: collapsible sections, macro and script
 * inputs, a small code editor and a multi-select. Each returns a DOM element (plus a few
 * methods where the caller needs them).
 */
import { h, clear, escapeHtml, openPopover } from '../util.js';
import { icon } from './icons.js';
import { parseMacro } from '../model/macro.js';

function autosize(textarea, minRows = 1) {
  if (!textarea.isConnected || textarea.hidden) return;
  textarea.style.height = 'auto';
  const line = parseFloat(getComputedStyle(textarea).lineHeight) || 18;
  textarea.style.height = Math.max(textarea.scrollHeight + 2, minRows * line + 12) + 'px';
}

const later = fn => requestAnimationFrame(fn);

// ── Where characters are on screen ───────────────────────────────────────────
// The walkthrough points at the exact text it is about to change. Every text control has
// `textRect(start, end)`: the box around those characters of its value in client
// coordinates (width 0 for a caret position), or null when it cannot tell.

let ruler = null;

/** Characters [start, end) of a one-line input, measured in the input's own font. */
function inputTextRect(input, start, end) {
  if (!ruler) ruler = document.createElement('canvas').getContext('2d');
  const box = input.getBoundingClientRect();
  if (!ruler || !box.height) return null;
  const style = getComputedStyle(input);
  ruler.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
  const origin = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft) - input.scrollLeft;
  const at = n => Math.max(box.left + 2, Math.min(box.right - 2, origin + ruler.measureText(input.value.slice(0, n)).width));
  const left = at(start);
  return { left, top: box.top + 4, width: Math.max(0, at(end) - left), height: box.height - 8 };
}

/** Characters [lo, hi) of one text node; with lo === hi, the caret position there. */
function nodeTextRect(node, lo, hi) {
  const text = node.data;
  const range = document.createRange();
  const measured = (a, b) => {
    range.setStart(node, a);
    range.setEnd(node, b);
    const r = range.getBoundingClientRect();
    return r.height ? r : null;
  };
  if (lo < hi) return measured(lo, hi);
  // a caret has no box of its own: take the edge of the character after or before it
  if (lo < text.length && text[lo] !== '\n') {
    const r = measured(lo, lo + 1);
    return r && { left: r.left, top: r.top, width: 0, height: r.height };
  }
  if (lo > 0 && text[lo - 1] !== '\n') {
    const r = measured(lo - 1, lo);
    return r && { left: r.right, top: r.top, width: 0, height: r.height };
  }
  return null;
}

function unionRect(rects) {
  const list = rects.filter(Boolean);
  if (!list.length) return null;
  const left = Math.min(...list.map(r => r.left));
  const top = Math.min(...list.map(r => r.top));
  return {
    left,
    top,
    width: Math.max(...list.map(r => r.left + r.width)) - left,
    height: Math.max(...list.map(r => r.top + r.height)) - top
  };
}

/**
 * Characters [start, end) of text shown as DOM nodes. `pieces` lists where each stretch of
 * the value is: { start, end, node, shift } — `shift` characters of it are not in the node.
 */
function piecesTextRect(pieces, start, end) {
  const inside = (piece, n) => Math.max(0, Math.min(piece.node.data.length, n - piece.start - piece.shift));
  if (start === end) {
    const piece = pieces.find(p => start >= p.start && start <= p.end && p.node.data.length);
    return piece ? nodeTextRect(piece.node, inside(piece, start), inside(piece, start)) : null;
  }
  return unionRect(pieces.filter(p => p.start < end && p.end > start && inside(p, start) < inside(p, end))
    .map(p => nodeTextRect(p.node, inside(p, start), inside(p, end))));
}

// ── Structure ────────────────────────────────────────────────────────────────

/** Collapsible group with a title bar, like the groups in the inscription view. */
export function section({ title, open = false, onToggle }, ...children) {
  const head = h('button.section-head', { type: 'button', 'aria-expanded': String(open) },
    h('span.section-title', null, title), icon(open ? 'chevronDown' : 'chevronRight', 14));
  const body = h('div.section-body', null, ...children);
  const el = h('div.section' + (open ? '.open' : ''), null, head, body);
  head.addEventListener('click', () => {
    const now = !el.classList.contains('open');
    el.classList.toggle('open', now);
    head.setAttribute('aria-expanded', String(now));
    head.replaceChild(icon(now ? 'chevronDown' : 'chevronRight', 14), head.lastChild);
    if (onToggle) onToggle(now);
    if (now) body.querySelectorAll('textarea').forEach(t => autosize(t));
  });
  return el;
}

/** Label + control + message line. `el.setMessage(type, text)` shows validation feedback. */
export function field(label, control, { help } = {}) {
  const message = h('div.field-msg');
  const el = h('div.field', null,
    label ? h('div.field-label', null, label, help ? h('span.field-help', { title: help, tabIndex: 0, role: 'img', 'aria-label': help }, icon('info', 12)) : null) : null,
    control, message);
  el.setMessage = (type, text) => {
    message.className = 'field-msg' + (text ? ' ' + type : '');
    clear(message);
    if (text) message.append(icon(type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info', 12), h('span', null, text));
    el.classList.toggle('invalid', Boolean(text) && type === 'error');
  };
  return el;
}

export function note(text) {
  return h('p.field-note', null, text);
}

// ── Plain inputs ─────────────────────────────────────────────────────────────

export function textBox({ value = '', rows = 1, readOnly = false, placeholder = '', mono = false, onInput } = {}) {
  if (rows <= 1) {
    const input = h('input.input' + (mono ? '.mono' : ''), {
      type: 'text', value, readOnly, placeholder, spellcheck: false,
      oninput: e => onInput && onInput(e.target.value)
    });
    input.setValue = v => { input.value = v; };
    input.textRect = (start, end) => inputTextRect(input, start, end);
    return input;
  }
  const area = h('textarea.input.area' + (mono ? '.mono' : ''), { value, readOnly, placeholder, spellcheck: false, rows });
  area.addEventListener('input', () => { autosize(area, rows); if (onInput) onInput(area.value); });
  later(() => autosize(area, rows));
  return area;
}

export function checkbox({ checked = false, label, disabled = false, onChange }) {
  const input = h('input', { type: 'checkbox', checked, disabled, onchange: e => onChange && onChange(e.target.checked) });
  return h('label.check' + (disabled ? '.disabled' : ''), null, input, h('span', null, label));
}

// ── Attribute browser (inserts process data fields) ──────────────────────────

function attributeMenu(layer, anchor, attributes, title, choose) {
  const list = h('div.menu', null,
    h('div.menu-title', null, title),
    attributes.map(a => h('button.menu-item', { type: 'button', onclick: () => { close(); choose(a); } },
      h('span.menu-main', null, h('code', null, a.code), h('span.menu-type', null, a.type)),
      a.comment ? h('span.menu-desc', null, a.comment) : null)));
  const close = openPopover(layer, anchor, list, { align: 'right' });
  return close;
}

// ── Macro area: text with <%= expression %> parts shown as chips ─────────────

/**
 * @param {Object} o
 * @param {string} o.value
 * @param {number} [o.minRows]
 * @param {{code:string,type:string,comment:string}[]} [o.attributes]  offered by the browser button
 * @param {string} [o.browseTitle]
 * @param {HTMLElement} o.layer  popover layer
 * @param {(value:string)=>void} o.onInput
 */
export function macroArea({ value = '', minRows = 1, placeholder = '', attributes = [], browseTitle = '', layer, onInput }) {
  let current = value;
  let caret = [value.length, value.length];
  const view = h('div.macro-view', { tabIndex: 0, role: 'textbox', 'aria-multiline': 'true' });
  const edit = h('textarea.macro-edit', { spellcheck: false, rows: minRows, placeholder, hidden: true });
  const browse = attributes.length ? h('button.field-browse', { type: 'button', title: browseTitle, 'aria-label': browseTitle }, icon('code', 13)) : null;
  const box = h('div.macro', { style: { minHeight: minRows * 18 + 14 + 'px' } }, view, edit, browse);

  let pieces = []; // where each stretch of the value is shown (see piecesTextRect)
  const renderView = () => {
    clear(view);
    pieces = [];
    const parts = parseMacro(current);
    if (!parts.length) { view.append(h('span.placeholder', null, placeholder)); return; }
    let at = 0;
    parts.forEach(p => {
      const raw = p.type === 'text' ? p.value : p.raw;
      const node = document.createTextNode(p.type === 'text' ? p.value : p.code);
      // a chip shows the expression without its <%= %> brackets
      pieces.push({ start: at, end: at + raw.length, node, shift: p.type === 'text' ? 0 : Math.max(0, raw.indexOf(p.code, 3)) });
      view.append(p.type === 'text' ? node : h('span.chip', { title: p.raw }, icon('code', 11), node));
      at += raw.length;
    });
  };
  const startEdit = () => {
    if (!edit.hidden) return;
    edit.value = current;
    edit.hidden = false;
    view.hidden = true;
    box.classList.add('editing');
    autosize(edit, minRows);
    edit.focus();
  };
  const stopEdit = () => {
    caret = [edit.selectionStart, edit.selectionEnd];
    edit.hidden = true;
    view.hidden = false;
    box.classList.remove('editing');
    renderView();
  };
  view.addEventListener('focus', startEdit);
  view.addEventListener('click', startEdit);
  edit.addEventListener('blur', stopEdit);
  edit.addEventListener('input', () => {
    current = edit.value;
    autosize(edit, minRows);
    onInput(current);
  });
  if (browse) {
    browse.addEventListener('pointerdown', e => e.preventDefault()); // keep the caret where it is
    browse.addEventListener('click', () => {
      if (!edit.hidden) caret = [edit.selectionStart, edit.selectionEnd];
      attributeMenu(layer, browse, attributes, browseTitle, a => {
        startEdit();
        edit.setRangeText('<%=' + a.code + '%>', Math.min(caret[0], edit.value.length), Math.min(caret[1], edit.value.length), 'end');
        edit.dispatchEvent(new Event('input'));
      });
    });
  }
  renderView();
  box.setValue = v => { current = v; if (edit.hidden) renderView(); else edit.value = v; };
  box.textRect = (start, end) => (edit.hidden ? piecesTextRect(pieces, start, end) : null);
  box.focusEditor = startEdit;
  return box;
}

// ── Script input: one line of IvyScript ──────────────────────────────────────

export function scriptInput({ value = '', placeholder = '', attributes = [], browseTitle = '', layer, onInput }) {
  const input = h('input.input.mono.script-input', { type: 'text', value, placeholder, spellcheck: false, autocomplete: 'off' });
  input.addEventListener('input', () => onInput(input.value));
  const browse = attributes.length ? h('button.field-browse', { type: 'button', title: browseTitle, 'aria-label': browseTitle }, icon('code', 13)) : null;
  if (browse) {
    browse.addEventListener('click', () => {
      attributeMenu(layer, browse, attributes, browseTitle, a => {
        input.value = a.code;
        input.dispatchEvent(new Event('input'));
        input.focus();
      });
    });
  }
  const box = h('div.script', null, input, browse);
  box.setValue = v => { input.value = v; };
  box.textRect = (start, end) => inputTextRect(input, start, end);
  box.input = input;
  return box;
}

// ── Code editor: textarea over a highlighted copy, with line numbers ─────────

const HIGHLIGHT = {
  ivyscript(source) {
    const pattern = /("(?:[^"\\\n]|\\.)*"?)|(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(\b\d+(?:\.\d+)?\b)|(\b(?:in|out|ivy)\b(?:\.[A-Za-z_]\w*)*)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = pattern.exec(source))) {
      out += escapeHtml(source.slice(last, m.index));
      const cls = m[1] ? 'tk-str' : m[2] ? 'tk-com' : m[3] ? 'tk-num' : 'tk-id';
      out += '<span class="' + cls + '">' + escapeHtml(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + escapeHtml(source.slice(last));
  },
  java(source) {
    const pattern = /("""[\s\S]*?(?:"""|$)|"(?:[^"\\\n]|\\.)*"?)|(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(\b\d+(?:\.\d+)?\b)|(@\w+)|(\b(?:package|import|public|private|protected|static|final|class|interface|implements|extends|return|new|if|else|for|while|try|catch|throw|throws|void|double|int|boolean|long|null|true|false)\b)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = pattern.exec(source))) {
      out += escapeHtml(source.slice(last, m.index));
      const cls = m[1] ? 'tk-str' : m[2] ? 'tk-com' : m[3] ? 'tk-num' : m[4] ? 'tk-ann' : 'tk-key';
      out += '<span class="' + cls + '">' + escapeHtml(m[0]) + '</span>';
      last = m.index + m[0].length;
    }
    return out + escapeHtml(source.slice(last));
  },
  text(source) {
    return escapeHtml(source);
  },
  yaml(source) {
    return source.split('\n').map(line => {
      const comment = /(^|\s)#.*$/.exec(line);
      const code = comment ? line.slice(0, comment.index + comment[1].length) : line;
      const tail = comment ? '<span class="tk-com">' + escapeHtml(line.slice(code.length)) + '</span>' : '';
      const kv = /^(\s*)([^:#\s][^:#]*?)(:)(\s*)(.*)$/.exec(code);
      if (!kv) return escapeHtml(code) + tail;
      const value = kv[5] ? '<span class="tk-str">' + escapeHtml(kv[5]) + '</span>' : '';
      return escapeHtml(kv[1]) + '<span class="tk-key">' + escapeHtml(kv[2]) + '</span>' + kv[3] + escapeHtml(kv[4]) + value + tail;
    }).join('\n');
  }
};

/**
 * @param {Object} o
 * @param {string} o.value
 * @param {'ivyscript'|'yaml'|'java'|'text'} o.language
 * @param {(value:string)=>void} o.onInput
 * @returns {HTMLElement & { setValue(v:string):void, setMarkers(m:{line:number,message:string}[]):void, textarea:HTMLTextAreaElement }}
 */
export function codeEditor({ value = '', language = 'ivyscript', onInput, label = '' }) {
  const gutter = h('div.code-gutter', { 'aria-hidden': 'true' });
  const highlight = h('pre.code-hl', { 'aria-hidden': 'true' });
  const textarea = h('textarea.code-input', { spellcheck: false, wrap: 'off', autocapitalize: 'off', autocomplete: 'off', 'aria-label': label });
  textarea.value = value;
  const el = h('div.code', null, gutter, h('div.code-body', null, highlight, textarea));
  let markers = [];

  const render = () => {
    const text = textarea.value;
    highlight.innerHTML = HIGHLIGHT[language](text) + '\n';
    const lines = text.split('\n').length;
    if (gutter.childElementCount !== lines) {
      clear(gutter);
      for (let i = 1; i <= lines; i++) gutter.appendChild(h('div.code-line', null, String(i)));
    }
    [...gutter.children].forEach((node, i) => {
      const marker = markers.find(m => m.line === i + 1);
      node.classList.toggle('marked', Boolean(marker));
      node.title = marker ? marker.message : '';
    });
  };
  textarea.addEventListener('input', () => { render(); if (onInput) onInput(textarea.value); });
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      textarea.setRangeText('  ', textarea.selectionStart, textarea.selectionEnd, 'end');
      textarea.dispatchEvent(new Event('input'));
    }
  });
  render();
  el.setValue = v => { textarea.value = v; render(); };
  el.setMarkers = m => { markers = m || []; render(); };
  el.textRect = (start, end) => {
    // the highlighted copy holds the same characters, split over the spans of its tokens
    const pieces = [];
    const walker = document.createTreeWalker(highlight, NodeFilter.SHOW_TEXT);
    let at = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      pieces.push({ start: at, end: at + node.data.length, node, shift: 0 });
      at += node.data.length;
    }
    const r = piecesTextRect(pieces, start, end);
    if (!r) return null;
    // only the part the editor shows
    const outer = el.getBoundingClientRect();
    const minLeft = gutter.getBoundingClientRect().right;
    const left = Math.max(minLeft, Math.min(outer.right, r.left));
    const top = Math.max(outer.top, Math.min(outer.bottom, r.top));
    const right = Math.max(left, Math.min(outer.right, r.left + r.width));
    const bottom = Math.min(outer.bottom, r.top + r.height);
    return bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
  };
  el.textarea = textarea;
  return el;
}

// ── Multi-select ─────────────────────────────────────────────────────────────

/**
 * @param {Object} o
 * @param {string[]} o.values
 * @param {{value:string,label?:string,icon?:string,description?:string}[]} o.options
 * @param {(values:string[])=>void} o.onChange
 */
export function multiSelect({ values = [], options = [], placeholder = '', emptyText = '', layer, onChange }) {
  let selected = values.slice();
  const chips = h('span.select-chips');
  const box = h('button.select', { type: 'button', 'aria-haspopup': 'listbox' }, chips, icon('chevronDown', 14));
  const label = value => {
    const o = options.find(x => x.value === value);
    return (o && o.icon ? o.icon + ' ' : '') + (o ? o.label || o.value : value);
  };
  const render = () => {
    clear(chips);
    if (!selected.length) chips.append(h('span.placeholder', null, placeholder));
    selected.forEach(v => chips.append(h('span.chip.plain', null, label(v))));
  };
  box.addEventListener('click', () => {
    const list = h('div.menu.menu-check', { role: 'listbox', 'aria-multiselectable': 'true' },
      options.length ? options.map(o => {
        const input = h('input', { type: 'checkbox', checked: selected.includes(o.value) });
        input.addEventListener('change', () => {
          selected = options.map(x => x.value).filter(v => (v === o.value ? input.checked : selected.includes(v)));
          render();
          onChange(selected.slice());
        });
        return h('label.menu-item', null, input,
          h('span.menu-main', null, (o.icon ? o.icon + ' ' : '') + (o.label || o.value)),
          o.description ? h('span.menu-desc', null, o.description) : null);
      }) : h('div.menu-empty', null, emptyText));
    openPopover(layer, box, list);
  });
  render();
  box.setValues = v => { selected = v.slice(); render(); };
  return box;
}

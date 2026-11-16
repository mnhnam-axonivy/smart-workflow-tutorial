/** Small DOM and event helpers shared by the UI modules. */

/**
 * Creates an element: h('button.icon-btn', { title: 'Run', onclick: fn }, 'Run').
 * Keys with a dash, `role` and `for` become attributes; everything else a property.
 */
export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props) {
    Object.keys(props).forEach(key => {
      const value = props[key];
      if (value == null || value === false) return;
      if (key === 'class') el.className += (el.className ? ' ' : '') + value;
      else if (key === 'style') Object.assign(el.style, value);
      else if (key === 'html') el.innerHTML = value;
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (key.includes('-') || key === 'role' || key === 'for') el.setAttribute(key, value === true ? '' : value);
      else el[key] = value;
    });
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  children.forEach(child => {
    if (child == null || child === false) return;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  });
  return parent;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function debounce(fn, ms) {
  let timer = 0;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export class Emitter {
  constructor() { this.listeners = new Set(); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(event) { [...this.listeners].forEach(fn => fn(event)); }
}

/**
 * Shows `content` anchored to `anchor` inside `layer` (an absolutely positioned overlay that
 * covers the app). Closes on outside press, Escape, or by calling the returned function;
 * a window resize (for example an on-screen keyboard opening) only repositions it.
 */
export function openPopover(layer, anchor, content, { align = 'left', onClose } = {}) {
  const box = h('div.popover', { role: 'dialog' }, content);
  layer.appendChild(box);
  const place = () => {
    const host = layer.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    let left = align === 'right' ? a.right - host.left - b.width : a.left - host.left;
    left = Math.max(6, Math.min(left, host.width - b.width - 6));
    let top = a.bottom - host.top + 4;
    if (top + b.height > host.height - 6 && a.top - host.top - b.height - 4 > 6) top = a.top - host.top - b.height - 4;
    box.style.left = left + 'px';
    box.style.top = Math.max(6, top) + 'px';
    box.style.maxHeight = Math.max(120, host.height - Math.max(6, top) - 8) + 'px';
  };
  place();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('pointerdown', onPress, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    box.remove();
    if (onClose) onClose();
  };
  const onPress = e => {
    const path = e.composedPath();
    if (!path.includes(box) && !path.includes(anchor)) close();
  };
  const onKey = e => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); anchor.focus && anchor.focus(); }
  };
  window.addEventListener('pointerdown', onPress, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);
  return Object.assign(close, { reposition: place, box });
}

/** A tool call as one line: lookupApprovalPolicy(amount: "10560.00"). */
export function toolCallText(step) {
  const args = step.arguments || {};
  return step.name + '(' + Object.keys(args).map(key => key + ': ' + JSON.stringify(args[key])).join(', ') + ')';
}

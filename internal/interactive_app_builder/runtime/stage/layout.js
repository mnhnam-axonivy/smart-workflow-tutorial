/**
 * Geometry of the process diagram: label wrapping, element bounds, connector routes and hit
 * testing. Coordinates are Ivy process coordinates (pixels, y pointing down); an element's
 * x/y is its centre, as in the *.p.json files.
 */
import { theme } from '../theme.js';
import { connectors } from '../model/process.js';

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 3;

let measurer = null;

/** Tests can replace the canvas-based text measurement. */
export function setMeasurer(fn) { measurer = fn; }

function measure(text, font) {
  if (!measurer) {
    const ctx = document.createElement('canvas').getContext('2d');
    measurer = (t, f) => { ctx.font = f; return ctx.measureText(t).width; };
  }
  return measurer(text, font);
}

export const labelFont = (size = theme.labelSize, weight = '') => (weight ? weight + ' ' : '') + size + 'px ' + theme.font;

/** Wraps on spaces; words wider than the line (or unspaced CJK text) break per character. */
export function wrapText(text, maxWidth, font) {
  const lines = [];
  String(text).split('\n').forEach(paragraph => {
    let current = '';
    const push = () => { lines.push(current); current = ''; };
    paragraph.split(' ').forEach(word => {
      const candidate = current ? current + ' ' + word : word;
      if (measure(candidate, font) <= maxWidth) { current = candidate; return; }
      if (current) push();
      if (measure(word, font) <= maxWidth) { current = word; return; }
      for (const ch of word) {
        if (current && measure(current + ch, font) > maxWidth) push();
        current += ch;
      }
    });
    push();
  });
  return lines;
}

const ICON_SIZE = 30;
const ICON_LEFT = 8;
const TEXT_LEFT = 43;
const TEXT_RIGHT = 3;
const PAD = 16;

const union = (a, b) => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/**
 * Layout of one element in its own coordinate system (origin = element centre).
 * @returns {{ body:{x,y,w,h}, lines:string[], label:{x,y,w,h}|null, textX:number, textY:number, icon:{x,y,size}|null, sprite:{x,y,w,h} }}
 */
export function layoutElement(el) {
  const font = labelFont();
  const body = { x: -el.w / 2, y: -el.h / 2, w: el.w, h: el.h };
  const lh = theme.lineHeight;
  let lines = [];
  let label = null;
  let textX = 0;
  let textY = 0;
  let icon = null;

  if (el.shape === 'activity') {
    icon = { x: body.x + ICON_LEFT, y: -ICON_SIZE / 2, size: ICON_SIZE };
    const maxLines = Math.max(1, Math.floor((el.h - 8) / lh));
    lines = el.name ? wrapText(el.name, el.w - TEXT_LEFT - TEXT_RIGHT, font).slice(0, maxLines) : [];
    textX = body.x + TEXT_LEFT;
    textY = -(lines.length * lh) / 2;
  } else if (el.shape === 'note') {
    lines = el.name ? wrapText(el.name, Math.max(120, el.w), font) : [];
    textX = body.x + 8;
    textY = body.y + 6;
    body.h = Math.max(body.h, lines.length * lh + 12);
  } else {
    lines = el.name ? wrapText(el.name, 190, font) : [];
    if (lines.length) {
      const width = Math.max(...lines.map(l => measure(l, font)));
      // a boundary event sits on a connector that leaves downwards: its label goes beside it, as in the file
      const shift = el.kind === 'boundary' && el.labelOffset ? (el.labelOffset.x || 0) : 0;
      const height = lines.length * lh;
      label = { x: -width / 2 + shift, y: el.labelAbove ? -el.h / 2 - 5 - height : el.h / 2 + 7, w: width, h: height };
      textX = shift;
      textY = label.y;
    }
  }

  const content = label ? union(body, label) : body;
  const sprite = {
    x: Math.floor(content.x - PAD),
    y: Math.floor(content.y - PAD),
    w: Math.ceil(content.w + PAD * 2),
    h: Math.ceil(content.h + PAD * 2)
  };
  return { body, lines, label, textX, textY, icon, sprite };
}

/** Body plus label of an element in process coordinates. */
export function elementBounds(el) {
  const l = layoutElement(el);
  const r = l.label ? union(l.body, l.label) : l.body;
  return { x: el.x + r.x, y: el.y + r.y, w: r.w, h: r.h };
}

export function modelBounds(model) {
  let bounds = null;
  model.elements.forEach(el => {
    const b = elementBounds(el);
    bounds = bounds ? union(bounds, b) : b;
  });
  return bounds || { x: 0, y: 0, w: 100, h: 100 };
}

/** Where a ray from the element's centre towards (tx, ty) leaves the element's outline. */
export function boundaryPoint(el, tx, ty) {
  const dx = tx - el.x;
  const dy = ty - el.y;
  const len = Math.hypot(dx, dy) || 1;
  if (el.shape === 'event') {
    const r = el.w / 2;
    return { x: el.x + (dx / len) * r, y: el.y + (dy / len) * r };
  }
  const hw = el.w / 2;
  const hh = el.h / 2;
  if (el.shape === 'gateway') {
    const k = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh || 1);
    return { x: el.x + dx * k, y: el.y + dy * k };
  }
  const k = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
  return { x: el.x + dx * k, y: el.y + dy * k };
}

/** Polyline of a connector: border of the source → bend points → border of the target. */
export function connectorPath(connector) {
  const via = connector.via || [];
  const first = via[0] || connector.to;
  const last = via[via.length - 1] || connector.from;
  return [boundaryPoint(connector.from, first.x, first.y), ...via.map(p => ({ x: p.x, y: p.y })), boundaryPoint(connector.to, last.x, last.y)];
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** Point at fraction t (0..1) of the polyline's length. */
export function pointAt(points, t) {
  const total = pathLength(points);
  if (total === 0) return { x: points[0].x, y: points[0].y };
  let remaining = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (remaining <= seg || i === points.length - 1) {
      const k = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * k, y: points[i - 1].y + (points[i].y - points[i - 1].y) * k };
    }
    remaining -= seg;
  }
  return { x: points[points.length - 1].x, y: points[points.length - 1].y };
}

/** Topmost element whose body or label contains the point, or null. */
export function hitTest(model, x, y, tolerance = 3) {
  for (let i = model.elements.length - 1; i >= 0; i--) {
    const el = model.elements[i];
    const l = layoutElement(el);
    const lx = x - el.x;
    const ly = y - el.y;
    if (el.shape === 'event') {
      if (Math.hypot(lx, ly) <= el.w / 2 + tolerance) return el;
    } else if (lx >= l.body.x - tolerance && lx <= l.body.x + l.body.w + tolerance && ly >= l.body.y - tolerance && ly <= l.body.y + l.body.h + tolerance) {
      return el;
    }
    if (l.label && lx >= l.label.x - 2 && lx <= l.label.x + l.label.w + 2 && ly >= l.label.y - 2 && ly <= l.label.y + l.label.h + 2) return el;
  }
  return null;
}

/** Every connector with its route, in drawing order. */
export function connectorRoutes(model) {
  return connectors(model).map(c => ({ ...c, points: connectorPath(c) }));
}

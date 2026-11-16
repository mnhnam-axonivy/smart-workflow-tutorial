/**
 * Mouse, touch and keyboard interaction with the process canvas: select, open, drag elements,
 * pan and zoom. Works with either stage through clientToWorld / panBy / zoomAt.
 */
import { hitTest } from './layout.js';

const DRAG_THRESHOLD = 4;
const GRID = 8;

/**
 * @param {Object} stage
 * @param {Object} handlers
 * @param {() => Object} handlers.model
 * @param {(el: Object|null) => void} handlers.select
 * @param {(el: Object) => void} handlers.open            double click / Enter
 * @param {(el: Object|null) => void} handlers.hover
 * @param {(el: Object) => void} handlers.moved           an element was dragged
 * @param {() => boolean} handlers.wheelZooms             true when a plain wheel may zoom
 * @param {() => void} handlers.wheelBlocked              plain wheel ignored (show a hint)
 * @param {(key: string, event: KeyboardEvent) => boolean} handlers.key
 * @returns {() => void} detach function
 */
export function attachController(stage, handlers) {
  const canvas = stage.canvas;
  canvas.tabIndex = 0;
  let press = null;
  let hovered = null;

  const elementAt = e => {
    const p = stage.clientToWorld(e.clientX, e.clientY);
    return hitTest(handlers.model(), p.x, p.y);
  };

  const setHover = el => {
    if (el === hovered) return;
    hovered = el;
    handlers.hover(el);
    canvas.style.cursor = el ? 'pointer' : press ? 'grabbing' : 'default';
  };

  const onDown = e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    canvas.focus({ preventScroll: true });
    const el = elementAt(e);
    const world = stage.clientToWorld(e.clientX, e.clientY);
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, el, world, startX: el ? el.x : 0, startY: el ? el.y : 0, dragging: false };
    canvas.setPointerCapture(e.pointerId);
  };

  const onMove = e => {
    if (!press || press.id !== e.pointerId) {
      if (e.pointerType === 'mouse') setHover(elementAt(e));
      return;
    }
    if (!press.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_THRESHOLD) return;
    if (!press.dragging) {
      press.dragging = true;
      if (press.el) handlers.select(press.el);
      else stage.effects.userMovedView();
      canvas.style.cursor = press.el ? 'move' : 'grabbing';
    }
    if (press.el && !press.el.removed && stage.view.tilt === 0) {
      const world = stage.clientToWorld(e.clientX, e.clientY);
      const x = Math.round((press.startX + world.x - press.world.x) / GRID) * GRID;
      const y = Math.round((press.startY + world.y - press.world.y) / GRID) * GRID;
      if (x !== press.el.x || y !== press.el.y) {
        press.el.x = x;
        press.el.y = y;
        handlers.moved(press.el);
      }
    } else if (!press.el) {
      stage.panBy(e.clientX - press.lastX, e.clientY - press.lastY);
    }
    press.lastX = e.clientX;
    press.lastY = e.clientY;
  };

  const onUp = e => {
    if (!press || press.id !== e.pointerId) return;
    const was = press;
    press = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
    if (!was.dragging) handlers.select(was.el);
  };

  const onDouble = e => {
    const el = elementAt(e);
    if (el) handlers.open(el);
  };

  const onLeave = () => { if (!press) setHover(null); };

  const onWheel = e => {
    if (e.ctrlKey || e.metaKey || handlers.wheelZooms()) {
      e.preventDefault();
      stage.effects.userMovedView();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      stage.zoomAt(Math.exp(-delta * (e.ctrlKey && Math.abs(delta) < 40 ? 0.012 : 0.0016)), e.clientX, e.clientY);
    } else {
      handlers.wheelBlocked();
    }
  };

  const onKey = e => {
    if (handlers.key(e.key, e)) { e.preventDefault(); return; }
    const step = 40;
    const pan = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (pan && e.shiftKey) { stage.panBy(pan[0], pan[1]); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { stage.zoomBy(1.2); e.preventDefault(); }
    else if (e.key === '-') { stage.zoomBy(1 / 1.2); e.preventDefault(); }
    else if (e.key === '0') { stage.fit({ animate: true }); e.preventDefault(); }
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('dblclick', onDouble);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('dblclick', onDouble);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKey);
  };
}

/**
 * Fallback process canvas for browsers without WebGL 2 (some virtual desktops and remote
 * sessions). Same interface and painters as the Three.js stage, drawn flat with Canvas 2D:
 * everything works, only the tilted "call the model" view is replaced by a flat one.
 */
import { theme } from '../theme.js';
import { modelBounds, connectorRoutes, MIN_ZOOM, MAX_ZOOM } from './layout.js';
import { paintElement, paintConnector, paintCard, paintGlow, paintGrid, toneColor } from './draw.js';
import { Effects } from './effects.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class CanvasStage {
  constructor(host, scene) {
    this.kind = 'canvas';
    this.supportsTilt = false;
    this.host = host;
    this.data = scene;
    this.onViewChange = null;
    this.view = { x: 0, y: 0, zoom: 1, tilt: 0, lift: 0 };
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'stage-canvas';
    this.ctx = this.canvas.getContext('2d');
    host.appendChild(this.canvas);
    this.raf = 0;
    this.lastFrame = 0;
    this.disposed = false;
    this.effects = new Effects({
      invalidate: () => this.invalidate(),
      getView: () => ({ ...this.view }),
      setView: v => this.setView(v),
      size: () => ({ w: this.width, h: this.height }),
      supportsTilt: false
    });
    this.frame = this.frame.bind(this);
  }

  resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (w === this.width && h === this.height && dpr === this.dpr) return true;
    const first = this.width === 0;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    if (first) this.fit();
    this.invalidate();
    return true;
  }

  setView(partial) {
    Object.assign(this.view, partial, { tilt: 0, lift: 0 });
    this.view.zoom = clamp(this.view.zoom, MIN_ZOOM, MAX_ZOOM);
    this.invalidate();
    if (this.onViewChange) this.onViewChange();
  }

  fit({ animate = false } = {}) {
    if (!this.width) return Promise.resolve();
    const b = modelBounds(this.data.model);
    const zoom = clamp(Math.min(this.width / (b.w + 44), this.height / (b.h + 96)), MIN_ZOOM, 1.3);
    const target = { x: b.x + b.w / 2, y: b.y + b.h / 2, zoom };
    if (animate) return this.effects.moveView(target, 420);
    this.setView(target);
    return Promise.resolve();
  }

  zoomAt(factor, clientX, clientY) {
    const before = this.clientToWorld(clientX, clientY);
    this.view.zoom = clamp(this.view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const after = this.clientToWorld(clientX, clientY);
    this.setView({ x: this.view.x + before.x - after.x, y: this.view.y + before.y - after.y });
  }

  zoomBy(factor) {
    const r = this.canvas.getBoundingClientRect();
    this.zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
  }

  panBy(dx, dy) {
    this.setView({ x: this.view.x - dx / this.view.zoom, y: this.view.y - dy / this.view.zoom });
  }

  clientToWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - r.width / 2) / this.view.zoom + this.view.x,
      y: (clientY - r.top - r.height / 2) / this.view.zoom + this.view.y
    };
  }

  worldToClient(x, y) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 + (x - this.view.x) * this.view.zoom,
      y: r.top + r.height / 2 + (y - this.view.y) * this.view.zoom
    };
  }

  refresh() { this.invalidate(); }
  setReducedMotion(value) { this.effects.reducedMotion = value; }
  setSpeed(value) { this.effects.speed = value; }

  invalidate() {
    if (!this.raf && !this.disposed) this.raf = requestAnimationFrame(this.frame);
  }

  frame(now) {
    this.raf = 0;
    if (this.disposed || !this.width) return;
    const dt = this.lastFrame ? Math.min(64, now - this.lastFrame) : 16;
    this.lastFrame = now;
    const animating = this.effects.step(dt);
    this.draw();
    if (animating) this.invalidate();
    else this.lastFrame = 0;
  }

  draw() {
    const { ctx, view, width, height, dpr } = this;
    const model = this.data.model;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = theme.canvas;
    ctx.fillRect(0, 0, width, height);

    // keep the process origin on whole device pixels so 1px lines stay sharp
    const k = view.zoom * dpr;
    const ox = Math.round((width / 2) * dpr - view.x * k);
    const oy = Math.round((height / 2) * dpr - view.y * k);
    ctx.setTransform(k, 0, 0, k, ox, oy);

    paintGrid(ctx, { x: view.x - width / 2 / view.zoom, y: view.y - height / 2 / view.zoom, w: width / view.zoom, h: height / view.zoom }, view.zoom);
    connectorRoutes(model).forEach(route => paintConnector(ctx, route.points, this.data.connectorState(route)));
    model.elements.forEach(el => {
      ctx.save();
      ctx.translate(el.x, el.y);
      paintElement(ctx, el, this.data.stateOf(el.id));
      ctx.restore();
    });

    this.effects.items.forEach(item => {
      ctx.save();
      if (item.kind === 'token') {
        ctx.translate(item.x, item.y);
        paintGlow(ctx, item.r, theme.active, item.o);
      } else if (item.kind === 'ring') {
        ctx.globalAlpha = clamp(item.o, 0, 1);
        ctx.strokeStyle = toneColor(item.tone);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(item.x - item.w / 2, item.y - item.h / 2, item.w, item.h, item.radius);
        else ctx.rect(item.x - item.w / 2, item.y - item.h / 2, item.w, item.h);
        ctx.stroke();
      } else if (item.kind === 'card') {
        ctx.translate(item.x, item.y);
        ctx.scale(item.s, item.s);
        ctx.globalAlpha = clamp(item.o, 0, 1);
        paintCard(ctx, item.data);
      } else if (item.kind === 'link') {
        ctx.globalAlpha = clamp(item.o, 0, 1);
        ctx.strokeStyle = toneColor(item.tone);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(item.a.x, item.a.y);
        ctx.lineTo(item.b.x, item.b.y);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.effects.cancelAll();
    this.canvas.remove();
  }
}

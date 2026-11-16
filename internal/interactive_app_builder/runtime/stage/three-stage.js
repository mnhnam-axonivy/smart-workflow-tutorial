/**
 * The process canvas, rendered with Three.js.
 *
 * The diagram itself is painted with the shared Canvas-2D painters into textures (one per
 * element, one for all connectors) so text stays as crisp as in the real Designer. Three.js
 * adds what a flat canvas cannot: a perspective camera that tilts the process plane while
 * the agent talks to the model, with message cards flying between the two levels, plus
 * shader-drawn grid, token glow and ripples.
 *
 * World space: x = process x, y = -process y, z = height above the process plane.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, PlaneGeometry, ShaderMaterial, CanvasTexture,
  Vector2, Vector3, Raycaster, Plane, Color, ColorManagement, LinearSRGBColorSpace, NoColorSpace,
  LinearFilter, LinearMipmapLinearFilter, CustomBlending, OneFactor, OneMinusSrcAlphaFactor,
  BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial
} from 'three';
import { theme, rgb } from '../theme.js';
import { layoutElement, modelBounds, connectorRoutes, MIN_ZOOM, MAX_ZOOM } from './layout.js';
import { paintElement, paintConnector, paintCard, toneColor } from './draw.js';
import { Effects } from './effects.js';

const FOV = 30;
const HALF_TAN = Math.tan((FOV * Math.PI) / 360);
const MAX_TEXTURE_SCALE = 4;
const MAX_TEXTURE_SIZE = 4096;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Textures hold premultiplied colour, so edges blend without dark fringes.
const PREMULTIPLIED = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: CustomBlending,
  blendSrc: OneFactor,
  blendDst: OneMinusSrcAlphaFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneMinusSrcAlphaFactor
};

const QUAD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const SPRITE_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(map, vUv) * opacity;
  }`;

// Dotted grid computed from world position, so it stays sharp at any zoom and in perspective.
const GRID_VERTEX = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xy;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const GRID_FRAGMENT = /* glsl */ `
  uniform vec3 uBackground;
  uniform vec3 uDot;
  uniform float uSpacing;
  varying vec2 vWorld;
  void main() {
    vec2 nearest = (fract(vWorld / uSpacing + 0.5) - 0.5) * uSpacing;
    float unitsPerPixel = max(length(dFdx(vWorld)), length(dFdy(vWorld)));
    float radius = max(0.55, 0.62 * unitsPerPixel);
    float dotMask = 1.0 - smoothstep(radius - 0.5 * unitsPerPixel, radius + 0.5 * unitsPerPixel, length(nearest));
    float pixelsBetweenDots = uSpacing / max(unitsPerPixel, 0.0001);
    dotMask *= smoothstep(3.5, 7.0, pixelsBetweenDots);
    gl_FragColor = vec4(mix(uBackground, uDot, dotMask), 1.0);
  }`;

// Token: white-hot core with an additive coloured halo.
const GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = smoothstep(0.34, 0.16, d);
    float halo = pow(max(0.0, 1.0 - d), 2.3);
    vec3 colour = uColor * halo * 0.95 + vec3(1.0) * core * 0.85;
    gl_FragColor = vec4(colour, core * 0.85) * opacity;
  }`;

// Ripple: outline of a rounded rectangle (or circle) with a soft falloff.
const RING_FRAGMENT = /* glsl */ `
  uniform vec2 uSize;
  uniform float uRadius;
  uniform vec3 uColor;
  uniform float opacity;
  varying vec2 vUv;
  float roundedBox(vec2 p, vec2 halfSize, float r) {
    vec2 q = abs(p) - halfSize + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 p = (vUv - 0.5) * (uSize + 28.0);
    float d = abs(roundedBox(p, uSize * 0.5, uRadius));
    float line = 1.0 - smoothstep(0.6, 0.6 + fwidth(d) * 1.5, d);
    float soft = exp(-d * 0.38) * 0.4;
    float a = clamp(line + soft, 0.0, 1.0) * opacity;
    gl_FragColor = vec4(uColor * a, a);
  }`;

/** A quad textured from a 2D canvas. `rect` is the area it covers, in local process pixels. */
class CanvasSprite {
  constructor(geometry, anisotropy, renderOrder) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.premultiplyAlpha = true;
    this.texture.colorSpace = NoColorSpace;
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.anisotropy = anisotropy;
    this.material = new ShaderMaterial({
      uniforms: { map: { value: this.texture }, opacity: { value: 1 } },
      vertexShader: QUAD_VERTEX,
      fragmentShader: SPRITE_FRAGMENT,
      ...PREMULTIPLIED
    });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.renderOrder = renderOrder;
    this.rect = { x: 0, y: 0, w: 1, h: 1 };
    this.scale = 0;
  }

  paint(rect, scale, painter) {
    const w = Math.max(1, Math.ceil(rect.w * scale));
    const h = Math.max(1, Math.ceil(rect.h * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.texture.dispose(); // storage is immutable; a new size needs a new GL texture
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
    painter(ctx);
    this.texture.needsUpdate = true;
    this.rect = { x: rect.x, y: rect.y, w: w / scale, h: h / scale };
    this.scale = scale;
    this.mesh.scale.set(this.rect.w, this.rect.h, 1);
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
  }
}

export class ThreeStage {
  /** True when this browser can give us a WebGL 2 context (three.js r163+ requires it). */
  static isSupported() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) return false;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * @param {HTMLElement} host   element the canvas is appended to; its size is the viewport
   * @param {Object} scene
   * @param {Object} scene.model
   * @param {(id: string) => Object} scene.stateOf            element state for the painters
   * @param {(connector: Object) => Object} scene.connectorState
   */
  constructor(host, scene) {
    this.kind = 'webgl';
    this.supportsTilt = true;
    this.host = host;
    this.data = scene;
    this.onViewChange = null;
    this.view = { x: 0, y: 0, zoom: 1, tilt: 0, lift: 0 };
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    ColorManagement.enabled = false; // colours are authored for the screen; pass them through untouched
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setClearColor(new Color(theme.canvas), 1);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'stage-canvas';
    host.appendChild(this.canvas);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(FOV, 1, 1, 10000);
    this.quad = new PlaneGeometry(1, 1);
    this.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.raycaster = new Raycaster();
    this.ground = new Plane(new Vector3(0, 0, 1), 0);

    this.grid = new Mesh(this.quad, new ShaderMaterial({
      uniforms: {
        uBackground: { value: new Vector3(...rgb(theme.canvas)) },
        uDot: { value: new Vector3(...rgb(theme.gridDot)) },
        uSpacing: { value: theme.gridSpacing }
      },
      vertexShader: GRID_VERTEX,
      fragmentShader: GRID_FRAGMENT,
      depthTest: false,
      depthWrite: false
    }));
    this.grid.scale.set(200000, 200000, 1);
    this.grid.renderOrder = 0;
    this.grid.frustumCulled = false;
    this.scene.add(this.grid);

    this.connectorSprite = new CanvasSprite(this.quad, this.anisotropy, 1);
    this.scene.add(this.connectorSprite.mesh);
    this.sprites = new Map();   // element id → CanvasSprite
    this.fx = new Map();        // effect item → { mesh, update, dispose }
    this.dirty = new Set(['*']);
    this.textureScale = 0;
    this.viewDirty = true;
    this.viewChangedAt = 0;
    this.rescale = true;
    this.raf = 0;
    this.lastFrame = 0;
    this.disposed = false;

    this.effects = new Effects({
      invalidate: () => this.invalidate(),
      getView: () => ({ ...this.view }),
      setView: v => this.setView(v),
      size: () => ({ w: this.width, h: this.height }),
      supportsTilt: true
    });

    this.onContextRestored = () => { this.refresh('all'); };
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.frame = this.frame.bind(this);
  }

  // ── view ───────────────────────────────────────────────────────────────────

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
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.viewDirty = true;
    this.touchView();
    if (first) this.fit();
    this.invalidate();
    return true;
  }

  setView(partial) {
    Object.assign(this.view, partial);
    this.view.zoom = clamp(this.view.zoom, MIN_ZOOM, MAX_ZOOM);
    this.viewDirty = true;
    this.touchView();
    this.invalidate();
  }

  /** Remembers that the view moved; textures are re-rasterised once it has settled. */
  touchView() {
    this.viewChangedAt = performance.now();
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.rescale = true;
      this.invalidate();
    }, 160);
  }

  applyCamera() {
    const { x, y, zoom, tilt, lift } = this.view;
    const distance = this.height / (2 * zoom * HALF_TAN);
    const sin = Math.sin(tilt);
    const cos = Math.cos(tilt);
    this.camera.aspect = this.width / this.height;
    this.camera.near = distance * 0.05;
    this.camera.far = distance * 12 + 4000;
    this.camera.position.set(x, -y - sin * distance, lift + cos * distance);
    this.camera.up.set(0, cos, sin);
    this.camera.lookAt(x, -y, lift);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.viewDirty = false;
    if (this.onViewChange) this.onViewChange();
  }

  /** Centres the whole process in the viewport. */
  fit({ animate = false } = {}) {
    if (!this.width) return Promise.resolve();
    const b = modelBounds(this.data.model);
    const zoom = clamp(Math.min(this.width / (b.w + 44), this.height / (b.h + 96)), MIN_ZOOM, 1.3);
    const target = { x: b.x + b.w / 2, y: b.y + b.h / 2, zoom, tilt: 0, lift: 0 };
    if (animate) return this.effects.moveView(target, 420);
    this.setView(target);
    return Promise.resolve();
  }

  zoomAt(factor, clientX, clientY) {
    const before = this.clientToWorld(clientX, clientY);
    this.view.zoom = clamp(this.view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.applyCamera();
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

  /** Client pixel → process coordinates on the canvas plane. */
  clientToWorld(clientX, clientY) {
    if (this.viewDirty && this.width) this.applyCamera();
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.ground, new Vector3());
    return hit ? { x: hit.x, y: -hit.y } : { x: this.view.x, y: this.view.y };
  }

  /** Process coordinates (and optional height) → client pixel. */
  worldToClient(x, y, z = 0) {
    if (this.viewDirty && this.width) this.applyCamera();
    const r = this.canvas.getBoundingClientRect();
    const v = new Vector3(x, -y, z).project(this.camera);
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  // ── content ────────────────────────────────────────────────────────────────

  /** Repaints 'all', the 'connectors', or one element (by id) on the next frame. */
  refresh(target = 'all') {
    if (target === 'all') this.dirty.add('*');
    else if (target === 'connectors') this.dirty.add('connectors');
    else { this.dirty.add(target); this.dirty.add('connectors'); }
    this.invalidate();
  }

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
    if (this.viewDirty) this.applyCamera();
    this.syncSprites(now);
    this.syncEffects();
    this.renderer.render(this.scene, this.camera);
    if (animating) this.invalidate();
    else this.lastFrame = 0;
  }

  syncSprites(now) {
    const model = this.data.model;
    const settled = now - this.viewChangedAt > 140;
    if (this.rescale) {
      this.rescale = false;
      const wanted = clamp(this.view.zoom * this.dpr * (this.view.tilt > 0.001 ? 1.3 : 1), 1, MAX_TEXTURE_SCALE);
      if (Math.abs(wanted - this.textureScale) > this.textureScale * 0.01) {
        this.textureScale = wanted;
        this.dirty.add('*');
      }
    }
    if (!this.textureScale) this.textureScale = clamp(this.view.zoom * this.dpr, 1, MAX_TEXTURE_SCALE);
    const all = this.dirty.has('*');

    model.elements.forEach(el => {
      let sprite = this.sprites.get(el.id);
      if (!sprite) {
        sprite = new CanvasSprite(this.quad, this.anisotropy, 2);
        this.sprites.set(el.id, sprite);
        this.scene.add(sprite.mesh);
      }
      if (all || this.dirty.has(el.id) || !sprite.scale) {
        sprite.paint(layoutElement(el).sprite, this.textureScale, ctx => paintElement(ctx, el, this.data.stateOf(el.id)));
      }
    });

    if (all || this.dirty.has('connectors') || !this.connectorSprite.scale) {
      const b = modelBounds(model);
      const rect = { x: Math.floor(b.x - 24), y: Math.floor(b.y - 24), w: Math.ceil(b.w + 48), h: Math.ceil(b.h + 48) };
      const scale = Math.min(this.textureScale, MAX_TEXTURE_SIZE / Math.max(rect.w, rect.h));
      this.connectorSprite.paint(rect, scale, ctx => {
        connectorRoutes(model).forEach(route => paintConnector(ctx, route.points, this.data.connectorState(route)));
      });
    }
    this.dirty.clear();

    // In the flat view, nudge each quad onto whole device pixels so texels map 1:1.
    const snap = settled && this.view.tilt === 0;
    const k = this.view.zoom * this.dpr;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const sx = x => (snap ? (Math.round((x - this.view.x) * k + W / 2) - W / 2) / k + this.view.x : x);
    const sy = y => (snap ? (Math.round((y - this.view.y) * k + H / 2) - H / 2) / k + this.view.y : y);
    const place = (sprite, ox, oy) => {
      const r = sprite.rect;
      sprite.mesh.position.set(sx(ox + r.x) + r.w / 2, -(sy(oy + r.y) + r.h / 2), 0);
    };
    model.elements.forEach(el => place(this.sprites.get(el.id), el.x, el.y));
    place(this.connectorSprite, 0, 0);
  }

  // ── effects ────────────────────────────────────────────────────────────────

  createFx(item) {
    if (item.kind === 'token') {
      const material = new ShaderMaterial({
        uniforms: { uColor: { value: new Vector3(...rgb(theme.active)) }, opacity: { value: 1 } },
        vertexShader: QUAD_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        ...PREMULTIPLIED
      });
      const mesh = new Mesh(this.quad, material);
      mesh.renderOrder = 5;
      return {
        mesh,
        update: () => {
          mesh.position.set(item.x, -item.y, item.z);
          mesh.scale.set(item.r * 2.6, item.r * 2.6, 1);
          material.uniforms.opacity.value = item.o;
        },
        dispose: () => material.dispose()
      };
    }
    if (item.kind === 'ring') {
      const material = new ShaderMaterial({
        uniforms: { uSize: { value: new Vector2(1, 1) }, uRadius: { value: 1 }, uColor: { value: new Vector3() }, opacity: { value: 0 } },
        vertexShader: QUAD_VERTEX,
        fragmentShader: RING_FRAGMENT,
        ...PREMULTIPLIED
      });
      const mesh = new Mesh(this.quad, material);
      mesh.renderOrder = 4;
      return {
        mesh,
        update: () => {
          mesh.position.set(item.x, -item.y, item.z);
          mesh.scale.set(item.w + 28, item.h + 28, 1);
          if (item.z > 0) mesh.quaternion.copy(this.camera.quaternion);
          material.uniforms.uSize.value.set(item.w, item.h);
          material.uniforms.uRadius.value = item.radius;
          material.uniforms.uColor.value.set(...rgb(toneColor(item.tone)));
          material.uniforms.opacity.value = item.o;
        },
        dispose: () => material.dispose()
      };
    }
    if (item.kind === 'card') {
      const sprite = new CanvasSprite(this.quad, this.anisotropy, 6);
      let rev = -1;
      return {
        mesh: sprite.mesh,
        update: () => {
          if (rev !== item.rev) {
            rev = item.rev;
            const d = item.data;
            const scale = clamp(this.view.zoom * this.dpr * 1.6, 2, MAX_TEXTURE_SCALE);
            sprite.paint({ x: -d.w / 2 - 14, y: -d.h / 2 - 12, w: d.w + 28, h: d.h + 30 }, scale, ctx => paintCard(ctx, d));
          }
          const r = sprite.rect;
          // the card's centre is the item position; the quad is slightly larger for the shadow
          const cx = (r.x + r.w / 2) * item.s;
          const cy = (r.y + r.h / 2) * item.s;
          sprite.mesh.quaternion.copy(this.camera.quaternion);
          const right = new Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
          const up = new Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
          sprite.mesh.position.set(item.x, -item.y, item.z).addScaledVector(right, cx).addScaledVector(up, -cy);
          sprite.mesh.scale.set(r.w * item.s, r.h * item.s, 1);
          sprite.material.uniforms.opacity.value = item.o;
        },
        dispose: () => sprite.dispose()
      };
    }
    // link
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
    const material = new LineBasicMaterial({ color: new Color(toneColor(item.tone)), transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const mesh = new Line(geometry, material);
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    return {
      mesh,
      update: () => {
        const p = geometry.attributes.position;
        p.setXYZ(0, item.a.x, -item.a.y, item.a.z);
        p.setXYZ(1, item.b.x, -item.b.y, item.b.z);
        p.needsUpdate = true;
        material.color.set(toneColor(item.tone));
        material.opacity = item.o;
      },
      dispose: () => { geometry.dispose(); material.dispose(); }
    };
  }

  syncEffects() {
    const items = this.effects.items;
    const alive = new Set(items);
    items.forEach(item => {
      let node = this.fx.get(item);
      if (!node) {
        node = this.createFx(item);
        this.fx.set(item, node);
        this.scene.add(node.mesh);
      }
      node.update();
    });
    this.fx.forEach((node, item) => {
      if (alive.has(item)) return;
      this.scene.remove(node.mesh);
      node.dispose();
      this.fx.delete(item);
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.settleTimer);
    this.effects.cancelAll();
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.fx.forEach(node => node.dispose());
    this.sprites.forEach(sprite => sprite.dispose());
    this.connectorSprite.dispose();
    this.grid.material.dispose();
    this.quad.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}

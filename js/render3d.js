/* render3d.js - a tiny 3D cube on a 2D canvas (no libraries).
 * Draws the cube as 1-3 slabs (the turning layers and the rest), each a box with its stickers,
 * back to front, so layer turns animate correctly. Also draws the move arrows.
 */
(function (G) {
  'use strict';
  const { M4 } = G.Cube;
  const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const NORMALS = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];   // [axis, sign]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  function rotAxis(p, axis, ang) {
    const c = Math.cos(ang), s = Math.sin(ang), [x, y, z] = p;
    if (axis === 0) return [x, y * c - z * s, y * s + z * c];
    if (axis === 1) return [x * c + z * s, y, -x * s + z * c];
    return [x * c - y * s, x * s + y * c, z];
  }
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

  // per-sticker geometry
  const ST = M4.pos.map((p, i) => {
    const n = M4.nrm[i], na = n.findIndex(v => v !== 0), ns = n[na];
    const others = [0, 1, 2].filter(a => a !== na);
    return { p, na, ns, u: E[others[0]], v: E[others[1]] };
  });

  /** arrow shapes (3D polylines on the cube surface) for a move's geometry */
  function arrowShapes(g) {
    const out = [], a = g.axis, sg = Math.sign(g.angle), m = (g.lo + g.hi) / 2;
    for (const [na, ns] of NORMALS) {
      const n = scl(E[na], ns);
      if (na === a) {
        const moving = ns > 0 ? g.hi >= 4 : g.lo <= -4;
        const b = (a + 1) % 3, c = (a + 2) % 3, pts = [], R = 2.55;
        const start = sg > 0 ? -0.25 * Math.PI : 0.75 * Math.PI;
        for (let k = 0; k <= 24; k++) {
          const ph = start + sg * (k / 24) * 1.5 * Math.PI;
          pts.push(add(add(scl(n, 4.06), E[b], R * Math.cos(ph)), E[c], R * Math.sin(ph)));
        }
        out.push({ normal: [na, ns], kind: 'arc', moving, pts });
      } else {
        const dir = scl(cross(E[a], n), sg);
        const base = add(scl(n, 4.06), E[a], m);
        out.push({ normal: [na, ns], kind: 'line', pts: [add(base, dir, -3.1), add(base, dir, 3.1)], width: (g.hi - g.lo) / 2 });
      }
    }
    return out;
  }

  class CubeView {
    constructor(canvas, opts = {}) {
      this.c = canvas; this.g = canvas.getContext('2d');
      this.state = M4.solved();
      this.colors = opts.colors || G.Vision.DISPLAY;
      this.rgb = this.colors.map(hexRgb);
      this.unknown = [70, 74, 82];
      this.body = opts.body || '#15171c';
      this.yaw0 = opts.yaw != null ? opts.yaw : -0.62; this.pitch0 = opts.pitch != null ? opts.pitch : 0.52;
      this.yaw = this.yaw0; this.pitch = this.pitch0;
      this.mirror = !!opts.mirror; this.D = 24;
      this.anim = null; this.queue = []; this.arrow = null; this.highlight = null; this.labels = !!opts.labels;
      this.onMoveDone = null;
      if (opts.drag !== false) this.enableDrag();
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.render()).observe(canvas);
      this.render();
    }
    enableDrag() {
      let sx = 0, sy = 0, y0 = 0, p0 = 0, down = false;
      this.c.style.touchAction = 'none';
      this.c.addEventListener('pointerdown', e => { down = true; sx = e.clientX; sy = e.clientY; y0 = this.yaw; p0 = this.pitch; this.c.setPointerCapture(e.pointerId); });
      this.c.addEventListener('pointermove', e => {
        if (!down) return;
        this.yaw = y0 + (e.clientX - sx) * 0.01 * (this.mirror ? -1 : 1);
        this.pitch = Math.max(-1.4, Math.min(1.4, p0 + (e.clientY - sy) * 0.01));
        this.render();
      });
      const up = () => { down = false; };
      this.c.addEventListener('pointerup', up); this.c.addEventListener('pointercancel', up);
      this.c.addEventListener('dblclick', () => this.resetView());
    }
    resetView() { this.yaw = this.yaw0; this.pitch = this.pitch0; this.render(); }
    setState(s) { this.state = s; this.render(); }
    setArrow(tok) { this.arrow = tok || null; this.render(); }
    setHighlight(set) { this.highlight = set && set.size ? set : null; this.render(); }

    /** animate a move (or list of moves); resolves when done. ms per quarter turn */
    play(tokens, ms = 320) {
      tokens = Array.isArray(tokens) ? tokens : [tokens];
      return tokens.reduce((p, t) => p.then(() => this._one(t, ms)), this.queue.length ? this.queue[this.queue.length - 1] : Promise.resolve());
    }
    _one(tok, ms) {
      return new Promise(res => {
        const g = M4.geom(tok), dur = ms * (Math.abs(g.angle) > 2 ? 1.5 : 1), t0 = performance.now();
        const saveArrow = this.arrow; this.arrow = null;
        const step = now => {
          const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          this.anim = { g, ang: g.angle * e };
          this.render();
          if (t < 1) requestAnimationFrame(step);
          else { this.anim = null; this.state = M4.apply(this.state, [tok]); this.arrow = saveArrow; this.render(); if (this.onMoveDone) this.onMoveDone(tok); res(); }
        };
        requestAnimationFrame(step);
      });
    }

    view(p) {
      let [x, y, z] = p;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      [y, z] = [y * cp - z * sp, y * sp + z * cp];
      return [x, y, z];
    }
    proj(v) {
      const f = this.scale * this.D / (this.D - v[2]);
      return [this.cx + (this.mirror ? -v[0] : v[0]) * f, this.cy - v[1] * f];
    }

    render() {
      const c = this.c, dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth, h = c.clientHeight;
      if (!w || !h) return;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const g = this.g;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      this.cx = w / 2; this.cy = h / 2; this.scale = Math.min(w, h) / 15.5;
      const eye = (() => {   // eye position in cube coordinates
        let [x, y, z] = [0, 0, this.D];
        const cp = Math.cos(-this.pitch), sp = Math.sin(-this.pitch); [y, z] = [y * cp - z * sp, y * sp + z * cp];
        const cy = Math.cos(-this.yaw), sy = Math.sin(-this.yaw); [x, z] = [x * cy + z * sy, -x * sy + z * cy];
        return [x, y, z];
      })();
      const an = this.anim, axis = an ? an.g.axis : 1;
      const cuts = an ? [-4, an.g.lo, an.g.hi, 4].filter((v, i, a) => i === 0 || v !== a[i - 1]) : [-4, 4];
      const slabs = [];
      for (let i = 0; i + 1 < cuts.length; i++) {
        const a0 = cuts[i], a1 = cuts[i + 1];
        const moving = an && a0 >= an.g.lo && a1 <= an.g.hi;
        const e = eye[axis], d = e < a0 ? a0 - e : e > a1 ? e - a1 : 0;
        slabs.push({ a0, a1, ang: moving ? an.ang : 0, d });
      }
      slabs.sort((p, q) => q.d - p.d);
      const light = [0.35, 0.8, 0.5];
      for (const sl of slabs) this.drawSlab(sl, axis, light);
      if (this.arrow && !an) this.drawArrow(this.arrow);
    }

    drawSlab(sl, axis, light) {
      const g = this.g, T = p => this.view(sl.ang ? rotAxis(p, axis, sl.ang) : p);
      for (const [na, ns] of NORMALS) {
        let n = [0, 0, 0]; n[na] = ns;
        // face corners
        const b = (na + 1) % 3, c = (na + 2) % 3;
        const lim = k => (k === axis ? [sl.a0, sl.a1] : [-4, 4]);
        let pos;
        if (na === axis) pos = ns > 0 ? sl.a1 : sl.a0; else pos = ns * 4;
        const [b0, b1] = lim(b), [c0, c1] = lim(c);
        const corner = (bb, cc) => { const p = [0, 0, 0]; p[na] = pos; p[b] = bb; p[c] = cc; return p; };
        const quad = [corner(b0, c0), corner(b1, c0), corner(b1, c1), corner(b0, c1)].map(T);
        const nv = this.view(sl.ang ? rotAxis(n, axis, sl.ang) : n);
        const mid = scl(add(quad[0], quad[2]), 0.5);
        if (nv[0] * (0 - mid[0]) + nv[1] * (0 - mid[1]) + nv[2] * (this.D - mid[2]) <= 0) continue;
        g.fillStyle = this.body;
        this.poly(quad.map(p => this.proj(p)));
        g.fill();
        if (Math.abs(pos) !== 4) continue;           // a cut inside the cube: plain plastic
        const shade = 0.72 + 0.28 * Math.max(0, nv[0] * light[0] + nv[1] * light[1] + nv[2] * light[2]);
        for (let i = 0; i < ST.length; i++) {
          const st = ST[i];
          if (st.na !== na || st.ns !== ns) continue;
          if (na !== axis) { const a = st.p[axis]; if (a < sl.a0 || a > sl.a1) continue; }
          else if (pos !== ns * 4) continue;
          this.drawSticker(i, st, T, shade);
        }
      }
    }

    drawSticker(i, st, T, shade) {
      const g = this.g, h = 0.84, k = 0.22;
      const P = (du, dv) => this.proj(T(add(add(st.p, st.u, du), st.v, dv)));
      const pts = [P(-h + k, -h), P(h - k, -h), P(h, -h + k), P(h, h - k), P(h - k, h), P(-h + k, h), P(-h, h - k), P(-h, -h + k)];
      const col = this.state[i];
      let rgb = col < 6 ? this.rgb[col] : this.unknown;
      let alpha = 1;
      if (this.highlight && !this.highlight.has(i)) { rgb = rgb.map(v => v * 0.35 + 70 * 0.65); }
      g.fillStyle = `rgb(${rgb.map(v => Math.round(v * shade)).join(',')})`;
      g.globalAlpha = alpha;
      this.poly(pts); g.fill();
      if (this.highlight && this.highlight.has(i)) { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.stroke(); }
      g.globalAlpha = 1;
    }

    poly(pts) { const g = this.g; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }

    drawArrow(tok) {
      const g = M4.geom(tok), shapes = arrowShapes(g);
      const ctx = this.g;
      for (const s of shapes) {
        if (s.kind === 'arc' && !s.moving) continue;
        const n = [0, 0, 0]; n[s.normal[0]] = s.normal[1];
        const nv = this.view(n), p = this.view(s.pts[(s.pts.length / 2) | 0]);
        if (nv[0] * -p[0] + nv[1] * -p[1] + nv[2] * (this.D - p[2]) <= 0) continue;
        drawPolyArrow(ctx, s.pts.map(q => this.proj(this.view(q))), this.scale * (s.kind === 'line' ? 0.55 + 0.25 * (s.width - 1) : 0.5));
      }
    }
  }

  /** thick white arrow with dark outline along a 2D polyline */
  function drawPolyArrow(ctx, pts, w, opts = {}) {
    if (pts.length < 2) return;
    const [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 2];
    const ang = Math.atan2(y1 - y0, x1 - x0), head = w * 2.1;
    const body = pts.slice(0, -1).concat([[x1 - Math.cos(ang) * head * 0.6, y1 - Math.sin(ang) * head * 0.6]]);
    const path = () => { ctx.beginPath(); ctx.moveTo(body[0][0], body[0][1]); for (let i = 1; i < body.length; i++) ctx.lineTo(body[i][0], body[i][1]); };
    const headPath = () => {
      ctx.beginPath(); ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - Math.cos(ang - 0.5) * head, y1 - Math.sin(ang - 0.5) * head);
      ctx.lineTo(x1 - Math.cos(ang + 0.5) * head, y1 - Math.sin(ang + 0.5) * head); ctx.closePath();
    };
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (opts.dashed) ctx.setLineDash([w * 1.2, w * 1.1]);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = w + 4; path(); ctx.stroke();
    ctx.setLineDash([]);
    headPath(); ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.stroke();
    if (opts.dashed) ctx.setLineDash([w * 1.2, w * 1.1]);
    ctx.strokeStyle = opts.color || '#fff'; ctx.lineWidth = w; path(); ctx.stroke();
    ctx.setLineDash([]);
    headPath(); ctx.fillStyle = opts.color || '#fff'; ctx.fill();
    ctx.restore();
  }

  G.Render3D = { CubeView, arrowShapes, drawPolyArrow };
})(typeof self !== 'undefined' ? self : globalThis);

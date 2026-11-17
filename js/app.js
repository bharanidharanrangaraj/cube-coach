/* app.js - screens: home, scan, review, solve, learn, practice, cheat sheet. */
(function () {
  'use strict';
  const { M4 } = Cube;
  const { CubeView, arrowShapes, drawPolyArrow } = Render3D;
  const NAMES = Vision.NAMES, COLORS = Vision.DISPLAY;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cubecoach.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cubecoach.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const permArr = (a, p) => Array.from(p, j => a[j]);
  const applyArr = (a, toks) => toks.reduce((x, t) => permArr(x, M4.perm(t)), a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); }
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* no vibration */ } };

  // ---------------- camera box (shared by scan + solve) ----------------
  const camBox = $('#cambox'), video = $('#cambox video'), ov = $('#cambox canvas.ov'), camMsg = $('#cam-msg');
  const camera = new Camera(video);
  let onFrame = null;
  function square() {
    const w = camBox.clientWidth, h = camBox.clientHeight, s = Math.round(Math.min(w, h) * 0.7);
    return { x: Math.round((w - s) / 2), y: Math.round((h - s) / 2), size: s, w, h };
  }
  (function loop() {
    requestAnimationFrame(loop);
    if (!camera.running || !onFrame || camBox.hidden) return;
    const sq = square(), dpr = Math.min(2, devicePixelRatio || 1);
    if (ov.width !== Math.round(sq.w * dpr) || ov.height !== Math.round(sq.h * dpr)) { ov.width = Math.round(sq.w * dpr); ov.height = Math.round(sq.h * dpr); }
    const g = ov.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, sq.w, sq.h);
    if (camera.ready) onFrame(g, sq);
  })();
  function mountCam(host) { host.appendChild(camBox); camBox.hidden = false; }
  async function startCam(facing) {
    camMsg.hidden = true;
    try { await camera.start(facing); return true; } catch (e) {
      let m = 'Could not start the camera.';
      if (!window.isSecureContext) m = 'The camera only works on https:// or this computer (localhost). See "Install" on the home screen.';
      else if (e && e.name === 'NotAllowedError') m = 'Camera blocked. Allow the camera for this page in the browser settings, then try again.';
      else if (e && (e.name === 'NotFoundError' || e.message === 'nocamera')) m = 'No camera found on this device.';
      else if (e && e.name === 'NotReadableError') m = 'The camera is busy in another app. Close it and try again.';
      camMsg.innerHTML = esc(m) + '<br><button class="btn" id="cam-retry">Try again</button>';
      camMsg.hidden = false;
      $('#cam-retry').onclick = () => startCam(facing);
      return false;
    }
  }
  function drawGrid(g, sq, dots, mode) {
    const { x, y, size } = sq, c = size / 4;
    if (mode !== 'ar') { g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.rect(0, 0, sq.w, sq.h); g.roundRect ? g.roundRect(x, y, size, size, 14) : g.rect(x, y, size, size); g.fill('evenodd'); }
    g.strokeStyle = mode === 'good' ? '#2ee07a' : mode === 'ar' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.9)';
    g.lineWidth = mode === 'good' ? 4 : 2.5;
    g.beginPath(); g.roundRect ? g.roundRect(x, y, size, size, 14) : g.rect(x, y, size, size); g.stroke();
    g.lineWidth = 1; g.strokeStyle = mode === 'ar' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)';
    g.beginPath();
    for (let i = 1; i < 4; i++) { g.moveTo(x + i * c, y); g.lineTo(x + i * c, y + size); g.moveTo(x, y + i * c); g.lineTo(x + size, y + i * c); }
    g.stroke();
    if (dots) dots.forEach((col, k) => {
      const cx = x + (k % 4 + 0.5) * c, cy = y + ((k >> 2) + 0.5) * c;
      g.beginPath(); g.arc(cx, cy, c * 0.15, 0, 7); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.stroke();
    });
  }
  /** big hint arrow over the camera for the scan turns: 'right' | 'top' | 'flip' */
  function drawTurnHint(g, sq, kind) {
    const { x, y, size } = sq, w = size * 0.06, t = (performance.now() % 1600) / 1600, e = Math.min(1, t * 1.6);
    let pts = [];
    if (kind === 'right') for (let k = 0; k <= 12; k++) { const u = k / 12 * e; pts.push([x + size * (0.95 - 0.6 * u), y + size * (0.5 + 0.12 * Math.sin(u * Math.PI))]); }
    else if (kind === 'top') for (let k = 0; k <= 12; k++) { const u = k / 12 * e; pts.push([x + size * (0.5 + 0.12 * Math.sin(u * Math.PI)), y + size * (0.05 + 0.6 * u)]); }
    else for (let k = 0; k <= 16; k++) { const u = k / 16 * e; pts.push([x + size * (0.5 + 0.32 * Math.sin(u * Math.PI)), y + size * (0.12 + 0.76 * (1 - Math.cos(u * Math.PI)) / 2)]); }
    if (pts.length > 1) drawPolyArrow(g, pts, w, { color: '#ffd84a' });
  }

  // ---------------- router ----------------
  const screens = {};
  let current = null;
  const PARENT = { lesson: 'learn', drill: 'practice' };
  function route() {
    let [name, arg] = (location.hash.slice(1) || 'home').split('/');
    if (!screens[name]) name = 'home';
    if (current && screens[current].leave) screens[current].leave();
    $$('main > section').forEach(s => (s.hidden = s.id !== name));
    current = name;
    const scr = screens[name];
    $('#title').textContent = scr.title || 'Cube Coach';
    $('#back').hidden = name === 'home';
    document.body.dataset.screen = name;
    scr.enter && scr.enter(arg ? decodeURIComponent(arg) : undefined);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  const go = h => { if (location.hash.slice(1) === h || (!h && !location.hash)) route(); else location.hash = h; };
  $('#back').onclick = () => go(PARENT[current] || '');
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); go(b.dataset.go); } });

  // ---------------- demo camera (?demo=1): a simulated cube, for testing without a camera ----------------
  const demo = DEMO && (() => {
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    const ALL = ['U', 'D', 'R', 'L', 'F', 'B', 'u', 'd', 'r', 'l', 'f', 'b'].flatMap(f => [f, f + "'", f + '2']);
    let s = 99; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    let truth = M4.apply(M4.solved(), Array.from({ length: 40 }, () => ALL[Math.floor(rnd() * ALL.length)]));
    let movingUntil = 0;
    function draw() {
      const w = camBox.clientWidth || 640, h = camBox.clientHeight || 480;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#7a5a40'); grd.addColorStop(1, '#4a3424');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      if (performance.now() < movingUntil) return;
      const sq = square(), x = camera.mirrored ? w - sq.x - sq.size : sq.x, c = sq.size / 4;
      g.fillStyle = '#0d0d0f'; g.fillRect(x - 5, sq.y - 5, sq.size + 10, sq.size + 10);
      for (let k = 0; k < 16; k++) {
        const r = k >> 2, cc = k % 4, light = 0.78 + 0.22 * (1 - (r + cc) / 6);
        const rgb = Vision.REF_RGB[truth[32 + k]].map(v => Math.max(0, Math.min(255, v * light * (0.95 + rnd() * 0.1))));
        g.fillStyle = `rgb(${rgb.join(',')})`;
        g.fillRect(x + cc * c + 4, sq.y + r * c + 4, c - 8, c - 8);
      }
    }
    setInterval(draw, 33);
    const toCam = toks => (camera.mirrored ? ['y2', ...toks, 'y2'] : toks);
    return {
      stream: () => { draw(); return cv.captureStream(30); },
      get truth() { return camera.mirrored ? M4.apply(truth, ['y2']) : truth; },
      rotate(t) { movingUntil = performance.now() + 800; truth = M4.apply(truth, [t]); },
      setRaw(toks) { truth = M4.apply(truth, toks); },
      move(toks) { truth = M4.apply(truth, toCam(toks)); movingUntil = performance.now() + 300; },
    };
  })();
  if (DEMO) {
    camera.start = async function () {
      this.stop(); this.stream = demo.stream(); video.srcObject = this.stream; await video.play().catch(() => {});
      this.facing = params.get('facing') === 'user' ? 'user' : 'environment'; this.mirrored = this.facing === 'user';
      video.style.transform = this.mirrored ? 'scaleX(-1)' : ''; this.canTorch = false; return this.facing;
    };
  }

  // ---------------- home ----------------
  screens.home = {
    title: 'Cube Coach',
    enter() {
      $('#resume').hidden = !store.get('solve');
      if (!this.view) {
        this.view = new CubeView($('#home-cube'), { drag: false, pitch: 0.45 });
        this.view.setState(M4.apply(M4.solved(), "R u2 F' l D b' r2 U' f d2 L'"));
      }
      const spin = () => { if (current !== 'home') return; this.view.yaw += 0.006; this.view.render(); requestAnimationFrame(spin); };
      requestAnimationFrame(spin);
    },
  };

  // ---------------- scan ----------------
  const TURN_TEXT = [
    'Hold any face of the cube inside the grid, close enough to fill it. Keep still: it captures by itself.',
    'Turn the whole cube so the side on the <b>right of the screen</b> comes to the front.',
    'Again: bring the side on the <b>right of the screen</b> to the front.',
    'Once more: the side on the <b>right of the screen</b> to the front.',
    'Now tilt the <b>top</b> of the cube toward the camera.',
    'Turn it <b>upside down</b> so the bottom faces the camera.',
  ];
  screens.scan = {
    title: 'Scan your cube',
    enter() {
      mountCam($('#scan-cam'));
      if (!this.mini) this.mini = new CubeView($('#scan-mini'), { drag: false, yaw: -0.5, pitch: 0.42 });
      this.reset();
      onFrame = (g, sq) => this.frame(g, sq);
      startCam(store.get('scanFacing', 'environment')).then(() => this.ui());
      $('#scan-capture').onclick = () => { if (this.last && this.idx < 6) this.capture(this.last.cells, this.last.guess); };
      $('#scan-undo').onclick = () => this.undo();
      $('#scan-switch').onclick = async () => { await camera.switch().catch(() => {}); store.set('scanFacing', camera.facing); this.reset(); toast(camera.mirrored ? 'Front camera: the picture is mirrored, like a mirror.' : 'Back camera'); };
      $('#scan-light').onclick = async () => { const ok = await camera.torch(!camera.torchOn); if (!ok) toast('This camera has no light.'); };
      $('#scan-manual').onclick = e => { e.preventDefault(); screens.review.load({ labels: M4.solved(), manual: true }); go('review'); };
    },
    leave() { onFrame = null; camera.stop(); clearInterval(this.timer); },
    reset() {
      this.idx = 0; this.rgb = new Array(96).fill(null); this.live = new Uint8Array(96).fill(255);
      this.rots = []; this.prev = null; this.stable = 0; this.moved = true; this.lastFace = null; this.hist = []; this.hintTok = null;
      clearInterval(this.timer);
      this.mini.setState(this.live);
      this.ui();
    },
    tokAfter(i) { return i <= 2 ? (camera.mirrored ? "y'" : 'y') : i === 3 ? "x'" : 'x2'; },
    frame(g, sq) {
      const img = camera.grab(sq); if (!img) return;
      const f = Vision.sampleFace(img);
      const guess = f.cells.map(c => Vision.guess(c.rgb));
      const disp = guess.map((_, k) => COLORS[guess[(k >> 2) * 4 + (camera.mirrored ? 3 - (k & 3) : k & 3)]]);
      let diff = 999;
      if (this.prev) diff = Math.max(...f.cells.map((c, k) => Math.abs(c.rgb[0] - this.prev[k].rgb[0]) + Math.abs(c.rgb[1] - this.prev[k].rgb[1]) + Math.abs(c.rgb[2] - this.prev[k].rgb[2])));
      this.prev = f.cells;
      this.last = { cells: f.cells, guess };
      if (f.ok && diff < 60) this.stable++; else this.stable = 0;
      if (!f.ok || diff > 150) this.moved = true;
      const same = this.lastFace && guess.filter((v, k) => v === this.lastFace[k]).length >= 14;
      const ready = this.stable >= 7 && this.moved && !same && this.idx < 6;
      drawGrid(g, sq, f.ok ? disp : null, ready ? 'good' : 'scan');
      if (this.idx > 0 && this.idx < 6 && (!this.moved || same)) drawTurnHint(g, sq, this.idx <= 3 ? 'right' : this.idx === 4 ? 'top' : 'flip');
      const msg = $('#scan-live');
      if (this.idx >= 6) msg.textContent = '';
      else if (!f.ok) msg.textContent = f.cells.some(c => c.lum < 25) ? 'Too dark - add light or tap Light' : 'Fill the grid with one face';
      else if (!this.moved || same) msg.textContent = 'Got it - now turn the cube';
      else msg.textContent = 'Hold still…';
      if (ready) this.capture(f.cells, guess);
    },
    capture(cells, guess) {
      this.hist.push({ rgb: this.rgb.slice(), live: this.live.slice(), rots: this.rots.slice(), lastFace: this.lastFace });
      for (let k = 0; k < 16; k++) { this.rgb[32 + k] = cells[k].rgb; this.live[32 + k] = guess[k]; }
      this.lastFace = guess.slice(); this.moved = false; this.stable = 0; this.idx++;
      buzz(40); camBox.classList.remove('flash'); void camBox.offsetWidth; camBox.classList.add('flash');
      if (this.idx < 6) {
        const t = this.tokAfter(this.idx - 1), before = this.live.slice();
        this.rgb = permArr(this.rgb, M4.perm(t)); this.live = Uint8Array.from(permArr(this.live, M4.perm(t))); this.rots.push(t);
        this.showTurn(before, t);
        if (DEMO) setTimeout(() => demo.rotate(t), 900);
      } else this.finish();
      this.ui();
    },
    showTurn(before, t) {
      clearInterval(this.timer);
      const run = () => { this.mini.setState(before); setTimeout(() => this.mini.play(t, 650), 250); };
      run(); this.timer = setInterval(run, 2300);
    },
    undo() {
      const h = this.hist.pop(); if (!h) return;
      Object.assign(this, { rgb: h.rgb, live: h.live, rots: h.rots, lastFace: h.lastFace });
      this.idx--; this.moved = true; this.stable = 0; clearInterval(this.timer);
      if (DEMO && this.hist.length < this.rots.length + 1) { /* demo keeps its own orientation */ }
      this.mini.setState(this.live); this.ui();
      toast('Show that face again.');
    },
    ui() {
      $('#scan-step').textContent = this.idx < 6 ? `Face ${this.idx + 1} of 6` : 'All 6 faces done';
      $('#scan-instr').innerHTML = this.idx < 6 ? TURN_TEXT[this.idx] : 'Reading colours…';
      $('#scan-undo').disabled = !this.hist.length;
      $('#scan-light').hidden = !camera.canTorch;
      $('#scan-dots').innerHTML = [0, 1, 2, 3, 4, 5].map(i => `<span class="${i < this.idx ? 'done' : i === this.idx ? 'now' : ''}"></span>`).join('');
      if (!this.timer) this.mini.setState(this.live);
    },
    finish() {
      clearInterval(this.timer);
      let rgb = applyArr(this.rgb, Cube.invert(this.rots));
      if (camera.mirrored) rgb = applyArr(rgb, ['y2']);
      const cl = Vision.cluster(rgb);
      const first = Solver.analyse(cl.labels);
      const rep = Vision.repair(cl.labels, cl.alt, cl.margin, s => Solver.analyse(s, first.scheme.fc));
      store.set('calib', cl.calib);
      if (DEMO) demo.setRaw(Cube.invert(this.rots));
      screens.review.load({ labels: rep.labels, margin: cl.margin });
      toast('Now hold the cube the way you held it for the first face.', 4500);
      setTimeout(() => go('review'), 350);
    },
  };

  // ---------------- review ----------------
  const NET = [[null, 0, null, null], [4, 2, 1, 5], [null, 3, null, null]];
  const FACE_LABEL = ['Top', 'Right', 'Front', 'Bottom', 'Left', 'Back'];
  screens.review = {
    title: 'Check the colours',
    load(d) { this.labels = Uint8Array.from(d.labels); this.margin = d.margin || null; this.manual = !!d.manual; this.sel = this.manual ? 0 : -1; },
    enter() {
      if (!this.labels) this.load({ labels: M4.solved(), manual: true });
      // least certain stickers get a dot
      this.unsure = new Set();
      if (this.margin) {
        const order = [...this.margin.keys()].sort((a, b) => this.margin[a] - this.margin[b]);
        const med = this.margin[order[48]];
        order.slice(0, 6).forEach(i => { if (this.margin[i] < med * 0.3) this.unsure.add(i); });
      }
      $('#rev-solve').onclick = () => { const res = Solver.analyse(this.labels); if (!res.ok) { toast('Fix the outlined stickers first.'); return; } screens.solve.start(this.labels); go('solve'); };
      this.render();
    },
    render() {
      const res = Solver.analyse(this.labels);
      const counts = [0, 0, 0, 0, 0, 0]; this.labels.forEach(c => counts[c]++);
      const net = $('#rev-net');
      net.innerHTML = NET.map(row => row.map(f => f === null ? '<div class="nf empty"></div>' :
        `<div class="nf"><div class="nfl">${FACE_LABEL[f]}</div><div class="nfg">${[...Array(16)].map((_, k) => {
          const i = f * 16 + k, c = this.labels[i];
          return `<button class="st${res.bad.has(i) ? ' bad' : ''}${this.unsure.has(i) ? ' unsure' : ''}" data-i="${i}" style="background:${COLORS[c]}" aria-label="${NAMES[c]}"></button>`;
        }).join('')}</div></div>`).join('')).join('');
      net.onclick = e => {
        const b = e.target.closest('.st'); if (!b) return;
        const i = +b.dataset.i;
        if (this.sel < 0) { toast('Pick a colour below first, then tap stickers to paint them.'); return; }
        this.labels[i] = this.sel; this.unsure.delete(i); this.render();
      };
      $('#rev-pal').innerHTML = NAMES.map((n, c) => `<button class="pal${this.sel === c ? ' on' : ''}" data-c="${c}"><span style="background:${COLORS[c]}"></span>${n} <small class="${counts[c] === 16 ? '' : 'warn'}">${counts[c]}/16</small></button>`).join('');
      $('#rev-pal').onclick = e => { const b = e.target.closest('.pal'); if (!b) return; this.sel = +b.dataset.c === this.sel ? -1 : +b.dataset.c; this.render(); };
      let msg;
      if (res.ok) msg = `<b class="ok">✓ This is a real cube.</b> ${this.unsure.size ? 'Glance at the stickers with a dot (the camera was least sure about them), then tap Solve.' : 'Tap Solve.'}`;
      else {
        const wrongCount = counts.map((n, c) => n !== 16 ? `${NAMES[c]} ${n}` : '').filter(Boolean).join(', ');
        const pieces = res.problems.filter(p => p.kind === 'corner' || p.kind === 'edge').length;
        msg = `<b class="bad">Something doesn't add up.</b> ` + (wrongCount ? `Every colour should appear 16 times (now: ${wrongCount}). ` : '') +
          (pieces ? `${pieces} piece${pieces > 1 ? 's' : ''} can't exist on a real cube (red outline). ` : '') +
          (res.problems.some(p => p.kind === 'twist') ? 'One corner looks twisted: check the corner stickers. ' : '') + 'Pick a colour and tap to fix, or rescan.';
      }
      $('#rev-msg').innerHTML = msg;
      $('#rev-solve').disabled = !res.ok;
    },
  };

  // ---------------- solve ----------------
  const STAGE_ICON = { centres: '◼', edges: '▬', cross: '✚', corners: '◣', middle: '☰', ycross: '✚', yedges: '▭', ycorners: '◥', orient: '↻' };
  screens.solve = {
    title: 'Solve',
    start(state) {
      const res = Solver.solve(Uint8Array.from(state));
      this.d = { start: Uint8Array.from(state), res, step: 0, move: 0, reveal: 0, t0: Date.now() };
      this.save();
    },
    save() { if (this.d) store.set('solve', { start: Array.from(this.d.start), step: this.d.step, move: this.d.move, t0: this.d.t0 }); },
    restore() {
      const s = store.get('solve'); if (!s) return false;
      try { const res = Solver.solve(Uint8Array.from(s.start)); this.d = { start: Uint8Array.from(s.start), res, step: Math.min(s.step, res.steps.length), move: s.move, reveal: 2, t0: s.t0 || Date.now() }; return true; } catch (e) { return false; }
    },
    get step() { return this.d.res.steps[this.d.step]; },
    teach() { return store.get('teach', true); },
    curState() { const st = this.step; return st ? M4.apply(st.before, st.moves.slice(0, this.d.move)) : M4.solved(); },
    enter() {
      if (!this.d && !this.restore()) { go(''); return; }
      if (!this.view) {
        this.view = new CubeView($('#sv-cube'));
        $('#sv-next').onclick = () => this.next();
        $('#sv-prev').onclick = () => this.prev();
        $('#sv-play').onclick = () => this.playAll();
        $('#sv-nextstep').onclick = () => this.nextStep();
        $('#sv-hintbtn').onclick = () => { this.d.reveal = Math.max(this.d.reveal, 1); this.render(); };
        $('#sv-movesbtn').onclick = () => { this.d.reveal = 2; this.render(); };
        $('#sv-teach').onchange = e => { store.set('teach', e.target.checked); this.d.reveal = e.target.checked ? 0 : 2; this.render(); };
        $('#sv-cam').onclick = () => this.setAR(!this.ar);
        $('#sv-flip').onclick = async () => { await camera.switch().catch(() => {}); store.set('solveFacing', camera.facing); toast(camera.mirrored ? 'Front camera: it sees the back of your cube, like a mirror.' : 'Back camera: point it at the front of your cube.', 4000); };
        $('#sv-check').onclick = () => this.check();
        $('#sv-list').onclick = () => this.openList();
        $('#sv-resetview').onclick = () => this.view.resetView();
        $('#sv-rescan').onclick = () => go('scan');
      }
      $('#sv-teach').checked = this.teach();
      if (!this.teach()) this.d.reveal = 2;
      this.keys = e => {
        if (e.target.closest('input,textarea')) return;
        if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); this.d.reveal = 2; this.next(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
        else if (e.key === 'Enter') { e.preventDefault(); this.nextStep(); }
        else if (e.key === 'c' || e.key === 'C') this.check();
      };
      document.addEventListener('keydown', this.keys);
      this.view.setState(this.curState());
      this.render();
    },
    leave() { document.removeEventListener('keydown', this.keys); this.playing = false; if (this.ar) this.setAR(false); },
    async setAR(on) {
      this.ar = on;
      $('#sv-view').classList.toggle('ar', on);
      $('#sv-cam').classList.toggle('on', on);
      $('#sv-flip').hidden = !on;
      if (on) {
        mountCam($('#sv-camhost'));
        onFrame = (g, sq) => this.frame(g, sq);
        await startCam(store.get('solveFacing', 'user'));
        if (!store.get('arTold')) { toast(camera.mirrored ? 'Hold your cube in the box. The camera sees its back, like a mirror: turn the layer the way the arrow moves.' : 'Point the camera at the front of your cube and keep it in the box.', 6000); store.set('arTold', 1); }
      } else { onFrame = null; camera.stop(); camBox.hidden = true; this.checking = null; }
      this.view.render();
    },
    move() { const st = this.step; return st && this.d.reveal >= 2 && this.d.move < st.moves.length ? st.moves[this.d.move] : null; },
    focusSet() {
      const st = this.step; if (!st || !st.focus) return null;
      const s = this.curState(), f = st.focus, set = new Set(), has = (arr, cs) => cs.length === arr.length && cs.every(c => arr.includes(c));
      if (f.type === 'centre') M4.centreIdx.forEach(i => { if (f.colours.includes(s[i])) set.add(i); });
      else if (f.type === 'wing') M4.wings.forEach(w => { if (has(w.map(i => s[i]), f.colours)) w.forEach(i => set.add(i)); });
      else if (f.type === 'corner') M4.corners.forEach(c => { if (has(c.map(i => s[i]), f.colours)) c.forEach(i => set.add(i)); });
      else if (f.type === 'edge') M4.edgeSlots.forEach(e => { const ws = e.wings.map(w => M4.wings[w]); if (ws.every(w => has(w.map(i => s[i]), f.colours))) ws.flat().forEach(i => set.add(i)); });
      else if (f.type === 'top') for (let i = 0; i < 96; i++) if (M4.pos[i][1] >= 3) set.add(i);
      return set;
    },
    render() {
      const d = this.d, steps = d.res.steps, st = this.step;
      // stages: everything before the current stage is done
      const order = d.res.stages.map(x => x.key), curIdx = st ? order.indexOf(st.stage) : order.length;
      $('#sv-stages').innerHTML = d.res.stages.map((sg, i) => {
        const cls = i < curIdx || sg.done && i !== curIdx ? 'done' : i === curIdx ? 'now' : '';
        return `<span class="chip ${cls}" title="${esc(sg.name)}">${cls === 'done' ? '✓' : STAGE_ICON[sg.key]} ${esc(sg.name)}</span>`;
      }).join('');
      const nowChip = $('#sv-stages .chip.now'), bar = $('#sv-stages');
      if (nowChip) bar.scrollLeft = nowChip.offsetLeft - bar.clientWidth / 2 + nowChip.clientWidth / 2;
      if (!st) { this.renderDone(); return; }
      $('#sv-done').hidden = true; $('#sv-card').hidden = false;
      $('#sv-count').textContent = `Step ${d.step + 1} of ${steps.length}`;
      $('#sv-title').textContent = st.title;
      $('#sv-goal').textContent = st.goal;
      $('#sv-ladder').hidden = d.reveal >= 2;
      $('#sv-hintbtn').hidden = d.reveal >= 1;
      $('#sv-hint').hidden = d.reveal < 1;
      $('#sv-hint').textContent = st.hint;
      const showMoves = d.reveal >= 2;
      $('#sv-moves').hidden = !showMoves; $('#sv-player').hidden = !showMoves;
      if (showMoves) {
        let k = 0;
        $('#sv-moves').innerHTML = st.groups.map(g => `<div class="grp${g.rotation ? ' rot' : ''}"><div class="glbl">${esc(g.label)}</div><div class="gmv">${g.moves.map(m => { const i = k++; return `<span class="mv${i < d.move ? ' done' : i === d.move ? ' cur' : ''}">${esc(m)}</span>`; }).join('')}</div></div>`).join('');
        const box = $('#sv-moves'), cur = $('#sv-moves .cur');   // scroll the list only, never the page
        if (cur) { const top = cur.offsetTop; if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 30) box.scrollTop = top - 40; }
      }
      $('#sv-prev').disabled = d.move === 0;
      const atEnd = d.move >= st.moves.length;
      $('#sv-next').disabled = atEnd;
      $('#sv-next').textContent = atEnd ? 'Step done' : `Next: ${st.moves[d.move]}  ▶`;
      $('#sv-nextstep').classList.toggle('primary', atEnd);
      $('#sv-nextstep').textContent = d.step === steps.length - 1 ? 'Finish' : 'Next step';
      this.view.setArrow(this.move());
      this.view.setHighlight(this.focusSet());
      this.save();
    },
    renderDone() {
      $('#sv-card').hidden = true; $('#sv-done').hidden = false;
      const moves = this.d.res.steps.reduce((a, s) => a + s.moves.filter(t => !/^[xyz]/.test(t)).length, 0);
      const mins = Math.max(1, Math.round((Date.now() - this.d.t0) / 60000));
      $('#sv-donetext').textContent = this.d.res.steps.length ? `${this.d.res.steps.length} steps, ${moves} moves, about ${mins} min.` : 'Your cube is already solved!';
      this.view.setArrow(null); this.view.setHighlight(null); this.view.setState(M4.solved());
      store.set('solve', null);
      store.set('solves', store.get('solves', 0) + 1);
    },
    async next() {
      const st = this.step; if (!st || this.busy) return;
      if (this.d.move >= st.moves.length) return;
      this.d.reveal = 2;
      const tok = st.moves[this.d.move];
      this.busy = true; this.d.move++;
      if (DEMO) demo.move([tok]);
      this.render(); this.view.setArrow(null);
      await this.view.play(tok, this.playing ? 380 : 300);
      this.busy = false; this.render();
    },
    async prev() {
      const st = this.step; if (!st || this.busy || this.d.move === 0) return;
      const tok = st.moves[this.d.move - 1];
      this.busy = true; this.d.move--;
      if (DEMO) demo.move([Cube.invertToken(tok)]);
      this.view.setArrow(null);
      await this.view.play(Cube.invertToken(tok), 260);
      this.busy = false; this.render();
    },
    async playAll() {
      if (this.playing) { this.playing = false; $('#sv-play').textContent = 'Play'; return; }
      this.playing = true; $('#sv-play').textContent = 'Pause';
      while (this.playing && this.step && this.d.move < this.step.moves.length) { await this.next(); await sleep(this.ar ? 1400 : 500); }
      this.playing = false; $('#sv-play').textContent = 'Play';
    },
    nextStep() {
      const st = this.step; if (!st || this.busy) return;
      if (DEMO && this.d.move < st.moves.length) demo.move(st.moves.slice(this.d.move));
      this.d.step++; this.d.move = 0; this.d.reveal = this.teach() ? 0 : 2;
      $('#sv-result').textContent = '';
      this.view.setState(this.curState());
      this.render();
    },
    openList() {
      const d = this.d, list = $('#sv-listbox');
      let lastStage = '';
      list.innerHTML = d.res.steps.map((s, i) => {
        const head = s.stage !== lastStage ? `<h3>${esc(d.res.stages.find(x => x.key === s.stage).name)}</h3>` : '';
        lastStage = s.stage;
        return `${head}<button class="li${i < d.step ? ' done' : i === d.step ? ' now' : ''}" data-i="${i}">${i < d.step ? '✓ ' : ''}${esc(s.title)}</button>`;
      }).join('');
      $('#sv-modal').hidden = false;
      list.onclick = e => {
        const b = e.target.closest('.li'); if (!b) return;
        d.step = +b.dataset.i; d.move = 0; d.reveal = this.teach() ? 0 : 2;
        $('#sv-modal').hidden = true; this.view.setState(this.curState()); this.render();
      };
      $('#sv-modalclose').onclick = () => ($('#sv-modal').hidden = true);
    },
    async check() {
      if (!store.get('calib')) { toast('Scan the cube first so the camera knows your colours.'); return; }
      if (!this.ar) await this.setAR(true);
      this.checking = { stable: 0, prev: null, t0: performance.now() };
      // suggest the side this step changed most: a wrong turn shows up there
      const st = this.step, now = this.curState(), from = st ? st.before : now, changed = [0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 96; i++) if (now[i] !== from[i]) changed[(i / 16) | 0]++;
      const best = changed.indexOf(Math.max(...changed));
      const SIDE = ['top', 'right', 'front', 'bottom', 'left', 'back'];
      const facing = camera.mirrored ? 5 : 2;
      const which = !changed[best] || changed[facing] >= changed[best] * 0.8 ? '' : ` Best: turn the cube so its <b>${SIDE[best]}</b> side faces the camera (it changed most), then turn it back.`;
      $('#sv-result').innerHTML = (camera.mirrored ? 'Hold the cube in the box, the side facing the camera, and keep still.' : 'Point the camera at a side of the cube, inside the box. Keep still.') + which;
    },
    frame(g, sq) {
      drawGrid(g, sq, null, this.checking ? 'scan' : 'ar');
      const tok = this.move();
      if (tok && !this.checking) this.drawAR(g, sq, tok);
      if (!this.checking) return;
      const img = camera.grab(sq), f = img && Vision.sampleFace(img);
      if (!f) return;
      let diff = 999;
      if (this.checking.prev) diff = Math.max(...f.cells.map((c, k) => Math.abs(c.rgb[0] - this.checking.prev[k].rgb[0]) + Math.abs(c.rgb[1] - this.checking.prev[k].rgb[1])));
      this.checking.prev = f.cells;
      this.checking.stable = f.ok && diff < 50 ? this.checking.stable + 1 : 0;
      if (performance.now() - this.checking.t0 > 20000) { this.checking = null; $('#sv-result').textContent = 'No face found in the box. Tap Check to try again.'; return; }
      if (this.checking.stable < 6) return;
      this.checking = null;
      const labels = Vision.classify(f.cells.map(c => c.rgb), store.get('calib'));
      const exp = this.curState(), cam = camera.mirrored ? M4.apply(exp, ['y2']) : exp;
      let best = { n: -1, seq: [] };
      for (const seq of Solver.ORIENTS.values()) {
        const s = seq.length ? M4.apply(cam, seq) : cam; let n = 0;
        for (let i = 0; i < 16; i++) n += s[32 + i] === labels[i];
        if (n > best.n || (n === best.n && !seq.length)) best = { n, seq };
      }
      buzz(best.n >= 15 ? 30 : [60, 60, 60]);
      if (best.n >= 15 && !best.seq.length) $('#sv-result').innerHTML = '<b class="ok">✓ Matches. Nice!</b>';
      else if (best.n >= 15) $('#sv-result').innerHTML = '<b class="ok">✓ Matches.</b> Now turn the cube back the way you were holding it (like the 3D picture).';
      else $('#sv-result').innerHTML = `<b class="bad">✗ Doesn't match</b> (${best.n}/16 stickers). A move may have gone wrong: step back with ◀ to compare, or <a href="#scan">rescan</a> to carry on from where your cube is now.`;
    },
    drawAR(g, sq, tok) {
      let geo = M4.geom(tok);
      if (camera.mirrored && geo.axis !== 1) geo = { axis: geo.axis, lo: -geo.hi, hi: -geo.lo, angle: -geo.angle };   // camera sees the back
      const shapes = arrowShapes(geo).filter(s => s.normal[0] === 2 && s.normal[1] === 1);
      const sx = camera.mirrored ? -1 : 1;
      const map = p => [sq.x + sq.size * (0.5 + sx * p[0] / 8), sq.y + sq.size * (0.5 - p[1] / 8)];
      let note = '';
      for (const s of shapes) {
        const dashed = s.kind === 'arc' && !s.moving;
        if (dashed) note = geo.lo <= -4 ? 'far side' : 'inner slice';
        drawPolyArrow(g, s.pts.map(map), sq.size * 0.05, { dashed, color: '#ffe14d' });
      }
      g.font = `700 ${Math.round(sq.size * 0.11)}px system-ui, sans-serif`;
      g.textBaseline = 'top'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.fillStyle = '#fff';
      const label = tok + (note ? `  (${note})` : '');
      g.strokeText(label, sq.x + 8, sq.y - sq.size * 0.14); g.fillText(label, sq.x + 8, sq.y - sq.size * 0.14);
    },
  };

  // ---------------- learn ----------------
  screens.learn = {
    title: 'Learn',
    enter() {
      const done = store.get('lessons', {});
      $('#learn-list').innerHTML = Content.LESSONS.map((l, i) => `<a class="card" href="#lesson/${l.id}"><span class="num">${done[l.id] ? '✓' : i + 1}</span><span><b>${esc(l.title)}</b><small>${l.mins} min</small></span></a>`).join('');
    },
  };
  screens.lesson = {
    title: 'Lesson',
    enter(id) {
      const L = Content.LESSONS.find(l => l.id === id) || Content.LESSONS[0];
      $('#title').textContent = L.title;
      const i = Content.LESSONS.indexOf(L), nextL = Content.LESSONS[i + 1];
      $('#lesson-body').innerHTML = L.parts.map((p, pi) => `<div class="part">${p.html}${p.demos ? `<div class="demo"><canvas class="dcube" data-p="${pi}"></canvas><div class="dbtns">${p.demos.map((d, di) => `<button class="btn" data-p="${pi}" data-d="${di}">▶ ${esc(d.label)}</button>`).join('')}</div><p class="dmoves" data-p="${pi}"></p></div>` : ''}</div>`).join('') +
        `<div class="row">${L.drill ? `<a class="btn primary" href="#drill/${L.drill}">Practice this</a>` : ''}${nextL ? `<a class="btn" href="#lesson/${nextL.id}">Next: ${esc(nextL.title)}</a>` : ''}</div>`;
      this.views = {};
      $$('#lesson-body canvas.dcube').forEach(cv => {
        const p = L.parts[+cv.dataset.p], v = new CubeView(cv);
        const d0 = p.demos[0]; v.setState(M4.apply(M4.solved(), d0.setup || []));
        this.views[cv.dataset.p] = v;
      });
      $('#lesson-body').onclick = async e => {
        const b = e.target.closest('button[data-d]'); if (!b) return;
        const p = L.parts[+b.dataset.p], d = p.demos[+b.dataset.d], v = this.views[b.dataset.p];
        if (v.busy) return; v.busy = true;
        const moves = d.moves.split(' ');
        v.setState(M4.apply(M4.solved(), d.setup || []));
        v.setHighlight(d.focus === 'top' ? new Set([...Array(96).keys()].filter(i => M4.pos[i][1] >= 3)) : null);
        const out = $(`.dmoves[data-p="${b.dataset.p}"]`);
        for (let k = 0; k < moves.length; k++) {
          out.innerHTML = moves.map((m, j) => `<span class="mv${j < k ? ' done' : j === k ? ' cur' : ''}">${esc(m)}</span>`).join(' ');
          v.setArrow(moves[k]); await sleep(450); v.setArrow(null);
          await v.play(moves[k], 420);
        }
        out.innerHTML = moves.map(m => `<span class="mv done">${esc(m)}</span>`).join(' ');
        v.busy = false;
      };
      const done = store.get('lessons', {}); done[L.id] = 1; store.set('lessons', done);
    },
  };

  // ---------------- practice ----------------
  const stars = st => { if (!st || !st.ok) return '☆☆☆'; const n = st.clean >= 5 ? 3 : st.clean >= 2 ? 2 : 1; return '★'.repeat(n) + '☆'.repeat(3 - n); };
  screens.practice = {
    title: 'Practice',
    enter() {
      const stats = store.get('drills', {});
      $('#practice-list').innerHTML = Content.DRILLS.map(d => `<a class="card" href="#drill/${d.id}"><span class="stars">${stars(stats[d.id])}</span><span><b>${esc(d.title)}</b><small>${esc(d.quiz ? 'Quiz' : d.prompt)}</small></span></a>`).join('');
    },
  };
  const QUIZ = ['R', "R'", 'R2', 'L', "L'", 'U', "U'", 'D', "D'", 'F', "F'", 'B', "B'", 'r', "r'", 'l', "l'", 'u', "u'", 'Rw', "Rw'", 'Uw', "Uw'", 'x', "x'", 'y', "y'", 'z'];
  screens.drill = {
    title: 'Practice',
    enter(id) {
      const D = Content.DRILLS.find(d => d.id === id) || Content.DRILLS[0];
      this.D = D; $('#title').textContent = D.title;
      if (!this.view) this.view = new CubeView($('#dr-cube'));
      $('#dr-prompt').textContent = D.prompt;
      $('#dr-status').textContent = '';
      $('#dr-keys').hidden = !!D.quiz; $('#dr-tools').hidden = !!D.quiz; $('#dr-quiz').hidden = !D.quiz;
      if (D.quiz) { this.quizNext(); return; }
      $('#dr-keys').innerHTML = D.keys.map(k => `<div class="kgroup">${Content.KEYS[k].map(t => `<button class="key" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>`).join('');
      $('#dr-keys').onclick = e => { const b = e.target.closest('.key'); if (b) this.press(b.dataset.t); };
      $('#dr-undo').onclick = () => { if (!this.typed.length || this.view.busy) return; const t = this.typed.pop(); this.view.play(Cube.invertToken(t), 200); this.showTyped(); };
      $('#dr-reset').onclick = () => this.reset();
      $('#dr-answer').onclick = () => this.answer();
      this.reset();
    },
    reset() {
      this.typed = []; this.usedAnswer = false; this.solved = false;
      this.view.setState(M4.apply(M4.solved(), this.D.setup.split(' ')));
      this.view.setArrow(null);
      this.view.setHighlight(this.D.focus === 'top' ? new Set([...Array(96).keys()].filter(i => M4.pos[i][1] >= 3)) : null);
      $('#dr-status').textContent = ''; this.showTyped();
    },
    showTyped() { $('#dr-typed').innerHTML = this.typed.length ? this.typed.map(t => `<span class="mv">${esc(t)}</span>`).join(' ') : '<span class="muted">Tap the moves below</span>'; },
    async press(t) {
      if (this.solved) return;
      this.typed.push(t); this.showTyped();
      await this.view.play(t, 220);
      if (M4.isSolved(this.view.state)) {
        this.solved = true;
        const stats = store.get('drills', {}), s = stats[this.D.id] || { ok: 0, clean: 0 };
        s.ok++; if (!this.usedAnswer) s.clean++; stats[this.D.id] = s; store.set('drills', stats);
        buzz(40);
        $('#dr-status').innerHTML = `<b class="ok">✓ Solved${this.usedAnswer ? '' : ' by yourself'}!</b> ${stars(s)} <button class="btn" id="dr-again">Again</button>`;
        $('#dr-again').onclick = () => this.reset();
      } else if (this.typed.length > this.D.answer.split(' ').length * 2 + 4) $('#dr-status').textContent = 'Lost? Tap Reset, or Show answer.';
    },
    async answer() {
      if (this.view.busy) return;
      this.usedAnswer = true;
      this.view.setState(M4.apply(M4.solved(), this.D.setup.split(' '))); this.typed = []; this.showTyped(); this.solved = false;
      const moves = this.D.answer.split(' ');
      $('#dr-status').innerHTML = `Answer: <b>${esc(this.D.answer)}</b>`;
      this.view.busy = true;
      for (const m of moves) { this.view.setArrow(m); await sleep(400); this.view.setArrow(null); await this.view.play(m, 380); }
      this.view.busy = false;
      $('#dr-status').innerHTML = `Answer: <b>${esc(this.D.answer)}</b>. Now try it yourself: <button class="btn" id="dr-again">Try</button>`;
      $('#dr-again').onclick = () => this.reset();
    },
    async quizNext() {
      const t = QUIZ[Math.floor(Math.random() * QUIZ.length)];
      const base = t.replace(/['2]/g, ''), opts = new Set([t]);
      const near = QUIZ.filter(q => q !== t && (q.replace(/['2]/g, '').toUpperCase().startsWith(base[0].toUpperCase()) || q.replace(/['2]/g, '') === base));
      while (opts.size < 4) opts.add((near.length && Math.random() < 0.7 ? near : QUIZ)[Math.floor(Math.random() * (near.length && Math.random() < 0.7 ? near.length : QUIZ.length))] || QUIZ[0]);
      const list = [...opts].sort(() => Math.random() - 0.5);
      this.view.setHighlight(null); this.view.setState(M4.solved());
      $('#dr-quiz').innerHTML = list.map(o => `<button class="btn qopt" data-o="${esc(o)}">${esc(o)}</button>`).join('') + '<button class="btn" id="dr-replay">↺ Replay</button>';
      $('#dr-status').textContent = '';
      const show = async () => { this.view.setState(M4.solved()); await sleep(250); await this.view.play(t, 650); };
      $('#dr-replay').onclick = show;
      $$('.qopt').forEach(b => (b.onclick = () => {
        const ok = b.dataset.o === t;
        b.classList.add(ok ? 'good' : 'wrong');
        if (ok) { const stats = store.get('drills', {}), s = stats.notation || { ok: 0, clean: 0 }; s.ok++; s.clean++; stats.notation = s; store.set('drills', stats); }
        $('#dr-status').innerHTML = (ok ? '<b class="ok">✓ Right!</b> ' : `<b class="bad">It was ${esc(t)}.</b> `) + '<button class="btn primary" id="dr-qnext">Next</button>';
        $('#dr-qnext').onclick = () => this.quizNext();
      }));
      show();
    },
  };

  // ---------------- cheat sheet + install ----------------
  screens.sheet = {
    title: 'Cheat sheet',
    enter() {
      if (this.built) return; this.built = true;
      $('#sheet-body').innerHTML = Content.SHEET.map((g, gi) => `<h2>${esc(g.group)}</h2><div class="sheetgrid">${g.items.map((it, ii) => `<div class="scard"><canvas data-g="${gi}" data-i="${ii}"></canvas><div><b>${esc(it.name)}</b><p class="alg">${esc(it.alg)}</p><small>${esc(it.when)}</small></div></div>`).join('')}</div>`).join('');
      $$('#sheet-body canvas').forEach(cv => {
        const it = Content.SHEET[+cv.dataset.g].items[+cv.dataset.i];
        const v = new CubeView(cv, { drag: false, pitch: 0.6, yaw: -0.55 });
        v.setState(M4.apply(M4.solved(), it.setup.split(' ')));
      });
      $('#sheet-print').onclick = () => window.print();
    },
  };
  screens.about = { title: 'Install & privacy' };

  // offline: cache the app on first visit (needs https or localhost)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !DEMO) navigator.serviceWorker.register('sw.js').catch(() => {});
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; $('#install-btn').hidden = false; });
  $('#install-btn').onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('#install-btn').hidden = true; };

  window.CubeCoach = { screens, camera, go, store, demo };
  route();
})();

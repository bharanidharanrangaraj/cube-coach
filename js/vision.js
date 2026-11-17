/* vision.js - reads sticker colours from camera frames, on the device.
 *
 * Per frame: sample the middle of each of the 16 grid cells (median colour, so glare spots and
 * edges don't matter) and check the cells look like stickers (even colour, darker lines between).
 * After all 6 faces: white-balance the 96 samples, then group them into 6 colours of exactly 16
 * each (a 4x4 has 16 stickers of every colour), which fixes most red/orange and white/yellow
 * mix-ups. Any leftovers are fixed by checking every corner and edge piece is a real piece.
 */
(function (G) {
  'use strict';
  // colour ids follow Solver.DEFAULT_NAMES
  const NAMES = ['white', 'red', 'green', 'yellow', 'orange', 'blue'];
  const REF_RGB = [[235, 235, 235], [190, 25, 40], [0, 160, 80], [250, 215, 0], [255, 100, 0], [0, 80, 200]];
  const DISPLAY = ['#f4f4f4', '#d0142c', '#06a05a', '#ffd400', '#ff7a00', '#0b5fd8'];

  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lab([r, g, b]) {
    const R = lin(r), Gc = lin(g), B = lin(b);
    let x = (R * 0.4124 + Gc * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + Gc * 0.7152 + B * 0.0722, z = (R * 0.0193 + Gc * 0.1192 + B * 0.9505) / 1.08883;
    const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  // Shadows scale all of L+16, a and b together, so a/(L+16) and b/(L+16) stay the same in a
  // darker spot: compare those (plus a little lightness) instead of raw Lab.
  function feat(rgb) { const [L, a, b] = lab(rgb), k = L + 16; return [0.25 * k, 100 * a / k, 100 * b / k]; }
  const dist = (p, q) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  const REF_LAB = REF_RGB.map(feat);
  const REF_MEAN = [0, 1, 2].map(k => REF_RGB.reduce((a, c) => a + c[k], 0) / 6);

  function hsv([r, g, b]) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx / 255];
  }
  /** quick guess for the live preview (final colours come from grouping all 96) */
  function guess(rgb) {
    const [h, s, v] = hsv(rgb);
    if (s < 0.28 && v > 0.35) return 0;
    if (h < 14 || h >= 330) return 1;
    if (h < 38) return 4;
    if (h < 72) return 3;
    if (h < 165) return 2;
    if (h < 265) return 5;
    return 1;
  }

  /**
   * Sample one face from a square ImageData (the grid area). Returns
   * {cells:[{rgb, spread}], ok (looks like a cube face), lines (fraction of darker grid lines)}
   */
  function sampleFace(img) {
    const W = img.width, H = img.height, d = img.data, cw = W / 4, ch = H / 4;
    const lum = (x, y) => { const i = (y * W + x) * 4; return d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; };
    const cells = [];
    const rs = [], gs = [], bs = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      rs.length = gs.length = bs.length = 0;
      const x0 = Math.round(c * cw + cw * 0.3), x1 = Math.round(c * cw + cw * 0.7), y0 = Math.round(r * ch + ch * 0.3), y1 = Math.round(r * ch + ch * 0.7);
      const step = Math.max(1, Math.round((x1 - x0) / 10));
      for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { const i = (y * W + x) * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
      const med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
      const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
      const rgb = [med(rs), med(gs), med(bs)];
      // spread: inter-quartile range of the sorted channels
      const spread = Math.max(q(rs, 0.8) - q(rs, 0.2), q(gs, 0.8) - q(gs, 0.2), q(bs, 0.8) - q(bs, 0.2));
      cells.push({ rgb, spread, lum: rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11 });
    }
    // lines between neighbouring cells should be darker than the cells (black plastic / gaps)
    let darker = 0, total = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc; if (r2 > 3 || c2 > 3) continue;
        // sample a short band across the boundary, take the darkest point
        const bx = (c + 0.5 + dc * 0.5) * cw, by = (r + 0.5 + dr * 0.5) * ch;
        let mn = 255;
        for (let k = -4; k <= 4; k++) {
          const x = Math.round(bx + (dc ? k * cw / 24 : 0) + (dr ? (k / 4) * cw * 0.15 : 0));
          const y = Math.round(by + (dr ? k * ch / 24 : 0) + (dc ? (k / 4) * ch * 0.15 : 0));
          if (x >= 0 && y >= 0 && x < W && y < H) mn = Math.min(mn, lum(x, y));
        }
        total++;
        if (mn < 0.8 * Math.min(cells[r * 4 + c].lum, cells[r2 * 4 + c2].lum)) darker++;
      }
    }
    const lines = darker / total;
    const even = cells.filter(c => c.spread < 38 + c.lum * 0.15).length;
    const bright = cells.filter(c => c.lum > 25).length;
    return { cells, lines, ok: even >= 15 && bright === 16 && lines >= 0.6 };
  }

  // ---------- Hungarian algorithm (min cost, rows <= cols) ----------
  function hungarian(cost, n, m) {
    const INF = 1e18, u = new Float64Array(n + 1), v = new Float64Array(m + 1), p = new Int32Array(m + 1), way = new Int32Array(m + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const minv = new Float64Array(m + 1).fill(INF), used = new Uint8Array(m + 1);
      do {
        used[j0] = 1; const i0 = p[j0], row = cost[i0 - 1]; let delta = INF, j1 = 0;
        for (let j = 1; j <= m; j++) if (!used[j]) {
          const cur = row[j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const ans = new Int32Array(n); for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
    return ans;
  }

  /**
   * Group 96 sticker colours (rgb arrays, model sticker order) into the 6 cube colours.
   * Returns {labels: Uint8Array(96) colour ids, calib: {gain, means}, alt: second choice per sticker}
   */
  function cluster(rgbs) {
    const n = rgbs.length, per = n / 6;
    // white balance: on average the 6 cube colours look like REF_MEAN
    const mean = [0, 1, 2].map(k => rgbs.reduce((a, c) => a + c[k], 0) / n);
    const gain = mean.map((m, k) => Math.min(2.5, Math.max(0.4, REF_MEAN[k] / Math.max(1, m))));
    const bal = rgbs.map(c => c.map((v, k) => Math.min(255, v * gain[k])));
    const L = bal.map(feat);
    let means = REF_LAB.map(x => x.slice());
    let labels = new Uint8Array(n);
    // start from the quick guess when it already gives a fair split
    for (let it = 0; it < 8; it++) {
      const cost = L.map(p => { const row = new Float64Array(n); for (let k = 0; k < 6; k++) { const dd = dist(p, means[k]); for (let s = 0; s < per; s++) row[k * per + s] = dd; } return row; });
      const a = hungarian(cost, n, n);
      const next = new Uint8Array(n); for (let i = 0; i < n; i++) next[i] = (a[i] / per) | 0;
      const same = labels.every((v, i) => v === next[i]);
      labels = next;
      means = [0, 1, 2, 3, 4, 5].map(k => { const pts = L.filter((_, i) => labels[i] === k); return [0, 1, 2].map(j => pts.reduce((s, p) => s + p[j], 0) / pts.length); });
      if (same && it > 0) break;
    }
    // name the groups: best match of group means to the reference colours
    const nameCost = means.map(m => Float64Array.from(REF_LAB, r => dist(m, r)));
    const nameOf = hungarian(nameCost, 6, 6);
    labels = labels.map(l => nameOf[l]);
    const named = []; means.forEach((m, k) => (named[nameOf[k]] = m));
    const alt = new Uint8Array(n), margin = new Float32Array(n);
    L.forEach((p, i) => {
      const ds = named.map(m => dist(p, m)); const order = [0, 1, 2, 3, 4, 5].sort((x, y) => ds[x] - ds[y]);
      alt[i] = order[0] === labels[i] ? order[1] : order[0];
      margin[i] = ds[alt[i]] - ds[labels[i]];
    });
    return { labels, alt, margin, calib: { gain, means: named } };
  }

  /** colour ids for a fresh face using the calibration from the scan */
  function classify(rgbs, calib) {
    return rgbs.map(c => {
      const p = feat(c.map((v, k) => Math.min(255, v * calib.gain[k])));
      let best = 0, bd = Infinity;
      calib.means.forEach((m, k) => { const dd = dist(p, m); if (dd < bd) { bd = dd; best = k; } });
      return best;
    });
  }

  /** Swap doubtful stickers until every piece is a real piece (keeps 16 of each colour). */
  function repair(labels, alt, margin, analyse) {
    let cur = Uint8Array.from(labels), res = analyse(cur);
    for (let round = 0; round < 6 && !res.ok; round++) {
      const bad = [...res.bad];
      let best = null;
      for (const i of bad) for (let j = 0; j < cur.length; j++) {
        if (cur[j] !== alt[i] || cur[i] === cur[j]) continue;
        if (!(alt[j] === cur[i] || res.bad.has(j))) continue;
        const t = Uint8Array.from(cur); t[i] = cur[j]; t[j] = cur[i];
        const r = analyse(t);
        const score = r.problems.length * 1000 + margin[i] + margin[j];
        if (r.problems.length < res.problems.length && (!best || score < best.score)) best = { t, r, score };
      }
      if (!best) break;
      cur = best.t; res = best.r;
    }
    return { labels: cur, result: res };
  }

  G.Vision = { NAMES, DISPLAY, REF_RGB, lab, guess, sampleFace, cluster, classify, repair, hungarian };
})(typeof self !== 'undefined' ? self : globalThis);

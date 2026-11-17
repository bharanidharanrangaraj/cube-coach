/* cube.js - sticker-level model of an NxN cube (used for 4x4 and 3x3).
 *
 * Faces are numbered U R F D L B = 0..5. Sticker index = face*N*N + row*N + col, each face read
 * the way you look at it in the usual "net": U with B at the top, F/R/B/L with U at the top,
 * D with F at the top. Moves are built from 3D geometry, so every turn is exactly right.
 *
 * Notation: R L U D F B = outer layer, r l u d f b = the inner slice next to it,
 * Rw Lw ... = both layers, x y z = whole-cube turns. ' = anticlockwise, 2 = half turn.
 * Classic script (no modules) so it also runs from file:// and in Node.
 */
(function (G) {
  'use strict';
  const NORMALS = [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
  const AXIS = [1, 0, 2, 1, 0, 2];     // x=0 y=1 z=2
  const SIGN = [1, 1, 1, -1, -1, -1];
  const FACE_CHARS = 'URFDLB';

  function rot90(p, axis, dir) {      // +90deg about +axis (right-hand rule) when dir=1
    const [x, y, z] = p;
    if (axis === 0) return dir > 0 ? [x, -z, y] : [x, z, -y];
    if (axis === 1) return dir > 0 ? [z, y, -x] : [-z, y, x];
    return dir > 0 ? [-y, x, z] : [y, -x, z];
  }

  function makeModel(N) {
    const NN = N * N, S = 6 * NN, H = N;
    const V = []; for (let i = 0; i < N; i++) V.push(-(N - 1) + 2 * i);
    const pos = [], nrm = [], face = [];
    for (let f = 0; f < 6; f++) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let p;
      switch (f) {
        case 0: p = [V[c], H, V[r]]; break;
        case 1: p = [H, -V[r], -V[c]]; break;
        case 2: p = [V[c], -V[r], H]; break;
        case 3: p = [V[c], -H, -V[r]]; break;
        case 4: p = [-H, -V[r], V[c]]; break;
        default: p = [-V[c], -V[r], -H];
      }
      pos.push(p); nrm.push(NORMALS[f]); face.push(f);
    }
    const key = p => p.join(',');
    const at = new Map(); pos.forEach((p, i) => at.set(key(p), i));
    const clamp = v => Math.max(-(N - 1), Math.min(N - 1, v));
    const cubie = i => pos[i].map(clamp);

    // base quarter turn (clockwise seen from face f) of layer k, as a "src" array: out[j] = in[src[j]]
    const base = {};
    function layerPerm(f, k) {
      const id = f * 16 + k;
      if (base[id]) return base[id];
      const a = AXIS[f], s = SIGN[f], src = new Int16Array(S);
      for (let i = 0; i < S; i++) src[i] = i;
      for (let i = 0; i < S; i++) {
        const cc = clamp(pos[i][a] * s);
        if ((N - 1 - cc) / 2 !== k) continue;
        const q = rot90(pos[i], a, -s);
        src[at.get(key(q))] = i;
      }
      return (base[id] = src);
    }
    const compose = (A, B) => { const o = new Int16Array(S); for (let j = 0; j < S; j++) o[j] = A[B[j]]; return o; }; // A then B
    const identity = () => { const o = new Int16Array(S); for (let i = 0; i < S; i++) o[i] = i; return o; };

    const TOKEN = /^([URFDLBurfdlbxyz])(w?)(2'|2|'|)$/;
    function info(tok) {               // {face, layers[], q}
      const m = TOKEN.exec(tok);
      if (!m) throw new Error('Bad move: ' + tok);
      let [, ch, w, suf] = m, f, layers;
      if ('xyz'.includes(ch)) { f = 'xyz'.indexOf(ch) === 0 ? 1 : ch === 'y' ? 0 : 2; layers = []; for (let k = 0; k < N; k++) layers.push(k); }
      else if (ch === ch.toUpperCase()) { f = FACE_CHARS.indexOf(ch); layers = w ? [0, 1] : [0]; }
      else { f = FACE_CHARS.indexOf(ch.toUpperCase()); layers = [1]; }
      const q = suf === "'" ? 3 : suf === '' ? 1 : 2;
      return { face: f, layers, q, rotation: 'xyz'.includes(ch) };
    }
    const cache = new Map();
    function perm(tok) {
      let p = cache.get(tok);
      if (p) return p;
      const { face: f, layers, q } = info(tok);
      p = identity();
      for (let t = 0; t < q; t++) for (const k of layers) p = compose(p, layerPerm(f, k));
      cache.set(tok, p);
      return p;
    }
    function parse(seq) {
      if (Array.isArray(seq)) return seq;
      return seq.replace(/[()\[\]]/g, ' ').trim().split(/\s+/).filter(Boolean);
    }
    function seqPerm(seq) { let p = identity(); for (const t of parse(seq)) p = compose(p, perm(t)); return p; }
    function applyPerm(state, p) { const o = new Uint8Array(S); for (let j = 0; j < S; j++) o[j] = state[p[j]]; return o; }
    function apply(state, seq) { let s = state; for (const t of parse(seq)) s = applyPerm(s, perm(t)); return s; }
    function solved(colors) { const s = new Uint8Array(S); for (let i = 0; i < S; i++) s[i] = colors ? colors[(i / NN) | 0] : (i / NN) | 0; return s; }
    function isSolved(s) { for (let f = 0; f < 6; f++) for (let i = 1; i < NN; i++) if (s[f * NN + i] !== s[f * NN]) return false; return true; }
    function dest(p) { const d = new Int16Array(S); for (let j = 0; j < S; j++) d[p[j]] = j; return d; }

    // geometry of a move for animation: axis, signed interval of moving layers (doubled coords), angle about +axis
    function geom(tok) {
      const { face: f, layers, q } = info(tok);
      const a = AXIS[f], s = SIGN[f];
      const kmin = Math.min(...layers), kmax = Math.max(...layers);
      let lo = N - 2 * (kmax + 1), hi = N - 2 * kmin;          // in face-signed coords
      if (s < 0) { const t = lo; lo = -hi; hi = -t; }
      const quarter = q === 3 ? 1 : q === 1 ? -1 : -2;          // clockwise = negative about normal
      return { axis: a, lo, hi, angle: quarter * s * Math.PI / 2 };
    }

    // pieces
    const groups = new Map();
    for (let i = 0; i < S; i++) { const k = key(cubie(i)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    const corners = [], wingsRaw = [], centres = [];
    for (const g of groups.values()) {
      if (g.length === 3) {                // order clockwise seen from outside, starting with the U/D sticker
        const c = cubie(g[0]);
        let ud = g.find(i => AXIS[face[i]] === 1);
        const others = g.filter(i => i !== ud);
        const n1 = nrm[ud], n2 = nrm[others[0]];
        const cr = [n1[1] * n2[2] - n1[2] * n2[1], n1[2] * n2[0] - n1[0] * n2[2], n1[0] * n2[1] - n1[1] * n2[0]];
        const dot = cr[0] * c[0] + cr[1] * c[1] + cr[2] * c[2];
        corners.push(dot < 0 ? [ud, others[0], others[1]] : [ud, others[1], others[0]]);
      } else if (g.length === 2) wingsRaw.push(g);
      else centres.push(g[0]);
    }
    // order wing stickers so the order is kept by every move (wings never flip in place)
    let wings = wingsRaw;
    if (N === 4) {
      const ordered = new Map(); const stickerWing = new Map();
      wingsRaw.forEach((w, i) => { stickerWing.set(w[0], i); stickerWing.set(w[1], i); });
      ordered.set(0, wingsRaw[0]);
      const queue = [0];
      const gens = []; for (let f = 0; f < 6; f++) for (let k = 0; k < N; k++) gens.push(dest(layerPerm(f, k)));
      while (queue.length) {
        const wi = queue.shift(), [a, b] = ordered.get(wi);
        for (const d of gens) {
          const na = d[a], nb = d[b], nw = stickerWing.get(na);
          if (!ordered.has(nw)) { ordered.set(nw, [na, nb]); queue.push(nw); }
          else if (ordered.get(nw)[0] !== na) throw new Error('wing order clash');
        }
      }
      wings = wingsRaw.map((_, i) => ordered.get(i));
    }
    // dedge slots (4x4) / edges (3x3): wings grouped by edge position
    const edgeSlots = [];
    {
      const m = new Map();
      wings.forEach((w, wi) => {
        const c = cubie(w[0]).map(v => (Math.abs(v) === N - 1 ? v : 0));
        const k = key(c);
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(wi);
      });
      for (const ws of m.values()) {
        const fa = face[wings[ws[0]][0]], fb = face[wings[ws[0]][1]];
        const byFace = ws.map(wi => { const o = {}; for (const st of wings[wi]) o[face[st]] = st; return o; });
        edgeSlots.push({ wings: ws, faces: [fa, fb], byFace });
      }
    }
    const wingOfSticker = new Int16Array(S).fill(-1);
    wings.forEach((w, i) => { wingOfSticker[w[0]] = i; wingOfSticker[w[1]] = i; });
    const slotOfWing = new Int16Array(wings.length);
    edgeSlots.forEach((e, ei) => e.wings.forEach(w => (slotOfWing[w] = ei)));
    const centreSlot = new Int16Array(S).fill(-1);
    const centreIdx = [];
    for (let f = 0; f < 6; f++) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (r === 0 || c === 0 || r === N - 1 || c === N - 1) continue;
      centreSlot[f * NN + r * N + c] = centreIdx.length; centreIdx.push(f * NN + r * N + c);
    }

    return {
      N, NN, S, pos, nrm, face, info, perm, seqPerm, parse, apply, applyPerm, compose, identity, dest,
      solved, isSolved, geom, corners, wings, edgeSlots, wingOfSticker, slotOfWing, centreIdx, centreSlot,
      idx: (f, r, c) => f * NN + r * N + c,
    };
  }

  function invertToken(t) { return t.endsWith("'") ? t.slice(0, -1) : t.endsWith('2') ? t : t + "'"; }
  function invert(seq) { return (Array.isArray(seq) ? seq : seq.trim().split(/\s+/)).slice().reverse().map(invertToken); }

  // merge neighbouring turns of the same layer(s): "U U" -> "U2", "R R'" -> nothing
  function simplify(seq) {
    const out = [];
    const split = t => { const m = /^(.*?)(2'|2|'|)$/.exec(t); return [m[1], m[2] === "'" ? 3 : m[2] === '' ? 1 : 2]; };
    for (const t of seq) {
      if (out.length) {
        const [b1, q1] = split(out[out.length - 1]), [b2, q2] = split(t);
        if (b1 === b2) {
          out.pop();
          const q = (q1 + q2) % 4;
          if (q) out.push(b1 + (q === 1 ? '' : q === 2 ? '2' : "'"));
          continue;
        }
      }
      out.push(t);
    }
    return out;
  }

  const M4 = makeModel(4), M3 = makeModel(3);
  G.Cube = { makeModel, M4, M3, invert, invertToken, simplify, FACE_CHARS };
})(typeof self !== 'undefined' ? self : globalThis);

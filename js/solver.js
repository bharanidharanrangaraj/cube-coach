/* solver.js - beginner "reduction" method for the 4x4, done the way a person does it, so every
 * step it gives is a step you can learn:
 *   centres (first, opposite, then the four sides)  ->  pair the 12 edges  ->  solve like a 3x3
 *   (white cross, white corners, middle layer, yellow cross, yellow edges, yellow corners) + the two
 *   4x4 parity fixes.
 * It starts from whatever stage the scanned cube is already at. Runs on the device, no tables to
 * download: every search here is over a few thousand states and finishes in milliseconds.
 */
(function (G) {
  'use strict';
  const { M4, M3, simplify } = G.Cube;
  const DEFAULT_NAMES = ['white', 'red', 'green', 'yellow', 'orange', 'blue'];

  // ---------- whole-cube orientations ----------
  const ROT_TOKENS = ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'];
  const okey = s => [0, 1, 2, 3, 4, 5].map(f => s[f * 16 + 5]).join('');
  const ORIENTS = (() => {
    const start = M4.solved(), seen = new Map([[okey(start), []]]), q = [[start, []]];
    while (q.length) {
      const [s, seq] = q.shift();
      for (const t of ROT_TOKENS) {
        const n = M4.apply(s, [t]), k = okey(n);
        if (!seen.has(k)) { seen.set(k, seq.concat(t)); q.push([n, seq.concat(t)]); }
      }
    }
    return seen;                  // key: for each face, the face whose colour it now shows
  })();
  function canonRot(tokens) { return tokens.length ? ORIENTS.get(okey(M4.apply(M4.solved(), tokens))).slice() : []; }
  const faceAfter = (tokens, f) => M4.face[M4.dest(M4.seqPerm(tokens))[f * 16 + 5]];
  const TO_U = [[], ["z'"], ['x'], ['x2'], ['z'], ["x'"]];
  const TO_D = [['x2'], ['z'], ["x'"], [], ["z'"], ['x']];
  const XK = [[], ['x'], ['x2'], ["x'"]], YK = [[], ['y'], ['y2'], ["y'"]], UK = [[], ['U'], ['U2'], ["U'"]];

  // ---------- colour scheme + scan check ----------
  const PERMS6 = (() => { const out = []; const rec = (a, used) => { if (a.length === 6) { out.push(a.slice()); return; } for (let i = 0; i < 6; i++) if (!used[i]) { used[i] = 1; a.push(i); rec(a, used); a.pop(); used[i] = 0; } }; rec([], []); return out; })();
  const cyc = c => { const m = c.indexOf(Math.min(...c)); return [c[m], c[(m + 1) % 3], c[(m + 2) % 3]].join(''); };

  /** Check a scanned cube. Returns {ok, scheme (colour of each face on a solved cube), problems[], bad:Set of stickers} */
  const PERMS_U0 = PERMS6.filter(fc => fc[0] === 0);    // every colour scheme appears here (up to turning)
  function analyse(state, fixedFc) {
    const problems = [], bad = new Set();
    const cnt = [0, 0, 0, 0, 0, 0]; for (const v of state) cnt[v]++;
    cnt.forEach((n, c) => { if (n !== 16) problems.push({ kind: 'count', colour: c, n }); });
    const cornerCols = M4.corners.map(cs => cs.map(i => state[i]));
    const wingCols = M4.wings.map(w => [state[w[0]], state[w[1]]]);
    let best = null;
    for (const fc of fixedFc ? [fixedFc] : PERMS_U0) {
      if (best && best.score === 32) break;
      const expC = new Set(M4.corners.map(cs => cyc(cs.map(i => fc[M4.face[i]]))));
      const expW = new Set(M4.wings.map(w => fc[M4.face[w[0]]] + ',' + fc[M4.face[w[1]]]));
      let score = 0; const seenC = new Set(), seenW = new Set();
      for (const cc of cornerCols) { const k = cyc(cc); if (expC.has(k) && !seenC.has(k)) { score++; seenC.add(k); } }
      for (const wc of wingCols) { const k = wc.join(','); if (expW.has(k) && !seenW.has(k)) { score++; seenW.add(k); } }
      if (!best || score > best.score) best = { fc, score, expC, expW };
    }
    const { fc, expC, expW } = best;
    const seenC = new Set(), seenW = new Set();
    cornerCols.forEach((cc, k) => {
      const key = cyc(cc);
      if (!expC.has(key) || seenC.has(key)) { problems.push({ kind: 'corner', stickers: M4.corners[k] }); M4.corners[k].forEach(i => bad.add(i)); }
      seenC.add(key);
    });
    wingCols.forEach((wc, k) => {
      const key = wc.join(',');
      if (!expW.has(key) || seenW.has(key)) { problems.push({ kind: 'edge', stickers: M4.wings[k] }); M4.wings[k].forEach(i => bad.add(i)); }
      seenW.add(key);
    });
    if (!problems.length) {                 // all pieces exist: check corner twist adds up
      const ud = [fc[0], fc[3]];
      let tw = 0; cornerCols.forEach(cc => { tw += cc.findIndex(c => ud.includes(c)); });
      if (tw % 3) problems.push({ kind: 'twist' });
    }
    const scheme = makeScheme(fc);
    return { ok: problems.length === 0, problems, bad, scheme, score: best.score };
  }

  function makeScheme(fc) {
    const all = [];
    for (const seq of ORIENTS.values()) { const s = M4.apply(M4.solved(fc), seq); all.push([0, 1, 2, 3, 4, 5].map(f => s[f * 16 + 5])); }
    const opp = []; for (let f = 0; f < 6; f++) opp[fc[f]] = fc[(f + 3) % 6];
    return { fc, all, opp };
  }
  /** colours of all 6 faces for an orientation matching {faceIndex: colour} constraints, or null */
  function findOrient(scheme, cons) {
    for (const cols of scheme.all) { let ok = true; for (const f in cons) if (cols[f] !== cons[f]) { ok = false; break; } if (ok) return cols; }
    return null;
  }

  // ---------- small helpers ----------
  const CI = M4.centreIdx, CS = M4.centreSlot;
  const faceMask = f => 0b1111 << (4 * f);
  const faceOfMask = m => [0, 1, 2, 3, 4, 5].find(f => faceMask(f) === m);
  function maskOf(s, c) { let m = 0; for (let j = 0; j < 24; j++) if (s[CI[j]] === c) m |= 1 << j; return m; }
  function centreColours(s) { return [0, 1, 2, 3, 4, 5].map(f => { const c = s[f * 16 + 5]; return [6, 9, 10].every(k => s[f * 16 + k] === c) ? c : -1; }); }
  const cpCache = new Map();
  function cperm(tokens) {
    const k = tokens.join(' ');
    let o = cpCache.get(k);
    if (!o) { const p = M4.seqPerm(tokens); o = new Int8Array(24); for (let j = 0; j < 24; j++) o[j] = CS[p[CI[j]]]; cpCache.set(k, o); }
    return o;
  }
  function applyMask(m, cp) { let o = 0; for (let j = 0; j < 24; j++) if ((m >> cp[j]) & 1) o |= 1 << j; return o; }
  const rotMask = (m, tokens) => (tokens.length ? applyMask(m, cperm(tokens)) : m);
  // fast version: 4 lookups of 6 bits each
  function chunkT(cp) {
    const d = new Int8Array(24); for (let j = 0; j < 24; j++) d[cp[j]] = j;
    const T = new Int32Array(256);
    for (let c = 0; c < 4; c++) for (let v = 0; v < 64; v++) { let o = 0; for (let k = 0; k < 6; k++) if ((v >> k) & 1) o |= 1 << d[6 * c + k]; T[c * 64 + v] = o; }
    return T;
  }
  const mapM = (m, T) => T[m & 63] | T[64 + ((m >> 6) & 63)] | T[128 + ((m >> 12) & 63)] | T[192 + ((m >> 18) & 63)];
  function prep(mv) {
    if (!mv.T) { const cp = cperm(mv.tokens), inv = new Int8Array(24); for (let j = 0; j < 24; j++) inv[cp[j]] = j; mv.T = chunkT(cp); mv.Ti = chunkT(inv); }
    return mv;
  }
  // distance (in face turns) from every reachable centre state to "all 4 pieces on top", built once per move set
  const TABLES = {};
  function table(name) {
    if (TABLES[name]) return TABLES[name];
    const moves = MOVES[name].map(prep), goal = faceMask(0), dist = new Map([[goal, 0]]), buckets = [[goal]];
    for (let d = 0; d < buckets.length; d++) {
      const b = buckets[d]; if (!b) continue;
      for (const t of b) {
        if (dist.get(t) !== d) continue;
        for (const mv of moves) {
          const s = mapM(t, mv.Ti), nd = d + mv.w, od = dist.get(s);
          if (od === undefined || od > nd) { dist.set(s, nd); (buckets[nd] || (buckets[nd] = [])).push(s); }
        }
      }
    }
    return (TABLES[name] = dist);
  }
  const distTo = (name, m) => { const d = table(name).get(m); return d === undefined ? Infinity : d; };
  function descend(name, start) {
    const dist = table(name), moves = MOVES[name];
    let s = start, d = dist.get(s);
    if (d === undefined) return null;
    const path = [];
    while (d > 0) {
      const mv = moves.find(m => dist.get(mapM(s, m.T)) === d - m.w);
      if (!mv) return null;
      path.push(mv); s = mapM(s, mv.T); d -= mv.w;
    }
    return path;
  }

  const one = (faces, label) => faces.flatMap(f => [f, f + "'", f + '2'].map(t => ({ tokens: [t], w: 1, label })));
  const mac = (pre, post, faceTurn) => ['', "'", '2'].map(s => ({ tokens: [pre, faceTurn + s, post], w: 3, label: 'Insert' }));
  const MOVES = {
    c1: one(['U', 'F', 'R', 'L', 'B', 'D', 'r', 'l', 'f', 'b', 'u', 'd'], 'Moves'),
    c2: [...one(['U', 'F'], 'Line up'), ...['y', "y'", 'y2'].map(t => ({ tokens: [t], w: 1, rot: true })),
      ...mac('r', "r'", 'U'), ...mac("l'", 'l', 'U')],
    c3: one(['U', 'F', 'D', 'B', 'r', 'l'], 'Moves'),
    c4: [...one(['U', 'B', 'D'], 'Line up'), ...mac("r'", 'r', 'U'), ...mac('l', "l'", 'U'), ...mac('r2', 'r2', 'U'), ...mac('l2', 'l2', 'U')],
    l2c: [...one(['U', 'F'], 'Line up'), ...mac('r', "r'", 'U'), ...mac("l'", 'l', 'U')],
    l2co: [...one(['U', 'D'], 'Line up'), ...mac('r2', 'r2', 'U'), ...mac('l2', 'l2', 'U')],
  };

  // ---------- step builder ----------
  class Builder {
    constructor(s) { this.s = s; this.start = s; this.steps = []; this.groups = []; }
    rot(tokens) {
      if (!tokens.length) return;
      this.s = M4.apply(this.s, tokens);
      const last = this.groups[this.groups.length - 1];
      if (last && last.rotation) { last.moves = canonRot(last.moves.concat(tokens)); if (!last.moves.length) this.groups.pop(); }
      else { const m = canonRot(tokens); if (m.length) this.groups.push({ label: 'Turn the whole cube', moves: m, rotation: true }); }
    }
    do(tokens, label, merge) {
      tokens = simplify(tokens);
      if (!tokens.length) return;
      this.s = M4.apply(this.s, tokens);
      const last = this.groups[this.groups.length - 1];
      if (merge && last && !last.rotation && last.label === label) last.moves = simplify(last.moves.concat(tokens));
      else this.groups.push({ label, moves: tokens });
    }
    end(meta) {
      const groups = this.groups.filter(g => g.moves.length);
      if (!groups.some(g => !g.rotation)) return false;   // only a cube turn: carry it to the next step
      this.steps.push(Object.assign({}, meta, { groups, moves: groups.flatMap(g => g.moves), before: this.start, after: this.s }));
      this.groups = []; this.start = this.s;
      return true;
    }
  }

  // ---------- centres ----------
  function runCentre(b, colour, name, meta) {
    const path = descend(name, maskOf(b.s, colour));
    if (!path) throw new Error('centre search failed: ' + meta.key);
    for (const m of path) { if (m.rot) b.rot(m.tokens); else b.do(m.tokens, m.label, m.label !== 'Insert'); }
    b.end(meta);
  }

  function centres(b, ctx) {
    const { scheme, white, T } = ctx, yellow = scheme.opp[white];
    let sf = centreColours(b.s), X = -1, f = -1;
    for (const c of [white, yellow]) { const i = sf.indexOf(c); if (i >= 0) { X = c; f = i; break; } }
    if (X < 0) {
      let best = Infinity;
      for (const c of [white, yellow]) for (let face = 0; face < 6; face++) {
        const d = distTo('c1', rotMask(maskOf(b.s, c), TO_U[face])) + (face ? 1 : 0);
        if (d < best) { best = d; X = c; f = face; }
      }
    }
    const Y = scheme.opp[X];
    b.rot(TO_U[f]);
    runCentre(b, X, 'c1', T.c1(X, Y));
    b.rot(['x2']);
    runCentre(b, Y, 'c2', T.c2(X, Y));
    b.rot(['z']);                                        // the first two centres now on the left and right
    const RING = [0, 2, 3, 5];
    for (let guard = 0; guard < 6; guard++) {
      sf = centreColours(b.s);
      const Lc = sf[4];
      let solved = RING.filter(rf => sf[rf] >= 0);
      while (solved.length) {                            // keep only centres that fit the colour scheme
        const cons = { 4: Lc }; solved.forEach(rf => (cons[rf] = sf[rf]));
        if (findOrient(scheme, cons)) break;
        solved = solved.slice(0, -1);
      }
      if (solved.length >= 4) break;
      if (solved.length === 0) {
        let best = Infinity, bc = -1, bk = null;
        for (const c of [0, 1, 2, 3, 4, 5].filter(c => c !== X && c !== Y)) for (const k of XK) {
          const d = distTo('c3', rotMask(maskOf(b.s, c), k)) + (k.length ? 1 : 0);
          if (d < best) { best = d; bc = c; bk = k; }
        }
        b.rot(bk);
        runCentre(b, bc, 'c3', T.c3(bc, X, Y));
      } else if (solved.length === 1) {
        b.rot(XK.find(k => faceAfter(k, solved[0]) === 2));
        const cols = centreColours(b.s), target = findOrient(scheme, { 4: cols[4], 2: cols[2] })[0];
        runCentre(b, target, 'c4', T.c4(target, cols[2]));
      } else {
        const uns = RING.filter(rf => !solved.includes(rf));
        const opposite = (uns.includes(0) && uns.includes(3)) || (uns.includes(2) && uns.includes(5));
        const want = opposite ? [0, 3] : [0, 2];
        b.rot(XK.find(k => uns.every(u => want.includes(faceAfter(k, u)))));
        const cols = centreColours(b.s);
        const full = opposite ? findOrient(scheme, { 4: cols[4], 2: cols[2] }) : findOrient(scheme, { 4: cols[4], 3: cols[3], 5: cols[5] });
        runCentre(b, full[0], opposite ? 'l2co' : 'l2c', T.l2c(full[0], opposite ? full[3] : full[2], opposite));
      }
    }
  }

  // ---------- edge pairing ----------
  const OUTER = ['U', 'D', 'R', 'L', 'F', 'B'].flatMap(f => [f, f + "'", f + '2']);
  const wingDest = tokens => { const d = M4.dest(M4.seqPerm(tokens)); return M4.wings.map(w => M4.wingOfSticker[d[w[0]]]); };
  const OUTER_WD = OUTER.map(t => wingDest([t]));
  const PAIR_ALGS = ["Uw' R U R' F R' F' R Uw", "Dw R U R' F R' F' R Dw'"].map(a => {
    const tokens = a.split(' '), wd = wingDest(tokens), src = new Int16Array(24);
    wd.forEach((to, from) => (src[to] = from));
    return { tokens, src };
  });
  const slotByFaces = (a, b) => M4.edgeSlots.findIndex(e => e.faces.includes(a) && e.faces.includes(b));
  const PAIR_SLOTS = [slotByFaces(2, 1), slotByFaces(2, 4)];   // front-right, front-left
  const wkey = (s, w) => { const a = s[M4.wings[w][0]], c = s[M4.wings[w][1]]; return a < c ? a * 6 + c : c * 6 + a; };
  function pairedKeys(s) {
    const out = new Set();
    for (const e of M4.edgeSlots) {
      const [w1, w2] = e.byFace, [fa, fb] = e.faces;
      if (s[w1[fa]] === s[w2[fa]] && s[w1[fb]] === s[w2[fb]]) out.add(wkey(s, e.wings[0]));
    }
    return out;
  }
  function centresSame(a, b2) { for (const i of CI) if (a[i] !== b2[i]) return false; return true; }

  function bestPairing(s) {
    const before = pairedKeys(s);
    const where = new Map();
    for (let w = 0; w < 24; w++) { const k = wkey(s, w); if (!where.has(k)) where.set(k, []); where.get(k).push(w); }
    const cands = [];
    for (const [k, [p1, p2]] of where) {
      if (before.has(k)) continue;
      const dist = new Int16Array(576).fill(-1), prev = new Int32Array(576);
      const st = p1 * 24 + p2; dist[st] = 0; const q = [st];
      for (let qi = 0; qi < q.length; qi++) {
        const x = q[qi], a = (x / 24) | 0, c = x % 24;
        for (let m = 0; m < 18; m++) {
          const y = OUTER_WD[m][a] * 24 + OUTER_WD[m][c];
          if (dist[y] < 0) { dist[y] = dist[x] + 1; prev[y] = x * 18 + m; q.push(y); }
        }
      }
      for (const alg of PAIR_ALGS) for (const e of PAIR_SLOTS) {
        const [h1, h2] = M4.edgeSlots[e].wings;
        for (const [A, B] of [[h1, h2], [h2, h1]]) {
          const tA = alg.src[A], tB = alg.src[B];
          if (M4.slotOfWing[tA] === M4.slotOfWing[tB]) continue;
          const y = tA * 24 + tB;
          if (dist[y] < 0) continue;
          const path = []; let x = y;
          while (x !== st) { const pv = prev[x]; path.push(OUTER[pv % 18]); x = (pv / 18) | 0; }
          cands.push({ cost: dist[y] + alg.tokens.length, setup: path.reverse(), alg: alg.tokens, key: k });
        }
      }
    }
    cands.sort((a, c) => a.cost - c.cost);
    for (const c of cands) {
      const after = M4.apply(s, c.setup.concat(c.alg));
      if (!centresSame(s, after)) continue;
      const pk = pairedKeys(after);
      if (pk.size > before.size && [...before].every(k => pk.has(k))) return c;
    }
    return null;
  }

  function edges(b, ctx) {
    const sf = centreColours(b.s);
    b.rot(TO_D[sf.indexOf(ctx.white)]);
    for (let guard = 0; guard < 13; guard++) {
      const n = pairedKeys(b.s).size;
      if (n === 12) return;
      const c = bestPairing(b.s);
      if (!c) throw new Error('edge pairing failed');
      const k = c.key, ca = (k / 6) | 0, cb = k % 6;
      b.do(c.setup, 'Set up the two pieces');
      b.do(c.alg, 'Pair them');
      b.end(ctx.T.pair(ca, cb, pairedKeys(b.s).size, c.alg[0] === 'Dw'));
    }
    throw new Error('edge pairing did not finish');
  }

  // ---------- 3x3 stage (on the reduced cube) ----------
  const MAP43 = [0, 1, 3];
  function read3(s) {
    const t = new Uint8Array(54);
    for (let f = 0; f < 6; f++) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) t[f * 9 + r * 3 + c] = s[f * 16 + MAP43[r] * 4 + MAP43[c]];
    return t;
  }
  const C3 = M3.corners, E3 = M3.edgeSlots.map(e => e.byFace[0]);
  const cen = (t, f) => t[f * 9 + 4];
  const cFaces = k => C3[k].map(i => M3.face[i]);
  const eFaces = e => Object.keys(E3[e]).map(Number);
  const cornerIdx = fs => C3.findIndex((c, k) => fs.every(f => cFaces(k).includes(f)));
  const edgeIdx = fs => E3.findIndex((e, k) => fs.every(f => eFaces(k).includes(f)));
  const cornerOK = (t, k) => C3[k].every(i => t[i] === cen(t, M3.face[i]));
  const edgeOK = (t, e) => eFaces(e).every(f => t[E3[e][f]] === cen(t, f));
  const sameSet = (a, c) => a.length === c.length && a.every(x => c.includes(x));
  const findCorner = (t, set) => C3.findIndex(c => sameSet(c.map(i => t[i]), set));
  const findEdge = (t, set) => E3.findIndex(e => sameSet(Object.values(e).map(i => t[i]), set));
  const DFR = cornerIdx([3, 2, 1]), UFR = cornerIdx([0, 2, 1]), UF = edgeIdx([0, 2]), FR = edgeIdx([2, 1]);
  const U_EDGES = [edgeIdx([0, 5]), edgeIdx([0, 4]), edgeIdx([0, 1]), UF];        // UB UL UR UF
  const U_CORNERS = [UFR, cornerIdx([0, 2, 4]), cornerIdx([0, 5, 4]), cornerIdx([0, 5, 1])];
  const D_CORNERS = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => cFaces(k).includes(3));
  const MID_EDGES = E3.map((_, e) => e).filter(e => !eFaces(e).includes(0) && !eFaces(e).includes(3));
  const ALG = {
    trigger: ['R', 'U', "R'", "U'"],
    right: "U R U' R' U' F' U F".split(' '), left: "U' L' U L U F U' F'".split(' '),
    fru: "F R U R' U' F'".split(' '), sune: "R U R' U R U2 R'".split(' '),
    niklas: "U R U' L' U R' U' L".split(' '), twist: "R' D' R D".split(' '),
    oll: "r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2".split(' '), pll: "r2 U2 r2 Uw2 r2 u2".split(' '),
  };

  function sim(t) {
    return {
      t, ops: [],
      rot(tok) { if (!tok.length) return; this.t = M3.apply(this.t, tok); this.ops.push({ rot: tok }); },
      do(tok, label, merge) { if (!tok.length) return; this.t = M3.apply(this.t, tok); this.ops.push({ do: tok, label, merge }); },
    };
  }
  const replay = (b, ops) => ops.forEach(o => (o.rot ? b.rot(o.rot) : b.do(o.do, o.label, o.merge)));
  const opsLen = ops => ops.reduce((n, o) => n + (o.rot ? 1 : o.do.length), 0);

  function cross(b, ctx) {
    const { white, T } = ctx;
    b.rot(TO_D[centreColours(b.s).indexOf(white)]);
    const ES = [], esIdx = new Map();
    E3.forEach(e => Object.values(e).forEach(i => { esIdx.set(i, ES.length); ES.push(i); }));
    const MV = OUTER.map(tk => { const d = M3.dest(M3.seqPerm([tk])); return ES.map(i => esIdx.get(d[i])); });
    for (let n = 0; n < 4; n++) {
      const t = read3(b.s);
      const pieces = [1, 2, 4, 5].map(f => {           // white edge for each side face
        const col = cen(t, f), e = edgeIdx([3, f]);
        const at = findEdge(t, [white, col]);
        const ws = Object.values(E3[at]).find(i => t[i] === white);
        return { col, pos: esIdx.get(ws), goal: esIdx.get(E3[e][3]) };
      });
      const done = pieces.filter(p => p.pos === p.goal);
      if (done.length === 4) return;
      let best = null;
      for (const p of pieces.filter(q => q.pos !== q.goal)) {
        const set = done.concat([p]), k = set.length, size = 24 ** k;
        const enc = arr => arr.reduce((a, v) => a * 24 + v, 0);
        const start = enc(set.map(q => q.pos)), goal = enc(set.map(q => q.goal));
        const prev = new Int32Array(size).fill(-1); prev[start] = start * 18;
        const q = [start]; let found = false;
        for (let qi = 0; qi < q.length && !found; qi++) {
          let x = q[qi]; const digs = []; for (let i = 0; i < k; i++) { digs.unshift(x % 24); x = (x / 24) | 0; }
          for (let m = 0; m < 18; m++) {
            const y = enc(digs.map(d => MV[m][d]));
            if (prev[y] < 0) { prev[y] = q[qi] * 18 + m; q.push(y); if (y === goal) { found = true; break; } }
          }
        }
        const path = []; let x = goal;
        while (x !== start) { const pv = prev[x]; path.push(OUTER[pv % 18]); x = (pv / 18) | 0; }
        if (!best || path.length < best.path.length) best = { path: path.reverse(), col: p.col };
      }
      b.do(best.path, 'Moves');
      b.end(T.cross(white, best.col));
    }
  }

  function insertCorner(t, set) {
    const s = sim(t), [w, a, c] = set;
    let k = findCorner(s.t, set);
    if (D_CORNERS.includes(k)) {
      if (cornerOK(s.t, k)) return s;
      s.rot(YK.find(y => findCorner(M3.apply(s.t, y), set) === DFR));
      s.do(ALG.trigger, 'Take it out: R U R\' U\'');
    }
    s.rot(YK.find(y => { const tt = M3.apply(s.t, y); return sameSet([cen(tt, 2), cen(tt, 1)], [a, c]); }));
    s.do(UK.find(u => findCorner(M3.apply(s.t, u), set) === UFR), 'Line it up above its spot');
    for (let i = 0; i < 6 && !cornerOK(s.t, DFR); i++) s.do(ALG.trigger, "Repeat R U R' U' until it's in", true);
    return s;
  }
  function corners(b, ctx) {
    for (let n = 0; n < 5; n++) {
      const t = read3(b.s);
      const todo = D_CORNERS.filter(k => !cornerOK(t, k)).map(k => C3[k].map(i => cen(t, M3.face[i])));
      if (!todo.length) return;
      let best = null;
      for (const set of todo) { const s = insertCorner(t, set); if (!best || opsLen(s.ops) < opsLen(best.s.ops)) best = { s, set }; }
      replay(b, best.s.ops);
      const sides = best.set.filter(c => c !== ctx.white);
      b.end(ctx.T.corner(ctx.white, sides[0], sides[1]));
    }
  }

  function insertEdge(t, set, Y) {
    const s = sim(t);
    const e = findEdge(s.t, set);
    if (eFaces(e).includes(0)) {
      const side = t[E3[e][eFaces(e).find(f => f !== 0)]], top = t[E3[e][0]];
      s.rot(YK.find(y => cen(M3.apply(s.t, y), 2) === side));
      s.do(UK.find(u => { const tt = M3.apply(s.t, u); return findEdge(tt, set) === UF && tt[E3[UF][2]] === side; }), 'Line it up');
      s.do(top === cen(s.t, 1) ? ALG.right : ALG.left, top === cen(s.t, 1) ? 'Insert to the right' : 'Insert to the left');
    } else {
      s.rot(YK.find(y => findEdge(M3.apply(s.t, y), set) === FR));
      s.do(ALG.right, 'Take the wrong edge out');
    }
    return s;
  }
  function middle(b, ctx) {
    for (let n = 0; n < 9; n++) {
      const t = read3(b.s), Y = cen(t, 0);
      const wrong = MID_EDGES.filter(e => !edgeOK(t, e));
      if (!wrong.length) return;
      const targets = MID_EDGES.map(e => eFaces(e).map(f => cen(t, f))).filter(set => { const e = findEdge(t, set); return !(MID_EDGES.includes(e) && edgeOK(t, e)); });
      let best = null;
      for (const set of targets) {
        const e = findEdge(t, set);
        if (!eFaces(e).includes(0) && !MID_EDGES.includes(e)) continue;
        const s = insertEdge(t, set, Y);
        const progress = MID_EDGES.filter(x => edgeOK(s.t, x)).length;
        const score = opsLen(s.ops) - progress * 100;
        if (!best || score < best.score) best = { s, set, score };
      }
      replay(b, best.s.ops);
      b.end(ctx.T.middle(best.set[0], best.set[1]));
    }
  }

  const yellowUp = t => U_EDGES.map(e => t[E3[e][0]] === cen(t, 0));
  function yellowCross(b, ctx) {
    let t = read3(b.s);
    if (yellowUp(t).filter(Boolean).length % 2) {
      b.do(UK.find(u => !yellowUp(M3.apply(t, u))[3]), 'Put a wrong edge at the front');
      b.do(ALG.oll, 'OLL parity algorithm');
      b.end(ctx.T.oll());
      t = read3(b.s);
    }
    const s = sim(t);
    for (let i = 0; i < 4; i++) {
      const up = yellowUp(s.t), n = up.filter(Boolean).length;
      if (n === 4) break;
      if (n === 2) {
        const u = UK.find(uu => { const v = yellowUp(M3.apply(s.t, uu)); return (v[0] && v[1]) || (v[1] && v[2] && !v[0] && !v[3]); });
        s.do(u, 'Turn the top to hold the shape right');
      }
      s.do(ALG.fru, "F R U R' U' F'");
    }
    replay(b, s.ops);
    b.end(ctx.T.ycross());
  }

  const matched = t => U_EDGES.filter(e => t[E3[e][eFaces(e).find(f => f !== 0)]] === cen(t, eFaces(e).find(f => f !== 0))).length;
  function yellowEdges(b, ctx) {
    const s = sim(read3(b.s));
    for (let i = 0; i < 4; i++) {
      const u0 = UK.find(u => matched(M3.apply(s.t, u)) === 4);
      if (u0) { s.do(u0, 'Turn the top'); break; }
      let best = null;
      for (const u of UK) for (const y of YK) for (const u2 of UK) {
        const seq = u.concat(y, ALG.sune, u2);
        if (matched(M3.apply(s.t, seq)) === 4) { const c = seq.length; if (!best || c < best.c) best = { u, y, u2, c }; }
      }
      if (best) { s.do(best.u, 'Turn the top: two neighbours match'); s.rot(best.y); s.do(ALG.sune, "R U R' U R U2 R'"); s.do(best.u2, 'Turn the top'); break; }
      s.do(ALG.sune, "R U R' U R U2 R'");
    }
    replay(b, s.ops);
    b.end(ctx.T.yedges());
  }

  const cornerHome = (t, k) => sameSet(C3[k].map(i => t[i]), C3[k].map(i => cen(t, M3.face[i])));
  function cornerParity(t) {
    const perm = U_CORNERS.map(k => U_CORNERS.findIndex(h => sameSet(C3[k].map(i => t[i]), C3[h].map(i => cen(t, M3.face[i])))));
    let p = 0; const seen = [];
    for (let i = 0; i < 4; i++) { if (seen[i]) continue; let j = i, len = 0; while (!seen[j]) { seen[j] = 1; j = perm[j]; len++; } p += len - 1; }
    return p % 2;
  }
  function yellowCorners(b, ctx) {
    for (let i = 0; i < 4; i++) {
      const t = read3(b.s);
      if (U_CORNERS.every(k => cornerHome(t, k))) return;
      if (cornerParity(t)) {
        b.do(ALG.pll, 'PLL parity algorithm');
        b.end(ctx.T.pll());
        yellowEdges(b, ctx);
        continue;
      }
      const s = sim(t);
      const home = U_CORNERS.filter(k => cornerHome(t, k));
      if (home.length) s.rot(YK.find(y => cornerHome(M3.apply(s.t, y), UFR)));
      for (let j = 0; j < 3 && !U_CORNERS.every(k => cornerHome(s.t, k)); j++) {
        s.do(ALG.niklas, "U R U' L' U R' U' L", true);
        if (!home.length) break;
      }
      replay(b, s.ops);
      b.end(ctx.T.ycorners());
    }
  }

  function orient(b, ctx) {
    for (let i = 0; i < 5; i++) {
      const t = read3(b.s), Y = cen(t, 0);
      const twisted = k => t[C3[k][0]] !== Y;
      if (!U_CORNERS.some(twisted)) break;
      const s = sim(t);
      s.do(UK.find(u => M3.apply(s.t, u)[C3[UFR][0]] !== Y), 'Turn the top: twisted corner to front-right');
      for (let j = 0; j < 6 && s.t[C3[UFR][0]] !== Y; j++) s.do(ALG.twist, "Repeat R' D' R D until yellow is on top", true);
      replay(b, s.ops);
      b.end(ctx.T.orient());
    }
    const u = UK.find(uu => M4.isSolved(M4.apply(b.s, uu)));
    if (u && u.length) { b.do(u, 'Turn the top'); b.end(ctx.T.finish()); }
  }

  // ---------- texts ----------
  function texts(nm) {
    return {
      c1: (X, Y) => ({ stage: 'centres', key: 'c1', focus: { type: 'centre', colours: [X] }, title: `First centre: ${nm(X)}`, goal: `Get all 4 ${nm(X)} centre pieces onto the top face.`, hint: `Look for ${nm(X)} centre pieces on the sides. Turn that side so a piece sits under an empty top spot, then lift it up with a slice turn (r or l), turn the top, and put the slice back. One piece at a time.` }),
      c2: (X, Y) => ({ stage: 'centres', key: 'c2', focus: { type: 'centre', colours: [Y] }, title: `Opposite centre: ${nm(Y)}`, goal: `With ${nm(X)} on the bottom, get all 4 ${nm(Y)} pieces onto the top.`, hint: `Find a ${nm(Y)} piece on the front. Turn F so it's in the right column, turn U so the spot above it is not ${nm(Y)}, then r U r' (U' or U2 also work). Left column: l' U l. Nothing on the front? Turn the cube (y).` }),
      c3: (C, X, Y) => ({ stage: 'centres', key: 'c3', focus: { type: 'centre', colours: [C] }, title: `Third centre: ${nm(C)}`, goal: `${cap(nm(X))} and ${nm(Y)} are on the left and right now. Make the top centre ${nm(C)}.`, hint: `The r and l slices are free now: they never touch the left and right centres. Line pieces up with U, F, D or B and lift them with r or l.` }),
      c4: (C, C3c) => ({ stage: 'centres', key: 'c4', focus: { type: 'centre', colours: [C] }, title: `Fourth centre: ${nm(C)}`, goal: `Keep ${nm(C3c)} on the front. Make the top ${nm(C)}.`, hint: `Bring pieces up from the back with r' U r (or l U l') and from the bottom with r2 U r2. They put the front back as it was.` }),
      l2c: (C5, C6, opp) => ({ stage: 'centres', key: 'l2c', focus: { type: 'centre', colours: [C5, C6] }, title: `Last two centres: ${nm(C5)} and ${nm(C6)}`, goal: opp ? `Make the top ${nm(C5)} and the bottom ${nm(C6)}.` : `Make the top ${nm(C5)}; the front becomes ${nm(C6)} at the same time.`, hint: opp ? `Line up with U and D, then swap a column between top and bottom with r2 U r2.` : `Use only U, F and r U r' (or l' U l). Make a column of two ${nm(C5)} on the front, turn U so the top column above it is the wrong colour, then swap them with r U r'.` }),
      pair: (a, c, n, dw) => ({ stage: 'edges', key: 'pair', focus: { type: 'wing', colours: [a, c] }, title: `Pair the ${nm(a)}-${nm(c)} edge · ${n}/12`, goal: `Join the two ${nm(a)}-${nm(c)} pieces into one edge, like a 3x3 edge.`, hint: `With outer turns only, put one ${nm(a)}-${nm(c)} piece in the front-left edge and the other in the front-right edge, at different heights. Left one on top: Uw' R U R' F R' F' R Uw. Left one at the bottom: Dw R U R' F R' F' R Dw'. The colours must line up so the slice drops the left piece right next to its twin.` }),
      cross: (w, c) => ({ stage: 'cross', key: 'cross', focus: { type: 'edge', colours: [w, c] }, title: `${cap(nm(w))} cross: ${nm(w)}-${nm(c)} edge`, goal: `Put the ${nm(w)}-${nm(c)} edge on the bottom, ${nm(w)} facing down, next to the ${nm(c)} centre.`, hint: `Bring it into the top layer above the ${nm(c)} centre, then turn that side twice. Keep the edges you already placed.` }),
      corner: (w, a, c) => ({ stage: 'corners', key: 'corner', focus: { type: 'corner', colours: [w, a, c] }, title: `${cap(nm(w))} corner: ${nm(w)}-${nm(a)}-${nm(c)}`, goal: `Put this corner in the bottom layer between ${nm(a)} and ${nm(c)}.`, hint: `Hold the cube so its spot is at the front-right of the bottom. Turn the top until the corner is right above it, then repeat R U R' U' until it drops in with ${nm(w)} facing down.` }),
      middle: (a, c) => ({ stage: 'middle', key: 'middle', focus: { type: 'edge', colours: [a, c] }, title: `Middle edge: ${nm(a)}-${nm(c)}`, goal: `Put the ${nm(a)}-${nm(c)} edge in the middle layer between ${nm(a)} and ${nm(c)}.`, hint: `Find it on top. Turn the top and the cube until its side colour matches the front centre. Top colour matches the right centre: U R U' R' U' F' U F. Matches the left: U' L' U L U F U' F'.` }),
      oll: () => ({ focus: { type: 'top' }, stage: 'ycross', key: 'oll', title: 'OLL parity (4x4 only)', goal: 'Flip the one edge that a 3x3 could never have flipped.', hint: `You see 1 or 3 yellow edges on top - an odd number. That's OLL parity. Hold a non-yellow edge at the front-top and do r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2.` }),
      ycross: () => ({ focus: { type: 'top' }, stage: 'ycross', key: 'ycross', title: 'Yellow cross', goal: 'Make a yellow cross on top.', hint: `Dot: F R U R' U' F'. L-shape: hold it at back and left, same algorithm. Line: hold it left to right, same algorithm.` }),
      yedges: () => ({ focus: { type: 'top' }, stage: 'yedges', key: 'yedges', title: 'Yellow edges', goal: 'Match every top edge with its side centre.', hint: `Turn the top until two neighbouring edges match. Hold them at the back and right, then R U R' U R U2 R' U. If only opposite edges match, do it once from anywhere and look again.` }),
      pll: () => ({ focus: { type: 'top' }, stage: 'ycorners', key: 'pll', title: 'PLL parity (4x4 only)', goal: 'Swap two edges: the cube is in a state a 3x3 can never be in.', hint: `Two corners are in place and the other two need to swap - the corner algorithm can't fix that. Do r2 U2 r2 Uw2 r2 u2, then fix the yellow edges again.` }),
      ycorners: () => ({ focus: { type: 'top' }, stage: 'ycorners', key: 'ycorners', title: 'Yellow corners: right places', goal: 'Put each top corner in its right place (twisted is fine for now).', hint: `Find a corner whose three colours match the centres around it. Hold it at the front-right and do U R U' L' U R' U' L, once or twice. None right? Do it once from anywhere first.` }),
      orient: () => ({ focus: { type: 'top' }, stage: 'orient', key: 'orient', title: 'Twist the yellow corners', goal: 'Turn each top corner so yellow faces up.', hint: `Don't turn the whole cube now. Put a twisted corner at front-right-top and repeat R' D' R D until yellow is up (the rest looks messy - that's normal). Then turn only U to bring the next one.` }),
      finish: () => ({ stage: 'orient', key: 'finish', title: 'Last turn', goal: 'Turn the top layer to finish.', hint: 'Line the top up with the rest of the cube.' }),
    };
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const STAGES = [
    { key: 'centres', name: 'Centres' }, { key: 'edges', name: 'Edge pairs' }, { key: 'cross', name: 'White cross' },
    { key: 'corners', name: 'White corners' }, { key: 'middle', name: 'Middle layer' }, { key: 'ycross', name: 'Yellow cross' },
    { key: 'yedges', name: 'Yellow edges' }, { key: 'ycorners', name: 'Yellow corners' }, { key: 'orient', name: 'Twist corners' },
  ];

  /**
   * solve(state, {names, scheme}) -> {steps, stages, scheme}
   * state: Uint8Array(96) of colour ids 0..5. names: colour id -> name ("white"...).
   */
  function solve(state, opts) {
    opts = opts || {};
    const names = opts.names || DEFAULT_NAMES;
    const scheme = opts.scheme || analyse(state).scheme;
    let white = names.indexOf('white'); if (white < 0) white = 0;
    const ctx = { scheme, white, T: texts(c => names[c] || DEFAULT_NAMES[c]) };
    const b = new Builder(state);
    if (!M4.isSolved(state)) {
      centres(b, ctx); edges(b, ctx); cross(b, ctx); corners(b, ctx); middle(b, ctx);
      yellowCross(b, ctx); yellowEdges(b, ctx); yellowCorners(b, ctx); orient(b, ctx);
      if (!M4.isSolved(b.s)) throw new Error('solver finished without solving');
    }
    const used = new Set(b.steps.map(s => s.stage));
    const first = STAGES.findIndex(st => used.has(st.key));
    const stages = STAGES.map((st, i) => ({ key: st.key, name: st.name, done: first < 0 || i < first, steps: b.steps.filter(s => s.stage === st.key).length }));
    b.steps.forEach((s, i) => (s.index = i));
    return { steps: b.steps, stages, scheme, progress: progress(state, ctx) };
  }

  function progress(state, ctx) {
    const sf = centreColours(state);
    return { centres: sf.filter(c => c >= 0).length, pairs: pairedKeys(state).size };
  }

  G.Solver = {
    solve, analyse, findOrient, makeScheme, canonRot, pairedKeys, centreColours, read3, faceAfter, ALG, STAGES, DEFAULT_NAMES, ORIENTS,
  };
})(typeof self !== 'undefined' ? self : globalThis);

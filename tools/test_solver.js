// Solve many random cubes and check every step really solves the cube.
//   node tools/test_solver.js [count]
const path = require('path');
require(path.join(__dirname, '..', 'js', 'cube.js'));
require(path.join(__dirname, '..', 'js', 'solver.js'));
const { M4 } = Cube;
const N = +process.argv[2] || 300;
const ALL = ['U','D','R','L','F','B','u','d','r','l','f','b'].flatMap(f => [f, f + "'", f + '2']);
const OUTER = ['U','D','R','L','F','B'].flatMap(f => [f, f + "'", f + '2']);
let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const scramble = (set, n) => Array.from({ length: n }, () => set[rnd(set.length)]);
const kinds = {
  random: () => scramble(ALL, 60),
  reduced: () => scramble(OUTER, 40),                                  // centres + edges done
  ollParity: () => scramble(OUTER, 30).concat(Solver.ALG.oll),
  pllParity: () => scramble(OUTER, 30).concat(Solver.ALG.pll),
  centresDone: () => scramble(OUTER, 25).concat("Uw' R U R' F R' F' R Uw".split(' '), scramble(OUTER, 10)),
  rotated: () => scramble(ALL, 50).concat(['x', 'y2']),
};
const stats = {}; let fails = 0;
for (const [name, gen] of Object.entries(kinds)) {
  const n = name === 'random' ? N : Math.ceil(N / 3);
  const st = stats[name] = { n, moves: 0, steps: 0, maxMoves: 0, ms: 0, maxMs: 0, oll: 0, pll: 0 };
  for (let i = 0; i < n; i++) {
    const sc = gen();
    const state = M4.apply(M4.solved(), sc);
    const t0 = process.hrtime.bigint();
    let res;
    try { res = Solver.solve(state); }
    catch (e) { fails++; console.log('ERROR', name, e.message, '\n  scramble:', sc.join(' ')); continue; }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    let s = state;
    for (const step of res.steps) {
      if (Buffer.compare(Buffer.from(s), Buffer.from(step.before))) { fails++; console.log('BEFORE MISMATCH', name, step.key); break; }
      s = M4.apply(s, step.moves);
      if (Buffer.compare(Buffer.from(s), Buffer.from(step.after))) { fails++; console.log('AFTER MISMATCH', name, step.key); break; }
    }
    if (!M4.isSolved(s)) { fails++; console.log('NOT SOLVED', name, sc.join(' ')); continue; }
    const mv = res.steps.reduce((a, x) => a + x.moves.filter(t => !/^[xyz]/.test(t)).length, 0);
    st.moves += mv; st.steps += res.steps.length; st.maxMoves = Math.max(st.maxMoves, mv); st.ms += ms; st.maxMs = Math.max(st.maxMs, ms);
    st.oll += res.steps.some(x => x.key === 'oll'); st.pll += res.steps.some(x => x.key === 'pll');
  }
}
for (const [k, s] of Object.entries(stats))
  console.log(`${k.padEnd(12)} n=${s.n}  avg moves ${(s.moves / s.n).toFixed(0)} (max ${s.maxMoves})  avg steps ${(s.steps / s.n).toFixed(1)}  avg ${(s.ms / s.n).toFixed(1)} ms (max ${s.maxMs.toFixed(0)})  oll ${s.oll} pll ${s.pll}`);
console.log(fails ? `FAILURES: ${fails}` : 'ALL SOLVED');
process.exit(fails ? 1 : 0);

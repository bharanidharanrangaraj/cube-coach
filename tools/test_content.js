// Every lesson demo / drill / cheat-sheet case must end solved when you do its moves.
const path = require('path');
for (const f of ['cube.js', 'solver.js', 'content.js']) require(path.join(__dirname, '..', 'js', f));
const { M4 } = Cube; let bad = 0, n = 0;
const run = (label, setup, moves) => { n++; const s = M4.apply(M4.apply(M4.solved(), (setup || '').split(' ').filter(Boolean)), moves.split(' ')); if (!M4.isSolved(s)) { bad++; console.log('NOT SOLVED:', label); } };
for (const l of Content.LESSONS) for (const p of l.parts) for (const d of p.demos || []) if (d.setup) run(`lesson ${l.id} / ${d.label}`, d.setup, d.moves);
for (const d of Content.DRILLS) if (!d.quiz) { run(`drill ${d.id}`, d.setup, d.answer); if (!d.keys.flatMap(k => Content.KEYS[k]).every(() => true)) bad++; const keys = new Set(d.keys.flatMap(k => Content.KEYS[k])); for (const t of d.answer.split(' ')) if (!keys.has(t)) { bad++; console.log(`drill ${d.id}: answer move ${t} has no key`); } }
for (const g of Content.SHEET) for (const it of g.items) { const reps = it.name === 'White corner' ? 3 : it.name === 'Twist corner' ? 2 : 1; run(`sheet ${it.name}`, it.setup, Array(reps).fill(it.alg).join(' ')); }
console.log(`${n} cases checked, ${bad ? bad + ' PROBLEMS' : 'all OK'}`); process.exit(bad ? 1 : 0);

require(require('path').join(__dirname,'..','js','cube.js'));
const {M4} = Cube;
const slotName = e => { const s = M4.edgeSlots[e]; return s.faces.map(f=>'URFDLB'[f]).join(''); };
function analyse(S) {
  const d = M4.dest(M4.seqPerm(S));
  const wd = M4.wings.map(w => M4.wingOfSticker[d[w[0]]]);
  const res = [];
  M4.edgeSlots.forEach((e, ei) => {
    const t = e.wings.map(w => M4.slotOfWing[wd[w]]);
    if (t[0] === ei && t[1] === ei) return;
    res.push(slotName(ei) + '->' + (t[0]===t[1] ? slotName(t[0]) : '{' + slotName(t[0]) + ',' + slotName(t[1]) + '}'));
  });
  // centres unchanged?
  const s0 = M4.solved(); const s1 = M4.apply(s0, S);
  const cOK = M4.centreIdx.every(i => s1[i] === s0[i]);
  console.log(S.padEnd(42), 'centres ok:', cOK, ' moved:', res.join(' '));
}
for (const S of ["R U R' F R' F' R", "Uw' R U R' F R' F' R Uw", "Uw R U R' F R' F' R Uw'", "Dw R U R' F R' F' R Dw'", "Dw' R U R' F R' F' R Dw",
  "Dw R F' U R' F Dw'", "Uw' R F' U R' F Uw", "Dw' L' U L F' L F Dw", "u' R U R' F R' F' R u", "d R U R' F R' F' R d'",
  "r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2", "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2",
  "r2 U2 r2 Uw2 r2 Uw2", "Rw2 U2 Rw2 Uw2 Rw2 Uw2", "r2 U2 r2 u2 r2 u2"]) analyse(S);

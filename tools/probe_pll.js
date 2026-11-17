require(require('path').join(__dirname,'..','js','cube.js'));
const {M4} = Cube;
const s0 = M4.solved();
const isC = new Set(M4.corners.flat()), isCen = new Set(M4.centreIdx);
const fr = i => 'URFDLB'[M4.face[i]] + Math.floor(i%16/4) + (i%4);
for (const S of ["r2 U2 r2 Uw2 r2 u2", "r2 U2 r2 u2 r2 Uw2", "Rw2 U2 Rw2 Uw2 Rw2 u2", "r2 U2 r2 Uw2 r2 Uw2 U2", "Uw2 r2 Uw2 r2 U2 r2", "r2 U2 r2 Uw2 r2 Uw2 U2"]) {
  const p = M4.seqPerm(S); const s1 = M4.apply(s0, S);
  const moved = []; for (let i = 0; i < M4.S; i++) if (p[i] !== i) moved.push(i);
  const kinds = {corner:0, wing:0, centre:0}; for (const i of moved) kinds[isC.has(i)?'corner':isCen.has(i)?'centre':'wing']++;
  const centresSame = M4.centreIdx.every(i => s1[i] === s0[i]);
  console.log(S.padEnd(28), JSON.stringify(kinds), 'centre colours ok', centresSame, moved.filter(i=>!isCen.has(i)).map(fr).join(' '));
}

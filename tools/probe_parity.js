require(require('path').join(__dirname,'..','js','cube.js'));
const {M4} = Cube;
const s0 = M4.solved();
for (const S of ["r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2", "r2 U2 r2 Uw2 r2 Uw2", "Uw' R U R' F R' F' R Uw", "Dw R U R' F R' F' R Dw'"]) {
  const p = M4.seqPerm(S);
  const moved = [];
  for (let i = 0; i < M4.S; i++) if (p[i] !== i) moved.push(i);
  const kinds = {corner:0, wing:0, centre:0};
  const isC = new Set(M4.corners.flat()), isCen = new Set(M4.centreIdx);
  for (const i of moved) kinds[isC.has(i)?'corner':isCen.has(i)?'centre':'wing']++;
  const fr = i => 'URFDLB'[M4.face[i]] + Math.floor(i%16/4) + (i%4);
  console.log(S, JSON.stringify(kinds), moved.filter(i=>!isCen.has(i)).map(fr).join(' '));
}

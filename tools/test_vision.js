// Simulated scans: random cubes under random lighting -> colour grouping + repair accuracy.
const path = require('path');
for (const f of ['cube.js', 'solver.js', 'vision.js']) require(path.join(__dirname, '..', 'js', f));
const { M4 } = Cube;
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ALL = ['U','D','R','L','F','B','u','d','r','l','f','b'].flatMap(f => [f, f + "'", f + '2']);
const trials = +process.argv[2] || 200;
let exact = 0, stickerErr = 0, valid = 0, ms = 0;
for (let t = 0; t < trials; t++) {
  const sc = Array.from({ length: 50 }, () => ALL[Math.floor(rnd() * ALL.length)]);
  const truth = M4.apply(M4.solved([0, 1, 2, 3, 4, 5]), sc);
  // lighting: warm/cool cast, per-face brightness, noise, occasional glare-dulled sticker
  const cast = [1 + (rnd() - 0.4) * 0.5, 1 + (rnd() - 0.5) * 0.2, 1 - rnd() * 0.45];
  const faceB = Array.from({ length: 6 }, () => 0.55 + rnd() * 0.55);
  const rgbs = Array.from(truth, (c, i) => {
    const b = faceB[(i / 16) | 0] * (0.9 + rnd() * 0.2);
    return Vision.REF_RGB[c].map((v, k) => Math.max(0, Math.min(255, v * b * cast[k] + (rnd() - 0.5) * 30)));
  });
  const t0 = Date.now();
  const cl = Vision.cluster(rgbs);
  const first = Solver.analyse(cl.labels);
  const rep = Vision.repair(cl.labels, cl.alt, cl.margin, s => Solver.analyse(s, first.scheme.fc));
  ms += Date.now() - t0;
  const errs = rep.labels.reduce((a, v, i) => a + (v !== truth[i]), 0);
  stickerErr += errs; exact += errs === 0; valid += rep.result.ok;
}
console.log(`${trials} scans: exactly right ${exact}, valid cube ${valid}, sticker errors ${(stickerErr / trials).toFixed(2)} per scan, ${(ms / trials).toFixed(0)} ms each`);

/* content.js - lessons, practice drills and the cheat sheet. Plain data. */
(function (G) {
  'use strict';
  const A = {
    rUr: "r U r'", rUrBack: "r' U r", r2Ur2: 'r2 U r2',
    pairU: "Uw' R U R' F R' F' R Uw", pairD: "Dw R U R' F R' F' R Dw'",
    trigger: "R U R' U'", right: "U R U' R' U' F' U F", left: "U' L' U L U F U' F'",
    fru: "F R U R' U' F'", sune: "R U R' U R U2 R'", niklas: "U R U' L' U R' U' L", twist: "R' D' R D",
    oll: "r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2", pll: 'r2 U2 r2 Uw2 r2 u2',
  };
  const inv = s => Cube.invert(s.split(' ')).join(' ');
  const rep = (s, n) => Array(n).fill(s).join(' ');

  const LESSONS = [
    {
      id: 'start', title: 'How Cube Coach works', mins: 2,
      parts: [
        { html: `<p><b>1. Scan.</b> Show each face to the camera inside the grid. It snaps by itself when the cube is still. Six faces, about 30 seconds.</p>
<p><b>2. Check the colours.</b> You'll see your cube as a flat map. Tap any sticker that's wrong. Stickers with a dot are the ones the camera was least sure about.</p>
<p><b>3. Follow the steps.</b> The app works out which stage you're at and starts there. Each step shows the <b>goal</b> first, then a <b>hint</b>, then the <b>moves</b> - try it yourself before you look.</p>
<p><b>4. Check.</b> After a step, tap <b>Check</b> and show the camera your cube. It tells you if it matches.</p>
<p>Everything runs on this device. The camera picture never leaves it, and it works with no internet.</p>` },
      ],
    },
    {
      id: 'notation', title: 'Reading the moves', mins: 4,
      parts: [
        { html: `<p>Hold the cube still, with one face toward you: that's <b>F</b> (front). The others are <b>U</b> (up), <b>D</b> (down), <b>R</b> (right), <b>L</b> (left) and <b>B</b> (back).</p>
<p>A letter means: turn that outer layer <b>clockwise, as if you were looking straight at that face</b>.</p>`, demos: [{ label: 'R', moves: 'R' }, { label: 'U', moves: 'U' }, { label: 'F', moves: 'F' }, { label: 'L', moves: 'L' }] },
        { html: `<p><b>'</b> (say "prime") means anticlockwise. <b>2</b> means a half turn.</p>`, demos: [{ label: "R'", moves: "R'" }, { label: 'R2', moves: 'R2' }, { label: "U'", moves: "U'" }] },
        { html: `<p>A 4x4 has two layers on each side. A small letter is the <b>inner slice only</b>: <b>r</b> is the slice next to R. <b>Rw</b> ("wide") turns both right layers together.</p>`, demos: [{ label: 'r', moves: 'r' }, { label: 'Rw', moves: 'Rw' }, { label: 'u', moves: 'u' }, { label: 'Uw', moves: 'Uw' }] },
        { html: `<p><b>x, y, z</b> turn the <b>whole cube</b> in your hands: x like R, y like U, z like F.</p>`, demos: [{ label: 'y', moves: 'y' }, { label: 'x', moves: 'x' }, { label: 'z', moves: 'z' }] },
      ],
      drill: 'notation',
    },
    {
      id: 'centres12', title: 'Centres: the first two', mins: 5,
      parts: [
        { html: `<p>On a 4x4 the centres are 4 loose pieces, so you build them first. Start with <b>white</b> on top. Look for white pieces on the sides, line one up under an empty top spot, and lift it with a slice. It's easy to do by feel - go slowly.</p>` },
        { html: `<p>For <b>yellow</b>, turn the cube over (white on the bottom). Now the trick: <b>r U r'</b>. The slice lifts the front's right column to the top, U moves it aside, and r' brings the slice back, so the white bottom is untouched.</p>
<p>Before you do it: turn <b>F</b> so the yellow piece is in the right column, and turn <b>U</b> so the spot above it isn't yellow.</p>`, demos: [{ label: "r U r'", setup: inv(A.rUr), moves: A.rUr, focus: 'centre' }, { label: "l' U l (left column)", setup: inv("l' U l"), moves: "l' U l", focus: 'centre' }] },
      ],
      drill: 'centre',
    },
    {
      id: 'centres36', title: 'Centres: the last four', mins: 5,
      parts: [
        { html: `<p>Turn the cube so white and yellow are on the <b>left and right</b>. Now the r and l slices never touch them, so you can move freely. Build the third centre on top.</p>` },
        { html: `<p>For the fourth, keep the third on the <b>front</b>. Lift pieces from the <b>back</b> with <b>r' U r</b>, and from the <b>bottom</b> with <b>r2 U r2</b>. Both put the front back where it was.</p>`, demos: [{ label: "r' U r", setup: inv(A.rUrBack), moves: A.rUrBack, focus: 'centre' }, { label: 'r2 U r2', setup: inv(A.r2Ur2), moves: A.r2Ur2, focus: 'centre' }] },
        { html: `<p><b>Last two centres</b>: put them on top and front. Use only U, F and r U r'. Make a column of two on the front, turn U so the column above has the wrong colour, then swap with r U r'.</p>`, demos: [{ label: "r U2 r'", setup: inv("r U2 r'"), moves: "r U2 r'", focus: 'centre' }] },
      ],
      drill: 'centre-back',
    },
    {
      id: 'edges', title: 'Pairing the edges', mins: 6,
      parts: [
        { html: `<p>Each 3x3-style edge is made of two pieces with the same two colours (twins). Pair all 12.</p>
<p><b>Set up</b> with outer turns only (R, L, U, D, F, B - they never break centres): one twin in the <b>front-left</b> edge, the other in the <b>front-right</b> edge, at different heights. Line them up so that sliding the left one across would drop it right next to its twin.</p>` },
        { html: `<p>Left piece on <b>top</b>: <b>Uw' R U R' F R' F' R Uw</b>. Uw' brings the left twin across to its partner, R U R' F R' F' R moves things so the slice back can't split them, and Uw puts the centres back. Other pairs are never broken.</p>`, demos: [{ label: 'Pair (top)', setup: inv(A.pairU), moves: A.pairU, focus: 'wing' }] },
        { html: `<p>Left piece at the <b>bottom</b>: <b>Dw R U R' F R' F' R Dw'</b>. The same algorithm also finishes the last two edges at once.</p>`, demos: [{ label: 'Pair (bottom)', setup: inv(A.pairD), moves: A.pairD, focus: 'wing' }] },
      ],
      drill: 'pair',
    },
    {
      id: 'three', title: 'The 3x3 stage (refresher)', mins: 6,
      parts: [
        { html: `<p>Now it's a big 3x3: treat each pair as one edge and use outer turns only. Same beginner steps you know, with white on the bottom.</p>` },
        { html: `<p><b>White corners</b>: hold the spot at front-right-bottom, corner above it, repeat <b>R U R' U'</b>.</p>`, demos: [{ label: "R U R' U' x3", setup: inv(rep(A.trigger, 3)), moves: rep(A.trigger, 3) }] },
        { html: `<p><b>Middle layer</b>: edge's side colour matches the front centre. To the right: <b>U R U' R' U' F' U F</b>. To the left: <b>U' L' U L U F U' F'</b>.</p>`, demos: [{ label: 'Right', setup: inv(A.right), moves: A.right }, { label: 'Left', setup: inv(A.left), moves: A.left }] },
        { html: `<p><b>Yellow cross</b>: <b>F R U R' U' F'</b> (dot, then L at back-left, then line left-right).</p>`, demos: [{ label: "F R U R' U' F'", setup: inv(A.fru), moves: A.fru }] },
        { html: `<p><b>Yellow edges</b>: two neighbours matching at back and right, then <b>R U R' U R U2 R'</b> and a final <b>U</b>.</p>`, demos: [{ label: 'Sune', setup: inv(A.sune), moves: A.sune }] },
        { html: `<p><b>Corner places</b>: a correct corner at front-right, then <b>U R U' L' U R' U' L</b>. <b>Twist</b>: <b>R' D' R D</b> until yellow is up, turn only U between corners.</p>`, demos: [{ label: 'Corner swap', setup: inv(A.niklas), moves: A.niklas }, { label: "R' D' R D x2", setup: inv(rep(A.twist, 2)), moves: rep(A.twist, 2) }] },
      ],
      drill: 'sune',
    },
    {
      id: 'oll', title: 'OLL parity', mins: 4,
      parts: [
        { html: `<p><b>When:</b> at the yellow cross you see <b>1 or 3</b> yellow edges facing up. A 3x3 can't do that, so the 4x4 needs one extra algorithm.</p>
<p><b>Fix:</b> hold a non-yellow edge at the front-top, then:</p>
<p class="alg">r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2</p>
<p>Learn it in chunks: <b>r2 B2</b> · <b>U2 l U2 r'</b> · <b>U2 r U2</b> · <b>F2 r F2</b> · <b>l' B2 r2</b>. The small r and l are inner slices.</p>`, demos: [{ label: 'OLL parity', setup: A.oll, moves: A.oll, focus: 'top' }] },
      ],
      drill: 'oll',
    },
    {
      id: 'pll', title: 'PLL parity', mins: 3,
      parts: [
        { html: `<p><b>When:</b> at the end, two corners are right and two need to swap (the corner algorithm can't fix that), or two edges are swapped.</p>
<p><b>Fix:</b> this swaps the front-top and back-top edges:</p>
<p class="alg">r2 U2 r2 Uw2 r2 u2</p>
<p>Then fix the yellow edges and corners again as usual.</p>`, demos: [{ label: 'PLL parity', setup: A.pll, moves: A.pll, focus: 'top' }] },
      ],
      drill: 'pll',
    },
  ];

  // keypad sets
  const K = {
    outer: ['R', "R'", 'R2', 'L', "L'", 'L2', 'U', "U'", 'U2', 'D', "D'", 'D2', 'F', "F'", 'F2', 'B', "B'", 'B2'],
    inner: ['r', "r'", 'r2', 'l', "l'", 'l2', 'u', "u'", 'u2', 'd', "d'", 'd2'],
    wide: ['Rw', "Rw'", 'Uw', "Uw'", 'Uw2', 'Dw', "Dw'"],
  };
  const DRILLS = [
    { id: 'notation', title: 'Name that move', quiz: true, lesson: 'notation', prompt: 'Watch the cube. Which move was that?' },
    { id: 'centre', title: "Lift a centre piece: r U r'", lesson: 'centres12', setup: inv(A.rUr), answer: A.rUr, keys: ['outer', 'inner'], focus: 'centre', prompt: 'Bring the front column piece up into the top centre without breaking the bottom.' },
    { id: 'centre-back', title: "From the back: r' U r", lesson: 'centres36', setup: inv(A.rUrBack), answer: A.rUrBack, keys: ['outer', 'inner'], focus: 'centre', prompt: 'Fix the top centre using a piece from the back.' },
    { id: 'centre-down', title: 'From the bottom: r2 U r2', lesson: 'centres36', setup: inv(A.r2Ur2), answer: A.r2Ur2, keys: ['outer', 'inner'], focus: 'centre', prompt: 'Fix the top centre using a piece from the bottom.' },
    { id: 'pair', title: 'Pair edges (left piece on top)', lesson: 'edges', setup: inv(A.pairU), answer: A.pairU, keys: ['outer', 'wide'], focus: 'wing', prompt: 'Pair the front-left and front-right twins.' },
    { id: 'pair-d', title: 'Pair edges (left piece at bottom)', lesson: 'edges', setup: inv(A.pairD), answer: A.pairD, keys: ['outer', 'wide'], focus: 'wing', prompt: 'Pair the twins, left piece at the bottom.' },
    { id: 'corner', title: 'White corner', lesson: 'three', setup: inv(rep(A.trigger, 3)), answer: rep(A.trigger, 3), keys: ['outer'], prompt: "Drop the corner into its spot at front-right-bottom." },
    { id: 'mid-r', title: 'Middle edge to the right', lesson: 'three', setup: inv(A.right), answer: A.right, keys: ['outer'], prompt: 'Insert the front-top edge to the right.' },
    { id: 'mid-l', title: 'Middle edge to the left', lesson: 'three', setup: inv(A.left), answer: A.left, keys: ['outer'], prompt: 'Insert the front-top edge to the left.' },
    { id: 'ycross', title: 'Yellow cross', lesson: 'three', setup: inv(A.fru), answer: A.fru, keys: ['outer'], focus: 'top', prompt: 'Make the yellow cross on top.' },
    { id: 'sune', title: 'Yellow edges (Sune)', lesson: 'three', setup: inv(A.sune), answer: A.sune, keys: ['outer'], focus: 'top', prompt: 'Solve the cube with one algorithm.' },
    { id: 'niklas', title: 'Corner places', lesson: 'three', setup: inv(A.niklas), answer: A.niklas, keys: ['outer'], focus: 'top', prompt: 'Cycle the three top corners into place.' },
    { id: 'twist', title: "Twist a corner: R' D' R D", lesson: 'three', setup: inv(rep(A.twist, 2)), answer: rep(A.twist, 2), keys: ['outer'], prompt: 'Twist the front-right corner so yellow faces up.' },
    { id: 'oll', title: 'OLL parity', lesson: 'oll', setup: A.oll, answer: A.oll, keys: ['outer', 'inner'], focus: 'top', prompt: 'Flip the front-top edge.' },
    { id: 'pll', title: 'PLL parity', lesson: 'pll', setup: A.pll, answer: A.pll, keys: ['outer', 'inner', 'wide'], focus: 'top', prompt: 'Swap the front-top and back-top edges.' },
  ];

  const SHEET = [
    { group: 'Centres', items: [
      { name: 'Lift from front', when: 'Second centre on top, piece in the front-right column.', alg: A.rUr, setup: inv(A.rUr) },
      { name: 'Lift from back', when: 'Fourth centre, piece on the back.', alg: A.rUrBack, setup: inv(A.rUrBack) },
      { name: 'Lift from bottom', when: 'Fourth centre, piece on the bottom.', alg: A.r2Ur2, setup: inv(A.r2Ur2) },
    ] },
    { group: 'Edge pairing', items: [
      { name: 'Left piece on top', when: 'Twins at front-left (top) and front-right (bottom).', alg: A.pairU, setup: inv(A.pairU) },
      { name: 'Left piece at bottom', when: 'Twins at front-left (bottom) and front-right (top).', alg: A.pairD, setup: inv(A.pairD) },
    ] },
    { group: '3x3 stage', items: [
      { name: 'White corner', when: 'Corner above its spot at front-right. Repeat.', alg: A.trigger, setup: inv(rep(A.trigger, 3)) },
      { name: 'Middle edge right', when: 'Side colour matches front, top colour matches right.', alg: A.right, setup: inv(A.right) },
      { name: 'Middle edge left', when: 'Top colour matches left.', alg: A.left, setup: inv(A.left) },
      { name: 'Yellow cross', when: 'Dot, L (back-left) or line (left-right).', alg: A.fru, setup: inv(A.fru) },
      { name: 'Yellow edges (Sune)', when: 'Matching neighbours at back and right. Finish with U.', alg: A.sune, setup: inv(A.sune) },
      { name: 'Corner places', when: 'Correct corner at front-right.', alg: A.niklas, setup: inv(A.niklas) },
      { name: 'Twist corner', when: 'Twisted corner at front-right-top. Repeat, turn only U.', alg: A.twist, setup: inv(rep(A.twist, 2)) },
    ] },
    { group: 'Parity (4x4 only)', items: [
      { name: 'OLL parity', when: '1 or 3 yellow edges up. Wrong edge at front-top.', alg: A.oll, setup: A.oll },
      { name: 'PLL parity', when: 'Two corners/edges need to swap at the end.', alg: A.pll, setup: A.pll },
    ] },
  ];

  G.Content = { LESSONS, DRILLS, SHEET, KEYS: K, ALGS: A };
})(typeof self !== 'undefined' ? self : globalThis);

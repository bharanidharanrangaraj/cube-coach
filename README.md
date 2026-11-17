# Cube Coach (4x4)

Show your 4x4 cube to the camera. Cube Coach reads the colours, works out which stage you're at,
and guides you from there one step at a time, using the beginner method you can learn to do
without the app. Everything runs in the browser on the device with the camera: no server, no
upload, works offline. About 160 KB, no libraries.

## Run it

**On this computer:**

```bash
python serve.py --local-only
```

Then open http://localhost:8001 in Chrome or Edge. Double-clicking `index.html` should also work
in Chrome/Edge (the camera is allowed on local files), but that path wasn't tested.

**On your phone, today (same Wi-Fi):**

```bash
python serve.py
```

Open the `https://192.168.x.x:8444` address it prints. The phone warns that the connection isn't
private, because the certificate was made on this computer. **Chrome:** Advanced → Proceed. **Safari:** Show Details →
visit this website. If the phone can't connect, allow Python through Windows Firewall on
Private networks.

**On your phone, forever offline (recommended):** open
**https://bharanidharanrangaraj.github.io/cube-coach/** once, then choose **Install app** (Chrome)
or **Share → Add to Home Screen** (Safari). From then on it opens from the home screen and works in
airplane mode. The camera picture never leaves the phone. The site is GitHub Pages, served from the
`main` branch of this repository, so pushing to `main` updates it. An installed copy picks up
updates the next time it's opened with internet.

## Use it

1. **Scan**: hold one face inside the grid. It captures by itself when the cube is still. Then
   follow the arrow: three sideways turns, tilt the top toward the camera, then the bottom.
   Six faces, about 30 seconds. Even light, no glare.
2. **Check the colours**: the flat map shows your cube. Stickers with a dot are the ones the camera
   was least sure about. To fix one, pick a colour and tap the sticker. It only lets you solve
   once every piece is a real piece.
3. **Solve**: each step shows the **goal**, then a **hint**, then the **moves** ("Teach me" on).
   Turn "Teach me" off to see the moves straight away. Tap **Next** after each move (or press →).
   - **📷 Camera** shows the live camera with an arrow for the next move. With the front camera
     (laptop, or a phone on a stand facing you) the camera sees the *back* of the cube, like a
     mirror: turn the layer the way the arrow moves in the mirror.
   - **Check with camera**: shows one side to the camera and says whether it matches. It suggests
     the side that changed most in that step, because a mistake shows up there.
   - Lost? **Rescan** and it carries on from wherever your cube is now.
4. **Learn / Practice / Cheat sheet**: lessons with animated demos of each technique, drills where
   you solve a case on the 3D cube by tapping moves (stars for doing it without the answer), a
   "name that move" quiz, and a printable sheet of every algorithm.

## The method

Reduction, the usual beginner way to solve a 4x4:

| Stage | How |
|---|---|
| Centres | First centre by feel, opposite centre with `r U r'`, the last four with `r' U r` / `r2 U r2` |
| Edge pairs | Twins at front-left and front-right: `Uw' R U R' F R' F' R Uw` (or the `Dw` version) |
| 3x3 stage | White cross, `R U R' U'` corners, middle edges, `F R U R' U' F'`, `R U R' U R U2 R' U`, `U R U' L' U R' U' L`, `R' D' R D` |
| OLL parity | 1 or 3 yellow edges up: `r2 B2 U2 l U2 r' U2 r U2 F2 r F2 l' B2 r2` |
| PLL parity | Two corners stuck swapped: `r2 U2 r2 Uw2 r2 u2` |

Small letters are inner slices only, `w` means both layers, `x y z` turn the whole cube.

## How it works

- `js/cube.js`: the 4x4 sticker model. Every move is built from 3D geometry.
- `js/solver.js`: the beginner method as code. Centres use small exact search tables over
  person-sized moves like `r U r'`. Edges use one pairing algorithm, with the shortest set-up
  found by search. The 3x3 stage follows the usual beginner steps. It solves in about 10–20 ms.
- `js/vision.js`: per frame, the median colour of the middle of each grid cell, plus a check that the
  cells look like stickers. After 6 faces it white-balances, groups the 96 colours into 6 groups of
  exactly 16 (a 4x4 has 16 of each), and fixes leftovers by checking every corner and edge is a real
  piece. Colours are compared in a shadow-proof way (colour relative to lightness).
- `js/render3d.js`: the 3D cube and arrows, drawn on a plain canvas.
- `js/app.js`: the screens. `js/content.js`: lessons, drills, cheat sheet.

## Tests

```bash
node tools/test_solver.js 300    # random, rotated and parity cubes: every step replayed, must end solved
node tools/test_vision.js 200    # simulated scans under random lighting: colour accuracy
node tools/test_content.js       # every lesson demo, drill and cheat-sheet case ends solved
```

Open `http://localhost:8001/?demo=1` for a simulated camera (a virtual cube), handy for trying
the app without a real cube. Add `&facing=user` to simulate the front camera.

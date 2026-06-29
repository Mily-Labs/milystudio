# Techniques Cookbook — finished moves & procedural generation

Recipes that combine the primitives in [`lottie-toolbox.md`](lottie-toolbox.md)
into pieces a motion designer would ship, plus the generator-script pattern that
unlocks everything Skottie can't express at runtime.

---

## Part A — Recipes (assemble the primitives)

### 1. Line-art self-draw (logo / signature / icon reveal)
Trim path on a stroked path, `e` 0→100 with easeOutExpo, round caps. For a
multi-stroke logo, give each stroke its own group/`tm` and **stagger** the start
times (stroke 2 begins as stroke 1 is ~70% drawn). Optionally trail a fill in
behind the draw via a track matte (the drawn stroke is the matte; a fill shows
through it). Premium finish: a gradient stroke + a light-sweep pass after the
draw completes.

### 2. Kinetic typography (text that performs)
Use a text layer (`ty: 5`) or convert glyphs to shapes. Reveal words with a
**bottom-up mask** per word and **stagger** word entrances (3–5f apart). Add a
slight scale-overshoot and a baseline rise. For emphasis words, push scale and
hold. Clip a moving gradient to the text with a **luma matte** for a shimmer.

### 3. Liquid blob morph
Two+ ellipses + **merge union** (`mm: 2`); animate one blob's position/scale so
the union stretches and snaps (metaball). Or a single **morphing path** between
two organic shapes (equal vertex counts), breathing on a loop. Slow ease-in-out,
no hard stops — see the organic style in [`creative-direction.md`](creative-direction.md).

### 4. Particle burst (success/celebration)
N small shapes flung radially from a center, each with: outward position
(arc via `ti`/`to`), scale pop then shrink, opacity fade-out, slight rotation.
**Every particle has a different angle/speed/delay** — this is parametric, so
**generate it** (Part B). Add a quick scale-overshoot ring at the origin.

### 5. Seamless loop (loader / ambient)
The loop's **frame `op` state must equal frame `0` state.** Techniques:
- Continuous rotation: linear `r` 0→360 over the whole duration.
- Pulsing/breathing: sample a periodic function whose period divides `op`.
- Marching dashes: offset delta over the loop = `dash + gap`.
- Traveling gradient: keyframe `s`/`e` so the end matches the start.
Verify by screenshotting frame `0` and frame `op-1` — they should be visually
identical.

### 6. Parallax camera move (cinematic depth)
Parent foreground, midground, background to **separate nulls** (or one null with
per-layer extra motion). Push the camera null (scale 100→110) and pan slightly;
move foreground more than background. Add slow-in on the hero. See
[`lottie-toolbox.md`](lottie-toolbox.md) → null rigs.

### 7. Spring / elastic arrival
Bake a damped oscillation (overshoot then decaying over/undershoots) — values in
[`motion-craft.md`](motion-craft.md). For one element you can hand-write it; for
many or for tuned physics, generate it.

### 8. Light sweep / sheen (instant "premium")
A bright, soft, angled gradient bar on a **screen/add** blend layer, masked to
the target shape (or track-matted to it), swept across via position keyframes
with ease-in-out. Subtle and short (12–18f).

### 9. Number counter / data ticker
Use **hold keyframes** (`h: 1`) to step a text slot's value, or stack digit
shapes and slide them vertically behind a mask. Ease the final approach (fast
then settle on the target number).

### 10. Glitch / digital
Short, **deterministic** position/opacity jitters (baked, seeded — not random
at runtime). RGB split: duplicate the layer 2–3×, tint each channel color, offset
a few px, blend **add/screen**, jitter offsets for a few frames, then resolve.

---

## Part B — Procedural generation (the secret weapon)

Skottie runs **no expressions**, so physics, noise, particle systems, springs,
and large staggered fields can't be computed at playback time — you **bake** them
into keyframes with a script that emits `lottie.json`. This is the *intended*
path for parametric work, not a hack.

**Workflow**
```bash
# write the generator under scripts/, then:
node scripts/grid-wave.mjs > public/projects/main-project/scene-1/lottie.json
# reload the player page (hand-written/generated JSON does not hot-reload)
```

Use a generator when you have: many elements, baked springs/physics,
noise-driven motion, deterministic randomness (seeded PRNG → reproducible),
or a loop whose seam must be computed from `op`.

### Reusable helpers

```js
// easing handle objects (see motion-craft.md for the value table)
const EASE = {
  outExpo: { o: { x: [0.16], y: [1] },  i: { x: [0.3],  y: [1] } },
  inOut:   { o: { x: [0.45], y: [0] },  i: { x: [0.55], y: [1] } },
  outBack: { o: { x: [0.34], y: [1.56] }, i: { x: [0.64], y: [1] } },
};
// build a keyframe list from [time, value[]] pairs with a shared easing
const keys = (pairs, ease = EASE.inOut) =>
  pairs.map(([t, s], k) =>
    k === pairs.length - 1 ? { t, s } : { t, s, o: ease.o, i: ease.i });

// seeded PRNG so "random" output is reproducible (no Math.random in committed art)
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// a single filled dot as a shape group, with an animated scale (= the wave)
const dot = (x, y, size, color, scaleKeys) => ({
  ty: "gr", nm: `dot-${x}-${y}`, it: [
    { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [size, size] } },
    { ty: "fl", c: { a: 0, k: color }, o: { a: 0, k: 100 } },
    { ty: "tr",
      p: { a: 0, k: [x, y] }, a: { a: 0, k: [0, 0] },
      s: { a: 1, k: scaleKeys }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
  ],
});
```

### Full example: staggered grid-wave loader (seamless loop)

A 5×5 grid of dots that pulse in a diagonal wave. Each dot's phase comes from its
grid position → a cascade. The pulse is sampled from a sine whose period divides
the total duration, so **frame `op` == frame `0`** (perfect loop).

```js
// scripts/grid-wave.mjs   →   node scripts/grid-wave.mjs > .../scene-1/lottie.json
const W = 512, H = 512, FR = 60, OP = 90;     // 1.5s loop @60fps
const COLS = 5, ROWS = 5, GAP = 70, SIZE = 34;
const accent = [0.15, 0.6, 1, 1];

const groups = [];
const x0 = (W - (COLS - 1) * GAP) / 2;
const y0 = (H - (ROWS - 1) * GAP) / 2;

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const phase = ((c + r) / (COLS + ROWS)) * Math.PI * 2;   // diagonal cascade
    // sample the pulse every 5 frames so linear interpolation stays smooth,
    // and the last sample equals the first (seamless)
    const scaleKeys = [];
    for (let t = 0; t <= OP; t += 5) {
      const wave = 0.5 + 0.5 * Math.sin((t / OP) * Math.PI * 2 + phase);
      const s = 45 + wave * 75;                               // 45% … 120%
      scaleKeys.push(
        t === OP ? { t, s: [s, s] }
                 : { t, s: [s, s], o: { x: [0.45], y: [0] }, i: { x: [0.55], y: [1] } }
      );
    }
    const X = x0 + c * GAP - W / 2;   // group coords are relative to the layer center
    const Y = y0 + r * GAP - H / 2;
    groups.push(dotGroup(X, Y, SIZE, accent, scaleKeys));
  }
}

function dotGroup(x, y, size, color, scaleKeys) {
  return { ty: "gr", nm: `dot`, it: [
    { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [size, size] } },
    { ty: "fl", c: { a: 0, k: color }, o: { a: 0, k: 100 } },
    { ty: "tr", p: { a: 0, k: [x, y] }, a: { a: 0, k: [0, 0] },
      s: { a: 1, k: scaleKeys }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
  ] };
}

const doc = {
  v: "5.7.0", fr: FR, ip: 0, op: OP, w: W, h: H, nm: "Grid wave",
  assets: [],
  slots: {
    bgColor: { p: { a: 0, k: [0.04, 0.05, 0.09, 1] } },
    dotColor: { p: { a: 0, k: accent } },
  },
  layers: [
    { ty: 4, nm: "dots", ind: 1, ip: 0, op: OP, st: 0,
      ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, a: { a: 0, k: [0, 0, 0] },
            s: { a: 0, k: [100, 100, 100] }, p: { a: 0, k: [W / 2, H / 2, 0] } },
      shapes: groups },
    { ty: 4, nm: "background", ind: 2, ip: 0, op: OP, st: 0,
      ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, a: { a: 0, k: [0, 0, 0] },
            s: { a: 0, k: [100, 100, 100] }, p: { a: 0, k: [W / 2, H / 2, 0] } },
      shapes: [ { ty: "gr", nm: "bg", it: [
        { ty: "rc", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [W, H] }, r: { a: 0, k: 0 } },
        { ty: "fl", c: { sid: "bgColor" }, o: { a: 0, k: 100 } },
        { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
      ] } ] },
  ],
};

process.stdout.write(JSON.stringify(doc));
```

Wire a `dotColor` slot through if you want it editable (point the dot fills at
`{ "sid": "dotColor" }` instead of an inline color), and add a `controls.json`
with labels. Tweak `COLS/ROWS/GAP/OP/phase` to restyle the whole piece in one
edit — that parametric control is the entire point of generating.

### Particle burst (variation sketch)

Same skeleton; instead of a grid, emit N groups, each a particle:

```js
const rnd = mulberry32(1234);                 // reproducible
for (let i = 0; i < 40; i++) {
  const ang = (i / 40) * Math.PI * 2 + rnd() * 0.3;
  const speed = 120 + rnd() * 120;
  const delay = Math.floor(rnd() * 6);
  const ex = Math.cos(ang) * speed, ey = Math.sin(ang) * speed;
  // position: center → outward, arced via ti/to; scale: 0 → pop → shrink;
  // opacity: 100 → 0 near the end. Build keyframes offset by `delay`.
}
```

Each particle gets a unique angle/speed/delay, an outward arced position, a scale
pop-then-shrink, and an opacity fade — exactly the kind of per-element variation
that's painful by hand and trivial in a loop.

### Generation tips

- **Always validate the output:**
  `node -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"`.
- **Keep it deterministic** — seeded PRNG, no `Math.random()` in committed art,
  so re-runs reproduce the same piece.
- **Compute the seam from `op`** for loops; sample periodic motion at a divisor
  of the period.
- **Reload the page** after generating — generated/hand-edited JSON does not
  hot-reload (only folder add/remove/rename does).
- Then verify with `?frame=N` stills at `0`, `op/2`, `op-1`, plus a couple around
  key beats, per the SKILL checklist.

# Motion Craft — timing, easing, and the feel of motion

This is the part that separates "the computer moved a shape" from "a designer
animated this." Everything here bakes into keyframes (Skottie runs no
expressions), so the numbers matter. Copy the values; tune to taste.

## How Lottie easing works (the mental model)

An animated property is a list of keyframes. Each keyframe has a time `t` and a
value `s`. The **easing of the segment between keyframe A and keyframe B** is
defined by **A's out-handle `o`** and **B's in-handle `i`**, each a bezier
control point `{ "x": [..], "y": [..] }` where `x` = time fraction (0–1) and
`y` = value fraction (0–1).

A CSS `cubic-bezier(x1, y1, x2, y2)` maps directly:
- on keyframe **A**: `"o": { "x": [x1], "y": [y1] }`
- on keyframe **B**: `"i": { "x": [x2], "y": [y2] }`

```jsonc
"p": { "a": 1, "k": [
  { "t": 0,  "s": [256, 120, 0], "o": { "x": [0.16], "y": [1] }, "i": { "x": [0.3], "y": [1] } },
  { "t": 24, "s": [256, 300, 0] }   // last keyframe needs no handles
] }
```

Notes:
- **Scalar/1-D** properties (opacity, rotation, single scale) use **single-item**
  arrays: `"x": [0.4]`. Multi-D (position `[x,y]`, scale `[x,y]`) can share one
  handle (single-item arrays) or specify per-axis (multi-item). Single-item is
  simplest and usually right.
- **Hold / stepped:** add `"h": 1` to a keyframe to jump (no interpolation) —
  good for ticking counters, frame-by-frame, hard cuts.
- **The last keyframe carries no handles** (nothing comes after it).
- Avoid `x` exactly `0` or `1` on a handle (vertical tangent) — it can spike.
  Use `0.01`/`0.99` if you need near-vertical.

## Easing cheat-sheet (copy these handles)

Each row = the `o` on the start keyframe and the `i` on the end keyframe.

| Name | Feel | start `o` (x,y) | end `i` (x,y) |
|---|---|---|---|
| **Linear** | avoid — robotic | (1, 1)\* | (0, 0)\* |
| **Standard (Material)** | balanced UI | (0.4, 0) | (0.2, 1) |
| **Ease-out (decelerate)** | enters & relaxes | (0.0, 0) | (0.2, 1) |
| **Ease-in (accelerate)** | exits / speeds up | (0.4, 0) | (1.0, 1) |
| **Ease-in-out (smooth)** | premium, calm | (0.45, 0) | (0.55, 1) |
| **easeOutExpo** | snappy modern entrance | (0.16, 1) | (0.3, 1) |
| **easeOutQuint** | crisp, less extreme | (0.22, 1) | (0.36, 1) |
| **easeInOutCubic** | confident smooth | (0.65, 0) | (0.35, 1) |
| **easeOutBack (overshoot)** | playful arrival | (0.34, 1.56) | (0.64, 1) |
| **anticipate (easeInBack)** | wind-up before move | (0.36, 0) | (0.66, -0.56) |

\* For true linear, just omit `i`/`o` handles entirely (no easing object) — that
is linear. Only use it intentionally (e.g. a constant-speed conveyor, a steady
rotation).

**`y` values outside 0–1 are how you overshoot/anticipate.** `y > 1` overshoots
the target; `y < 0` pulls back before going. easeOutBack above uses `y=1.56` to
sail past and settle.

**Default recommendation:** entrances → easeOutExpo or easeOutBack; exits →
ease-in; transitions between two on-screen states → ease-in-out. When unsure,
Standard (0.4,0)→(0.2,1) is never wrong.

## Timing & spacing (the other half of easing)

Easing shapes a single segment; **timing** is how you place keyframes in time.

- **Slow-in / slow-out:** spend more frames near the start and end of a move,
  fewer in the middle. Easing does this within a segment; reinforce it by where
  you put intermediate keyframes.
- **Pacing contrast:** a fast snap (8–12 frames) followed by a slow settle
  (12–20 frames) reads as deliberate. Uniform-speed everything reads as dead.
- **Hold the pose.** After a move lands, let it sit for a few frames before the
  next beat. Empty time is part of the rhythm.
- **Frame budgets at 60fps** (scale for other fps):
  - micro snap: 6–10f · standard entrance: 12–20f · graceful reveal: 24–40f ·
    settle/wobble after impact: 10–18f · breathing loop cycle: 60–120f.

## Anticipation → action → settle (the universal arc)

Almost every "thing arrives/acts" should be three beats, not one tween:

```jsonc
// A button/icon popping in with anticipation + overshoot, scale property:
"s": { "a": 1, "k": [
  { "t": 0,  "s": [0, 0],     "o": { "x": [0.4],  "y": [0] },  "i": { "x": [0.2], "y": [1] } },
  { "t": 4,  "s": [85, 85],   "o": { "x": [0.3],  "y": [0] },  "i": { "x": [0.3], "y": [1] } }, // tiny dip/wind-up optional
  { "t": 14, "s": [112, 112], "o": { "x": [0.33], "y": [0] },  "i": { "x": [0.3], "y": [1] } }, // overshoot past 100
  { "t": 22, "s": [100, 100] }                                                                   // settle
] }
```

- **Anticipation:** a small counter-move first (scale dips, position pulls back,
  rotation winds the other way) — even 2–4 frames sells the energy.
- **Overshoot:** sail past the target (scale 108–115%, rotate a few degrees past,
  position a few px past) on the way in.
- **Settle:** come back to the resting value, optionally with one tiny secondary
  bounce (e.g. 100 → 103 → 100) for elastic personality.

## Elastic / spring (baked)

Skottie has no spring expression, so bake a damped oscillation as keyframes:
overshoot, then alternating smaller over/undershoots that decay. A simple recipe
for a value settling to `V` after a kick, sampled every ~5 frames:

```
V*0  →  V*1.15  →  V*0.95  →  V*1.03  →  V*0.99  →  V
```

Decay each overshoot by ~0.3× and shrink the interval slightly. For anything
parametric (many elements, exact spring physics), generate it — see
[`techniques-cookbook.md`](techniques-cookbook.md).

## Overlap, follow-through & secondary motion

- **Overlap:** parts don't move in lockstep. Start a child element 2–4 frames
  after its parent; the composition feels jointed, not rigid.
- **Follow-through:** trailing elements keep going after the lead stops, then
  damp. A tail, a cape, a string, a shadow, hair — offset its keyframes a few
  frames behind the body and let it overshoot once.
- **Secondary motion:** the main action provokes a reaction. Examples: a box
  lands → it squashes then un-squashes; a bell rings → the clapper swings with a
  lag; a card flips in → a soft shadow scales under it.

These are usually small (a few px, a few %, a few degrees) but they are the
single biggest "this looks professional" signal.

## Stagger / cascade (animating many elements)

Uniform timing on N elements looks mechanical; a **fanned** start time looks
alive. Give element `k` (0-indexed) a delay:

```
delay_k = k * step     // step ≈ 2–4 frames at 60fps
```

Patterns:
- **Linear cascade:** dots/bars wave left-to-right.
- **Radial:** delay by angle for a ring that lights up around.
- **Center-out / random:** delay by distance from center, or a *deterministic*
  shuffle (don't use real randomness in hand-written JSON; bake it via a script
  with a seeded PRNG so it's reproducible).

For more than ~6 staggered elements, **generate the JSON** — it's both easier and
cleaner. See the cookbook's grid-wave generator.

## Arcs — curved motion paths (`ti`/`to`)

Straight-line position moves look robotic. Bend the path with **spatial
tangents** on position keyframes: `to` (out of A) and `ti` (into B) are
`[x, y]` offsets that curve the trajectory.

```jsonc
"p": { "a": 1, "k": [
  { "t": 0,  "s": [120, 256, 0], "to": [60, -80, 0], "ti": [-60, 80, 0],
    "o": { "x": [0.4], "y": [0] }, "i": { "x": [0.2], "y": [1] } },
  { "t": 30, "s": [392, 256, 0] }
] }
```

This makes the object arc up and over instead of sliding flat. Pair with
**auto-orient** (`"ao": 1` on the layer) so it banks into the curve — see
[`lottie-toolbox.md`](lottie-toolbox.md#auto-orient).

## Weight & physics intuition

- **Heavy** = slow to start (long anticipation), hard to stop (overshoot +
  multiple settles), big squash on impact.
- **Light** = quick to start, floaty, drifts, gentle settle.
- **Gravity:** falling objects accelerate (ease-in down), then a sharp squash at
  impact, then a smaller bounce up (ease-out) — never a symmetric tween.
- **Squash & stretch conserves volume:** stretch on fast motion (taller/thinner),
  squash on impact (shorter/wider). Scale x and y inversely.

## Quick reference: what to reach for

| You want… | Use |
|---|---|
| A snappy modern entrance | easeOutExpo (0.16,1)→(0.3,1) |
| A playful arrival | easeOutBack overshoot (0.34,1.56)→(0.64,1) |
| Calm, premium | ease-in-out (0.45,0)→(0.55,1), longer duration |
| An exit | ease-in (0.4,0)→(1,1) |
| Many elements alive | stagger 2–4f + easeOut each |
| Curved travel | `ti`/`to` spatial tangents + `ao:1` |
| Spring/bounce | baked damped oscillation (or generate) |
| A constant loop element (rotation, conveyor) | linear, and last frame = first |

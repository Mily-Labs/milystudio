---
name: text-to-lottie
description: Author production-grade Lottie (Bodymovin) JSON animations that render in a local Skia/Skottie player. Use whenever the user asks to create, generate, design, edit, fix, or "animate" anything as a Lottie — from a simple loader to a virtuoso, art-directed motion piece. You act as an expert motion designer, not a JSON emitter.
---

# Authoring Renderable Lottie Files

You are a **virtuoso motion designer** who happens to deliver in Lottie JSON.
The renderer is **Skia's Skottie** module. Two jobs, always: (1) make a
deliberate, art-directed animation that a senior motion designer would sign off
on, and (2) make sure it actually renders in this player. This file covers the
mechanics and the creative bar; the `reference/` library covers the craft in
depth — **read the relevant reference file before you start animating**, not
after.

## The mindset (read this first)

Most agents produce *primitive* Lottie: one shape, one linear tween, constant
velocity, no anticipation, no secondary motion. That is the failure mode this
skill exists to defeat. Before you write a single keyframe, decide **what kind
of motion this wants to be** and commit to a point of view.

- **Interpret the context, don't just fulfill the noun.** "A loading spinner"
  could be a gooey metaball, a trim-path orbit, a staggered dot wave, or a
  morphing glyph. "A success check" could snap in with overshoot, draw itself
  along its own path, or burst with a particle ring. Pick the interpretation
  that fits the *purpose, surface, and mood* — then execute it at a high level.
- **Motion is the medium.** Easing, timing, overlap, and follow-through carry
  more meaning than the shapes. A boring shape with virtuoso timing beats a
  beautiful shape with linear tweens, every time.
- **Default to the bold-but-appropriate option.** When the brief is open, choose
  the most interesting direction you can still execute cleanly and verify.

→ **Read [`reference/creative-direction.md`](reference/creative-direction.md)**
for how to read a brief, choose a direction, the catalog of modern style
languages, and the anti-primitive checklist. Do this for any non-trivial ask.

## Skottie reality check (what changes how you build)

This renderer is **Skottie**, not lottie-web and not After Effects:

- **No expression engine.** `wiggle()`, `loopOut()`, inertia, time-based math —
  none of it runs. Anything procedural (springs, noise, particle systems,
  staggered cascades, physics) **must be baked into explicit keyframes**. This
  is exactly why a generator **script** is often the *right* tool, not a
  fallback — see "Procedural generation" below.
- **Reliable:** shapes, fills/strokes, gradients (linear/radial), trim paths,
  repeaters, masks, track mattes, merge paths, dashed strokes, polystar,
  rounded corners, parenting/null rigs, auto-orient, path morphing, blend
  modes, opacity/transform animation, text + slots.
- **Unreliable / verify before relying on it:** After Effects layer effects
  (`ef` — blurs, drop shadows, tints). Skottie covers only a subset. Prefer
  shape-based equivalents; if you use an effect, **screenshot to confirm it
  rendered** before you trust it.

## Setting up the project

The deliverable is not just a `lottie.json`: set up the viewer and make the
animation previewable in the browser. If the player project is missing, create
it; if it exists, install/update deps, start the dev server, and open the local
preview URL for verification.

**Always use the official GitHub player project — never hand-roll a custom
viewer.** This skill's JSON rules (slots, the properties panel, the `?frame=`
URL controls, the Skottie wasm wiring) only hold inside that exact project. Do
**not** build your own HTML page, swap in `lottie-web`, or scaffold a bespoke
canvas — any of those silently diverge from how this player renders and the
verification steps below won't apply. If the player isn't already on this
machine, scaffold a fresh copy with **degit**:

```bash
npx degit diffusionstudio/lottie my-animation
cd my-animation
npm install   # postinstall copies the CanvasKit wasm into /public
npm run dev
```

Then open the printed local URL. The dev server defaults to
**`http://localhost:3030`**. If you already have the project, just
`npm install && npm run dev`.

## Required folder structure in `/public`

The player is a multi-scene editor: every scene lives in its own folder under
`public/projects/`, and the app routes to one by path. **Follow this layout
exactly** — anything off-layout is ignored.

```
public/
├── canvaskit.wasm                 # Skia wasm (copied in by postinstall — don't touch)
└── projects/
    └── <project-slug>/            # e.g. main-project
        └── <scene-N>/             # e.g. scene-1, scene-2, … (see ordering below)
            ├── lottie.json        # REQUIRED — the Bodymovin animation
            ├── controls.json      # OPTIONAL — properties-panel metadata (see slots)
            └── <image files>      # OPTIONAL — .png/.jpg/.jpeg/.webp/.gif/.svg assets
```

Rules the scanner enforces:

- **Slugs are URL segments.** `<project-slug>` and `<scene-N>` must be
  folder-safe lowercase-ish names; they become the path `/<project>/<scene>`.
  The sidebar label title-cases the slug (`main-project` → "Main Project").
- **Scene ordering is the trailing `-N`** (regex `/-(\d+)$/`). Name new scenes
  `scene-<N>`; a slug with no trailing number sorts last.
- **`lottie.json` is mandatory.** A scene folder without one is silently
  dropped (a project with zero valid scenes disappears entirely).
- **Images are referenced by bare filename.** Put the image in the scene folder
  and reference it in `assets[].p` by filename only (e.g. `"p": "bg.png"`).

## Where to write the file (and how it loads)

- Write to **`public/projects/<project>/<scene-N>/lottie.json`**. For a
  brand-new animation with no target scene, **overwrite the placeholder scene at
  `public/projects/main-project/scene-1/lottie.json`** (or create a new project
  folder and `scene-1/` inside it), then open `/<project>/scene-1`.
- The app routes on **`/:project/:scene`**; `/` redirects to the first scene.
- The scenes plugin **watches the folder tree**: adding/removing/renaming a
  scene folder live-updates the sidebar over HMR. **Editing the contents of an
  existing `lottie.json` does NOT auto-reload** — reload the page (or
  re-navigate with `?frame=`) to pick up hand-edited JSON.
- **Re-read before you re-edit.** The user (and the properties panel) can write
  back to `lottie.json`, so the on-disk file may differ from your last copy.
  Read it from disk before modifying.

## Minimal valid skeleton

Every document needs `v, fr, ip, op, w, h, layers`. A shape lives inside a group
(`gr`) whose **last** item is the group transform (`tr`). Layers draw
back-to-front from the **end** of the `layers` array, so put background layers
last.

```json
{
  "v": "5.7.0", "fr": 60, "ip": 0, "op": 90, "w": 512, "h": 512,
  "nm": "My animation",
  "assets": [],
  "slots": { "bgColor": { "p": { "a": 0, "k": [1, 1, 1, 1] } } },
  "layers": [
    {
      "ty": 4, "nm": "shape", "ind": 1, "ip": 0, "op": 90, "st": 0,
      "ks": {
        "o": { "a": 0, "k": 100 }, "r": { "a": 0, "k": 0 },
        "a": { "a": 0, "k": [0, 0, 0] }, "s": { "a": 0, "k": [100, 100, 100] },
        "p": { "a": 0, "k": [256, 256, 0] }
      },
      "shapes": [
        { "ty": "gr", "nm": "g", "it": [
          { "ty": "el", "p": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [160, 160] } },
          { "ty": "fl", "c": { "a": 0, "k": [0.231, 0.6, 1, 1] }, "o": { "a": 0, "k": 100 } },
          { "ty": "tr", "p": { "a": 0, "k": [0, 0] }, "a": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [100, 100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
        ] }
      ]
    },
    {
      "ty": 4, "nm": "background", "ind": 2, "ip": 0, "op": 90, "st": 0,
      "ks": { "o": { "a": 0, "k": 100 }, "r": { "a": 0, "k": 0 }, "a": { "a": 0, "k": [0, 0, 0] }, "s": { "a": 0, "k": [100, 100, 100] }, "p": { "a": 0, "k": [256, 256, 0] } },
      "shapes": [
        { "ty": "gr", "nm": "bg", "it": [
          { "ty": "rc", "p": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [512, 512] }, "r": { "a": 0, "k": 0 } },
          { "ty": "fl", "c": { "sid": "bgColor" }, "o": { "a": 0, "k": 100 } },
          { "ty": "tr", "p": { "a": 0, "k": [0, 0] }, "a": { "a": 0, "k": [0, 0] }, "s": { "a": 0, "k": [100, 100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
        ] }
      ]
    }
  ]
}
```

This skeleton is the floor, not the goal. The moment the shape is on screen,
your real job — timing, easing, overlap, art direction — begins.

## The craft → make it move like a pro

These are the levers that separate primitive from virtuoso. Summary here; full
treatment with exact numbers in the reference.

- **Never ship linear.** Constant velocity reads as "computer did it." Almost
  every move wants an ease. Use deliberate cubic-bezier handles.
- **Anticipation → action → settle.** Real motion winds up before it moves and
  overshoots before it rests. Bake a small counter-move and an overshoot
  keyframe instead of a straight A→B tween.
- **Overlap & follow-through.** Parts don't start and stop together. Offset
  child elements by a few frames; let trailing parts catch up after the lead
  stops.
- **Stagger / cascade.** When animating many elements, fan their start times
  (e.g. +2–4 frames each). Uniform timing looks dead; a cascade looks alive.
- **Arc, don't go straight.** Use spatial tangents (`ti`/`to`) on position so
  things travel in curves, not rulers.
- **Secondary motion.** The main move triggers smaller reactions — a squash on
  impact, a wobble after a stop, a trailing shadow. This is where "alive" lives.
- **Hold the eye.** Vary pacing: a fast snap then a slow settle reads better
  than uniform speed. Slow-in/slow-out on the meaningful beats.

→ **Read [`reference/motion-craft.md`](reference/motion-craft.md)** for the
easing cheat-sheet (copy-paste bezier values), overshoot/elastic recipes,
stagger math, and the timing patterns that make motion feel designed.

## The toolbox → techniques Skottie renders

Reach beyond moving a shape from A to B. These are the building blocks of
distinctive work, each with a working JSON snippet in the reference:

- **Trim paths** (`tm`) — self-drawing lines, signature/logo reveals, animated
  strokes, progress rings, "marching" reveals.
- **Repeaters** (`rp`) — radial bursts, dot grids, spirals, loaders, halftone
  fields from a single shape.
- **Gradients** (`gf`/`gs`) — animated stops for sheen, depth, premium fills,
  light sweeps.
- **Masks & track mattes** (`masksProperties`, `tt`/`td`) — reveal-through-shape,
  wipes, text clipped to imagery, spotlight reveals.
- **Merge paths** (`mm`) — boolean union/subtract for gooey metaballs and
  compound shapes.
- **Path morphing** (animated `sh`) — shape A becomes shape B (icon→icon,
  liquid blobs). Keep vertex counts equal.
- **Polystar** (`sr`), **rounded corners** (`rd`), **dashed strokes** (`d`),
  **blend modes** (`bm`) — stars, soft geometry, marching ants, glow/light.
- **Null rigs & parenting** (`ty:3`, `parent`) — camera pushes/pans, jointed
  rigs, coordinated group motion.
- **Auto-orient** (`ao:1`) — objects that bank into their travel direction.

→ **Read [`reference/lottie-toolbox.md`](reference/lottie-toolbox.md)** for
Skottie-accurate, copy-paste snippets of every item above.

## Advanced techniques & procedural generation

→ **Read [`reference/techniques-cookbook.md`](reference/techniques-cookbook.md)**
for end-to-end recipes (line-art self-draw, kinetic typography, liquid morph,
particle burst, seamless loops, parallax camera, spring/elastic, light sweep,
number counters, glitch) **and** the generator-script pattern.

**Procedural generation is a first-class approach here, not a last resort.**
Because Skottie can't run expressions, the way to get physics, noise, particle
systems, spring overshoot, or a 60-element staggered cascade is to **compute the
keyframes in a script and emit `lottie.json`**:

- Put generators under `scripts/` (e.g. `scripts/particles.mjs`), run with
  `node scripts/particles.mjs > public/projects/<p>/<scene-N>/lottie.json`.
- Use scripts whenever the motion is parametric or repetitive: many elements,
  baked springs, noise-driven wiggle, deterministic randomness, seamless loops
  where frame `op` must equal frame `0`.
- Edit JSON directly for targeted tweaks; generate when the structure is
  algorithmic. Choose per task.

## Exposing editable properties (slots + properties panel)

The app renders a live properties panel that edits chosen values in real time
via Skottie's native **slots** — no re-parse, change shows next frame.

**1. Declare a slot.** Add a top-level `"slots"` object keyed by slot ID, and
point a property at it with `"sid"` instead of an inline value. The slot's `"p"`
holds the default in the property's normal shape.

```jsonc
"slots": {
  "ballColor": { "p": { "a": 0, "k": [0.231, 0.6, 1, 1] } },  // color RGBA 0–1
  "ballSize":  { "p": { "a": 0, "k": 120 } }                   // scalar
}
// then:  "c": { "sid": "ballColor" }   and   "s": { "sid": "ballSize" }
```

| Slot value | Control rendered |
|------------|------------------|
| scalar (single number) | slider |
| color (RGBA 0–1)       | color picker |
| vec2 (`[x, y]`)        | two number inputs |
| text (string)          | text input |

Slots are discovered automatically via `getSlotInfo()`. **Every animation must
expose at least a background-color control:**

```jsonc
// slots:    "bgColor": { "p": { "a": 0, "k": [1, 1, 1, 1] } }
// controls: { "sid": "bgColor", "label": "Background color" }
```

When the design has obvious "knobs" (primary color, speed-ish scale, accent),
expose them as slots too — it makes the deliverable feel finished.

**2. (Optional) `controls.json`** next to `lottie.json` adds labels/ranges:

```jsonc
{ "controls": [
  { "sid": "ballColor", "label": "Ball color" },
  { "sid": "ballSize",  "label": "Ball size", "min": 40, "max": 240, "step": 1 }
] }
```

`sid` must match a slot exactly; `min`/`max`/`step` shape scalar/vec2 inputs
(ignored for color/text). Unmatched entries are ignored; slots with no entry
fall back to defaults (0–100 range).

**Recommended:** give the document a root `nm` name — the player shows it above
the canvas and in `/__context`.

## Inspecting what's playing — `/__context`

```bash
curl -s http://localhost:3030/__context
```

Returns the full project/scene tree (with `lastModified`), the **active** scene,
and **live playback state** (current frame, `totalFrames`, `fps`). Prefer this
over screenshots to confirm your file landed and to read frame counts. The
browser POSTs heartbeats; you don't need to POST.

## Controlling playback & verification

**Pin the frame in the URL** to inspect a still moment:

```
http://localhost:3030/main-project/scene-1?frame=60
```

- `?frame=N` seeks to frame `N` and **pauses** there — the right way to grab an
  exact still. No `frame` param → autoplays on first load.
- The frame is per-scene; include the scene path. The canvas is
  `<canvas id="main-canvas">`. Blank canvas with no error → page still loading
  or the Lottie failed to parse / the group wrapping is wrong.

Verify deliberately — you're checking craft, not just "did something appear":

- **New scene → at least three stills** across the timeline: frame `0`, midpoint
  (`op/2`), and last frame (`op-1`). Catch the start pose, mid-flight motion,
  and end pose. For motion-feel, sample a few extra frames around key beats.
- **Small edits → one or two stills** around the changed region.
- **Hunt for artifacts and primitiveness, not just prompt-fidelity.** Ask: does
  it ease or slide? Is there anticipation/overshoot? Does anything pop in/out
  abruptly? Are edges clean? Does a loop seam? Fix what looks unfinished.

## Before you finish — checklist

**Renders correctly**
1. File at `public/projects/<project>/<scene-N>/lottie.json`; scene named
   `scene-<N>`.
2. Valid JSON (no comments, no trailing commas):
   `node -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"`.
3. Official GitHub player (degit), dev server running, scene visible at
   `/<project>/<scene>`, canvas rendering.
4. At least a background-color slot + control is present.

**Is actually good** (the part that matters)
5. No linear-only tweens; meaningful beats use deliberate easing.
6. There's anticipation and/or overshoot/settle where motion starts and stops.
7. Multi-element motion is staggered, not synchronized.
8. There's at least one piece of secondary motion or a distinctive technique
   from the toolbox — it should not look like the default "shape slides across."
9. If it loops, the last frame matches the first (no visible seam).
10. It reads as intentional and art-directed — something a motion designer would
    ship.

## References

- Creative direction & style languages: [`reference/creative-direction.md`](reference/creative-direction.md)
- Motion craft (easing, timing, overshoot, stagger): [`reference/motion-craft.md`](reference/motion-craft.md)
- Skottie technique toolbox (JSON snippets): [`reference/lottie-toolbox.md`](reference/lottie-toolbox.md)
- Advanced recipes & procedural generation: [`reference/techniques-cookbook.md`](reference/techniques-cookbook.md)
- Lottie format spec: <https://github.com/lottie/lottie-spec/tree/main/docs/specs>

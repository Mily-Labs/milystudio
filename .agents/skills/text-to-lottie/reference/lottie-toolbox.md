# Lottie Toolbox — Skottie-accurate technique snippets

Every snippet here renders in this player's Skottie. Copy the structure, swap
values. Reminder of the invariants:

- A shape lives in a group `gr`; the group's **last** `it` item is the group
  transform `tr`.
- Modifiers (trim `tm`, repeater `rp`, merge `mm`, round `rd`) sit **inside the
  group's `it` array, before the final `tr`**, and affect path items listed
  **above** them in the same group.
- Layers draw back-to-front from the **end** of the `layers` array (index 0 =
  on top).
- Give layers an `ind` if you'll parent to them.

## Shape primitives (the vocabulary)

| `ty` | Shape |
|---|---|
| `gr` | group (container; holds items + a `tr`) |
| `rc` | rectangle (`p` center, `s` size, `r` corner radius) |
| `el` | ellipse (`p` center, `s` size) |
| `sr` | polystar / polygon |
| `sh` | path (free bezier; animatable for morphs) |
| `fl` | fill · `gf` gradient fill |
| `st` | stroke · `gs` gradient stroke |
| `tr` | transform (group's own) |
| `tm` | trim paths · `rp` repeater · `mm` merge · `rd` round corners |

Layer types (`ty` on a layer): `0` precomp, `1` solid, `2` image, `3` null,
`4` shape, `5` text.

## Trim paths (`tm`) — self-drawing lines & rings

Animate `e` (end %) from 0→100 to "draw" a stroked path. `s` start, `e` end,
`o` offset (deg), `m` mode (`1` simultaneous across all paths, `2` individually).

```jsonc
{ "ty": "gr", "nm": "draw", "it": [
  { "ty": "sh", "ks": { "a": 0, "k": {
      "i": [[0,0],[0,0],[0,0]], "o": [[0,0],[0,0],[0,0]],
      "v": [[-120,40],[-30,-50],[120,30]], "c": false } } },
  { "ty": "st", "c": { "a": 0, "k": [0.1,0.5,1,1] }, "o": { "a": 0, "k": 100 },
    "w": { "a": 0, "k": 12 }, "lc": 2, "lj": 2 },              // lc/lj 2 = round cap/join
  { "ty": "tm", "s": { "a": 0, "k": 0 },
    "e": { "a": 1, "k": [
      { "t": 0,  "s": [0],   "o": { "x": [0.16], "y": [1] }, "i": { "x": [0.3], "y": [1] } },
      { "t": 45, "s": [100] } ] },
    "o": { "a": 0, "k": 0 }, "m": 1 },
  { "ty": "tr", "p": { "a": 0, "k": [256,256] }, "a": { "a": 0, "k": [0,0] }, "s": { "a": 0, "k": [100,100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
] }
```

- **Progress ring:** put `tm` on a stroked ellipse, animate `e` 0→100.
- **Both ends:** animate `s` and `e` together for a segment that travels along
  the path.
- **Round caps** (`lc: 2`) make draws look finished. For an SVG path reveal that
  "follows the natural direction," order the path vertices along the draw
  direction.

## Repeater (`rp`) — bursts, grids, spirals from one shape

`c` copies, `o` offset (start index), `m` composite (`1` below / `2` above).
Its embedded `tr` is applied **cumulatively** per copy: `p` shifts each copy,
`r` rotates each copy, `s` scales each copy, `so`/`eo` are start/end opacity
across the copies (great for fading trails).

```jsonc
// 12 ticks arranged in a ring (rotate each copy 30°), opacity fading around:
{ "ty": "gr", "nm": "ring", "it": [
  { "ty": "rc", "p": { "a": 0, "k": [0,-90] }, "s": { "a": 0, "k": [10,28] }, "r": { "a": 0, "k": 5 } },
  { "ty": "fl", "c": { "a": 0, "k": [1,1,1,1] }, "o": { "a": 0, "k": 100 } },
  { "ty": "tr", "p": { "a": 0, "k": [0,0] }, "a": { "a": 0, "k": [0,0] }, "s": { "a": 0, "k": [100,100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } },
  { "ty": "rp", "c": { "a": 0, "k": 12 }, "o": { "a": 0, "k": 0 }, "m": 2,
    "tr": { "ty": "tr",
      "p": { "a": 0, "k": [0,0] }, "a": { "a": 0, "k": [0,0] }, "s": { "a": 0, "k": [100,100] },
      "r": { "a": 0, "k": 30 },                         // each copy +30°
      "so": { "a": 0, "k": 100 }, "eo": { "a": 0, "k": 20 } } }  // fade trail
] }
```

- **Spinner:** rotate the *parent layer* steadily (linear, loop seam) while the
  repeater fades opacity around → a chasing-comet loader.
- **Grid:** set the repeater `tr.p` to `[stepX, 0]` and nest a second repeater
  (another group) stepping `[0, stepY]` for a full grid. Or generate the grid.
- **Spiral:** combine per-copy `r` (rotation) with per-copy `s` (scale down) and
  a small `p` offset.

## Gradients (`gf` / `gs`) — depth, sheen, premium fills

`t`: `1` linear, `2` radial. `s` start point, `e` end point (radial: `s` is the
center, `e` sets the radius). `g.p` = number of color stops. `g.k.k` is a flat
array; for each color stop: `[pos, r, g, b]` repeated `p` times. Append opacity
stops `[pos, opacity]` after the colors if you need them.

```jsonc
{ "ty": "gf", "t": 1, "o": { "a": 0, "k": 100 },
  "s": { "a": 0, "k": [-120,-120] }, "e": { "a": 0, "k": [120,120] },
  "g": { "p": 3, "k": { "a": 0, "k": [
      0,    0.05,0.5,1,      // stop @0  blue
      0.5,  0.4, 0.2,0.95,   // stop @0.5 purple
      1,    0.95,0.3,0.6     // stop @1  pink
  ] } } }
```

- **Animated sheen:** set `g.k.a: 1` and keyframe the flat array so a bright stop
  travels across — or simpler, keyframe `s`/`e` to sweep the gradient angle.
- **Radial glow:** `t: 2`, center `s` on the shape, `e` at the edge, light center
  → transparent-ish edge (use opacity stops).
- Color stop values are `0–1` (not 0–255).

## Masks — reveal through a moving shape

Layer-level `masksProperties`. `mode`: `"a"` add, `"s"` subtract, `"i"`
intersect, `"f"` difference, `"n"` none. Animate `pt` (the mask path) or just
move/scale the masked layer under a static mask for a wipe.

```jsonc
"masksProperties": [
  { "mode": "a", "inv": false,
    "pt": { "a": 1, "k": [
      { "t": 0,  "s": [ { "i":[[0,0],[0,0],[0,0],[0,0]], "o":[[0,0],[0,0],[0,0],[0,0]],
        "v":[[-300,-300],[-300,-300],[-300,300],[-300,300]], "c": true } ],
        "o": { "x": [0.16], "y": [1] }, "i": { "x": [0.3], "y": [1] } },
      { "t": 30, "s": [ { "i":[[0,0],[0,0],[0,0],[0,0]], "o":[[0,0],[0,0],[0,0],[0,0]],
        "v":[[-300,-300],[300,-300],[300,300],[-300,300]], "c": true } ] }
    ] },
    "o": { "a": 0, "k": 100 }, "x": { "a": 0, "k": 0 } }
]
```

This is a left-to-right wipe (the mask rectangle grows from zero width to full).
Mask reveals read far more "designed" than opacity fades.

## Track mattes (`tt` / `td`) — clip one layer to another's shape/luma

The **matte layer** sits directly **above** the matted layer (lower index) and
is marked `"td": 1` (it's the stencil, not drawn). The **matted layer** below
sets `"tt"`: `1` alpha, `2` alpha-inverted, `3` luma, `4` luma-inverted.

```jsonc
"layers": [
  { "ty": 4, "nm": "matte (text/shape stencil)", "ind": 1, "td": 1,
    "ip": 0, "op": 90, "st": 0, "ks": { /* … */ },
    "shapes": [ /* the shape that defines the visible area */ ] },

  { "ty": 4, "nm": "content (gets clipped)", "ind": 2, "tt": 1,
    "ip": 0, "op": 90, "st": 0, "ks": { /* … */ },
    "shapes": [ /* e.g. an animated gradient that sweeps — only shows inside the matte */ ] }
]
```

Uses: a gradient/shimmer clipped to text; an image revealed through a shape;
a luma gradient used as a soft wipe. Order matters — matte immediately above.

## Merge paths (`mm`) — booleans & gooey metaballs

`mm.mode`: `1` merge, `2` add (union), `3` subtract, `4` intersect, `5`
exclude-intersections. Place two `sh`/`el` paths in one group, then `mm`, then a
single fill, then `tr`. Two overlapping ellipses + union + a slight blur-feel
gives a **gooey metaball**:

```jsonc
{ "ty": "gr", "nm": "goo", "it": [
  { "ty": "el", "p": { "a": 0, "k": [-30,0] }, "s": { "a": 0, "k": [90,90] } },
  { "ty": "el", "p": { "a": 1, "k": [
      { "t": 0,  "s": [40,0],  "o": { "x": [0.4], "y": [0] }, "i": { "x": [0.2], "y": [1] } },
      { "t": 30, "s": [120,0] } ] }, "s": { "a": 0, "k": [70,70] } },
  { "ty": "mm", "mm": 2 },                                  // union the two blobs
  { "ty": "fl", "c": { "a": 0, "k": [0.2,0.8,0.6,1] }, "o": { "a": 0, "k": 100 } },
  { "ty": "tr", "p": { "a": 0, "k": [256,256] }, "a": { "a": 0, "k": [0,0] }, "s": { "a": 0, "k": [100,100] }, "r": { "a": 0, "k": 0 }, "o": { "a": 0, "k": 100 } }
] }
```

As the moving blob separates from the static one, the union "stretches" then
"snaps" — the classic metaball/liquid look.

## Path morphing (animated `sh`) — A becomes B

Set the path's `ks.a: 1` and keyframe the shape object in `s`. **Both keyframes
must have the same vertex count** (same-length `i`/`o`/`v` arrays) or the morph
tears. Best results come from generating both paths with matched vertex counts.

```jsonc
{ "ty": "sh", "ks": { "a": 1, "k": [
  { "t": 0,  "s": [ { "i":[…], "o":[…], "v":[…squareVerts…], "c": true } ],
    "o": { "x": [0.45], "y": [0] }, "i": { "x": [0.55], "y": [1] } },
  { "t": 24, "s": [ { "i":[…], "o":[…], "v":[…circleVerts…], "c": true } ] }
] } }
```

Tip: a circle approximated by 4 bezier vertices morphs cleanly to a 4-vertex
square/heart/etc. For icon→icon morphs, keep both at the same node count.

## Polystar (`sr`) — stars & polygons

`sy`: `1` star, `2` polygon. `pt` points, `r` rotation, `or`/`os` outer
radius/roundness, `ir`/`is` inner radius/roundness (star only). Animate `pt` or
`ir` for a pulsing star; animate `r` for spin.

```jsonc
{ "ty": "sr", "sy": 1, "pt": { "a": 0, "k": 5 },
  "p": { "a": 0, "k": [0,0] }, "r": { "a": 0, "k": 0 },
  "ir": { "a": 0, "k": 45 }, "is": { "a": 0, "k": 0 },
  "or": { "a": 0, "k": 100 }, "os": { "a": 0, "k": 0 } }
```

## Rounded corners (`rd`) & dashed strokes (`d`)

- **Round corners:** add `{ "ty": "rd", "r": { "a": 0, "k": 12 } }` to a group's
  `it` (before `tr`) to soften the path above it. Animate `r` for a
  square→squircle.
- **Marching ants / animated dashes:** on a stroke, add a `d` array. Animate the
  offset (`"n": "o"`) for marching motion.

```jsonc
{ "ty": "st", "c": { "a": 0, "k": [1,1,1,1] }, "o": { "a": 0, "k": 100 }, "w": { "a": 0, "k": 4 },
  "d": [
    { "n": "d", "nm": "dash",   "v": { "a": 0, "k": 24 } },
    { "n": "g", "nm": "gap",    "v": { "a": 0, "k": 14 } },
    { "n": "o", "nm": "offset", "v": { "a": 1, "k": [
        { "t": 0, "s": [0] }, { "t": 60, "s": [38] } ] } }   // loops if offset delta = dash+gap
  ] }
```

Make the offset delta over the loop equal `dash+gap` (here 38) for a seamless
march.

## Blend modes (`bm`) — glow, light, glitch

Set on a **layer**. `0` normal, `1` multiply, `2` screen, `3` overlay, `4`
darken, `5` lighten, `6` color-dodge, `10` difference, `16` add. Put a bright
shape on **screen** or **add** over a dark scene for a glow/light-sweep without
needing a blur effect. Duplicate a layer, tint it, and offset it a few px in
**screen** for an RGB-split glitch.

## Null rigs & parenting — camera moves & jointed motion

A **null** (`ty: 3`) is an invisible transform. Give it an `ind`; child layers
set `"parent": <that ind>` and inherit its transform. Animate the null to move
everything parented to it as one.

```jsonc
"layers": [
  { "ty": 3, "nm": "camera-null", "ind": 1, "ip": 0, "op": 90, "st": 0,
    "ks": {
      "o": { "a": 0, "k": 100 }, "r": { "a": 0, "k": 0 }, "a": { "a": 0, "k": [256,256,0] },
      "p": { "a": 0, "k": [256,256,0] },
      "s": { "a": 1, "k": [                                   // camera push: 100 → 112
        { "t": 0,  "s": [100,100,100], "o": { "x": [0.2], "y": [0] }, "i": { "x": [0.2], "y": [1] } },
        { "t": 90, "s": [112,112,100] } ] } } },

  { "ty": 4, "nm": "hero", "ind": 2, "parent": 1, "ip": 0, "op": 90, "st": 0,
    "ks": { /* its own animation, on top of the null's push */ },
    "shapes": [ /* … */ ] }
]
```

Scaling the null = camera **push/pull**; moving `p` = **pan**; rotating = a
camera roll. Parent several layers at different depths and move them at different
rates for **parallax** (foreground null moves more than background).

## Auto-orient — bank into the travel direction {#auto-orient}

Set `"ao": 1` on a layer with an animated, curved position (`ti`/`to` tangents).
The layer auto-rotates to face its motion path — a paper plane, a comet, an
arrow that follows its arc instead of staying flat.

## Effects (`ef`) — caution

Skottie supports only a **subset** of After Effects layer effects. Drop shadow,
Gaussian blur, tint, and fill *sometimes* render; many effects don't. **Prefer
shape-based equivalents** (a soft gradient instead of a glow blur; a dark offset
duplicate instead of a drop-shadow effect; screen/add blend for light). If you
do use an `ef`, **screenshot to confirm it actually rendered** before relying on
it — silent no-ops are common.

## When to stop hand-writing and generate

If a technique needs many elements, exact spacing/timing, baked physics, or a
seamless loop computed from `op`, switch to a generator script — see
[`techniques-cookbook.md`](techniques-cookbook.md). Trim/repeater/matte/morph
above are the primitives; the cookbook assembles them into finished pieces.

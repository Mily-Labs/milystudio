# Creative Direction — read the brief, choose a point of view

The difference between a primitive animation and a virtuoso one is decided
**before** you write keyframes. This file is the thinking step. Spend 60 seconds
here and the rest of the work gets dramatically better.

## 1. Read the context (interrogate the brief)

Even a one-line prompt implies answers. Pin them down — guess deliberately when
unstated, don't default blandly.

| Question | Why it changes the animation |
|---|---|
| **What is it for?** UI loader, hero/marketing, onboarding, success/error feedback, logo reveal, data viz, sticker/emoji, background ambiance | Decides duration, loop vs one-shot, energy, restraint |
| **Where does it live?** App screen, landing page, in-product micro-interaction, presentation | Decides scale, density, how loud it can be |
| **Loop or one-shot?** | A loader must seam perfectly; a reveal plays once and lands |
| **What's the emotional tone?** Playful, premium, technical, calm, energetic, celebratory | Decides easing personality (snappy vs smooth vs elastic) |
| **What's the subject's "physics"?** Heavy, light, liquid, mechanical, organic, electric | Decides weight, squash, overshoot, secondary motion |
| **Brand / palette / shape language?** | If given assets/colors, honor them; if not, design a cohesive small palette |
| **Duration & fps?** | Default 60fps. Loaders ~0.8–2s; reveals ~1–2.5s; hero loops 3–6s. Pick and commit |

If the user gave an SVG, screenshot, data, or palette — **use it as ground
truth.** Concrete assets beat invented geometry every time. Preserve the
original geometry unless asked to restyle.

## 2. Choose a direction (don't animate the obvious)

For any subject, brainstorm 2–4 *interpretations*, then pick the most
interesting one you can execute cleanly and verify. Examples:

- **"Loading spinner"** → trim-path orbit · gooey metaball merge · staggered dot
  wave · morphing glyph · liquid fill · breathing ring with overshoot.
- **"Success checkmark"** → self-drawing along its own path (trim) · snap-in with
  overshoot + a particle ring burst · a circle that wipes to reveal the check ·
  a tick that "stamps" with squash on impact.
- **"Logo reveal"** → mask wipe · trim-path line build · scale-up with elastic
  settle + light sweep · pieces flying in and assembling with overlap.
- **"Notification bell"** → anticipation wind-up then a damped wobble
  (follow-through), clapper offset from the bell by 2–3 frames.

Commit to one direction with a clear reason. A coherent bold choice beats a
timid average of everything.

## 3. Style languages (motion has accents)

Pick a "motion accent" and apply it consistently. Each has a signature in
**easing, timing, and detail**:

- **Snappy / expressive (modern UI):** fast in, slow settle. easeOutExpo /
  easeOutBack. Short anticipation, slight overshoot. The default for product
  micro-interactions.
- **Smooth / premium:** gentle ease-in-out, longer durations, subtle gradient
  sheen, nothing abrupt. For luxury/brand work.
- **Elastic / playful:** pronounced overshoot and wobble (back/elastic easing),
  squash & stretch, bouncy secondary motion. For consumer/fun.
- **Mechanical / precise:** crisp linear-ish segments with hard eases, stepped
  holds, geometric repeaters, marching dashes. For technical/data.
- **Organic / liquid:** path morphing, merge-path metaballs, slow breathing
  scales, noise-driven wiggle (baked), no hard stops. For fluid/natural themes.
- **Kinetic typography / editorial:** text revealed by masks, words that scale
  and track, baseline shifts, strong rhythmic timing to a beat.
- **Glitch / digital:** quick position/opacity jitters (baked, deterministic),
  RGB-split via offset duplicate layers in screen/add blend, scanline dashes.
- **Cinematic:** a camera push/pan via a parent null, depth via parallax layers,
  slow-in on the hero element, light sweep across.

## 4. Modern, unexpected moves (raise the ceiling)

When you want the result to feel current and surprising, reach for these instead
of a plain tween:

- **Reveal, don't fade.** Mask wipes, trim-path draws, and luma-matte sweeps read
  far more designed than an opacity fade.
- **Variable-rate easing.** Strong easeOut (e.g. `cubic-bezier(0.16,1,0.3,1)`) on
  entrances makes motion feel intentional and "fast then gentle."
- **Overshoot + settle on everything that arrives.** Scale to 108% then back to
  100%; rotate past then back. Tiny, but it's the tell of pro work.
- **Stagger across the field.** Fan timing across many elements so motion sweeps
  through the composition like a wave.
- **Morph between states.** Path morphing one icon into another, or a blob that
  reshapes, beats cross-fading two static shapes.
- **Depth & parallax.** Move background/foreground at different rates; add a
  subtle scale on a parent null for a camera push.
- **Light & sheen.** A gradient or a masked highlight sweeping across a surface
  signals quality instantly.
- **Negative space & subtraction.** Use merge-path subtract or subtract masks so
  shapes reveal *through* each other instead of merely overlapping.
- **Physical follow-through.** Trailing parts (a tail, a string, a shadow) keep
  moving after the lead stops, then damp out.

## 5. Anti-primitive checklist (what NOT to ship)

If any of these is true, it's primitive — fix it before finishing:

- ❌ A single shape doing a single move with **linear** easing.
- ❌ Everything starts and stops on the **same frame** (no overlap/stagger).
- ❌ Things **pop in/out** with a hard opacity cut where a reveal was wanted.
- ❌ Motion travels in **straight rulers** where an arc would read better.
- ❌ Arrival with **no overshoot/settle** — lands like it hit a wall, or worse,
  glides in at constant speed.
- ❌ A "loop" whose **last frame ≠ first frame** (visible jump on repeat).
- ❌ No **secondary motion** anywhere — nothing reacts to the main action.
- ❌ Only the background color is adjustable when the design clearly has other
  meaningful knobs (expose them as slots).

## 6. Then go deep on craft

Direction chosen? Now make it *move* well:
- Exact easing values, overshoot, stagger math → [`motion-craft.md`](motion-craft.md)
- The technique that realizes your direction (trim, matte, morph, repeater…) →
  [`lottie-toolbox.md`](lottie-toolbox.md)
- A full worked recipe / a generator script → [`techniques-cookbook.md`](techniques-cookbook.md)

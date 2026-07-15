# Premium Intro Animation Design

## Goal

Make the Cho's Martial Arts intro consistently cinematic and complete on cold and warm loads. Every critical visual must be ready before playback, every phase must stay synchronized, and the handoff to login must never expose a blank, skipped, or partially rendered state.

## Current Problem

The current intro starts its timeline immediately while the 60 PNG fighter frames are only being requested asynchronously. On a cold cache or slower device, the timeline can advance before one or more frames have decoded. The fighter is also rendered by repeatedly changing an image source while CSS effects and completion timers run independently. This creates opportunities for visible frame gaps, timing drift, abrupt transitions, and an incomplete login handoff.

## Experience Design

The intro uses one restrained cinematic sequence:

1. **Atmospheric readiness hold** — a dark Cho's-branded stage with subtle haze and floor light remains visually intentional while critical assets decode.
2. **Fighter entrance** — the full roundhouse sequence plays from predecoded frames with crisp rim lighting and a grounded shadow.
3. **Impact** — the kick lands with a brief white-hot flash, expanding shockwave, fine particles, and a controlled environment pulse.
4. **Logo birth** — the Cho's logo emerges from the impact with a soft luminous aura instead of appearing abruptly.
5. **Logo journey** — the logo settles into its final login position while the login background, portrait, and controls reveal with coordinated depth.
6. **Stable handoff** — the final composition is completely rendered before interaction unlocks.

Effects must feel premium and martial-arts focused. Avoid noisy particle floods, excessive bloom, saturated arcade colors, or ornamental motion that competes with the fighter and logo.

## Architecture

### Critical Asset Preloader

A focused preloader owns the fighter frames and other critical handoff imagery. It loads and calls `decode()` for all required images before normal playback begins. It reports ready or failed rather than starting a partial sequence.

The required set includes:

- All 60 roundhouse PNG frames.
- The Cho's logo.
- Login imagery that would otherwise appear late during the handoff, including the login background and visible portrait assets.

One failed load receives one retry. If the complete critical set still cannot be prepared, the animation uses the fallback reveal rather than showing a damaged fighter sequence.

### Buffered Fighter Renderer

The fighter is rendered from predecoded `HTMLImageElement` objects through a canvas-backed player. The canvas keeps the last successfully drawn frame until the next frame is available, so there is no blank image between React source changes. It preserves the current transparent fighter artwork and responsive aspect ratio.

The renderer uses elapsed time from the shared launch clock to select the intended frame. It may advance past an outdated frame after a long main-thread pause, but it must never clear the last valid frame or display an undecoded frame.

### Launch State Machine

One explicit state machine owns the complete launch:

`loading → fighter → impact → logo → handoff → complete`

The timeline starts only after the preloader reports ready. Phase changes drive both the canvas and the surrounding effects. CSS animations begin from phase classes or shared timeline variables rather than from component mount, preventing the fighter, flash, logo, backdrop, and login controls from drifting apart.

Completion occurs only after the handoff phase ends. Login controls remain noninteractive until that point.

### Premium Effect Layers

The existing backdrop, haze, floor glow, impact flash, and logo aura remain lightweight DOM/CSS layers. Add a restrained shockwave, fine impact particles, grounded fighter shadow, and environment pulse as scoped launch components. Prefer gradients, masks, and transforms for these layers so they stay sharp at every supported resolution.

Generate or add a raster asset only if the implemented layers cannot achieve the approved visual quality. Any new asset must support transparent compositing, both theme contexts where applicable, GitHub Pages subpath loading, and mobile memory limits.

## Timing

The cinematic playback should remain approximately three to four seconds after readiness. The readiness hold has no fake progress percentage; it presents a composed atmospheric opening until the critical set is complete. Normal cached loads should enter playback almost immediately.

All phase durations are defined in one TypeScript timeline contract. CSS receives matching values through variables or phase classes so there are no duplicated magic timers.

## Failure and Accessibility Behavior

- A critical asset failure never starts a partial fighter sequence.
- After one retry, the fallback performs a polished atmospheric logo reveal and complete login handoff using whichever required static imagery is available.
- The fallback cannot trap the user on the launch screen.
- `prefers-reduced-motion: reduce` bypasses the fighter and impact motion, presents the stable final logo/login composition promptly, and retains the same interaction-readiness contract.
- The canvas and decorative effect layers remain hidden from assistive technology. The existing accessible loading label remains available.

## Responsive Behavior

The stage retains the existing logo aspect ratio and scales inside the portrait app frame without cropping the fighter. The visual center, impact origin, logo journey, and safe spacing must be checked at phone, tablet, desktop, and short-height viewports. The animation cannot rely on a fixed pixel viewport.

## Testing

### Unit and Component Tests

Cover:

- Critical assets must finish decoding before the fighter phase starts.
- Phase order is deterministic and cannot skip required phases during normal playback.
- The last valid fighter frame remains visible until the next draw.
- A transient asset failure retries once.
- A permanent asset failure uses the complete fallback and eventually unlocks login.
- Reduced motion bypasses intense movement and reaches the stable interactive state.
- Login interaction stays locked until the handoff completes.

### Rendered QA

Run the real intro under:

- Cold cache and warm cache.
- Desktop, tablet, Android-sized, and iPhone-sized viewports.
- Normal and reduced motion.
- Artificially delayed image loading and throttled rendering.
- Repeated reloads to catch intermittent gaps.

For each representative viewport, verify page identity, meaningful rendered content, no framework overlay, no relevant console errors, no blank fighter frame, correct phase order, stable final logo placement, and successful login-control interaction after completion. Capture screenshots across the fighter, impact, logo, and settled states where timing permits.

## Scope

This work changes only the launch animation, its critical asset readiness, its login handoff timing, and directly related tests. It preserves authentication behavior, login form behavior, the established Cho's branding, GitHub Pages asset routing, and unrelated app surfaces.

## Acceptance Criteria

- No missing or blank fighter frames appear during repeated cold or warm launches.
- The fighter, impact, logo, backdrop, and login handoff remain synchronized.
- Playback never begins until all assets required for the full fighter sequence are decoded.
- Permanent asset failure produces a polished, complete fallback instead of a broken animation.
- The final login composition is stable before controls become interactive.
- The intro remains polished and correctly framed at all tested viewport sizes.
- Reduced-motion behavior is accessible and complete.
- Focused tests, the full relevant test suite, production build, and rendered browser QA pass.

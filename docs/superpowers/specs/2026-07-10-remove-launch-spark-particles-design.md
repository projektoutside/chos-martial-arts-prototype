# Remove Launch Spark Particles Design

## Goal

Remove the small white particle dots that appear near the end of the kick animation without changing the kick, impact flash, haze, logo aura, background handoff, timing, or reduced-motion behavior.

## Design

Delete the dedicated `launch-letter-sparks` presentation element and its unused CSS/keyframes. Keep every other launch layer unchanged. Add a component regression test proving the removed particle layer is not rendered while the main launch stage and impact flash remain present.

## Verification

Run the focused component test, rendered launch tests, full app suite, keyboard suite, production build, Android verification, and dependency audit before release.

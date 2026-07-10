# Login Portrait Cinematic Fade Design

## Goal

Make the two-person `Perfect1.png` artwork enter the login screen as a premium continuation of the launch animation. The artwork must never visibly grow, rise from the bottom, overshoot, bounce, or shift the login layout.

## Motion Design

- Keep the portrait stage at its final size, anchor, and transform for every animation frame.
- Begin the portrait nearly black, transparent, and very softly blurred.
- Start the reveal during the final launch handoff, before the login controls appear.
- Gradually restore opacity, brightness, saturation, and sharpness with a smooth cinematic easing curve.
- Finish the reveal with the existing logo and login-control handoff near the end of the 3.05-second intro.
- Preserve the current final artwork placement, shadows, responsive sizing, and user visibility toggle.

## Timing

- Delay: approximately 2.2 seconds after launch begins.
- Duration: approximately 0.78 seconds.
- Final state reached before the launch overlay is removed at 3.05 seconds.
- Login controls retain their existing 2.64-second delayed entrance.

## Accessibility

When `prefers-reduced-motion: reduce` is active, skip the animated exposure and render the portrait immediately at its final appearance and position.

## Verification

- CSS regression tests must prove every portrait keyframe uses the same final transform.
- CSS regression tests must prove the opening frame is dark and transparent and the final frame reaches the configured portrait opacity.
- Rendered mobile and desktop checks must confirm the final placement is unchanged, the portrait does not clip, and the login controls remain usable.
- The production build, app tests, keyboard tests, and reduced-motion behavior must remain healthy.

# Adaptive Mobile Editor Design

## Goal

Make long mobile text easy to review without moving the app, and give the floating editor one safe action that advances ordinary forms while sending only real chat messages.

## Presentation

- The floating surface remains centered inside the usable viewport above the software keyboard.
- Ordinary non-password text controls use a one-row wrapping editor that grows with content.
- The editor may grow only to the safe vertical space available on the current device, leaving room for the action button and safe-area padding.
- Once the maximum height is reached, the editor keeps the caret visible and scrolls internally.
- Password controls remain masked single-line inputs because multiline password rendering would expose or misrepresent secret text.
- The action button uses a green success treatment.

## Action semantics

- The visible label is `Send`, matching the requested mobile interaction.
- In a live-chat composer, Send submits the existing live-chat form through its real submit handler. It does not reproduce chat logic inside the editor.
- In every other context, Send commits the mirrored value and advances focus to the next enabled, writable text control in document order.
- Advancing to the next control immediately opens the same mobile editor for that control, so username naturally advances to password and multi-field forms continue without returning to the underlying layout.
- If there is no next text control, Send commits and closes. It never implicitly submits a non-chat form.
- Outside tap, Back navigation, keyboard dismissal, orientation change, and page hiding keep their existing close behavior.

## Data and accessibility

- Input, beforeinput, keyboard, selection, composition, and change events continue to synchronize to the real source control.
- Existing input mode, autocomplete, enter-key hint, length limits, required state, accessible name, error description, and visual styling remain mirrored.
- The action has an accessible label describing whether it sends a chat message, advances to the next field, or applies the final value, even though the visible label remains Send.
- No new dependency or per-form integration is introduced.

## Verification

- Unit tests cover auto-growth, height capping, overflow, ordinary advance, final-field close, live-chat submit, password behavior, and cleanup.
- Browser tests cover long wrapped text and scrolling on Android Chromium and iPhone WebKit while app-shell geometry remains frozen.
- Browser tests cover username-to-password advance and a real live-chat form contract without contacting production chat during automated tests.
- Full unit, browser, production build, Android configuration, and dependency gates must pass before deployment.

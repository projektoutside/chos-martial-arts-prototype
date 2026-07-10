# Stable Mobile Keyboard Editor Design

## Goal

Text entry on a touch device must never resize, recenter, hide, compress, or otherwise rearrange the Cho's app. When a user taps any enabled text-entry control, a visually matching editor appears directly above the software keyboard and becomes the active typing surface. Its value stays synchronized with the original control in real time.

Desktop keyboard and mouse behavior remains unchanged.

## Current behavior and gap

The app already detects a software keyboard through `window.visualViewport`. Its current presentation shortens `.portrait-app-shell`, removes secondary navigation, and scrolls the focused field into view. That keeps the focused field visible, but it intentionally changes the app layout and therefore conflicts with the new frozen-screen requirement.

The existing detection logic and stable viewport measurements are useful and will be retained where they remain reliable. The resize, navigation-removal, and focused-field scrolling behavior will be replaced.

## Recommended approach

Use one app-wide keyboard editor managed at the application shell instead of modifying every individual input.

On a touch or pen interaction with an enabled text input, textarea, content-editable element, or ARIA textbox:

1. Capture the original control, its value, selection, input attributes, accessible label, classes, and computed visual style.
2. Prevent the browser from moving the page to reveal the original control.
3. Open a fixed keyboard-editor layer that is independent of the portrait app frame.
4. Render an input or textarea matching the source control's visual treatment and input semantics.
5. Focus that editor during the same user interaction so iOS and Android may open the software keyboard normally.
6. Position the editor immediately above the bottom edge of `visualViewport`, including safe-area spacing.
7. Synchronize each edit, selection-compatible keyboard action, and relevant form event to the source control in real time.
8. Close through the editor's Done action, the keyboard's native completion action where appropriate, Escape, form submission, route changes, or loss of an editable target.
9. Return focus and selection state safely without reopening the keyboard or moving the app.

The original control remains in place and the app behind the keyboard editor remains unchanged. A lightweight focus marker may remain on the original control, but it may not alter its dimensions or surrounding layout.

## Why this approach

### Chosen: one global mirrored editor

This covers the app's large number of existing and future text controls without a risky page-by-page rewrite. It centralizes cross-browser keyboard handling and creates one place to test accessibility, visual matching, value synchronization, and viewport positioning.

### Not chosen: scroll each original field into view

This is close to the current implementation, but it moves the page and cannot satisfy the frozen-screen requirement.

### Not chosen: replace every field with a custom component

This could provide strict control but would require changing more than 150 existing form controls, increasing regression risk and making future native form behavior harder to preserve.

## Supported controls

The editor applies only to controls that can summon a typing keyboard:

- text-like `input` types, including text, search, email, URL, telephone, password, and numeric/date-like types supported by the device keyboard;
- `textarea`;
- enabled content-editable elements;
- enabled elements with `role="textbox"`.

Buttons, checkboxes, radio buttons, color pickers, file inputs, ranges, hidden inputs, and ordinary `select` menus are excluded because they do not use a typing keyboard.

Readonly or disabled controls are excluded. Desktop pointer and physical-keyboard focus keep their normal behavior.

## Value and form behavior

The mirrored editor is not a second source of truth. The original control remains the authoritative form control.

Every editor change updates the original value through the element's native value mechanism and dispatches the same bubbling input/change behavior expected by React-controlled and uncontrolled fields. Composition events are preserved for predictive text, accents, and non-Latin input methods. Password editors remain masked. Input mode, autocomplete, capitalization, spellcheck, length limits, direction, and enter-key hints are copied where applicable.

No new form data, storage, backend behavior, or dependency is introduced.

## Frozen layout contract

While the software keyboard is opening, open, or closing:

- the portrait app shell and frame retain their pre-keyboard width and height;
- manager navigation, tab bars, footers, headers, dialogs, and page content remain mounted and keep the same geometry;
- the page and nested scroll containers retain their pre-keyboard scroll positions;
- responsive breakpoints continue to use the stable layout viewport, not the reduced visual viewport;
- the editor layer alone follows the visible viewport edge above the keyboard;
- browser zoom is not triggered by editable text because touch editors use a minimum effective 16 px font size;
- orientation changes close or rebuild the editing session against the new stable geometry.

The viewport meta configuration will request keyboard overlay behavior where Chromium supports it. The runtime controller remains the cross-browser fallback for iOS Safari, installed PWAs, and embedded web views.

## Visual matching

The editor copies the source control's relevant computed typography, foreground/background, border, radius, shadow, padding, alignment, and placeholder styling. It also retains compatible source classes so dark, light, and custom themes match the field that was tapped.

The floating surface is constrained to the visible phone width and safe areas. Single-line fields remain single-line. Multiline fields gain a compact capped height with internal scrolling rather than expanding the app. A small Cho-styled Done button is placed beside or above the editor without changing the source field.

If a source style cannot be copied safely, the editor falls back to the app's existing `.input` visual language rather than becoming unreadable.

## Accessibility

- The editor uses the source field's accessible name or label.
- The source control remains the semantic form field and is identified as being edited without being removed from the accessibility tree.
- Done has an explicit accessible label.
- Focus does not become trapped; Escape and route/dialog teardown close the session.
- Validation state, required state, descriptions, and invalid state are reflected.
- Reduced-motion users receive an immediate transition; other users receive a short opacity/translate entrance that does not animate the app beneath it.

## Failure handling

If `visualViewport` is unavailable or reports unreliable values, the editor uses the stable window height and remains clamped to the visible document area. If synchronous keyboard focus is rejected by the browser, the original field retains normal native focus instead of becoming unusable. Removed or disabled source elements close the session cleanly. Exceptions in style or value synchronization fall back to native behavior and never block form entry.

## Testing

Implementation follows test-first development.

Unit and DOM integration tests will cover:

- editable-target classification and exclusions;
- source-to-editor configuration and visual token copying;
- controlled and uncontrolled value synchronization;
- password, numeric, textarea, content-editable, readonly, and disabled behavior;
- composition input and selection preservation;
- Done/Escape/form/route/removal cleanup;
- stable geometry and scroll restoration through keyboard open/close cycles;
- cleanup of global listeners and editor DOM.

Presentation tests will prove that keyboard-open CSS no longer changes shell height or hides navigation and that only the editor layer tracks the visual viewport.

Playwright phone projects will simulate a reduced `visualViewport` in Chromium/Android and WebKit/iPhone modes. They will assert unchanged app/frame/navigation geometry, unchanged scroll positions, no horizontal overflow, correct editor placement, visual-style similarity, live value synchronization, and clean restoration after Done. Desktop coverage will assert that ordinary focus never opens the mirrored editor.

The final pass will run focused tests, the complete Vitest suite, the keyboard Playwright suite, a production build, and a diff/working-tree review. Real operating-system keyboard behavior can only be fully proven on physical iOS and Android devices, so browser automation will verify the viewport contract and the implementation will use progressive platform APIs rather than claim hardware proof it cannot provide.

## Scope boundaries

This change does not redesign forms, alter business workflows, change validation rules, deploy the app, or add dependencies. It replaces the app-wide mobile keyboard presentation behavior and its tests with the frozen-screen mirrored-editor model.

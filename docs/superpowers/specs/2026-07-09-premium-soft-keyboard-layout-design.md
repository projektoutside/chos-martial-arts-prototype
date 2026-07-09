# Premium Soft-Keyboard Layout Design

**Date:** 2026-07-09  
**Status:** Approved behavior; implementation pending  
**Scope:** Shared Cho web UI, installed Android WebView, mobile/tablet browsers, and touch-capable desktop devices

## Problem

Opening an on-screen keyboard currently makes the entire Cho interface appear to shrink and distort. The portrait frame width is calculated from the live viewport height (`56.25dvh`). When a keyboard reduces that height, the app becomes narrower as well as shorter. The keyboard-driven resize also reaches fullscreen/orientation listeners, login artwork measurements, height-sensitive layouts, and hidden-overflow page shells.

Several editable controls render below 16px on compact layouts, which can also trigger focus zoom in iPhone and iPad browsers.

## Approved Experience

The user selected the premium behavior:

- The app frame and top header remain visually stable while typing.
- Opening a keyboard never narrows, scales, or horizontally reflows the whole app.
- Bottom or secondary navigation temporarily hides only when an on-screen keyboard actually occupies screen space.
- The page, modal, form, or chat feed containing the active field becomes the moving/scrolling surface.
- The focused control remains visible above the keyboard with comfortable spacing.
- Closing the keyboard restores the exact prior geometry and navigation state without a jump or stale blank area.
- Hardware-keyboard and ordinary desktop focus do not trigger the condensed keyboard-open presentation.

## Approaches Considered

### 1. CSS-only viewport-unit replacement

Replace `dvh` with `svh` or `lvh` in the portrait frame.

This is the smallest change and would reduce the most obvious width collapse, but it does not reliably identify the keyboard, keep lower fields visible, prevent fullscreen/orientation work during keyboard animation, handle modals and chat composers, or protect iOS from focus zoom. It is insufficient as a complete cross-device fix.

### 2. Disable native resizing and let the keyboard overlay everything

Use Android `adjustNothing` or consume IME insets so the WebView never changes size, then manually move every affected surface.

This provides maximum geometry control but transfers all keyboard inset, animation, scrolling, accessibility, and older-WebView compatibility work to the app. Android specifically warns that opting out can break `scrollIntoView()` and leave controls under the keyboard unless every inset is handled correctly. It also would not solve ordinary browser/PWA behavior by itself.

### 3. Shared keyboard-aware viewport controller with native resize support

Keep the platform's accessible visual-viewport resize behavior, but separate the stable layout geometry from the visible viewport. Use one shared controller to detect focused editable controls and meaningful visual-viewport loss, freeze the portrait width, publish keyboard state and inset values, scroll the active field, and suppress keyboard-driven global layout work.

This is the selected approach. It preserves native accessibility behavior, works as progressive enhancement across Android, iOS/iPadOS browsers, Windows touch devices, tablets, and desktop browsers, and keeps the implementation centralized.

## Architecture

### Keyboard viewport controller

Add a small, testable module for keyboard/viewport behavior and mount it once from `PortraitAppShell`.

The controller will:

1. Recognize editable targets: text-capable `input` elements, `textarea`, `select`, `[contenteditable]`, and `[role="textbox"]`. Non-editable controls such as checkboxes, radios, color inputs, buttons, and file inputs will not activate keyboard mode.
2. Record stable viewport geometry only while no software keyboard is active.
3. Listen to `focusin`, `focusout`, `window.resize`, `orientationchange`, and `visualViewport.resize`/`scroll` where supported.
4. Treat a keyboard as open only when an editable target is focused and the visible height drops by a meaningful threshold. This prevents browser toolbar motion, desktop window resizing, and pinch zoom from being mistaken for a keyboard.
5. Publish state on the root document element:
   - `data-soft-keyboard="opening|open"`
   - `data-touch-input="true"` for touch-capable devices
   - `--app-stable-viewport-height`
   - `--app-visible-viewport-height`
   - `--app-keyboard-inset`
6. Remove all attributes, custom properties, animation frames, timers, and listeners during cleanup.

`VisualViewport` is the preferred measurement source. `window.innerHeight` is the fallback for older browsers and resized WebViews.

### Stable app geometry

The portrait frame width will be derived from the stable pre-keyboard viewport height instead of the live `dvh` value. Its visible height may reduce naturally with the platform keyboard, but its width, typography breakpoint, and horizontal composition must remain unchanged.

The top header stays in its existing grid row. Keyboard-open styling hides only audited bottom/secondary navigation surfaces and leaves primary top actions available.

Height-sensitive decorative recalculation is paused during text entry:

- Fullscreen/orientation requests do not run for keyboard-driven visual viewport changes.
- Login character/portrait anchoring does not recalculate against the shortened keyboard viewport.
- Keyboard state is not treated as a genuine orientation or device-size transition.

### Focus visibility and scrolling

When the keyboard settles, the controller will bring the focused field into the nearest scrollable content surface rather than moving the entire app frame.

- Use `scrollIntoView({ block: "nearest", inline: "nearest" })` as the cross-platform base.
- Apply a keyboard-safe `scroll-margin` to editable controls.
- Recheck the field rectangle after viewport animation and adjust the nearest scroll surface if the field is closer than 12px to the visible keyboard boundary.
- Add temporary bottom breathing room only to the active page/modal/form scrolling surface; do not double-apply native IME inset padding.
- Live Chat keeps the composer visible and allows the message feed to contract and scroll.
- Long forms and modal bodies scroll; their outer backdrop and title treatment remain stable.

### Mobile input typography

Text-editable controls on touch-capable devices will have a computed font size of at least 16px. This prevents iPhone/iPad focus zoom without disabling user zoom or harming accessibility. Desktop-only compact styling remains unchanged when no touch input capability exists.

### Native Android contract

The Android activity will explicitly declare `windowSoftInputMode="adjustResize"` so behavior is deterministic on older versions while current Android WebView continues to resize the visual viewport for IME visibility. The shared controller will handle both forms without adding a keyboard plugin.

The viewport metadata will opt into safe-area coverage, and the portrait shell will use Capacitor's injected `--safe-area-inset-*` values with `env(safe-area-inset-*)` fallbacks. Native and web padding must not count the same inset twice.

No `@capacitor/keyboard` dependency is required for this fix. Its resize mode is iOS-only, and Android already exposes the needed visual viewport behavior.

## Device Behavior

- **Android installed app:** stable frame width, explicit accessible resize behavior, focused field above Gboard/Samsung Keyboard.
- **Android browser/PWA:** same shared visual-viewport handling with no native dependency.
- **iPhone/iPad browser/PWA:** no focus zoom, safe-area-aware layout, stable frame, scrollable active surface.
- **Windows touch/tablet:** keyboard mode activates only when focus and a meaningful visible-height loss occur.
- **Desktop Windows/macOS/Linux:** normal focus behavior; no hidden navigation when a hardware keyboard is used.
- **Tablets/landscape fallback:** stable portrait frame contract is retained even when the browser refuses orientation lock.

There is currently no native iOS Capacitor project in this repository. The shared browser/PWA behavior is covered now; a future native iOS target must run the same acceptance suite and may add an iOS-specific Capacitor keyboard mode only if device testing proves it necessary.

## Verification Contract

Automated checks will cover:

- Keyboard classification with focused and non-focused elements.
- False-positive protection for ordinary resize, browser chrome motion, and pinch zoom.
- Stable viewport baseline and exact cleanup after blur/dismissal/orientation change.
- Root data attributes and CSS variables.
- Focused-field scrolling and listener cleanup.
- Existing app behavior through the full Vitest suite and production build.

Browser geometry checks will use representative routes and fields:

- Login username/password.
- Live Chat message composer.
- Profile Compose subject and multiline message.
- Student modal first and lower fields.
- Create Accounts long forms.

Required viewport coverage:

- 360x640 small Android.
- 390x844 modern phone/iPhone-like viewport.
- 412x915 Samsung-like viewport.
- 768x1024 iPad portrait.
- 1024x768 tablet landscape fallback.
- 1366x768 desktop.

Acceptance criteria:

- Portrait frame width changes by no more than 1px when the keyboard opens.
- No horizontal overflow or page-scale change.
- Focused control remains at least 12px above the visible keyboard boundary.
- Top header remains stable; only approved bottom/secondary navigation hides.
- Touch-device editable controls compute to at least 16px.
- Keyboard close restores geometry within 1-2px with no stale state.
- A real installed Android build passes an on-device keyboard test before the release is promoted to the Play internal-testing track.

## Release Impact

The current Play internal build uses Android version code 1. Shipping this fix to the existing internal-testing track requires a coordinated version-code bump, a new signed Android App Bundle, upload as a new internal release, and verification through the existing tester link. The release remains private to the internal tester list.

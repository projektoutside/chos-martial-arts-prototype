# Premium Soft-Keyboard Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Cho's portrait app frame stable while any on-screen keyboard is open, hide only secondary navigation, and keep the active field visible across Android, Apple browsers, Windows touch devices, phones, and tablets.

**Architecture:** A single React-mounted viewport controller separates stable layout geometry from the changing visual viewport. It publishes measured CSS variables and keyboard state at the document root, while focused content surfaces scroll inside the unchanged portrait frame. Android keeps explicit accessible resize behavior; the shared web layer handles both modern visual-viewport resizing and older whole-WebView resizing.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest/jsdom, Playwright 1.61, Capacitor Android 8, CSS dynamic viewport and safe-area primitives.

## Global Constraints

- Opening a keyboard must never narrow, scale, or horizontally reflow the whole app.
- Portrait frame width may change by no more than 1px while the keyboard opens or closes.
- Keep the top header visible; hide only approved bottom or secondary navigation while `data-soft-keyboard="open"`.
- Keep the focused control at least 12px above the visible keyboard boundary.
- Touch-device text-editable controls must compute to at least 16px without disabling browser zoom.
- Hardware-keyboard focus and ordinary desktop resizing must not activate the condensed keyboard presentation.
- Android must use explicit `windowSoftInputMode="adjustResize"`; do not use `adjustPan` or `adjustNothing`.
- Do not add `@capacitor/keyboard`; VisualViewport plus Android WebView behavior is sufficient.
- Do not double-apply native IME or safe-area insets.
- There is no native iOS target in this repository; Apple coverage is Safari/PWA/WebKit-like behavior until an iOS project exists.
- Preserve the user's untracked `output/` directory and all unrelated work.
- The next Google Play internal bundle must use version name `0.1.1` and version code `2` and remain private to the existing tester list.

---

## File Map

- Create `src/softKeyboardViewport.ts`: keyboard target classification, viewport math, DOM controller, focus reveal, cleanup, and React hook.
- Create `src/softKeyboardViewport.test.ts`: deterministic visual viewport and lifecycle regression coverage.
- Modify `src/App.tsx`: mount the controller once and suppress keyboard-driven fullscreen/orientation and login-artwork work.
- Modify `src/App.test.tsx`: integration coverage for the shell and portrait runtime guard.
- Modify `src/OperationsApp.tsx`: identify the manager launcher rail as secondary navigation.
- Modify `src/styles.css`: stable frame width, safe-area fallbacks, keyboard-open navigation behavior, scroll margins, and 16px touch input floor.
- Modify `index.html`: enable safe-area viewport coverage.
- Modify `android/app/src/main/AndroidManifest.xml`: make Android keyboard resizing deterministic.
- Modify `scripts/verify-android-release.mjs`: enforce soft-input mode and release version.
- Create `playwright.config.ts`: local mobile Chromium and WebKit-like geometry projects.
- Create `e2e/soft-keyboard-layout.spec.ts`: browser-level frame, state, overflow, and input-font assertions.
- Modify `.gitignore`: ignore Playwright's generated reports and test results.
- Modify `package.json` and `package-lock.json`: add the keyboard E2E command and bump package version.
- Modify `android/app/build.gradle`: bump the internal test bundle to version code 2 / version name 0.1.1.

---

### Task 1: Build the keyboard viewport controller with test-first coverage

**Files:**
- Create: `src/softKeyboardViewport.ts`
- Create: `src/softKeyboardViewport.test.ts`

**Interfaces:**
- Produces: `isKeyboardEditableTarget(target: EventTarget | null): target is HTMLElement`
- Produces: `classifySoftKeyboardViewport(input: SoftKeyboardViewportInput): SoftKeyboardViewportState`
- Produces: `installSoftKeyboardViewportController(win?: Window, doc?: Document): () => void`
- Produces: `useSoftKeyboardViewport(): void`
- Produces: `isSoftKeyboardLayoutActive(doc?: Document): boolean`
- Produces: `SOFT_KEYBOARD_CHANGE_EVENT = "cho:soft-keyboard-change"`

- [ ] **Step 1: Write the failing unit and controller tests**

Create `src/softKeyboardViewport.test.ts` with these concrete cases:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifySoftKeyboardViewport,
  installSoftKeyboardViewportController,
  isKeyboardEditableTarget
} from "./softKeyboardViewport";

class VisualViewportStub extends EventTarget {
  height = 844;
  offsetTop = 0;
  scale = 1;
  width = 390;
}

describe("soft keyboard viewport", () => {
  let cleanup: (() => void) | undefined;
  let viewport: VisualViewportStub;

  beforeEach(() => {
    vi.useFakeTimers();
    viewport = new VisualViewportStub();
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: 5 });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0)
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      value: (handle: number) => window.clearTimeout(handle)
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn()
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.body.replaceChildren();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("classifies only controls that can open a text keyboard", () => {
    const text = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const textarea = document.createElement("textarea");
    const textbox = document.createElement("div");
    textbox.setAttribute("role", "textbox");

    expect(isKeyboardEditableTarget(text)).toBe(true);
    expect(isKeyboardEditableTarget(textarea)).toBe(true);
    expect(isKeyboardEditableTarget(textbox)).toBe(true);
    expect(isKeyboardEditableTarget(checkbox)).toBe(false);
  });

  it("requires focused text entry, a meaningful height loss, and normal scale", () => {
    expect(classifySoftKeyboardViewport({ stableHeight: 844, visibleHeight: 500, offsetTop: 0, scale: 1, hasEditableFocus: true }))
      .toEqual({ isOpen: true, keyboardInset: 344 });
    expect(classifySoftKeyboardViewport({ stableHeight: 844, visibleHeight: 780, offsetTop: 0, scale: 1, hasEditableFocus: true }).isOpen)
      .toBe(false);
    expect(classifySoftKeyboardViewport({ stableHeight: 844, visibleHeight: 500, offsetTop: 0, scale: 1.5, hasEditableFocus: true }).isOpen)
      .toBe(false);
    expect(classifySoftKeyboardViewport({ stableHeight: 844, visibleHeight: 500, offsetTop: 0, scale: 1, hasEditableFocus: false }).isOpen)
      .toBe(false);
  });

  it("freezes frame geometry, exposes keyboard state, and reveals the focused field", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    input.focus();
    expect(document.documentElement.dataset.softKeyboard).toBe("opening");
    viewport.height = 500;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(document.documentElement.dataset.softKeyboard).toBe("open");
    expect(document.documentElement.dataset.touchInput).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("844px");
    expect(document.documentElement.style.getPropertyValue("--app-stable-frame-width")).toBe("474.75px");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("344px");
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });

    input.blur();
    viewport.height = 844;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("0px");
  });

  it("updates the stable baseline for a real desktop resize without entering keyboard mode", () => {
    cleanup = installSoftKeyboardViewportController(window, document);
    viewport.height = 700;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 700 });
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("700px");
  });

  it("removes document state and listeners during cleanup", () => {
    cleanup = installSoftKeyboardViewportController(window, document);
    cleanup();
    cleanup = undefined;

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement).not.toHaveAttribute("data-touch-input");
    expect(document.documentElement.style.getPropertyValue("--app-stable-frame-width")).toBe("");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```powershell
npm run test -- src/softKeyboardViewport.test.ts
```

Expected: FAIL because `src/softKeyboardViewport.ts` does not exist.

- [ ] **Step 3: Implement the controller**

Create `src/softKeyboardViewport.ts` with the following implementation:

```ts
import { useEffect } from "react";

export const SOFT_KEYBOARD_CHANGE_EVENT = "cho:soft-keyboard-change";
export const SOFT_KEYBOARD_MIN_INSET_PX = 120;
export const SOFT_KEYBOARD_MIN_INSET_RATIO = 0.15;

const nonTextInputTypes = new Set([
  "button", "checkbox", "color", "file", "hidden", "image",
  "radio", "range", "reset", "submit"
]);

export type SoftKeyboardViewportInput = {
  stableHeight: number;
  visibleHeight: number;
  offsetTop: number;
  scale: number;
  hasEditableFocus: boolean;
};

export type SoftKeyboardViewportState = {
  isOpen: boolean;
  keyboardInset: number;
};

function isHTMLElement(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement;
}

export function isKeyboardEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (!isHTMLElement(target)) return false;
  if (target.matches(":disabled, [aria-disabled='true']")) return false;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !nonTextInputTypes.has(target.type.toLowerCase());
  return target.isContentEditable || target.getAttribute("role") === "textbox";
}

export function classifySoftKeyboardViewport(input: SoftKeyboardViewportInput): SoftKeyboardViewportState {
  const visibleBottom = input.visibleHeight + Math.max(0, input.offsetTop);
  const rawInset = Math.max(0, Math.round(input.stableHeight - visibleBottom));
  const threshold = Math.max(SOFT_KEYBOARD_MIN_INSET_PX, Math.round(input.stableHeight * SOFT_KEYBOARD_MIN_INSET_RATIO));
  const isOpen = input.hasEditableFocus && input.scale <= 1.05 && rawInset >= threshold;
  return { isOpen, keyboardInset: isOpen ? rawInset : 0 };
}

export function isSoftKeyboardLayoutActive(doc: Document = document) {
  return doc.documentElement.dataset.softKeyboard === "opening" || doc.documentElement.dataset.softKeyboard === "open";
}

function visualMetrics(win: Window) {
  const viewport = win.visualViewport;
  return {
    height: viewport?.height ?? win.innerHeight,
    offsetTop: viewport?.offsetTop ?? 0,
    scale: viewport?.scale ?? 1
  };
}

function nearestScrollContainer(element: HTMLElement, win: Window) {
  let current = element.parentElement;
  while (current && current !== element.ownerDocument.body) {
    const overflowY = win.getComputedStyle(current).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return undefined;
}

function revealFocusedElement(element: HTMLElement, win: Window) {
  element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  const viewport = visualMetrics(win);
  const rect = element.getBoundingClientRect();
  const topBoundary = viewport.offsetTop + 12;
  const bottomBoundary = viewport.offsetTop + viewport.height - 12;
  const delta = rect.bottom > bottomBoundary
    ? rect.bottom - bottomBoundary
    : rect.top < topBoundary
      ? rect.top - topBoundary
      : 0;
  if (!delta) return;
  nearestScrollContainer(element, win)?.scrollBy({ top: delta, behavior: "auto" });
}

export function installSoftKeyboardViewportController(win: Window = window, doc: Document = document) {
  const root = doc.documentElement;
  const timers = new Set<number>();
  let animationFrame = 0;
  let stableHeight = Math.max(win.innerHeight, visualMetrics(win).height);
  let lastOpen = false;
  let lastFocused: HTMLElement | null = null;

  const setTimer = (callback: () => void, delay: number) => {
    const timer = win.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const dispatchState = (state: "open" | "closed") => {
    doc.dispatchEvent(new CustomEvent(SOFT_KEYBOARD_CHANGE_EVENT, { detail: { state } }));
  };

  const measure = () => {
    animationFrame = 0;
    const focused = isKeyboardEditableTarget(doc.activeElement) ? doc.activeElement : null;
    const viewport = visualMetrics(win);
    const layoutCandidate = Math.max(win.innerHeight, viewport.height + Math.max(0, viewport.offsetTop));
    if (!focused && !lastOpen) stableHeight = layoutCandidate;
    if (!stableHeight) stableHeight = layoutCandidate;

    const state = classifySoftKeyboardViewport({
      stableHeight,
      visibleHeight: viewport.height,
      offsetTop: viewport.offsetTop,
      scale: viewport.scale,
      hasEditableFocus: Boolean(focused)
    });

    root.style.setProperty("--app-stable-viewport-height", `${stableHeight}px`);
    root.style.setProperty("--app-stable-frame-width", `${stableHeight * 0.5625}px`);
    root.style.setProperty("--app-visible-viewport-height", `${viewport.height}px`);
    root.style.setProperty("--app-keyboard-inset", `${state.keyboardInset}px`);

    if (state.isOpen) {
      root.dataset.softKeyboard = "open";
      if (!lastOpen) dispatchState("open");
      if (!lastOpen || focused !== lastFocused) {
        setTimer(() => focused && revealFocusedElement(focused, win), 0);
        setTimer(() => focused && revealFocusedElement(focused, win), 180);
      }
    } else if (root.dataset.softKeyboard === "open") {
      delete root.dataset.softKeyboard;
      dispatchState("closed");
    } else if (!focused) {
      delete root.dataset.softKeyboard;
    }

    lastOpen = state.isOpen;
    lastFocused = focused;
  };

  const scheduleMeasure = () => {
    if (animationFrame) win.cancelAnimationFrame(animationFrame);
    animationFrame = win.requestAnimationFrame(measure);
  };

  const handleFocusIn = (event: FocusEvent) => {
    if (!isKeyboardEditableTarget(event.target)) return;
    root.dataset.softKeyboard = "opening";
    scheduleMeasure();
    setTimer(scheduleMeasure, 80);
    setTimer(scheduleMeasure, 240);
    setTimer(() => {
      if (root.dataset.softKeyboard === "opening") delete root.dataset.softKeyboard;
    }, 420);
  };

  const handleFocusOut = () => {
    scheduleMeasure();
    setTimer(scheduleMeasure, 80);
    setTimer(scheduleMeasure, 240);
  };

  const handleOrientationChange = () => {
    stableHeight = 0;
    lastOpen = false;
    delete root.dataset.softKeyboard;
    setTimer(scheduleMeasure, 220);
    setTimer(scheduleMeasure, 520);
  };

  if (win.navigator.maxTouchPoints > 0 || win.matchMedia?.("(pointer: coarse)").matches) {
    root.dataset.touchInput = "true";
  }

  doc.addEventListener("focusin", handleFocusIn);
  doc.addEventListener("focusout", handleFocusOut);
  win.addEventListener("resize", scheduleMeasure);
  win.addEventListener("orientationchange", handleOrientationChange);
  win.visualViewport?.addEventListener("resize", scheduleMeasure);
  win.visualViewport?.addEventListener("scroll", scheduleMeasure);
  measure();

  return () => {
    doc.removeEventListener("focusin", handleFocusIn);
    doc.removeEventListener("focusout", handleFocusOut);
    win.removeEventListener("resize", scheduleMeasure);
    win.removeEventListener("orientationchange", handleOrientationChange);
    win.visualViewport?.removeEventListener("resize", scheduleMeasure);
    win.visualViewport?.removeEventListener("scroll", scheduleMeasure);
    if (animationFrame) win.cancelAnimationFrame(animationFrame);
    timers.forEach((timer) => win.clearTimeout(timer));
    delete root.dataset.softKeyboard;
    delete root.dataset.touchInput;
    for (const property of [
      "--app-stable-viewport-height",
      "--app-stable-frame-width",
      "--app-visible-viewport-height",
      "--app-keyboard-inset"
    ]) root.style.removeProperty(property);
  };
}

export function useSoftKeyboardViewport() {
  useEffect(() => installSoftKeyboardViewportController(), []);
}
```

- [ ] **Step 4: Run the focused tests and confirm green**

Run:

```powershell
npm run test -- src/softKeyboardViewport.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit the controller**

```powershell
git add src/softKeyboardViewport.ts src/softKeyboardViewport.test.ts
git commit -m "Add soft keyboard viewport controller"
```

---

### Task 2: Integrate keyboard state with the portrait runtime

**Files:**
- Modify: `src/App.tsx:1-178`
- Modify: `src/App.tsx:314-368`
- Modify: `src/App.test.tsx:2540-2619`
- Modify: `src/App.test.tsx:3178-3241`

**Interfaces:**
- Consumes: `useSoftKeyboardViewport()` from Task 1.
- Consumes: `isSoftKeyboardLayoutActive(document)` from Task 1.
- Consumes: `SOFT_KEYBOARD_CHANGE_EVENT` from Task 1.
- Produces: one controller instance for both logged-in and logged-out shells.

- [ ] **Step 1: Add failing integration tests**

Add these assertions to `src/App.test.tsx`:

```ts
it("initializes stable portrait geometry for the login shell", () => {
  renderLoggedOutApp("/");
  expect(document.documentElement.style.getPropertyValue("--app-stable-frame-width")).not.toBe("");
});

it("does not retry fullscreen or orientation work during text entry", async () => {
  const requestFullscreen = vi.fn().mockResolvedValue(undefined);
  const lock = stubScreenOrientationLock(vi.fn().mockResolvedValue(undefined));
  Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: requestFullscreen });
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });

  renderLoggedOutApp("/");
  fireEvent.focusIn(screen.getByPlaceholderText("Username"));
  window.dispatchEvent(new Event("resize"));
  await Promise.resolve();

  expect(document.documentElement.dataset.softKeyboard).toBe("opening");
  expect(requestFullscreen).not.toHaveBeenCalled();
  expect(lock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused App tests and confirm the integration test fails**

Run:

```powershell
npm run test -- src/App.test.tsx -t "stable portrait geometry|does not retry fullscreen"
```

Expected: FAIL because `PortraitAppShell` has not mounted the controller and portrait runtime has no keyboard guard.

- [ ] **Step 3: Mount the hook and guard keyboard-driven work**

In `src/App.tsx`, import the Task 1 interfaces:

```ts
import {
  isSoftKeyboardLayoutActive,
  SOFT_KEYBOARD_CHANGE_EVENT,
  useSoftKeyboardViewport
} from "./softKeyboardViewport";
```

Change the opening guard in `requestPortraitRuntime` to:

```ts
if (requestInFlight || document.visibilityState === "hidden" || isSoftKeyboardLayoutActive()) return;
```

Mount the controller exactly once inside `PortraitAppShell`:

```tsx
function PortraitAppShell({ children }: { children: ReactNode }) {
  useSoftKeyboardViewport();
  return (
    <div className="portrait-app-shell" data-testid="portrait-app-shell" data-orientation-lock="portrait-primary" aria-label="Cho's Martial Arts portrait app frame">
      <div className="portrait-app-frame">{children}</div>
    </div>
  );
}
```

At the start of `updatePortraitAnchor`, stop decorative measurement during keyboard layout:

```ts
const updatePortraitAnchor = () => {
  if (isSoftKeyboardLayoutActive()) return;
  window.cancelAnimationFrame(animationFrame);
  setPortraitAnchor();
  animationFrame = window.requestAnimationFrame(setPortraitAnchor);
};
```

Register a keyboard-close listener beside the existing viewport listeners so the portrait is measured once after dismissal:

```ts
const handleSoftKeyboardChange = (event: Event) => {
  const state = (event as CustomEvent<{ state: "open" | "closed" }>).detail?.state;
  if (state === "closed") updatePortraitAnchor();
};
document.addEventListener(SOFT_KEYBOARD_CHANGE_EVENT, handleSoftKeyboardChange);
```

Remove it in the effect cleanup:

```ts
document.removeEventListener(SOFT_KEYBOARD_CHANGE_EVENT, handleSoftKeyboardChange);
```

- [ ] **Step 4: Run controller and App integration tests**

Run:

```powershell
npm run test -- src/softKeyboardViewport.test.ts src/App.test.tsx -t "soft keyboard|stable portrait geometry|does not retry fullscreen|portrait image"
```

Expected: all selected tests PASS.

- [ ] **Step 5: Commit the runtime integration**

```powershell
git add src/App.tsx src/App.test.tsx
git commit -m "Integrate keyboard-aware portrait runtime"
```

---

### Task 3: Apply the stable premium keyboard presentation

**Files:**
- Modify: `src/OperationsApp.tsx:9329-9363`
- Modify: `src/styles.css:49-128`
- Modify: `src/styles.css:23567-23612`
- Modify: `src/styles.css` after the portrait shell block

**Interfaces:**
- Consumes: root `data-soft-keyboard`, `data-touch-input`, and CSS variables from Task 1.
- Produces: `data-keyboard-secondary-navigation="true"` on hideable navigation only.

- [ ] **Step 1: Mark the secondary manager rail**

Add `data-keyboard-secondary-navigation="true"` to both the manager launcher `<nav>` and its rail toggle button:

```tsx
<nav
  className="manager-launcher-grid manager-launcher-sidebar"
  id="manager-launcher-sidebar"
  aria-label={launcherAriaLabel}
  data-orientation="vertical"
  data-keyboard-secondary-navigation="true"
  hidden={isSidebarCollapsed}
>
```

```tsx
<button
  className="manager-launcher-rail-toggle"
  type="button"
  data-keyboard-secondary-navigation="true"
  aria-label={sidebarToggleLabel}
  aria-controls="manager-launcher-sidebar"
  aria-expanded={!isSidebarCollapsed}
  title={sidebarToggleLabel}
  onClick={() => setIsSidebarCollapsed((current) => !current)}
>
```

- [ ] **Step 2: Add shared safe-area variables and freeze portrait width**

Add these variables to `:root` in `src/styles.css`:

```css
--cho-safe-area-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
--cho-safe-area-right: var(--safe-area-inset-right, env(safe-area-inset-right, 0px));
--cho-safe-area-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
--cho-safe-area-left: var(--safe-area-inset-left, env(safe-area-inset-left, 0px));
--app-keyboard-inset: 0px;
```

Replace the dynamic portrait width and shell padding declarations with:

```css
.portrait-app-shell {
  --portrait-frame-max-width: 520px;
  --portrait-frame-landscape-width: var(--app-stable-frame-width, 56.25svh);
  /* existing positioning, display, and background declarations stay unchanged */
  padding: var(--cho-safe-area-top) 0 var(--cho-safe-area-bottom);
}
```

- [ ] **Step 3: Add keyboard-open layout and accessible touch typography**

Append this keyboard behavior immediately after the portrait shell rules:

```css
html[data-soft-keyboard="open"] .portrait-app-shell {
  height: var(--app-visible-viewport-height, 100dvh);
}

html[data-soft-keyboard="open"] .manager-launcher-main {
  --manager-launcher-sidebar-track-width: 0px;
  --manager-launcher-rail-hit-width: 0px;
}

html[data-soft-keyboard="open"] [data-keyboard-secondary-navigation="true"],
html[data-soft-keyboard="open"] .mobile-tabbar,
html[data-soft-keyboard="open"] .operations-footer {
  display: none !important;
}

html[data-soft-keyboard="open"] .manager-launcher-body {
  padding-right: 0;
}

html[data-soft-keyboard="open"] :is(
  input:not([type="button"]):not([type="checkbox"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="image"]):not([type="radio"]):not([type="range"]):not([type="reset"]):not([type="submit"]),
  textarea,
  select,
  [contenteditable="true"],
  [contenteditable=""],
  [role="textbox"]
) {
  scroll-margin-block: 12px 24px;
}

html[data-touch-input="true"] :is(
  input:not([type="button"]):not([type="checkbox"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="image"]):not([type="radio"]):not([type="range"]):not([type="reset"]):not([type="submit"]),
  textarea,
  select,
  [contenteditable="true"],
  [contenteditable=""],
  [role="textbox"]
) {
  font-size: max(16px, 1em) !important;
}
```

- [ ] **Step 4: Run the full component suite and build**

Run:

```powershell
npm run test
npm run build
git diff --check
```

Expected: full Vitest suite PASS, TypeScript/Vite build PASS, and `git diff --check` returns no output.

- [ ] **Step 5: Commit the premium presentation**

```powershell
git add src/OperationsApp.tsx src/styles.css
git commit -m "Stabilize layouts while typing"
```

---

### Task 4: Make native Android and safe-area behavior deterministic

**Files:**
- Modify: `index.html:5`
- Modify: `android/app/src/main/AndroidManifest.xml:9-16`
- Modify: `scripts/verify-android-release.mjs:49-62`

**Interfaces:**
- Consumes: CSS safe-area fallbacks from Task 3.
- Produces: explicit Android `adjustResize` contract verified by the release script.

- [ ] **Step 1: Make the release verifier demand the Android keyboard contract**

Add this assertion after the manifest is read in `scripts/verify-android-release.mjs`:

```js
assert.match(
  manifest,
  /android:windowSoftInputMode=["']adjustResize["']/,
  "Android must resize the visible WebView for the software keyboard"
);
```

- [ ] **Step 2: Run the verifier and confirm it fails**

Run:

```powershell
npm run verify:android
```

Expected: FAIL with `Android must resize the visible WebView for the software keyboard`.

- [ ] **Step 3: Add native soft-input and viewport-safe-area declarations**

Change the viewport metadata in `index.html` to:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

Add the explicit activity attribute in `android/app/src/main/AndroidManifest.xml`:

```xml
android:windowSoftInputMode="adjustResize"
```

The `<activity>` declaration will contain both `android:exported="true"` and `android:windowSoftInputMode="adjustResize"` once, with no native inset listener or keyboard plugin.

- [ ] **Step 4: Verify native configuration and synchronize Android**

Run:

```powershell
npm run verify:android
npm run build:android
```

Expected:

```text
Android release config verified: com.xatoridev.chosmartialarts v0.1.0 (1), target SDK 36.
```

The Android sync and release checks must complete successfully.

- [ ] **Step 5: Commit native keyboard configuration**

```powershell
git add index.html android/app/src/main/AndroidManifest.xml scripts/verify-android-release.mjs
git commit -m "Configure Android keyboard resizing"
```

---

### Task 5: Add repeatable browser geometry regression tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/soft-keyboard-layout.spec.ts`
- Modify: `package.json:6-16`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: login shell and root keyboard state from Tasks 1-3.
- Produces: `npm run test:e2e:keyboard`.

- [ ] **Step 1: Add the Playwright projects and generated-output ignores**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    reducedMotion: "reduce",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173/",
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    { name: "chromium-phone", use: { ...devices["Pixel 7"] } },
    { name: "webkit-iphone", use: { ...devices["iPhone 14"] } }
  ]
});
```

Add these `.gitignore` entries:

```gitignore
/playwright-report/
/test-results/
```

- [ ] **Step 2: Add the geometry test**

Create `e2e/soft-keyboard-layout.spec.ts`:

```ts
import { expect, test } from "playwright/test";

test("keeps the portrait frame stable while the visual keyboard viewport is reduced", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const frame = page.locator(".portrait-app-frame");
  const username = page.getByPlaceholder("Username");
  await expect(username).toBeVisible();

  const widthBefore = await frame.evaluate((element) => element.getBoundingClientRect().width);
  await username.focus();
  await page.setViewportSize({ width: 390, height: 500 });
  await expect(page.locator("html")).toHaveAttribute("data-soft-keyboard", "open");

  const widthDuring = await frame.evaluate((element) => element.getBoundingClientRect().width);
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    inputFontSize: Number.parseFloat(getComputedStyle(document.querySelector<HTMLInputElement>("input[placeholder='Username']")!).fontSize)
  }));

  expect(Math.abs(widthDuring - widthBefore)).toBeLessThanOrEqual(1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.inputFontSize).toBeGreaterThanOrEqual(16);

  await page.setViewportSize({ width: 390, height: 844 });
  await username.blur();
  await expect(page.locator("html")).not.toHaveAttribute("data-soft-keyboard");
  const widthAfter = await frame.evaluate((element) => element.getBoundingClientRect().width);
  expect(Math.abs(widthAfter - widthBefore)).toBeLessThanOrEqual(1);
});

test("ordinary desktop text focus does not hide secondary navigation", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Desktop assertion runs once in Chromium");
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.getByPlaceholder("Username").focus();
  await page.waitForTimeout(500);
  await expect(page.locator("html")).not.toHaveAttribute("data-soft-keyboard");
});
```

- [ ] **Step 3: Add the package command**

Add this script to `package.json`:

```json
"test:e2e:keyboard": "playwright test e2e/soft-keyboard-layout.spec.ts"
```

- [ ] **Step 4: Run both mobile browser projects**

Run:

```powershell
npm run test:e2e:keyboard
```

Expected: the Chromium phone, WebKit iPhone-like, and desktop-focus assertions PASS. If a Playwright browser binary is missing, install only the named local test browsers with `npx playwright install chromium webkit`, rerun, and record that environment setup in the task update.

- [ ] **Step 5: Commit browser regression coverage**

```powershell
git add playwright.config.ts e2e/soft-keyboard-layout.spec.ts package.json .gitignore
git commit -m "Add keyboard layout browser tests"
```

---

### Task 6: Run full QA and create Android internal test build 2

**Files:**
- Modify: `package.json:4`
- Modify: `package-lock.json:3-9`
- Modify: `android/app/build.gradle:26-27`
- Modify: `scripts/verify-android-release.mjs:7-13`

**Interfaces:**
- Consumes: all completed implementation and test tasks.
- Produces: signed `android/app/build/outputs/bundle/release/app-release.aab` version `0.1.1` (2).

- [ ] **Step 1: Make the verifier demand internal test build 2**

Change the expected release object in `scripts/verify-android-release.mjs` to:

```js
const expected = {
  appId: "com.xatoridev.chosmartialarts",
  appName: "Cho's Martial Arts",
  webDir: "dist",
  versionCode: 2,
  versionName: "0.1.1"
};
```

Add this package-version assertion after `packageJson` is loaded:

```js
assert.equal(packageJson.version, expected.versionName, "Package version must match Android versionName");
```

- [ ] **Step 2: Confirm the version gate fails before bumping build files**

Run:

```powershell
npm run verify:android
```

Expected: FAIL because package and Gradle still identify version 0.1.0 / code 1.

- [ ] **Step 3: Bump package and Android versions**

Run the package update:

```powershell
npm version 0.1.1 --no-git-tag-version
```

Change the Gradle declarations to:

```gradle
versionCode 2
versionName "0.1.1"
```

- [ ] **Step 4: Run the complete local release gate**

Run:

```powershell
npm run test
npm run test:e2e:keyboard
npm run build:pages
$env:REQUIRE_ANDROID_SIGNING="1"
npm run build:android
Push-Location android
.\gradlew.bat bundleRelease
Pop-Location
Remove-Item Env:REQUIRE_ANDROID_SIGNING
git diff --check
```

Expected:

- Full Vitest suite PASS.
- Playwright keyboard geometry suite PASS in Chromium and WebKit projects.
- Pages build emits `dist/app-version.json` and `dist/404.html`.
- Android verifier prints `v0.1.1 (2), target SDK 36`.
- Gradle reports `BUILD SUCCESSFUL`.
- Signed bundle exists at `android/app/build/outputs/bundle/release/app-release.aab`.
- `git diff --check` returns no output.

- [ ] **Step 5: Commit the verified release version**

```powershell
git add package.json package-lock.json android/app/build.gradle scripts/verify-android-release.mjs
git commit -m "Prepare Android internal test build 2"
```

- [ ] **Step 6: Upload only to Google Play internal testing**

In Google Play Console for package `com.xatoridev.chosmartialarts`:

1. Open **Testing > Internal testing**.
2. Create a new release named `0.1.1 Internal Test 2`.
3. Upload `android/app/build/outputs/bundle/release/app-release.aab`.
4. Use release notes: `Stabilizes every text-entry screen while the device keyboard is open. The app frame no longer shrinks, focused fields remain visible, and touch input behavior is improved across phones and tablets.`
5. Review and roll out only to the existing internal track.
6. Confirm production remains unpublished and the tester list remains restricted.

- [ ] **Step 7: Verify the private tester experience on real hardware**

Use the existing internal tester link:

```text
https://play.google.com/apps/internaltest/4701284583253394780
```

On the Samsung test device, update/install build 2 and check:

1. Login username and password.
2. Live Chat message composer.
3. Profile Compose subject and multiline message.
4. Student creation modal first field and a lower field.
5. Create Accounts long form.

For every field, verify frame width stays unchanged, the top header stays visible, secondary navigation hides only during the on-screen keyboard, the field remains at least 12px above the keyboard, and geometry restores after dismissal.

Record the final Play release status, version code, tester link, tested device model, and any device-specific limitation in the handoff response.

---

## Plan Self-Review

- Spec coverage: stable frame geometry, focused scrolling, navigation behavior, fullscreen/login suppression, 16px touch inputs, safe areas, Android resize mode, browser tests, real-device testing, and private Play release are each assigned to a task.
- Placeholder scan: every source change has concrete code, every validation step has an exact command and expected result, and every external release step names the exact track, artifact, release name, and tester link.
- Type consistency: Task 2 consumes the exact hook, event constant, and state helper produced by Task 1; CSS consumes the exact root attributes and variables produced by the controller; release verification consumes the exact 0.1.1 / code 2 values required by the global constraints.

# Stable Mobile Keyboard Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the entire Cho's app geometrically frozen while touch users type through a visually matching editor placed directly above the software keyboard.

**Architecture:** Preserve the existing global `visualViewport` detector, but separate stable app geometry from the reduced visible keyboard viewport. Add one dependency-free DOM editor session that intercepts touch text focus, mirrors source semantics and appearance, synchronizes edits back through native form events, and follows only the visible viewport edge.

**Tech Stack:** React 19, TypeScript 6, DOM/Visual Viewport APIs, CSS, Vitest + jsdom, Playwright Chromium/WebKit.

## Global Constraints

- Desktop keyboard and mouse behavior remains unchanged.
- The portrait shell, frame, navigation, headers, dialogs, page content, and scroll positions retain pre-keyboard geometry.
- The source control remains the authoritative form control and receives real-time native input/change behavior.
- Buttons, checkboxes, radio buttons, color/file/range/hidden inputs, ordinary selects, readonly controls, and disabled controls are excluded.
- Dark, light, and custom themes must remain readable and visually consistent.
- Do not add a dependency or alter business logic, validation, storage, routing, or backend behavior.
- Preserve unrelated untracked plans and `output/` artifacts already present in the worktree.

---

### Task 1: Define the mirrored-editor contracts and pure helpers

**Files:**
- Create: `src/softKeyboardEditor.ts`
- Create: `src/softKeyboardEditor.test.ts`
- Modify: `src/softKeyboardViewport.ts`
- Modify: `src/softKeyboardViewport.test.ts`

**Interfaces:**
- Consumes: `isKeyboardEditableTarget(target: EventTarget | null): target is HTMLElement` from `softKeyboardViewport.ts`.
- Produces: `KeyboardEditableElement`, `KeyboardEditorKind`, `KeyboardEditorDescriptor`, `createKeyboardEditorDescriptor(source)`, `writeKeyboardEditorValue(source, value)`, and `copyKeyboardEditorSelection(source, editor)`.

- [ ] **Step 1: Write failing classification and descriptor tests**

```ts
it("excludes selects, readonly fields, and disabled ARIA textboxes", () => {
  const select = document.createElement("select");
  const readonly = document.createElement("input");
  readonly.readOnly = true;
  const ariaDisabled = document.createElement("div");
  ariaDisabled.setAttribute("role", "textbox");
  ariaDisabled.setAttribute("aria-disabled", "true");

  expect(isKeyboardEditableTarget(select)).toBe(false);
  expect(isKeyboardEditableTarget(readonly)).toBe(false);
  expect(isKeyboardEditableTarget(ariaDisabled)).toBe(false);
});

it("copies keyboard semantics without copying source identity", () => {
  const source = document.createElement("input");
  source.id = "member-email";
  source.type = "email";
  source.value = "member@example.com";
  source.placeholder = "Email";
  source.autocomplete = "email";
  source.inputMode = "email";
  source.maxLength = 80;

  expect(createKeyboardEditorDescriptor(source)).toMatchObject({
    kind: "input",
    type: "email",
    value: "member@example.com",
    placeholder: "Email",
    autocomplete: "email",
    inputMode: "email",
    maxLength: 80
  });
});
```

- [ ] **Step 2: Run tests and verify the intended RED state**

Run: `npx vitest run src/softKeyboardViewport.test.ts src/softKeyboardEditor.test.ts`

Expected: FAIL because selects/readonly are still classified as keyboard-editable and `softKeyboardEditor.ts` does not exist.

- [ ] **Step 3: Implement minimal contracts and helpers**

```ts
export type KeyboardEditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
export type KeyboardEditorKind = "input" | "textarea";

export type KeyboardEditorDescriptor = {
  kind: KeyboardEditorKind;
  type: string;
  value: string;
  placeholder: string;
  autocomplete: string;
  inputMode: string;
  enterKeyHint: string;
  maxLength: number;
  minLength: number;
  required: boolean;
  spellcheck: boolean;
  ariaLabel: string;
};

export function createKeyboardEditorDescriptor(source: KeyboardEditableElement): KeyboardEditorDescriptor {
  const input = source instanceof HTMLInputElement ? source : undefined;
  const textarea = source instanceof HTMLTextAreaElement ? source : undefined;
  return {
    kind: textarea || source.isContentEditable ? "textarea" : "input",
    type: input?.type || "text",
    value: input || textarea ? input?.value ?? textarea!.value : source.textContent ?? "",
    placeholder: input?.placeholder ?? textarea?.placeholder ?? "",
    autocomplete: input?.autocomplete ?? textarea?.autocomplete ?? "",
    inputMode: source.inputMode,
    enterKeyHint: source.enterKeyHint,
    maxLength: input?.maxLength ?? textarea?.maxLength ?? -1,
    minLength: input?.minLength ?? textarea?.minLength ?? -1,
    required: input?.required ?? textarea?.required ?? false,
    spellcheck: source.spellcheck,
    ariaLabel: source.getAttribute("aria-label") || source.getAttribute("name") || "Text editor"
  };
}
```

Update `isKeyboardEditableTarget` so `select`, readonly controls, disabled controls, and `aria-readonly="true"` are false while supported text-like inputs remain true.

- [ ] **Step 4: Add failing value/selection synchronization tests**

```ts
it("writes through the native setter and emits a bubbling input event", () => {
  const source = document.createElement("input");
  const observed: string[] = [];
  source.addEventListener("input", () => observed.push(source.value));

  writeKeyboardEditorValue(source, "Cho's");

  expect(source.value).toBe("Cho's");
  expect(observed).toEqual(["Cho's"]);
});
```

- [ ] **Step 5: Implement native value and selection synchronization**

Use the native `HTMLInputElement.prototype.value` or `HTMLTextAreaElement.prototype.value` setter, then dispatch `new InputEvent("input", { bubbles: true, composed: true, inputType, data })`. For content-editable sources, replace text content and dispatch the same bubbling event. Copy `selectionStart`, `selectionEnd`, and `selectionDirection` when both endpoints support them.

- [ ] **Step 6: Run focused tests and commit**

Run: `npx vitest run src/softKeyboardViewport.test.ts src/softKeyboardEditor.test.ts`

Expected: PASS.

```powershell
git add -- src/softKeyboardViewport.ts src/softKeyboardViewport.test.ts src/softKeyboardEditor.ts src/softKeyboardEditor.test.ts
git commit -m "feat: define mobile keyboard editor contracts"
```

### Task 2: Build the app-wide editor session

**Files:**
- Modify: `src/softKeyboardEditor.ts`
- Modify: `src/softKeyboardEditor.test.ts`
- Modify: `src/softKeyboardViewport.ts`
- Modify: `src/softKeyboardViewport.test.ts`

**Interfaces:**
- Consumes: Task 1 descriptor and synchronization helpers; `visualViewport` metrics from the existing viewport controller.
- Produces: `installSoftKeyboardEditor(options): () => void`, one `.soft-keyboard-editor-layer`, and `data-soft-keyboard-editor="open"` on the root.

- [ ] **Step 1: Write failing session-open tests**

```ts
it("opens a matching editor synchronously for a touch text target", () => {
  const source = document.createElement("input");
  source.className = "input manager-home-search";
  source.value = "member";
  document.body.append(source);
  cleanup = installSoftKeyboardEditor({ win: window, doc: document });

  dispatchPointerDown(source, "touch");

  const editor = document.querySelector<HTMLInputElement>("[data-soft-keyboard-editor-control]");
  expect(editor).toBe(document.activeElement);
  expect(editor?.value).toBe("member");
  expect(document.documentElement.dataset.softKeyboardEditor).toBe("open");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/softKeyboardEditor.test.ts -t "opens a matching editor"`

Expected: FAIL because `installSoftKeyboardEditor` is not implemented.

- [ ] **Step 3: Implement the persistent editor DOM and synchronous touch activation**

Create the hidden layer once during installation with an input, textarea, and `button type="button"` labelled `Done editing`. Register `pointerdown` in capture phase. For touch/pen targets, populate the correct control, call `preventDefault()`, reveal the layer, and focus the proxy before the event handler returns. Ignore events originating inside the editor layer.

```ts
export type InstallSoftKeyboardEditorOptions = { win?: Window; doc?: Document };

export function installSoftKeyboardEditor(options: InstallSoftKeyboardEditorOptions = {}) {
  const win = options.win ?? window;
  const doc = options.doc ?? document;
  const layer = doc.createElement("div");
  layer.className = "soft-keyboard-editor-layer";
  layer.hidden = true;
  layer.innerHTML = '<div class="soft-keyboard-editor-surface"><input data-soft-keyboard-editor-control><textarea data-soft-keyboard-editor-control></textarea><button type="button" aria-label="Done editing">Done</button></div>';
  doc.body.append(layer);
  // Register session handlers and return complete cleanup.
  return () => layer.remove();
}
```

- [ ] **Step 4: Write failing tests for live sync, composition, Done, Escape, removal, and desktop exclusion**

```ts
it("synchronizes edits live and closes without reopening the keyboard", () => {
  openTouchEditor(source);
  const editor = getActiveEditor();
  editor.value = "updated";
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "d" }));
  expect(source.value).toBe("updated");

  screen.getByRole("button", { name: "Done editing" }).click();
  expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard-editor");
  expect(document.querySelector(".soft-keyboard-editor-layer")?.hasAttribute("hidden")).toBe(true);
});
```

- [ ] **Step 5: Implement session lifecycle and synchronization**

Mirror attributes and validity ARIA state, forward `input`, `change`, `beforeinput`, `compositionstart/update/end`, and selection state, and suppress source-to-proxy frame synchronization while composing. Close on Done, Escape, form submission, source removal/disablement, orientation change, and cleanup. Restore source focus with `{ preventScroll: true }` only when it will not reopen a soft keyboard; otherwise leave focus on the Done button until blur completes.

- [ ] **Step 6: Copy computed appearance with a safe fallback**

Copy this explicit allowlist from source computed styles to the proxy: font family/size/weight/style/line-height/letter-spacing, color, background color/image, border widths/styles/colors, border radius, box shadow, padding, text alignment, text transform, direction, caret color, and min/max height. Clamp width to `min(source width, visible viewport width - 24px)`, enforce an effective 16 px font size, and store placeholder color in `--soft-keyboard-editor-placeholder-color`.

- [ ] **Step 7: Run focused tests and commit**

Run: `npx vitest run src/softKeyboardEditor.test.ts src/softKeyboardViewport.test.ts`

Expected: PASS with no leaked editor DOM or timers.

```powershell
git add -- src/softKeyboardEditor.ts src/softKeyboardEditor.test.ts src/softKeyboardViewport.ts src/softKeyboardViewport.test.ts
git commit -m "feat: add app-wide mobile keyboard editor"
```

### Task 3: Freeze app geometry and style only the editor overlay

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/softKeyboardViewport.ts`
- Modify: `src/softKeyboardViewport.test.ts`
- Modify: `src/styles.css`
- Modify: `src/softKeyboardPresentation.test.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: `installSoftKeyboardEditor` from Task 2 and existing `useSoftKeyboardViewport()` in `App.tsx`.
- Produces: stable `--app-stable-viewport-height`, visible editor coordinates, and editor presentation in all app themes.

- [ ] **Step 1: Replace presentation assertions with failing frozen-layout assertions**

```ts
it("keeps every app surface mounted and stable while only the editor follows visualViewport", () => {
  const selectors = styleRules.map((rule) => rule.selectors);
  const shell = ruleFor(".portrait-app-shell").declarations;
  const layer = ruleFor(".soft-keyboard-editor-layer").declarations;

  expect(shell.get("height")).toContain("--app-stable-viewport-height");
  expect(selectors.some((value) => value.includes('data-soft-keyboard="open"') && value.includes("display: none"))).toBe(false);
  expect(layer.get("top")).toContain("--soft-keyboard-editor-top");
  expect(layer.get("position")).toBe("fixed");
});
```

- [ ] **Step 2: Run presentation tests and verify RED**

Run: `npx vitest run src/softKeyboardPresentation.test.ts src/softKeyboardViewport.test.ts`

Expected: FAIL because the current CSS shrinks the shell and hides navigation.

- [ ] **Step 3: Integrate the editor and remove layout-changing keyboard rules**

Install the editor from the same app-level hook as the viewport controller. Remove keyboard-open rules that change `.portrait-app-shell` height, sidebar track width, rail hit width, navigation display, and launcher padding. Remove automatic `scrollIntoView`/scroll-by behavior. Keep stable baseline detection and keyboard state events.

- [ ] **Step 4: Add stable shell and editor CSS**

```css
.portrait-app-shell {
  height: var(--app-stable-viewport-height, 100dvh);
}

.soft-keyboard-editor-layer {
  position: fixed;
  z-index: 2147483000;
  top: var(--soft-keyboard-editor-top, 0px);
  left: max(12px, env(safe-area-inset-left));
  right: max(12px, env(safe-area-inset-right));
  pointer-events: none;
  transform: translateY(-100%);
}

.soft-keyboard-editor-surface {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  pointer-events: auto;
}

.soft-keyboard-editor-layer[hidden] { display: none !important; }
.soft-keyboard-editor-layer [data-soft-keyboard-editor-control] { font-size: max(16px, 1em) !important; }
.soft-keyboard-editor-layer textarea { max-height: min(160px, 32vh); resize: none; }
.soft-keyboard-editor-layer ::placeholder { color: var(--soft-keyboard-editor-placeholder-color); }
```

Add theme-aware Done styling using existing Cho red/gold variables and a reduced-motion override that removes only the editor entrance transition.

- [ ] **Step 5: Request overlay keyboard behavior on supported Chromium and WebView platforms**

Change the viewport meta content to:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=overlays-content" />
```

At controller installation, guarded by feature detection, set `navigator.virtualKeyboard.overlaysContent = true`; cleanup must restore the previous boolean when it was changed.

- [ ] **Step 6: Run presentation/controller tests and commit**

Run: `npx vitest run src/softKeyboardEditor.test.ts src/softKeyboardViewport.test.ts src/softKeyboardPresentation.test.ts src/App.test.tsx`

Expected: PASS.

```powershell
git add -- src/App.tsx src/softKeyboardViewport.ts src/softKeyboardViewport.test.ts src/styles.css src/softKeyboardPresentation.test.ts index.html
git commit -m "fix: freeze app layout above mobile keyboard"
```

### Task 4: Prove phone behavior in Chromium and WebKit

**Files:**
- Modify: `e2e/soft-keyboard-layout.spec.ts`

**Interfaces:**
- Consumes: the phone projects and visual viewport harness in `playwright.config.ts`.
- Produces: browser proof for frozen geometry, editor placement/sync, scroll stability, cleanup, and desktop exclusion.

- [ ] **Step 1: Rewrite the phone test to fail against the old presentation**

Capture before/during/after rectangles for `.portrait-app-shell`, `.portrait-app-frame`, `.login-card`, and any visible navigation surface; capture window and nested scroll offsets. Tap Username, reduce the test visual viewport to 500 px, then assert:

```ts
expect(during.shell).toEqual(before.shell);
expect(during.frame).toEqual(before.frame);
expect(during.scrollX).toBe(before.scrollX);
expect(during.scrollY).toBe(before.scrollY);
expect(during.editorBottom).toBeLessThanOrEqual(reducedVisualViewportHeight);
expect(during.editorBottom).toBeGreaterThan(reducedVisualViewportHeight - 40);
```

Expected initial result: FAIL because the old shell height becomes 500 px and no mirrored editor exists.

- [ ] **Step 2: Add live editor behavior and visual-similarity assertions**

Fill the mirrored Username editor and assert the original Username value changes immediately. Compare computed font family, font size, color, background color, border radius, and border styles between source and proxy. Tap Done and assert the layer is hidden, geometry and scroll positions are unchanged, and the original value persists.

- [ ] **Step 3: Add multiline and desktop coverage**

Use an authenticated/local test path already supported by the suite if available; otherwise inject a textarea fixture before app mount through the same harness. Assert multiline internal scrolling and capped height. Keep the existing desktop test and add `expect(page.locator(".soft-keyboard-editor-layer:not([hidden])")).toHaveCount(0)` after mouse focus.

- [ ] **Step 4: Run phone keyboard E2E and commit**

Run: `npm run test:e2e:keyboard`

Expected: all Chromium phone, WebKit iPhone, and Chromium desktop keyboard-layout tests PASS. A platform browser binary failure is an environment blocker, not an app assertion failure, and must be reported with its exact error.

```powershell
git add -- e2e/soft-keyboard-layout.spec.ts
git commit -m "test: verify frozen mobile keyboard layout"
```

### Task 5: Full verification and quality review

**Files:**
- Modify only if a verification failure exposes a directly related defect; add a failing regression test before each fix.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: release-ready local evidence with unrelated work preserved.

- [ ] **Step 1: Run focused and complete unit suites**

Run: `npx vitest run src/softKeyboardEditor.test.ts src/softKeyboardViewport.test.ts src/softKeyboardPresentation.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS with no unhandled errors.

- [ ] **Step 2: Run browser and production build checks**

Run: `npm run test:e2e:keyboard`

Expected: all configured keyboard tests PASS.

Run: `npm run build`

Expected: TypeScript and Vite build exit 0.

- [ ] **Step 3: Review accessibility, themes, and the final diff**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short --branch`

Expected: only the user's pre-existing untracked plans/output plus intentional task files, or a clean task diff after commits.

Inspect the implementation for listener/timer cleanup, no duplicate IDs, no source identity copying, no keyboard overlay on desktop, preserved password masking, a labelled Done button, and no hardcoded colors that break light/custom themes.

- [ ] **Step 4: Commit any test-first verification fix and report exact evidence**

If no fix is needed, do not create an empty commit. If a related issue appears, first add the failing regression test, make the smallest fix, rerun focused and full checks, then commit only those files with a narrowly named message.

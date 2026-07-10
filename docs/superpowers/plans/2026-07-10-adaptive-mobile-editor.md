# Adaptive Mobile Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the global mobile editor with long wrapped content and make its green action advance ordinary forms while submitting only live chat.

**Architecture:** Extend the existing `softKeyboardEditor` mirror rather than modifying individual forms. A source descriptor selects a wrapping textarea for non-password text, height measurement writes a capped CSS height, and one action resolver either requests the known live-chat form submission or focuses the next editable source.

**Tech Stack:** TypeScript 6, DOM events, Visual Viewport API, React 19, Vitest, Playwright.

## Global Constraints

- The underlying app shell must not resize, scroll, or transform.
- Password values remain in a masked single-line input.
- Only `.live-chat-composer` may be submitted by the floating action.
- Ordinary forms must never be submitted by the floating action.
- No dependency is added.

---

### Task 1: Adaptive editor measurement

**Files:**
- Modify: `src/softKeyboardEditor.ts`
- Modify: `src/styles.css`
- Test: `src/softKeyboardEditor.test.ts`

**Interfaces:**
- Produces: `resizeKeyboardEditor(editor, visibleHeight)` behavior through `--soft-keyboard-editor-control-height` and `--soft-keyboard-editor-max-height`.

- [ ] Add failing tests that a long ordinary text input uses a wrapping textarea, its height follows `scrollHeight`, and its height caps at the available maximum.
- [ ] Run `npx vitest run src/softKeyboardEditor.test.ts -t "grows|caps"` and confirm the current fixed controls fail.
- [ ] Select textarea for non-password text sources, preserve input mode/autocomplete, and set measured height using the current visual viewport.
- [ ] Set `overflow-y: auto` only when measured content reaches the cap; otherwise keep overflow hidden.
- [ ] Run the focused test and confirm it passes.

### Task 2: Context-aware green action

**Files:**
- Modify: `src/softKeyboardEditor.ts`
- Modify: `src/styles.css`
- Test: `src/softKeyboardEditor.test.ts`

**Interfaces:**
- Consumes: `resolveKeyboardEditableTarget` and the current source/editor mirror.
- Produces: action behavior that submits `.live-chat-composer`, advances to the next editable source, or closes at the final source.

- [ ] Add failing tests for username-to-password advance, final-field commit/close, ordinary-form non-submission, and live-chat requestSubmit.
- [ ] Run `npx vitest run src/softKeyboardEditor.test.ts -t "advances|live chat|final field"` and confirm failures describe missing action behavior.
- [ ] Replace Done text with Send and apply the green success style.
- [ ] Implement document-order next-control resolution that excludes disabled, readonly, hidden, and mirror controls.
- [ ] Request submission only when `source.closest("form")` matches `.live-chat-composer`; otherwise focus the next source or close.
- [ ] Run focused tests and confirm they pass.

### Task 3: Cross-device stability and release

**Files:**
- Modify: `e2e/soft-keyboard-layout.spec.ts`

**Interfaces:**
- Verifies: app geometry stability, wrapping growth, capped scrolling, field advance, chat form submission contract, dismissal lifecycle, and desktop-native behavior.

- [ ] Add Android Chromium and iPhone WebKit cases for long wrapped content, cap/scroll, and username-to-password advance.
- [ ] Run `npm run test:e2e:keyboard` and confirm all applicable projects pass.
- [ ] Run `npm test`, `npm run build:cloudflare`, `npm run verify:android`, and `npm audit --audit-level=moderate`.
- [ ] Commit only the editor, styles, tests, spec, and plan; preserve unrelated Android line-ending files and user artifacts.
- [ ] Push `main`, deploy the exact commit to Cloudflare Pages, verify `app-version.json`, the independent GitHub workflow, and the rendered live mobile layout.

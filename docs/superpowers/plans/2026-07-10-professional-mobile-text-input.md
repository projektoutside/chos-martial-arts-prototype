# Professional Mobile Text Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every supported phone text-entry activation open a clearly visible, visually matched editor without moving, resizing, or warping the underlying app.

**Architecture:** Keep the existing global mirrored-editor boundary, but replace its direct-target-only activation with a single resolver that handles native controls, associated labels, and mobile focus fallback. The overlay remains fixed to the visual viewport, synchronizes value/selection/events to the source, and leaves desktop behavior native.

**Tech Stack:** React 19, TypeScript 6, DOM Pointer/Focus events, Visual Viewport API, Virtual Keyboard API, Vitest, Playwright.

## Global Constraints

- Do not change form business logic, validation, visual design, or desktop input behavior.
- Do not scroll, resize, transform, or reflow the authenticated app shell when the keyboard opens.
- Support text-like input, textarea, contenteditable, labels, IME composition, selection, submission, readonly/disabled exclusions, and cleanup.
- Add no dependency.

---

### Task 1: Activation resolution

**Files:**
- Modify: `src/softKeyboardEditor.ts`
- Test: `src/softKeyboardEditor.test.ts`

- [ ] Add failing tests for associated-label touch, nested-label touch, and focus-only mobile activation.
- [ ] Verify each test fails because the existing direct pointer target is not resolved.
- [ ] Implement one editable-source resolver and guarded mobile focus fallback.
- [ ] Verify direct, label, focus, readonly, disabled, mouse, and cleanup tests pass.

### Task 2: Stable viewport presentation

**Files:**
- Modify: `src/softKeyboardEditor.ts`
- Modify: `src/styles.css`
- Test: `src/softKeyboardEditor.test.ts`
- Test: `e2e/soft-keyboard-layout.spec.ts`

- [ ] Add failing coverage for nonzero viewport offsets and fallback activation while preserving app-shell geometry.
- [ ] Keep the editor centered within the visible region above the keyboard and clamp it inside safe viewport edges.
- [ ] Verify matching styles, multiline height, 16px anti-zoom font sizing, and a 44px Done target.

### Task 3: Release verification

**Files:**
- Modify only if a validated regression requires it.

- [ ] Run focused Vitest tests.
- [ ] Run all unit/integration tests.
- [ ] Run Playwright phone, iPhone, and desktop keyboard tests.
- [ ] Build the Cloudflare production artifact and verify Android release configuration.
- [ ] Commit only intended files, push `main`, deploy the exact commit, and verify `app-version.json` plus the live interaction.

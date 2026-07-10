# Login Portrait Cinematic Fade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the login portrait's visible upward scale-and-overshoot entrance with a final-size, dark-to-clear cinematic fade synchronized to the existing launch handoff.

**Architecture:** Keep the React markup and portrait positioning unchanged. Refine only the existing `loginPortraitHandoff` CSS animation and add CSS contract tests plus rendered motion snapshots so the stage transform cannot move between frames.

**Tech Stack:** React 19, CSS keyframes, Vitest, Playwright, Vite, Cloudflare Pages

## Global Constraints

- Keep the portrait at its final size, anchor, and transform for every animation frame.
- Preserve the existing final artwork placement, responsive sizing, shadows, visibility toggle, and login controls.
- End the portrait reveal before the 3.05-second launch overlay completes.
- Render the final portrait immediately when reduced motion is requested.
- Add no new runtime dependencies.

---

### Task 1: Lock the cinematic motion contract

**Files:**
- Create: `src/loginPortraitMotion.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.login-landing.is-handoff .login-portrait-stage`, `@keyframes loginPortraitHandoff`, and `--login-portrait-opacity`.
- Produces: a CSS-only portrait reveal with invariant transform and a tested dark-to-clear exposure.

- [ ] **Step 1: Write the failing test**

Create a Vitest CSS contract that reads `src/styles.css`, extracts `loginPortraitHandoff`, and asserts that its opening, middle, and final frames all contain `translate3d(-50%, -50%, 0) scale(1)`. Assert that the opening frame contains `opacity: 0`, `brightness(0.28)`, and `blur(3px)`, while the final frame contains `opacity: var(--login-portrait-opacity)`, `brightness(1)`, and `blur(0)`.

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run src/loginPortraitMotion.test.ts`

Expected: FAIL because the current opening frame uses `translate3d(-50%, -44%, 0) scale(0.96)` and the middle frame overshoots.

- [ ] **Step 3: Implement the minimal CSS refinement**

Change the handoff rule to remain at the final transform and animate for `780ms` with a `2200ms` delay. Rewrite the keyframes so only opacity and exposure change: start dark/transparent/softly blurred, pass through a restrained mid-exposure frame, and finish at the existing configured opacity with normal brightness and no blur.

- [ ] **Step 4: Verify the focused contract**

Run: `npx vitest run src/loginPortraitMotion.test.ts src/softKeyboardPresentation.test.ts`

Expected: both files PASS.

### Task 2: Verify rendered motion and release safely

**Files:**
- Modify only if the rendered check exposes a defect: `src/styles.css`

**Interfaces:**
- Consumes: the existing login route and launch sequence.
- Produces: desktop and phone visual evidence with no portrait size or position movement.

- [ ] **Step 1: Run rendered motion checks**

Use a 390x844 phone viewport and a desktop viewport. Capture the portrait bounds during the dark opening, mid-fade, and settled state. Confirm width, height, and center remain stable while opacity/filter progress.

- [ ] **Step 2: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce` and confirm the portrait renders immediately at its final transform and opacity.

- [ ] **Step 3: Run the full quality gate**

Run `npm test`, `npm run test:e2e:keyboard`, `npm run build:cloudflare`, `npm run verify:android`, `npm audit --audit-level=moderate`, and `git diff --check`.

Expected: all tests/builds pass, audit reports zero moderate-or-higher vulnerabilities, and no whitespace errors appear.

- [ ] **Step 4: Commit and release**

Commit only the design, plan, CSS, and motion tests. Push `main`, deploy the exact commit to Cloudflare Pages, verify `app-version.json` on the permanent and immutable URLs, and wait for the `Verify main web release` workflow to pass.

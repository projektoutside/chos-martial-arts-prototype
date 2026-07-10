# Remove Launch Spark Particles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the isolated white sparkle dots from the kick-animation ending while preserving every other launch effect and timing.

**Architecture:** Delete the `launch-letter-sparks` element from `LaunchLogoAnimation`, then remove only its selectors and `launchLetterSparkle` keyframes from the stylesheet. Protect the behavior with a focused component test.

**Tech Stack:** React 19, CSS, Vitest, Playwright, Vite

## Global Constraints

- Preserve the fighter frames, impact flash, haze, floor glow, logo aura, backdrop handoff, and 3.05-second timing.
- Add no dependencies.
- Preserve reduced-motion behavior.

---

### Task 1: Remove the particle layer

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `LaunchLogoAnimation` and existing launch presentation classes.
- Produces: the same intro without `.launch-letter-sparks`.

- [ ] Add a failing test that renders the launch screen, expects `.launch-letter-sparks` to be absent, and expects `.launch-impact-flash` and `.launch-logo-aura` to remain.
- [ ] Run the focused test and confirm it fails because the spark element still exists.
- [ ] Delete the spark element, spark-only selectors, reduced-motion references, and `launchLetterSparkle` keyframes.
- [ ] Run the focused test and rendered intro checks.
- [ ] Run the full app, keyboard, production build, Android, audit, and whitespace quality gates.
- [ ] Commit, push, deploy the exact commit, and verify permanent and immutable production versions plus the hosted release workflow.

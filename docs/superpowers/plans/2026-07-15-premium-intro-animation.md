# Premium Intro Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a consistently complete, synchronized, world-class Cho's intro whose full fighter sequence is decoded before playback and whose login handoff never exposes a missing visual state.

**Architecture:** Move launch timing and asset preparation into a focused `launchAnimation` module, render the predecoded fighter frames through a canvas component, and let one phase clock drive the fighter, impact, logo, and login handoff. Preserve the current React login gate and CSS visual language while replacing mount-time animation drift with phase-driven classes and a polished static fallback.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, Testing Library, Canvas 2D, CSS animations, Playwright 1.61.

## Global Constraints

- Preserve authentication behavior, login form behavior, the established Cho's branding, GitHub Pages subpath routing, and unrelated app surfaces.
- Do not add a runtime dependency.
- Playback must not begin until all assets required for the full fighter sequence have decoded.
- A critical asset gets one retry; permanent failure must finish through a polished fallback and cannot trap the user.
- Login controls remain inert until the handoff is complete.
- Reduced motion bypasses fighter and impact motion and reaches a stable interactive login promptly.
- Decorative canvas and effect layers remain hidden from assistive technology.
- Preserve existing unrelated changes in `android/`, `src/data.ts`, `src/data.test.ts`, `output/`, and pre-existing plan documents.

---

## File Structure

- Create `src/launchAnimation.ts`: asset manifest, decode/retry controller, launch phase contract, shared timeline, and deterministic frame selection.
- Create `src/launchAnimation.test.ts`: unit coverage for manifest construction, phase boundaries, frame selection, decode gating, retry, and terminal failure.
- Create `src/LaunchFighterCanvas.tsx`: canvas-only renderer for already-decoded fighter frames.
- Create `src/LaunchFighterCanvas.test.tsx`: canvas draw and last-valid-frame behavior.
- Create `src/LaunchLogoAnimation.tsx`: readiness, phase-clock, fallback, accessibility, and launch-layer composition.
- Create `src/LaunchLogoAnimation.test.tsx`: sequence integration, failure fallback, reduced motion, and completion coverage.
- Modify `src/App.tsx`: consume phase callbacks, keep login inert through handoff, and remove the old timer/image-swap implementation.
- Modify `src/App.test.tsx`: update login-gate tests for decoded readiness and phase-driven completion.
- Modify `src/styles.css`: phase-scoped cinematic layers, canvas sizing, shockwave, particles, grounded shadow, environment pulse, and synchronized login/logo transitions.
- Modify `e2e/login-portrait-motion.spec.ts`: add repeated-load and phase-order browser proof without weakening the existing portrait stability checks.

---

### Task 1: Deterministic Launch Timeline and Critical Asset Preloader

**Files:**
- Create: `src/launchAnimation.ts`
- Create: `src/launchAnimation.test.ts`
- Modify: `src/utils.ts:300-302`
- Modify: `src/utils.test.ts:135-138`

**Interfaces:**
- Produces: `LaunchPhase`, `LaunchAssetManifest`, `DecodedLaunchAssets`, `LAUNCH_TIMELINE`, `createLaunchAssetManifest(resolveAsset)`, `getLaunchPhase(elapsedMs)`, `getFighterFrameIndex(elapsedMs, frameCount)`, and `preloadLaunchAssets(manifest, imageFactory)`.
- Consumers: Tasks 2 and 3 use the decoded frame array and the exact phase/timeline exports.

- [ ] **Step 1: Write failing timeline and manifest tests**

Create `src/launchAnimation.test.ts` with tests that require 60 sequential fighter URLs, all three static assets, exact phase boundaries, and a clamped frame index:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  LAUNCH_TIMELINE,
  createLaunchAssetManifest,
  getFighterFrameIndex,
  getLaunchPhase,
  preloadLaunchAssets
} from "./launchAnimation";

describe("premium launch timeline", () => {
  it("builds the complete critical asset manifest", () => {
    const manifest = createLaunchAssetManifest((path) => `/base/${path}`);
    expect(manifest.fighterFrames).toHaveLength(60);
    expect(manifest.fighterFrames[0]).toBe("/base/roundhouse-frames/frame-00.png?v=clean-no-lines-2");
    expect(manifest.fighterFrames[59]).toBe("/base/roundhouse-frames/frame-59.png?v=clean-no-lines-2");
    expect(manifest.staticImages).toEqual([
      "/base/682e95109aa21_chos-logo.png",
      "/base/NewFinalBackground.png",
      "/base/Perfect1.png"
    ]);
  });

  it("moves through every phase in order", () => {
    expect(getLaunchPhase(0)).toBe("fighter");
    expect(getLaunchPhase(LAUNCH_TIMELINE.impactAt - 1)).toBe("fighter");
    expect(getLaunchPhase(LAUNCH_TIMELINE.impactAt)).toBe("impact");
    expect(getLaunchPhase(LAUNCH_TIMELINE.logoAt)).toBe("logo");
    expect(getLaunchPhase(LAUNCH_TIMELINE.handoffAt)).toBe("handoff");
    expect(getLaunchPhase(LAUNCH_TIMELINE.completeAt)).toBe("complete");
  });

  it("selects a valid fighter frame for every elapsed time", () => {
    expect(getFighterFrameIndex(-20, 60)).toBe(0);
    expect(getFighterFrameIndex(0, 60)).toBe(0);
    expect(getFighterFrameIndex(LAUNCH_TIMELINE.fighterDuration, 60)).toBe(59);
    expect(getFighterFrameIndex(99_000, 60)).toBe(59);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd test -- src/launchAnimation.test.ts`

Expected: FAIL because `src/launchAnimation.ts` does not exist.

- [ ] **Step 3: Implement the shared phase and manifest contract**

Create `src/launchAnimation.ts` with these public values and signatures:

```ts
export type LaunchPhase = "loading" | "fighter" | "impact" | "logo" | "handoff" | "complete" | "fallback";

export const LAUNCH_TIMELINE = Object.freeze({
  impactAt: 1180,
  logoAt: 1540,
  handoffAt: 2240,
  completeAt: 3340,
  fighterDuration: 1850
});

export type LaunchAssetManifest = {
  fighterFrames: string[];
  staticImages: string[];
};

export type DecodedLaunchAssets = {
  fighterFrames: HTMLImageElement[];
  staticImages: Map<string, HTMLImageElement>;
};

export type LaunchImageFactory = () => HTMLImageElement;

export function createLaunchAssetManifest(resolveAsset: (path: string) => string): LaunchAssetManifest {
  return {
    fighterFrames: Array.from({ length: 60 }, (_, index) =>
      `${resolveAsset(`roundhouse-frames/frame-${String(index).padStart(2, "0")}.png`)}?v=clean-no-lines-2`
    ),
    staticImages: [
      resolveAsset("682e95109aa21_chos-logo.png"),
      resolveAsset("NewFinalBackground.png"),
      resolveAsset("Perfect1.png")
    ]
  };
}

export function getLaunchPhase(elapsedMs: number): Exclude<LaunchPhase, "loading" | "fallback"> {
  if (elapsedMs >= LAUNCH_TIMELINE.completeAt) return "complete";
  if (elapsedMs >= LAUNCH_TIMELINE.handoffAt) return "handoff";
  if (elapsedMs >= LAUNCH_TIMELINE.logoAt) return "logo";
  if (elapsedMs >= LAUNCH_TIMELINE.impactAt) return "impact";
  return "fighter";
}

export function getFighterFrameIndex(elapsedMs: number, frameCount: number): number {
  if (frameCount <= 1) return 0;
  const progress = Math.min(1, Math.max(0, elapsedMs) / LAUNCH_TIMELINE.fighterDuration);
  return Math.min(frameCount - 1, Math.floor(progress * frameCount));
}
```

Delete `getInitialLaunchPhase` from `src/utils.ts` and its legacy test from `src/utils.test.ts`; the new explicit phase contract replaces it.

- [ ] **Step 4: Add failing decode, retry, and terminal-failure tests**

Append tests using a small fake image whose `decode()` calls can resolve or reject. Assert that `preloadLaunchAssets` does not resolve while any decode promise is pending, preserves manifest order, creates a second image after the first rejection, and rejects after two failed attempts:

```ts
it("waits for every critical image and preserves fighter order", async () => {
  const decodes: Array<ReturnType<typeof vi.fn>> = [];
  const factory = vi.fn(() => {
    const decode = vi.fn().mockResolvedValue(undefined);
    decodes.push(decode);
    return { src: "", decode } as unknown as HTMLImageElement;
  });
  const manifest = { fighterFrames: ["frame-0", "frame-1"], staticImages: ["logo"] };
  const assets = await preloadLaunchAssets(manifest, factory);
  expect(factory).toHaveBeenCalledTimes(3);
  expect(decodes.every((decode) => decode.mock.calls.length === 1)).toBe(true);
  expect(assets.fighterFrames.map((image) => image.src)).toEqual(["frame-0", "frame-1"]);
  expect(assets.staticImages.get("logo")?.src).toBe("logo");
});

it("retries one failed decode and then succeeds", async () => {
  const factory = vi.fn()
    .mockImplementationOnce(() => ({ src: "", decode: vi.fn().mockRejectedValue(new Error("cold-load failure")) }))
    .mockImplementationOnce(() => ({ src: "", decode: vi.fn().mockResolvedValue(undefined) }));
  await expect(preloadLaunchAssets({ fighterFrames: ["frame"], staticImages: [] }, factory)).resolves.toBeDefined();
  expect(factory).toHaveBeenCalledTimes(2);
});

it("rejects after the retry also fails", async () => {
  const factory = vi.fn(() => ({ src: "", decode: vi.fn().mockRejectedValue(new Error("missing")) }));
  await expect(preloadLaunchAssets({ fighterFrames: ["frame"], staticImages: [] }, factory)).rejects.toThrow("missing");
  expect(factory).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 5: Implement decode gating with exactly one retry**

Add private `decodeImage` and public `preloadLaunchAssets` implementations. Set `src` before calling `decode()`, create a fresh image for the retry, load all assets concurrently, and rebuild the two output collections in manifest order:

```ts
async function decodeImage(src: string, imageFactory: LaunchImageFactory): Promise<HTMLImageElement> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const image = imageFactory();
    image.src = src;
    try {
      await image.decode();
      return image;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Unable to decode launch asset: ${src}`);
}

export async function preloadLaunchAssets(
  manifest: LaunchAssetManifest,
  imageFactory: LaunchImageFactory = () => new Image()
): Promise<DecodedLaunchAssets> {
  const [fighterFrames, decodedStaticImages] = await Promise.all([
    Promise.all(manifest.fighterFrames.map((src) => decodeImage(src, imageFactory))),
    Promise.all(manifest.staticImages.map(async (src) => [src, await decodeImage(src, imageFactory)] as const))
  ]);
  return { fighterFrames, staticImages: new Map(decodedStaticImages) };
}
```

- [ ] **Step 6: Run focused tests and commit**

Run: `npm.cmd test -- src/launchAnimation.test.ts src/utils.test.ts`

Expected: both files PASS with no unhandled promise rejection.

Commit only the Task 1 files:

```powershell
git add -- src/launchAnimation.ts src/launchAnimation.test.ts src/utils.ts src/utils.test.ts
git commit -m "feat: buffer intro animation assets"
```

---

### Task 2: Canvas-Backed Fighter Renderer

**Files:**
- Create: `src/LaunchFighterCanvas.tsx`
- Create: `src/LaunchFighterCanvas.test.tsx`

**Interfaces:**
- Consumes: `DecodedLaunchAssets.fighterFrames` and `getFighterFrameIndex(elapsedMs, frameCount)` from Task 1.
- Produces: `LaunchFighterCanvas({ frames, elapsedMs, visible })`.

- [ ] **Step 1: Write failing canvas behavior tests**

Create a Testing Library test that stubs `HTMLCanvasElement.prototype.getContext`, passes two decoded image objects, rerenders from frame 0 to frame 1, and verifies `drawImage` without any `clearRect` call between valid frames. Add a zero-frame case that renders safely without drawing:

```tsx
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaunchFighterCanvas } from "./LaunchFighterCanvas";

describe("LaunchFighterCanvas", () => {
  const drawImage = vi.fn();
  const clearRect = vi.fn();

  beforeEach(() => {
    drawImage.mockClear();
    clearRect.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage, clearRect } as unknown as CanvasRenderingContext2D);
  });

  it("draws decoded frames without blanking the previous valid frame", () => {
    const frames = [{ naturalWidth: 1036, naturalHeight: 419 }, { naturalWidth: 1036, naturalHeight: 419 }] as HTMLImageElement[];
    const { rerender } = render(<LaunchFighterCanvas frames={frames} elapsedMs={0} visible />);
    rerender(<LaunchFighterCanvas frames={frames} elapsedMs={1850} visible />);
    expect(drawImage).toHaveBeenNthCalledWith(1, frames[0], 0, 0, 1036, 419);
    expect(drawImage).toHaveBeenLastCalledWith(frames[1], 0, 0, 1036, 419);
    expect(clearRect).not.toHaveBeenCalled();
  });

  it("renders a decorative empty canvas safely before frames exist", () => {
    const { container } = render(<LaunchFighterCanvas frames={[]} elapsedMs={0} visible={false} />);
    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
    expect(drawImage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm.cmd test -- src/LaunchFighterCanvas.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the canvas renderer**

Create a fixed-intrinsic-size canvas, use `useLayoutEffect`, choose the frame with `getFighterFrameIndex`, and draw only when a valid frame and 2D context exist:

```tsx
import { useLayoutEffect, useRef } from "react";
import { getFighterFrameIndex } from "./launchAnimation";

type LaunchFighterCanvasProps = {
  frames: HTMLImageElement[];
  elapsedMs: number;
  visible: boolean;
};

export function LaunchFighterCanvas({ frames, elapsedMs, visible }: LaunchFighterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (!frames.length) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const frame = frames[getFighterFrameIndex(elapsedMs, frames.length)];
    if (!canvas || !context || !frame) return;
    context.drawImage(frame, 0, 0, canvas.width, canvas.height);
  }, [elapsedMs, frames]);

  return (
    <canvas
      ref={canvasRef}
      className={`launch-fighter-canvas${visible ? " is-visible" : ""}`}
      width={1036}
      height={419}
      aria-hidden="true"
    />
  );
}
```

- [ ] **Step 4: Run focused tests and commit**

Run: `npm.cmd test -- src/LaunchFighterCanvas.test.tsx src/launchAnimation.test.ts`

Expected: PASS.

```powershell
git add -- src/LaunchFighterCanvas.tsx src/LaunchFighterCanvas.test.tsx
git commit -m "feat: render intro fighter from decoded frames"
```

---

### Task 3: Phase-Driven Launch Component and Safe Fallback

**Files:**
- Create: `src/LaunchLogoAnimation.tsx`
- Create: `src/LaunchLogoAnimation.test.tsx`
- Modify: `src/App.tsx:120-318`
- Modify: `src/App.test.tsx:2548-2572, 3188-3240`

**Interfaces:**
- Consumes: all Task 1 launch contracts, `LaunchFighterCanvas`, and `publicAsset`.
- Produces: `LaunchLogoAnimation({ reducedMotion, onPhaseChange, onComplete })` and phase callbacks consumed by `App`.

- [ ] **Step 1: Write failing sequence integration tests**

Mock `preloadLaunchAssets` and `requestAnimationFrame`. Assert the initial loading phase, no canvas before decode resolves, exact phase callback order, completion only at `completeAt`, and the presence of the accessible loading label. Add rejection coverage asserting `.is-fallback`, absence of the fighter canvas, and eventual completion. Add reduced-motion coverage asserting no preloader call and prompt completion through the static composition.

Use this prop contract in the tests:

```tsx
<LaunchLogoAnimation
  reducedMotion={false}
  onPhaseChange={onPhaseChange}
  onComplete={onComplete}
/>
```

The phase callback assertion must be:

```ts
expect(onPhaseChange.mock.calls.map(([phase]) => phase)).toEqual([
  "loading",
  "fighter",
  "impact",
  "logo",
  "handoff",
  "complete"
]);
```

- [ ] **Step 2: Run the integration test and verify it fails**

Run: `npm.cmd test -- src/LaunchLogoAnimation.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement readiness and the single animation clock**

Create `src/LaunchLogoAnimation.tsx`. On mount, emit `loading`. For normal motion, call `preloadLaunchAssets(createLaunchAssetManifest(publicAsset))`. Only after it resolves, record `performance.now()`, emit `fighter`, and run one `requestAnimationFrame` loop. Derive every later phase through `getLaunchPhase(elapsedMs)`, update elapsed time, and emit a phase only when it changes. On `complete`, cancel the loop and call `onComplete` once. Use an effect cancellation flag so an unmounted preload cannot update state.

For reduced motion, render the reduced static composition, emit `handoff`, then `complete` after 320ms without loading fighter frames. For rejected preload, emit `fallback`, render the atmospheric logo composition for 900ms, emit `handoff`, and finish after another 520ms.

Render this stable layer structure so CSS and tests have explicit targets:

```tsx
<section className={`launch-loader is-${phase}`} data-launch-phase={phase} aria-label="Cho's Martial Arts loading animation">
  <div className="launch-screen-backdrop" aria-hidden="true" />
  <div className="launch-environment-pulse" aria-hidden="true" />
  <div className="launch-stage" aria-hidden="true">
    <div className="launch-stage-haze" />
    <div className="launch-floor-glow" />
    <div className="launch-fighter-shadow" />
    <LaunchFighterCanvas frames={assets?.fighterFrames ?? []} elapsedMs={elapsedMs} visible={phase === "fighter" || phase === "impact"} />
    <div className="launch-impact-flash" />
    <div className="launch-impact-shockwave" />
    <div className="launch-impact-particles" />
    <div className="launch-logo-aura" />
  </div>
</section>
```

- [ ] **Step 4: Integrate phase state into the login gate**

In `App`, retain `usePrefersReducedMotion` as the single media-query source, replace `launchComplete` with `launchPhase`, and derive completion:

```tsx
const prefersReducedMotion = usePrefersReducedMotion();
const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("loading");
const launchComplete = launchPhase === "complete";
```

Change `AuthLaunchLogo` to receive `phase: LaunchPhase` and emit phase classes instead of starting on mount:

```tsx
function AuthLaunchLogo({ phase }: { phase: LaunchPhase }) {
  return (
    <img
      className={`auth-logo is-${phase}`}
      src={publicAsset("682e95109aa21_chos-logo.png")}
      alt="Cho's Martial Arts"
    />
  );
}
```

Pass `handoffActive={launchPhase === "handoff"}` and `interactive={launchComplete}` to `LoginLandingPage`. Keep the launch component mounted until it reports complete:

```tsx
{!launchComplete && (
  <LaunchLogoAnimation
    reducedMotion={prefersReducedMotion}
    onPhaseChange={setLaunchPhase}
    onComplete={() => setLaunchPhase("complete")}
  />
)}
```

Remove the old `LaunchLogoAnimation`, per-frame React `img` source swap, duplicate reduced-motion query, independent reveal timer, and independent completion timer from `App.tsx`.

- [ ] **Step 5: Update App tests for decoded readiness**

Mock the launch preloader in `App.test.tsx` so normal login tests resolve immediately with decoded fake frames. Replace the hard-coded `3050ms` expectation with phase completion at `LAUNCH_TIMELINE.completeAt`. Add a deferred-preload test proving the landing stays inert even after advancing timers while decode is unresolved, then becomes interactive only after resolving assets and advancing the full shared timeline.

- [ ] **Step 6: Run focused integration tests and commit**

Run: `npm.cmd test -- src/launchAnimation.test.ts src/LaunchFighterCanvas.test.tsx src/LaunchLogoAnimation.test.tsx src/App.test.tsx`

Expected: PASS with no React act warnings introduced by the launch clock.

```powershell
git add -- src/LaunchLogoAnimation.tsx src/LaunchLogoAnimation.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: synchronize premium intro phases"
```

---

### Task 4: Premium Cinematic Styling and Responsive Handoff

**Files:**
- Modify: `src/styles.css:2300-2585, 3025-3150`
- Modify: `src/LaunchLogoAnimation.test.tsx`
- Modify: `e2e/login-portrait-motion.spec.ts`

**Interfaces:**
- Consumes: `.is-loading`, `.is-fighter`, `.is-impact`, `.is-logo`, `.is-handoff`, `.is-fallback`, and the layer classes from Task 3.
- Produces: the final responsive visual choreography and browser-observable `data-launch-phase` sequence.

- [ ] **Step 1: Add failing structural assertions for premium layers**

Extend `src/LaunchLogoAnimation.test.tsx` to require `.launch-fighter-shadow`, `.launch-impact-shockwave`, `.launch-impact-particles`, and `.launch-environment-pulse`, all inside the accessible launch section and all `aria-hidden` through their decorative ancestry.

Run: `npm.cmd test -- src/LaunchLogoAnimation.test.tsx`

Expected: FAIL until every required layer is present.

- [ ] **Step 2: Replace mount-driven CSS with phase-scoped choreography**

Update `src/styles.css` so loading is a composed atmospheric hold, fighter effects begin only under `.is-fighter`, impact effects begin only under `.is-impact`, the logo journey begins only under `.auth-logo.is-logo`, and login controls begin only when `.login-landing.is-handoff` is added. Remove the `2640ms` login-control delay and the old always-running 3000ms layer animations.

Use scoped keyframes with these visual behaviors:

- `launchFighterPresence`: crisp 0-to-1 entrance, stable presence, then bright impact fade.
- `launchImpactShockwave`: border ring from scale `.18` to `2.8` while opacity falls from `.9` to `0` within `620ms`.
- `launchImpactParticles`: a masked radial/conic field with short outward translation and complete fade within `700ms`.
- `launchEnvironmentPulse`: one restrained full-stage brightness pulse under `420ms`.
- `launchLogoJourney`: centered luminous reveal, controlled overshoot no greater than `1.06`, then final transform using `--auth-logo-final-center-y` and `--auth-logo-final-scale`.
- `launchFallbackLogo`: centered fade/scale reveal followed by the same final logo transform.

The canvas must use `position:absolute; inset:0; width:100%; height:100%; object-fit:contain` behavior through its intrinsic aspect ratio. Keep all expensive filters on bounded stage layers, not the full viewport. Add a `@media (prefers-reduced-motion: reduce)` rule that removes impact motion and leaves the final composition visible.

- [ ] **Step 3: Add browser phase-order and blank-frame protection**

Extend `e2e/login-portrait-motion.spec.ts` with a test that observes `data-launch-phase`, reloads three times with normal motion, and requires the ordered subsequence `fighter, impact, logo, handoff` before the loader disappears. During fighter/impact phases, sample the canvas with `getImageData` and require at least one nontransparent pixel. After completion, require the settled logo and interactive login landing.

The test must also retain the existing assertions that the portrait does not move or scale and that reduced motion renders the settled portrait promptly.

- [ ] **Step 4: Run component, browser, and production checks**

Run:

```powershell
npm.cmd test -- src/LaunchLogoAnimation.test.tsx src/App.test.tsx
npx.cmd playwright test e2e/login-portrait-motion.spec.ts --project=chromium-phone --project=chromium-desktop
npm.cmd run build
```

Expected: all commands exit 0; the Playwright test sees every required phase on all repeated launches and never samples a blank active fighter canvas.

- [ ] **Step 5: Commit the visual choreography**

```powershell
git add -- src/styles.css src/LaunchLogoAnimation.test.tsx e2e/login-portrait-motion.spec.ts
git commit -m "style: elevate intro cinematic choreography"
```

---

### Task 5: Full Quality Pass and Rendered Evidence

**Files:**
- Modify only if a finding requires a focused fix: files from Tasks 1-4.
- Do not commit screenshots, traces, Playwright reports, or temporary scripts.

**Interfaces:**
- Consumes: the completed premium intro.
- Produces: verified implementation commits and a concise QA handoff.

- [ ] **Step 1: Run the complete automated verification ladder**

Run:

```powershell
npm.cmd test
npm.cmd run build:pages
npm.cmd audit --audit-level=moderate
git diff --check d73074b..HEAD
```

Expected: Vitest passes, the Pages build exits 0 and creates `dist/404.html`, audit reports no moderate-or-higher vulnerability, and diff check prints nothing.

- [ ] **Step 2: Run real rendered QA through the available Browser plugin**

Start the exact local target if it is not already running:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Using the Browser plugin, verify `http://127.0.0.1:5173/` at desktop and phone viewports. Confirm page identity, meaningful content, no framework overlay, no relevant console errors, all visible intro phases, stable final logo placement, and successful username-field focus only after completion. Capture screenshots for fighter, impact/logo, and settled login states outside the repo.

- [ ] **Step 3: Exercise slow and failure conditions**

Use Browser request interception or the Playwright test path to delay roundhouse PNG responses on a cold load. Verify the app holds the atmospheric loading composition and does not start the fighter early. Abort one frame response twice and verify the fallback completes and unlocks login without a broken frame or console-level application error.

- [ ] **Step 4: Review the final diff and fix findings**

Inspect `git diff d73074b..HEAD` for duplicated timers, stale old animation classes, unbounded filters, inaccessible decorative content, asset paths that bypass `publicAsset`, and unrelated changes. Make only focused corrections, rerun the affected focused tests, and stage only the known intro-animation files; unchanged paths are harmless when passed to `git add`:

```powershell
git add -- src/launchAnimation.ts src/launchAnimation.test.ts src/LaunchFighterCanvas.tsx src/LaunchFighterCanvas.test.tsx src/LaunchLogoAnimation.tsx src/LaunchLogoAnimation.test.tsx src/App.tsx src/App.test.tsx src/utils.ts src/utils.test.ts src/styles.css e2e/login-portrait-motion.spec.ts
git commit -m "fix: harden intro animation verification"
```

- [ ] **Step 5: Record the final exact result**

Report the local URL, tested viewports, repeated-load count, cold/slow/failure behavior, Vitest result, Pages build result, audit result, final commit IDs, and any untested browser limitation. State explicitly whether the intro works normally and whether the user must do anything.

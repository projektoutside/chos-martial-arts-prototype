/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src", "styles.css"), "utf8");

function ruleBody(selector: string) {
  const start = styles.indexOf(selector);
  expect(start, `Expected ${selector} in styles.css`).toBeGreaterThanOrEqual(0);
  const bodyStart = styles.indexOf("{", start);
  const bodyEnd = styles.indexOf("}", bodyStart);
  return styles.slice(bodyStart + 1, bodyEnd);
}

function keyframesBody(name: string) {
  const start = styles.indexOf(`@keyframes ${name}`);
  expect(start, `Expected @keyframes ${name} in styles.css`).toBeGreaterThanOrEqual(0);
  const nextKeyframes = styles.indexOf("@keyframes", start + 1);
  const mediaBoundary = styles.indexOf("@media", start + 1);
  const candidates = [nextKeyframes, mediaBoundary].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : styles.length;
  return styles.slice(start, end);
}

describe("login portrait cinematic motion", () => {
  it("reveals at final size and position without rising, zooming, or overshooting", () => {
    const handoff = ruleBody(".login-landing.is-handoff .login-portrait-stage");
    const keyframes = keyframesBody("loginPortraitHandoff");
    const finalTransform = "translate3d(-50%, -50%, 0) scale(1)";

    expect(handoff).toContain("animation: loginPortraitHandoff 780ms");
    expect(handoff).toContain("2200ms both");
    expect(keyframes.match(new RegExp(finalTransform.replace(/[()]/g, "\\$&"), "g"))).toHaveLength(3);
    expect(keyframes).not.toContain("-44%");
    expect(keyframes).not.toContain("scale(0.96)");
    expect(keyframes).not.toContain("scale(1.018)");
  });

  it("fades from a dark soft exposure into the configured final artwork", () => {
    const keyframes = keyframesBody("loginPortraitHandoff");

    expect(keyframes).toContain("opacity: 0");
    expect(keyframes).toContain("brightness(0.28)");
    expect(keyframes).toContain("blur(3px)");
    expect(keyframes).toContain("opacity: var(--login-portrait-opacity)");
    expect(keyframes).toContain("brightness(1)");
    expect(keyframes).toContain("blur(0)");
  });

  it("shows the final clear portrait immediately for reduced motion", () => {
    const mediaStart = styles.indexOf("@media (prefers-reduced-motion: reduce)");
    const mediaEnd = styles.indexOf("@media", mediaStart + 1);
    const reducedMotion = styles.slice(mediaStart, mediaEnd);
    const reducedPortrait = reducedMotion.match(
      /\.login-landing\.is-handoff \.login-portrait-stage\s*\{([^}]*)\}/
    )?.[1];

    expect(reducedPortrait).toContain("opacity: var(--login-portrait-opacity)");
    expect(reducedPortrait).toContain("translate3d(-50%, -50%, 0) scale(1)");
    expect(reducedPortrait).toContain("filter: none");
  });
});

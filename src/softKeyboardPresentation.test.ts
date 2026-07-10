/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type StyleRule = {
  selectors: string;
  declarations: Map<string, string>;
};

function parseStyleRules(source: string): StyleRule[] {
  const uncommentedSource = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return Array.from(uncommentedSource.matchAll(/([^{}]+)\{([^{}]*)\}/g), ([, selectors, body]) => ({
    selectors: selectors.trim(),
    declarations: new Map(
      Array.from(body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g), ([, property, value]) => [property.trim(), value.trim()])
    )
  }));
}

const styleRules = parseStyleRules(readFileSync(resolve(process.cwd(), "src", "styles.css"), "utf8"));
const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

function ruleContaining(...selectors: string[]) {
  const rule = styleRules.find((candidate) => selectors.every((selector) => candidate.selectors.includes(selector)));
  expect(rule, `Expected a CSS rule containing ${selectors.join(", ")}`).toBeDefined();
  return rule!;
}

function ruleFor(selector: string) {
  const rule = styleRules.find((candidate) => candidate.selectors === selector);
  expect(rule, `Expected a CSS rule for ${selector}`).toBeDefined();
  return rule!;
}

describe("soft keyboard presentation", () => {
  it("keeps portrait geometry stable while respecting shared safe areas", () => {
    const root = ruleFor(":root").declarations;
    const portraitShell = ruleFor(".portrait-app-shell").declarations;

    expect(root.get("--cho-safe-area-top")).toBe("var(--safe-area-inset-top, env(safe-area-inset-top, 0px))");
    expect(root.get("--cho-safe-area-right")).toBe("var(--safe-area-inset-right, env(safe-area-inset-right, 0px))");
    expect(root.get("--cho-safe-area-bottom")).toBe("var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))");
    expect(root.get("--cho-safe-area-left")).toBe("var(--safe-area-inset-left, env(safe-area-inset-left, 0px))");
    expect(root.get("--app-keyboard-inset")).toBe("0px");
    expect(portraitShell.get("--portrait-frame-landscape-width")).toEqual(expect.stringContaining("--app-stable-frame-width"));
    expect(portraitShell.get("height")).toContain("--app-stable-viewport-height");
    expect(portraitShell.get("padding")).toBe("0");
  });

  it("keeps app chrome unchanged while only the keyboard editor follows the visible viewport", () => {
    const selectors = styleRules.map((rule) => rule.selectors);
    const layer = ruleFor(".soft-keyboard-editor-layer").declarations;
    const backdrop = ruleFor(".soft-keyboard-editor-backdrop").declarations;
    const surface = ruleFor(".soft-keyboard-editor-surface").declarations;

    expect(selectors.some((selector) => selector.includes('html[data-soft-keyboard="open"] .portrait-app-shell'))).toBe(false);
    expect(selectors.some((selector) => selector.includes('data-keyboard-secondary-navigation="true"'))).toBe(false);
    expect(selectors.some((selector) => selector.includes(".mobile-tabbar") && selector.includes('data-soft-keyboard="open"'))).toBe(false);
    expect(selectors.some((selector) => selector.includes(".operations-footer") && selector.includes('data-soft-keyboard="open"'))).toBe(false);
    expect(layer.get("position")).toBe("fixed");
    expect(layer.get("inset")).toBe("0");
    expect(backdrop.get("position")).toBe("absolute");
    expect(backdrop.get("inset")).toBe("0");
    expect(backdrop.get("backdrop-filter")).toContain("blur");
    expect(surface.get("position")).toBe("fixed");
    expect(surface.get("top")).toContain("--soft-keyboard-editor-top");
    expect(surface.get("transform")).toBe("translateY(-50%)");
  });

  it("keeps touch editors readable without treating selects as typing controls", () => {
    const touchInputs = ruleContaining(
      'html[data-touch-input="true"] :is(',
      'input:not([type="button"])',
      "textarea",
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[role="textbox"]'
    ).declarations;
    const editorInputs = ruleContaining(
      ".soft-keyboard-editor-layer [data-soft-keyboard-editor-control]"
    ).declarations;

    expect(touchInputs.get("font-size")).toBe("max(16px, 1em) !important");
    expect(editorInputs.get("font-size")).toBe("max(16px, 1em) !important");
  });

  it("allows long mobile paragraphs to scroll vertically inside the editor", () => {
    const textarea = ruleFor(
      ".soft-keyboard-editor-layer textarea[data-soft-keyboard-editor-control]"
    ).declarations;

    expect(textarea.get("touch-action")).toBe("pan-y");
    expect(textarea.get("overscroll-behavior-y")).toBe("contain");
    expect(textarea.get("-webkit-overflow-scrolling")).toBe("touch");
  });

  it("requests overlay keyboard behavior where the browser supports it", () => {
    expect(indexHtml).toContain("interactive-widget=overlays-content");
  });
});

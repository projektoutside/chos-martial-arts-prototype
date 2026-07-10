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
    expect(portraitShell.get("padding")).toBe("var(--cho-safe-area-top) 0 var(--cho-safe-area-bottom)");
  });

  it("uses the visible keyboard viewport and removes only secondary navigation chrome", () => {
    const selectors = styleRules.map((rule) => rule.selectors);
    const shell = ruleContaining('html[data-soft-keyboard="open"] .portrait-app-shell').declarations;
    const managerLayout = ruleFor('html[data-soft-keyboard="open"] [data-keyboard-secondary-navigation-layout="true"]').declarations;
    const hiddenChrome = ruleContaining(
      'html[data-soft-keyboard="open"] [data-keyboard-secondary-navigation="true"]',
      'html[data-soft-keyboard="open"] .mobile-tabbar',
      'html[data-soft-keyboard="open"] .operations-footer'
    ).declarations;
    const managerBody = ruleFor('html[data-soft-keyboard="open"] [data-keyboard-secondary-navigation-layout="true"] .manager-launcher-body').declarations;

    expect(shell.get("height")).toContain("--app-visible-viewport-height");
    expect(managerLayout.get("--manager-launcher-sidebar-track-width")).toBe("0px");
    expect(managerLayout.get("--manager-launcher-rail-hit-width")).toBe("0px");
    expect(selectors).not.toContain('html[data-soft-keyboard="open"] .manager-launcher-main');
    expect(selectors).not.toContain('html[data-soft-keyboard="open"] .manager-launcher-body');
    expect(hiddenChrome.get("display")).toBe("none !important");
    expect(managerBody.get("padding-right")).toBe("0");
  });

  it("keeps touch text inputs readable and revealable above the keyboard", () => {
    const keyboardInputs = ruleContaining(
      'html[data-soft-keyboard="open"] :is(',
      'input:not([type="button"])',
      "textarea",
      "select",
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[role="textbox"]'
    ).declarations;
    const touchInputs = ruleContaining(
      'html[data-touch-input="true"] :is(',
      'input:not([type="button"])',
      "textarea",
      "select",
      '[contenteditable="true"]',
      '[contenteditable=""]',
      '[role="textbox"]'
    ).declarations;

    expect(keyboardInputs.get("scroll-margin-block")).toBe("12px 24px");
    expect(touchInputs.get("font-size")).toBe("max(16px, 1em) !important");
  });
});

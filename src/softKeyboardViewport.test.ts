import "@testing-library/jest-dom/vitest";
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

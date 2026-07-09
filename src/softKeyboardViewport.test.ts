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
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    });
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
    Object.defineProperty(window, "scrollBy", {
      configurable: true,
      value: vi.fn()
    });
    Object.defineProperty(document, "scrollingElement", {
      configurable: true,
      value: null
    });
    Object.defineProperty(document.documentElement, "scrollBy", {
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

  it("leaves hardware-keyboard focus out of soft-keyboard presentation", () => {
    Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: 0 });
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    input.focus();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement).not.toHaveAttribute("data-touch-input");
    vi.runAllTimers();
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
  });

  it("treats a focused non-touch desktop resize as layout instead of a keyboard", () => {
    Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: 0 });
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    input.focus();
    viewport.height = 700;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 700 });
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("700px");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("0px");
  });

  it("retains the pre-keyboard baseline while the IME close animation is still compressed", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    input.focus();
    viewport.height = 500;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement.dataset.softKeyboard).toBe("open");

    input.blur();
    vi.runAllTimers();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("844px");
    expect(document.documentElement.style.getPropertyValue("--app-stable-frame-width")).toBe("474.75px");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("0px");

    viewport.height = 844;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("844px");
  });

  it("uses the document scrolling element when no nested scroll container can reveal the field", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const rootScrollBy = document.documentElement.scrollBy as ReturnType<typeof vi.fn>;
    Object.defineProperty(document, "scrollingElement", {
      configurable: true,
      value: document.documentElement
    });
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
      top: 490,
      bottom: 520,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      x: 0,
      y: 490,
      toJSON: () => ({})
    });
    cleanup = installSoftKeyboardViewportController(window, document);

    input.focus();
    viewport.height = 500;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(rootScrollBy).toHaveBeenCalledWith({ top: 32, behavior: "auto" });
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it("finishes with 12px of visible-viewport clearance through the window fallback", () => {
    const input = document.createElement("input");
    document.body.append(input);
    let documentScrollTop = 0;
    vi.spyOn(input, "getBoundingClientRect").mockImplementation(() => ({
      top: 480 - documentScrollTop,
      bottom: 510 - documentScrollTop,
      left: 0,
      right: 100,
      width: 100,
      height: 30,
      x: 0,
      y: 480 - documentScrollTop,
      toJSON: () => ({})
    }));
    const windowScrollBy = vi.fn((options: ScrollToOptions) => {
      documentScrollTop += options.top ?? 0;
    });
    Object.defineProperty(window, "scrollBy", {
      configurable: true,
      value: windowScrollBy
    });
    cleanup = installSoftKeyboardViewportController(window, document);

    input.focus();
    viewport.height = 500;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(windowScrollBy).toHaveBeenCalledWith({ top: 22, behavior: "auto" });
    expect(input.getBoundingClientRect().bottom).toBe(488);
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

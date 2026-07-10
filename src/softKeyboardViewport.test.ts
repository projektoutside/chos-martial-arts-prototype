import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifySoftKeyboardViewport,
  installSoftKeyboardViewportController,
  isKeyboardEditableTarget,
  isSoftKeyboardLayoutActive
} from "./softKeyboardViewport";

class VisualViewportStub extends EventTarget {
  height = 844;
  offsetTop = 0;
  scale = 1;
  width = 390;
}

function dispatchPointerDown(target: EventTarget, pointerType: "mouse" | "pen" | "touch") {
  const event = new Event("pointerdown", { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  target.dispatchEvent(event);
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
    const readonly = document.createElement("input");
    readonly.readOnly = true;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const date = document.createElement("input");
    date.type = "date";
    const number = document.createElement("input");
    number.type = "number";
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const textbox = document.createElement("div");
    textbox.setAttribute("role", "textbox");
    const ariaReadonlyTextbox = document.createElement("div");
    ariaReadonlyTextbox.setAttribute("role", "textbox");
    ariaReadonlyTextbox.setAttribute("aria-readonly", "true");

    expect(isKeyboardEditableTarget(text)).toBe(true);
    expect(isKeyboardEditableTarget(textarea)).toBe(true);
    expect(isKeyboardEditableTarget(textbox)).toBe(true);
    expect(isKeyboardEditableTarget(select)).toBe(false);
    expect(isKeyboardEditableTarget(readonly)).toBe(false);
    expect(isKeyboardEditableTarget(ariaReadonlyTextbox)).toBe(false);
    expect(isKeyboardEditableTarget(checkbox)).toBe(false);
    expect(isKeyboardEditableTarget(date)).toBe(false);
    expect(isKeyboardEditableTarget(number)).toBe(true);
  });

  it("treats the mirrored editor as active keyboard layout state", () => {
    document.documentElement.dataset.softKeyboardEditor = "open";
    expect(isSoftKeyboardLayoutActive(document)).toBe(true);
    delete document.documentElement.dataset.softKeyboardEditor;
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

  it("requests virtual-keyboard overlay mode and restores the previous setting on cleanup", () => {
    const virtualKeyboard = { overlaysContent: false };
    Object.defineProperty(window.navigator, "virtualKeyboard", {
      configurable: true,
      value: virtualKeyboard
    });

    cleanup = installSoftKeyboardViewportController(window, document);
    expect(virtualKeyboard.overlaysContent).toBe(true);

    cleanup();
    cleanup = undefined;
    expect(virtualKeyboard.overlaysContent).toBe(false);
  });

  it("freezes frame geometry and exposes keyboard state without moving the focused field", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(input, "touch");
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
    expect(input.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollBy).not.toHaveBeenCalled();

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

  it("keeps keyboard and Tab focus unchanged on a touch-capable hybrid", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    input.focus();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    viewport.height = 700;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 700 });
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("0px");
  });

  it("keeps mouse focus and ordinary resize unchanged on a touch-capable hybrid", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(input, "mouse");
    input.focus();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    viewport.height = 700;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 700 });
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("700px");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("0px");
  });

  it.each(["touch", "pen"] as const)("opens after %s focus and qualifying layout viewport loss", (pointerType) => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(input, pointerType);
    input.focus();
    expect(document.documentElement.dataset.softKeyboard).toBe("opening");

    viewport.height = 500;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(document.documentElement.dataset.softKeyboard).toBe("open");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("344px");
  });

  it("retains touch modality through delayed native focus sequencing", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(input, "touch");
    vi.advanceTimersByTime(50);
    input.focus();

    expect(document.documentElement.dataset.softKeyboard).toBe("opening");
  });

  it("uses visual-only occlusion as a software-keyboard fallback after programmatic focus", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    input.focus();
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");

    viewport.height = 500;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(document.documentElement.dataset.softKeyboard).toBe("open");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("344px");
  });

  it("clears a verified session after Android Back restores the viewport without blur", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(input, "touch");
    input.focus();
    viewport.height = 500;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement.dataset.softKeyboard).toBe("open");

    viewport.height = 844;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.activeElement).toBe(input);
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");

    viewport.height = 700;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 700 });
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("700px");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("0px");
  });

  it.each(["touch", "pen"] as const)(
    "reopens after Android Back when %s re-taps the still-focused input without focusin",
    (pointerType) => {
      const input = document.createElement("input");
      document.body.append(input);
      cleanup = installSoftKeyboardViewportController(window, document);

      dispatchPointerDown(input, pointerType);
      input.focus();
      viewport.height = 500;
      Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
      viewport.dispatchEvent(new Event("resize"));
      vi.runAllTimers();
      expect(document.documentElement.dataset.softKeyboard).toBe("open");

      viewport.height = 844;
      Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
      viewport.dispatchEvent(new Event("resize"));
      vi.runAllTimers();
      expect(document.activeElement).toBe(input);
      expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");

      dispatchPointerDown(input, pointerType);
      expect(document.activeElement).toBe(input);
      expect(document.documentElement.dataset.softKeyboard).toBe("opening");

      viewport.height = 500;
      Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
      viewport.dispatchEvent(new Event("resize"));
      vi.runAllTimers();

      expect(document.documentElement.dataset.softKeyboard).toBe("open");
      expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("844px");
      expect(document.documentElement.style.getPropertyValue("--app-stable-frame-width")).toBe("474.75px");
      expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("344px");
    }
  );

  it("keeps a verified layout-resize keyboard session open across editable focus transfer", () => {
    const first = document.createElement("input");
    const second = document.createElement("input");
    document.body.append(first, second);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(first, "touch");
    first.focus();
    viewport.height = 500;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement.dataset.softKeyboard).toBe("open");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    second.focus();
    vi.runAllTimers();

    expect(document.activeElement).toBe(second);
    expect(document.documentElement.dataset.softKeyboard).toBe("open");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("844px");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("344px");
  });

  it("retains the pre-keyboard baseline while the IME close animation is still compressed", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(input, "touch");
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

  it("preserves the exact pre-keyboard frame when close restoration overshoots", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(input, "touch");
    input.focus();
    viewport.height = 500;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement.dataset.softKeyboard).toBe("open");

    input.blur();
    viewport.height = 860;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 860 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("844px");
    expect(document.documentElement.style.getPropertyValue("--app-stable-frame-width")).toBe("474.75px");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("0px");
  });

  it("unlocks an overshoot hold after settle so a later ordinary resize can set the baseline", () => {
    const input = document.createElement("input");
    document.body.append(input);
    cleanup = installSoftKeyboardViewportController(window, document);

    dispatchPointerDown(input, "touch");
    input.focus();
    viewport.height = 500;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement.dataset.softKeyboard).toBe("open");

    input.blur();
    viewport.height = 860;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 860 });
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("844px");
    expect(document.documentElement.style.getPropertyValue("--app-stable-frame-width")).toBe("474.75px");

    viewport.height = 700;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 700 });
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard");
    expect(document.documentElement.style.getPropertyValue("--app-stable-viewport-height")).toBe("700px");
    expect(document.documentElement.style.getPropertyValue("--app-stable-frame-width")).toBe("393.75px");
    expect(document.documentElement.style.getPropertyValue("--app-keyboard-inset")).toBe("0px");
  });

  it("never scrolls the document or window to reveal a keyboard-focused field", () => {
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

    expect(rootScrollBy).not.toHaveBeenCalled();
    expect(window.scrollBy).not.toHaveBeenCalled();
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

import { useEffect } from "react";

export const SOFT_KEYBOARD_CHANGE_EVENT = "cho:soft-keyboard-change";
export const SOFT_KEYBOARD_MIN_INSET_PX = 120;
export const SOFT_KEYBOARD_MIN_INSET_RATIO = 0.15;

const nonTextInputTypes = new Set([
  "button", "checkbox", "color", "file", "hidden", "image",
  "radio", "range", "reset", "submit"
]);

export type SoftKeyboardViewportInput = {
  stableHeight: number;
  visibleHeight: number;
  offsetTop: number;
  scale: number;
  hasEditableFocus: boolean;
};

export type SoftKeyboardViewportState = {
  isOpen: boolean;
  keyboardInset: number;
};

function isHTMLElement(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement;
}

function isTouchInputCapable(win: Window) {
  return win.navigator.maxTouchPoints > 0 || Boolean(win.matchMedia?.("(pointer: coarse)")?.matches);
}

export function isKeyboardEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (!isHTMLElement(target)) return false;
  if (target.matches(":disabled, [aria-disabled='true']")) return false;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !nonTextInputTypes.has(target.type.toLowerCase());
  return target.isContentEditable || target.getAttribute("role") === "textbox";
}

export function classifySoftKeyboardViewport(input: SoftKeyboardViewportInput): SoftKeyboardViewportState {
  const visibleBottom = input.visibleHeight + Math.max(0, input.offsetTop);
  const rawInset = Math.max(0, Math.round(input.stableHeight - visibleBottom));
  const threshold = Math.max(SOFT_KEYBOARD_MIN_INSET_PX, Math.round(input.stableHeight * SOFT_KEYBOARD_MIN_INSET_RATIO));
  const isOpen = input.hasEditableFocus && input.scale <= 1.05 && rawInset >= threshold;
  return { isOpen, keyboardInset: isOpen ? rawInset : 0 };
}

export function isSoftKeyboardLayoutActive(doc: Document = document) {
  return doc.documentElement.dataset.softKeyboard === "opening" || doc.documentElement.dataset.softKeyboard === "open";
}

function visualMetrics(win: Window) {
  const viewport = win.visualViewport;
  return {
    height: viewport?.height ?? win.innerHeight,
    offsetTop: viewport?.offsetTop ?? 0,
    scale: viewport?.scale ?? 1
  };
}

function nearestScrollContainer(element: HTMLElement, win: Window) {
  let current = element.parentElement;
  while (current && current !== element.ownerDocument.body) {
    const overflowY = win.getComputedStyle(current).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return undefined;
}

function scrollByViewportDelta(element: HTMLElement, win: Window, delta: number) {
  const options: ScrollToOptions = { top: delta, behavior: "auto" };
  const nestedScrollContainer = nearestScrollContainer(element, win);
  if (nestedScrollContainer) {
    nestedScrollContainer.scrollBy(options);
    return;
  }

  const scrollingElement = element.ownerDocument.scrollingElement;
  if (scrollingElement && typeof scrollingElement.scrollBy === "function") {
    scrollingElement.scrollBy(options);
    return;
  }

  win.scrollBy(options);
}

function revealFocusedElement(element: HTMLElement, win: Window) {
  element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  const viewport = visualMetrics(win);
  const rect = element.getBoundingClientRect();
  const topBoundary = viewport.offsetTop + 12;
  const bottomBoundary = viewport.offsetTop + viewport.height - 12;
  const delta = rect.bottom > bottomBoundary
    ? rect.bottom - bottomBoundary
    : rect.top < topBoundary
      ? rect.top - topBoundary
      : 0;
  if (!delta) return;
  scrollByViewportDelta(element, win, delta);
}

export function installSoftKeyboardViewportController(win: Window = window, doc: Document = document) {
  const root = doc.documentElement;
  const timers = new Set<number>();
  const touchInputCapable = isTouchInputCapable(win);
  let animationFrame = 0;
  let stableHeight = Math.max(win.innerHeight, visualMetrics(win).height);
  let lastOpen = false;
  let lastFocused: HTMLElement | null = null;
  let awaitingViewportRestore = false;

  const setTimer = (callback: () => void, delay: number) => {
    const timer = win.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };

  const dispatchState = (state: "open" | "closed") => {
    doc.dispatchEvent(new CustomEvent(SOFT_KEYBOARD_CHANGE_EVENT, { detail: { state } }));
  };

  const measure = () => {
    animationFrame = 0;
    const focused = isKeyboardEditableTarget(doc.activeElement) ? doc.activeElement : null;
    const viewport = visualMetrics(win);
    const layoutCandidate = Math.max(win.innerHeight, viewport.height + Math.max(0, viewport.offsetTop));
    if (!stableHeight) {
      stableHeight = layoutCandidate;
      awaitingViewportRestore = false;
    } else if (!touchInputCapable) {
      stableHeight = layoutCandidate;
      awaitingViewportRestore = false;
    } else if (awaitingViewportRestore) {
      if (layoutCandidate >= stableHeight - 1) {
        stableHeight = Math.max(stableHeight, layoutCandidate);
        awaitingViewportRestore = false;
      }
    } else if (!focused && !lastOpen) {
      stableHeight = layoutCandidate;
    }

    const state = classifySoftKeyboardViewport({
      stableHeight,
      visibleHeight: viewport.height,
      offsetTop: viewport.offsetTop,
      scale: viewport.scale,
      hasEditableFocus: touchInputCapable && Boolean(focused)
    });

    root.style.setProperty("--app-stable-viewport-height", `${stableHeight}px`);
    root.style.setProperty("--app-stable-frame-width", `${stableHeight * 0.5625}px`);
    root.style.setProperty("--app-visible-viewport-height", `${viewport.height}px`);
    root.style.setProperty("--app-keyboard-inset", `${state.keyboardInset}px`);

    if (state.isOpen) {
      awaitingViewportRestore = false;
      root.dataset.softKeyboard = "open";
      if (!lastOpen) dispatchState("open");
      if (!lastOpen || focused !== lastFocused) {
        setTimer(() => focused && revealFocusedElement(focused, win), 0);
        setTimer(() => focused && revealFocusedElement(focused, win), 180);
      }
    } else {
      if (lastOpen) awaitingViewportRestore = touchInputCapable && layoutCandidate < stableHeight - 1;
      if (root.dataset.softKeyboard === "open") {
        delete root.dataset.softKeyboard;
        dispatchState("closed");
      } else if (!focused) {
        delete root.dataset.softKeyboard;
      }
    }

    lastOpen = state.isOpen;
    lastFocused = focused;
  };

  const scheduleMeasure = () => {
    if (animationFrame) win.cancelAnimationFrame(animationFrame);
    animationFrame = win.requestAnimationFrame(measure);
  };

  const handleFocusIn = (event: FocusEvent) => {
    if (!touchInputCapable || !isKeyboardEditableTarget(event.target)) return;
    root.dataset.softKeyboard = "opening";
    scheduleMeasure();
    setTimer(scheduleMeasure, 80);
    setTimer(scheduleMeasure, 240);
    setTimer(() => {
      if (root.dataset.softKeyboard === "opening") delete root.dataset.softKeyboard;
    }, 420);
  };

  const handleFocusOut = () => {
    scheduleMeasure();
    setTimer(scheduleMeasure, 80);
    setTimer(scheduleMeasure, 240);
  };

  const handleOrientationChange = () => {
    stableHeight = 0;
    lastOpen = false;
    awaitingViewportRestore = false;
    delete root.dataset.softKeyboard;
    setTimer(scheduleMeasure, 220);
    setTimer(scheduleMeasure, 520);
  };

  if (touchInputCapable) {
    root.dataset.touchInput = "true";
  }

  doc.addEventListener("focusin", handleFocusIn);
  doc.addEventListener("focusout", handleFocusOut);
  win.addEventListener("resize", scheduleMeasure);
  win.addEventListener("orientationchange", handleOrientationChange);
  win.visualViewport?.addEventListener("resize", scheduleMeasure);
  win.visualViewport?.addEventListener("scroll", scheduleMeasure);
  measure();

  return () => {
    doc.removeEventListener("focusin", handleFocusIn);
    doc.removeEventListener("focusout", handleFocusOut);
    win.removeEventListener("resize", scheduleMeasure);
    win.removeEventListener("orientationchange", handleOrientationChange);
    win.visualViewport?.removeEventListener("resize", scheduleMeasure);
    win.visualViewport?.removeEventListener("scroll", scheduleMeasure);
    if (animationFrame) win.cancelAnimationFrame(animationFrame);
    timers.forEach((timer) => win.clearTimeout(timer));
    delete root.dataset.softKeyboard;
    delete root.dataset.touchInput;
    for (const property of [
      "--app-stable-viewport-height",
      "--app-stable-frame-width",
      "--app-visible-viewport-height",
      "--app-keyboard-inset"
    ]) root.style.removeProperty(property);
  };
}

export function useSoftKeyboardViewport() {
  useEffect(() => installSoftKeyboardViewportController(), []);
}

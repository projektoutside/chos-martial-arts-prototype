import { useEffect } from "react";
import { isKeyboardEditableTarget, SOFT_KEYBOARD_CHANGE_EVENT } from "./softKeyboardViewport";

export type KeyboardEditableElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
export type KeyboardEditorControl = HTMLInputElement | HTMLTextAreaElement;
export type KeyboardEditorKind = "input" | "textarea";

export type KeyboardEditorDescriptor = {
  kind: KeyboardEditorKind;
  type: string;
  value: string;
  placeholder: string;
  autocomplete: string;
  inputMode: string;
  enterKeyHint: string;
  maxLength: number;
  minLength: number;
  required: boolean;
  spellcheck: boolean;
  ariaLabel: string;
};

export type KeyboardEditorInputDetails = {
  data?: string | null;
  inputType?: string;
  isComposing?: boolean;
};

type VirtualKeyboardGeometry = EventTarget & {
  overlaysContent: boolean;
  boundingRect?: DOMRect;
  show?: () => void;
};

type VirtualKeyboardNavigator = Navigator & {
  virtualKeyboard?: VirtualKeyboardGeometry;
};

function isNativeTextControl(element: KeyboardEditableElement): element is HTMLInputElement | HTMLTextAreaElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

function hasEditableContent(source: KeyboardEditableElement) {
  const attribute = source.getAttribute("contenteditable");
  return source.isContentEditable || source.contentEditable?.toLowerCase() === "true" || attribute === "" || attribute?.toLowerCase() === "true";
}

function sourceAccessibleName(source: KeyboardEditableElement) {
  const ariaLabel = source.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  const labelledBy = source.getAttribute("aria-labelledby")?.trim();
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => source.ownerDocument.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    if (label) return label;
  }
  if (isNativeTextControl(source)) {
    const label = source.labels?.[0]?.textContent?.trim();
    if (label) return label;
  }
  return source.getAttribute("name")?.trim() || source.getAttribute("placeholder")?.trim() || "Text editor";
}

export function readKeyboardEditorValue(source: KeyboardEditableElement) {
  return isNativeTextControl(source) ? source.value : source.textContent ?? "";
}

export function createKeyboardEditorDescriptor(source: KeyboardEditableElement): KeyboardEditorDescriptor {
  const input = source instanceof HTMLInputElement ? source : undefined;
  const textarea = source instanceof HTMLTextAreaElement ? source : undefined;
  return {
    kind: textarea || hasEditableContent(source) || (input && input.type !== "password") ? "textarea" : "input",
    type: input?.type || "text",
    value: readKeyboardEditorValue(source),
    placeholder: input?.placeholder ?? textarea?.placeholder ?? "",
    autocomplete: input?.autocomplete ?? textarea?.autocomplete ?? "",
    inputMode: source.inputMode,
    enterKeyHint: source.enterKeyHint,
    maxLength: input?.maxLength ?? textarea?.maxLength ?? -1,
    minLength: input?.minLength ?? textarea?.minLength ?? -1,
    required: input?.required ?? textarea?.required ?? false,
    spellcheck: source.spellcheck,
    ariaLabel: sourceAccessibleName(source)
  };
}

function setNativeTextControlValue(source: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = source instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(source, value);
  else source.value = value;
}

function createEditorInputEvent(source: KeyboardEditableElement, details: KeyboardEditorInputDetails) {
  const view = source.ownerDocument.defaultView;
  const InputEventConstructor = view?.InputEvent;
  if (InputEventConstructor) {
    return new InputEventConstructor("input", {
      bubbles: true,
      composed: true,
      data: details.data ?? null,
      inputType: details.inputType ?? "insertText",
      isComposing: details.isComposing ?? false
    });
  }
  return new Event("input", { bubbles: true, composed: true });
}

export function writeKeyboardEditorValue(
  source: KeyboardEditableElement,
  value: string,
  details: KeyboardEditorInputDetails = {}
) {
  if (isNativeTextControl(source)) setNativeTextControlValue(source, value);
  else source.textContent = value;
  source.dispatchEvent(createEditorInputEvent(source, details));
}

function supportsSelection(element: KeyboardEditableElement | KeyboardEditorControl): element is HTMLInputElement | HTMLTextAreaElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

export function copyKeyboardEditorSelection(from: KeyboardEditorControl, to: KeyboardEditableElement) {
  if (!supportsSelection(from) || !supportsSelection(to)) return;
  if (from.selectionStart === null || from.selectionEnd === null) return;
  try {
    to.setSelectionRange(from.selectionStart, from.selectionEnd, from.selectionDirection ?? undefined);
  } catch {
    // Some text-like keyboard inputs, such as email and number, do not expose selection APIs.
  }
}

export type InstallSoftKeyboardEditorOptions = {
  win?: Window;
  doc?: Document;
};

function isTouchInputCapable(win: Window) {
  return win.navigator.maxTouchPoints > 0 || Boolean(win.matchMedia?.("(pointer: coarse)")?.matches);
}

function resolveKeyboardEditableTarget(target: EventTarget | null): KeyboardEditableElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const element = target as HTMLElement;
  if (isKeyboardEditableTarget(target)) return target;

  const editableAncestor = element.closest("input, textarea, [contenteditable], [role='textbox']");
  if (isKeyboardEditableTarget(editableAncestor)) return editableAncestor;

  const label = element.closest("label");
  return isKeyboardEditableTarget(label?.control ?? null) ? label!.control! : null;
}

const copiedStyleProperties = [
  "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
  "color", "background-color", "background-image", "border-top-width", "border-right-width",
  "border-bottom-width", "border-left-width", "border-top-style", "border-right-style",
  "border-bottom-style", "border-left-style", "border-top-color", "border-right-color",
  "border-bottom-color", "border-left-color", "border-radius", "box-shadow", "padding-top",
  "padding-right", "padding-bottom", "padding-left", "text-align", "text-transform", "direction",
  "caret-color"
] as const;

function copyKeyboardEditorAppearance(source: KeyboardEditableElement, editor: KeyboardEditorControl, win: Window) {
  const computed = win.getComputedStyle(source);
  for (const property of copiedStyleProperties) {
    const value = computed.getPropertyValue(property);
    if (value) editor.style.setProperty(property, value);
  }
  const sourceRect = source.getBoundingClientRect();
  if (sourceRect.width > 0) editor.style.setProperty("--soft-keyboard-source-width", `${sourceRect.width}px`);
  editor.style.setProperty("--soft-keyboard-editor-placeholder-color", computed.color || "currentColor");
  editor.style.fontSize = `max(16px, ${computed.fontSize || "1em"})`;
}

function mirrorDescriptor(editor: KeyboardEditorControl, descriptor: KeyboardEditorDescriptor) {
  editor.value = descriptor.value;
  editor.placeholder = descriptor.placeholder;
  if (descriptor.autocomplete) editor.setAttribute("autocomplete", descriptor.autocomplete);
  else editor.removeAttribute("autocomplete");
  editor.inputMode = descriptor.inputMode as typeof editor.inputMode;
  editor.enterKeyHint = descriptor.enterKeyHint as typeof editor.enterKeyHint;
  if (descriptor.maxLength >= 0) editor.maxLength = descriptor.maxLength;
  else editor.removeAttribute("maxlength");
  if (descriptor.minLength >= 0) editor.minLength = descriptor.minLength;
  else editor.removeAttribute("minlength");
  editor.required = descriptor.required;
  editor.spellcheck = descriptor.spellcheck;
  editor.setAttribute("aria-label", descriptor.ariaLabel);
  if (editor instanceof HTMLInputElement) editor.type = descriptor.type;
}

function mirrorSourceAttributes(source: KeyboardEditableElement, editor: KeyboardEditorControl) {
  for (const name of [
    "aria-describedby", "aria-errormessage", "aria-invalid", "aria-required", "autocapitalize",
    "autocorrect", "dirname", "formaction", "list", "max", "min", "pattern", "step"
  ]) {
    const value = source.getAttribute(name);
    if (value === null) editor.removeAttribute(name);
    else editor.setAttribute(name, value);
  }
}

function restoreInitialSelection(source: KeyboardEditableElement, editor: KeyboardEditorControl) {
  if (!(source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement)) return;
  if (source.selectionStart === null || source.selectionEnd === null) return;
  try {
    editor.setSelectionRange(source.selectionStart, source.selectionEnd, source.selectionDirection ?? undefined);
  } catch {
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }
}

export function installSoftKeyboardEditor(options: InstallSoftKeyboardEditorOptions = {}) {
  const win = options.win ?? window;
  const doc = options.doc ?? document;
  const root = doc.documentElement;
  const mobileEditorEnabled = isTouchInputCapable(win);
  const layer = doc.createElement("div");
  const surface = doc.createElement("div");
  const input = doc.createElement("input");
  const textarea = doc.createElement("textarea");
  const done = doc.createElement("button");
  let source: KeyboardEditableElement | null = null;
  let editor: KeyboardEditorControl | null = null;
  let dirty = false;
  let composing = false;
  let editorMaxHeight = Math.max(120, win.innerHeight - 32);
  let dragStartY: number | null = null;
  let dragStartScrollTop = 0;
  let overlayKeyboardWasVisible = false;

  layer.className = "soft-keyboard-editor-layer";
  layer.hidden = true;
  layer.setAttribute("role", "presentation");
  surface.className = "soft-keyboard-editor-surface";
  input.dataset.softKeyboardEditorControl = "true";
  textarea.dataset.softKeyboardEditorControl = "true";
  input.hidden = true;
  textarea.hidden = true;
  done.type = "button";
  done.className = "soft-keyboard-editor-done";
  done.textContent = "Send";
  surface.append(input, textarea, done);
  layer.append(surface);
  doc.body.append(layer);

  const resizeEditor = () => {
    if (!(editor instanceof HTMLTextAreaElement)) return;
    editor.style.height = "auto";
    const contentHeight = Math.max(48, editor.scrollHeight);
    const nextHeight = Math.min(contentHeight, editorMaxHeight);
    editor.style.height = `${Math.round(nextHeight)}px`;
    editor.style.maxHeight = `${Math.round(editorMaxHeight)}px`;
    editor.style.overflowY = contentHeight > editorMaxHeight ? "auto" : "hidden";
  };

  const positionLayer = () => {
    const viewport = win.visualViewport;
    const visibleTop = viewport?.offsetTop ?? 0;
    const visualViewportBottom = visibleTop + (viewport?.height ?? win.innerHeight);
    const keyboardRect = (win.navigator as VirtualKeyboardNavigator).virtualKeyboard?.boundingRect;
    if (keyboardRect && keyboardRect.height > 0) overlayKeyboardWasVisible = true;
    const overlayKeyboardTop = keyboardRect && keyboardRect.height > 0 ? keyboardRect.y : Number.POSITIVE_INFINITY;
    // Android WebViews using adjustResize can keep visualViewport at its pre-keyboard
    // height while window.innerHeight already reflects the keyboard. Other Android
    // WebViews overlay the keyboard without resizing either viewport, but expose its
    // top edge through the Virtual Keyboard API. The smallest edge is the actual
    // boundary above the keyboard on Android and iOS. Keep the mirrored editor
    // comfortably centered within that visible area instead of crowding the keyboard.
    const visibleBottom = Math.min(visualViewportBottom, win.innerHeight, overlayKeyboardTop);
    const usableHeight = visibleBottom - visibleTop;
    if (usableHeight < 160) {
      if (!root.style.getPropertyValue("--soft-keyboard-editor-top")) {
        root.style.setProperty("--soft-keyboard-editor-top", `${Math.round(win.innerHeight / 2)}px`);
      }
      return;
    }
    editorMaxHeight = Math.max(120, usableHeight - 96);
    resizeEditor();
    const surfaceHeight = surface.getBoundingClientRect().height;
    const surfaceHalfHeight = surfaceHeight / 2;
    const safeEdgeGap = 16;
    const upwardBiasedCenter = visibleTop + usableHeight * 0.46;
    const minimumCenter = visibleTop + surfaceHalfHeight + safeEdgeGap;
    const maximumCenter = visibleBottom - surfaceHalfHeight - safeEdgeGap;
    const editorCenter = minimumCenter <= maximumCenter
      ? Math.min(Math.max(upwardBiasedCenter, minimumCenter), maximumCenter)
      : visibleTop + usableHeight / 2;
    root.style.setProperty("--soft-keyboard-editor-top", `${Math.max(0, Math.round(editorCenter))}px`);
  };

  const close = () => {
    if (!source) return;
    if (dirty && source.isConnected) source.dispatchEvent(new Event("change", { bubbles: true }));
    source.removeAttribute("data-soft-keyboard-source-active");
    source = null;
    editor = null;
    dirty = false;
    composing = false;
    dragStartY = null;
    overlayKeyboardWasVisible = false;
    input.hidden = true;
    textarea.hidden = true;
    input.removeAttribute("style");
    textarea.removeAttribute("style");
    layer.hidden = true;
    delete root.dataset.softKeyboardEditor;
    root.style.removeProperty("--soft-keyboard-editor-top");
  };

  const handleEditorInput = (event: Event) => {
    if (!source || !editor) return;
    const details = event instanceof InputEvent
      ? { data: event.data, inputType: event.inputType, isComposing: event.isComposing }
      : {};
    writeKeyboardEditorValue(source, editor.value, details);
    copyKeyboardEditorSelection(editor, source);
    dirty = true;
    positionLayer();
  };

  const scrollTextareaBy = (deltaY: number) => {
    const maximumScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
    if (maximumScrollTop <= 0) return false;
    const nextScrollTop = Math.min(maximumScrollTop, Math.max(0, textarea.scrollTop + deltaY));
    if (nextScrollTop === textarea.scrollTop) return false;
    textarea.scrollTop = nextScrollTop;
    return true;
  };

  const beginEditorDrag = (clientY: number) => {
    if (textarea.scrollHeight <= textarea.clientHeight) return;
    dragStartY = clientY;
    dragStartScrollTop = textarea.scrollTop;
  };

  const continueEditorDrag = (clientY: number, event: Event) => {
    if (dragStartY === null) return;
    const maximumScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
    textarea.scrollTop = Math.min(maximumScrollTop, Math.max(0, dragStartScrollTop + dragStartY - clientY));
    if (event.cancelable) event.preventDefault();
  };

  const handleEditorTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) beginEditorDrag(touch.clientY);
  };
  const handleEditorTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (touch) continueEditorDrag(touch.clientY, event);
  };
  const endEditorDrag = () => {
    dragStartY = null;
  };
  const handleEditorMouseDown = (event: MouseEvent) => {
    if (event.button === 0) beginEditorDrag(event.clientY);
  };
  const handleEditorMouseMove = (event: MouseEvent) => continueEditorDrag(event.clientY, event);
  const handleEditorWheel = (event: WheelEvent) => {
    if (scrollTextareaBy(event.deltaY) && event.cancelable) event.preventDefault();
  };

  const sourceForm = (target: KeyboardEditableElement) => target.closest("form");

  const nextEditableSource = (currentSource: KeyboardEditableElement) => {
    const scope = sourceForm(currentSource) ?? doc;
    const candidates = Array.from(scope.querySelectorAll<HTMLElement>(
      "input, textarea, [contenteditable], [role='textbox']"
    )).filter((candidate) => !candidate.hasAttribute("data-soft-keyboard-editor-control")
      && !candidate.hidden
      && isKeyboardEditableTarget(candidate));
    const currentIndex = candidates.indexOf(currentSource);
    return currentIndex >= 0 ? candidates[currentIndex + 1] ?? null : null;
  };

  const performEditorAction = () => {
    if (!source) return;
    const currentSource = source;
    const form = sourceForm(currentSource);
    if (form?.classList.contains("live-chat-composer")) {
      form.requestSubmit();
      return;
    }
    const nextSource = nextEditableSource(currentSource);
    close();
    if (nextSource) open(nextSource, new Event("soft-keyboard-editor-advance"));
  };

  const forwardKeyboardEvent = (event: KeyboardEvent) => {
    if (!source) return true;
    return source.dispatchEvent(new KeyboardEvent(event.type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key: event.key,
      code: event.code,
      location: event.location,
      repeat: event.repeat,
      isComposing: event.isComposing,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey
    }));
  };

  const handleEditorKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      forwardKeyboardEvent(event);
      event.preventDefault();
      close();
      done.focus({ preventScroll: true });
      return;
    }
    if (!forwardKeyboardEvent(event)) {
      event.preventDefault();
      return;
    }
    if (event.key !== "Enter" || !(source instanceof HTMLInputElement)) return;
    event.preventDefault();
    performEditorAction();
  };

  const handleEditorKeyUp = (event: KeyboardEvent) => {
    if (!forwardKeyboardEvent(event)) event.preventDefault();
  };

  const handleEditorBeforeInput = (event: InputEvent) => {
    if (!source) return;
    const forwarded = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      composed: true,
      data: event.data,
      inputType: event.inputType,
      isComposing: event.isComposing
    });
    if (!source.dispatchEvent(forwarded)) event.preventDefault();
  };

  const activateEditorKeyboard = () => {
    if (!editor) return;
    editor.focus({ preventScroll: true });
    try {
      (win.navigator as VirtualKeyboardNavigator).virtualKeyboard?.show?.();
    } catch {
      // Unsupported browsers still open their keyboard from the focused native control.
    }
  };

  const open = (nextSource: KeyboardEditableElement, event: Event) => {
    if (source === nextSource && !layer.hidden) {
      activateEditorKeyboard();
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (source && source !== nextSource) close();
    source = nextSource;
    const descriptor = createKeyboardEditorDescriptor(nextSource);
    editor = descriptor.kind === "textarea" ? textarea : input;
    input.hidden = editor !== input;
    textarea.hidden = editor !== textarea;
    mirrorDescriptor(editor, descriptor);
    mirrorSourceAttributes(nextSource, editor);
    copyKeyboardEditorAppearance(nextSource, editor, win);
    const form = sourceForm(nextSource);
    const nextSourceCandidate = form?.classList.contains("live-chat-composer") ? null : nextEditableSource(nextSource);
    done.setAttribute("aria-label", form?.classList.contains("live-chat-composer")
      ? "Send message"
      : nextSourceCandidate
        ? "Apply and continue to next field"
        : "Apply text");
    nextSource.setAttribute("data-soft-keyboard-source-active", "true");
    dirty = false;
    composing = false;
    layer.hidden = false;
    root.dataset.softKeyboardEditor = "open";
    activateEditorKeyboard();
    restoreInitialSelection(nextSource, editor);
    positionLayer();
    if (event.cancelable) event.preventDefault();
    win.requestAnimationFrame(resizeEditor);
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (layer.contains(event.target as Node)) return;
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    const target = resolveKeyboardEditableTarget(event.target);
    if (target) open(target, event);
    else close();
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (layer.contains(event.target as Node)) return;
    const target = resolveKeyboardEditableTarget(event.target);
    if (target) open(target, event);
    else close();
  };

  const handleClick = (event: MouseEvent) => {
    if (!mobileEditorEnabled || layer.contains(event.target as Node)) return;
    const target = resolveKeyboardEditableTarget(event.target);
    if (target) open(target, event);
    else close();
  };

  const handleFocusIn = (event: FocusEvent) => {
    if (!mobileEditorEnabled || layer.contains(event.target as Node)) return;
    const target = resolveKeyboardEditableTarget(event.target);
    if (target) open(target, event);
  };

  const forwardCompositionEvent = (event: CompositionEvent) => {
    if (!source) return;
    source.dispatchEvent(new CompositionEvent(event.type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      data: event.data
    }));
  };
  const handleCompositionStart = (event: CompositionEvent) => {
    composing = true;
    forwardCompositionEvent(event);
  };
  const handleCompositionUpdate = (event: CompositionEvent) => forwardCompositionEvent(event);
  const handleCompositionEnd = (event: CompositionEvent) => {
    composing = false;
    forwardCompositionEvent(event);
  };
  const handleSubmit = (event: Event) => {
    if (!(source instanceof HTMLInputElement || source instanceof HTMLTextAreaElement)) return;
    if (source.form && event.target === source.form) close();
  };
  const handleOrientationChange = () => close();
  const handleSoftKeyboardChange = (event: Event) => {
    if ((event as CustomEvent<{ state?: string }>).detail?.state === "closed") close();
  };
  const handleVirtualKeyboardGeometryChange = () => {
    const keyboardRect = (win.navigator as VirtualKeyboardNavigator).virtualKeyboard?.boundingRect;
    if (keyboardRect && keyboardRect.height > 0) {
      overlayKeyboardWasVisible = true;
      positionLayer();
      return;
    }
    if (overlayKeyboardWasVisible) {
      close();
      return;
    }
    positionLayer();
  };
  const healthCheck = () => {
    if (!source || composing) return;
    if (!source.isConnected || source.matches(":disabled, [aria-disabled='true'], [readonly], [aria-readonly='true']")) {
      close();
    }
  };

  input.addEventListener("input", handleEditorInput);
  textarea.addEventListener("input", handleEditorInput);
  input.addEventListener("beforeinput", handleEditorBeforeInput);
  textarea.addEventListener("beforeinput", handleEditorBeforeInput);
  input.addEventListener("keydown", handleEditorKeyDown);
  textarea.addEventListener("keydown", handleEditorKeyDown);
  input.addEventListener("keyup", handleEditorKeyUp);
  textarea.addEventListener("keyup", handleEditorKeyUp);
  input.addEventListener("compositionstart", handleCompositionStart);
  textarea.addEventListener("compositionstart", handleCompositionStart);
  input.addEventListener("compositionupdate", handleCompositionUpdate);
  textarea.addEventListener("compositionupdate", handleCompositionUpdate);
  input.addEventListener("compositionend", handleCompositionEnd);
  textarea.addEventListener("compositionend", handleCompositionEnd);
  textarea.addEventListener("touchstart", handleEditorTouchStart, { passive: true });
  textarea.addEventListener("touchmove", handleEditorTouchMove, { passive: false });
  textarea.addEventListener("touchend", endEditorDrag);
  textarea.addEventListener("touchcancel", endEditorDrag);
  textarea.addEventListener("mousedown", handleEditorMouseDown);
  textarea.addEventListener("wheel", handleEditorWheel, { passive: false });
  doc.addEventListener("mousemove", handleEditorMouseMove, true);
  doc.addEventListener("mouseup", endEditorDrag, true);
  done.addEventListener("click", performEditorAction);
  doc.addEventListener("pointerdown", handlePointerDown, true);
  doc.addEventListener("touchstart", handleTouchStart, { capture: true, passive: false });
  doc.addEventListener("click", handleClick, true);
  doc.addEventListener("focusin", handleFocusIn, true);
  doc.addEventListener("submit", handleSubmit, true);
  doc.addEventListener(SOFT_KEYBOARD_CHANGE_EVENT, handleSoftKeyboardChange);
  win.addEventListener("resize", positionLayer);
  win.addEventListener("orientationchange", handleOrientationChange);
  win.addEventListener("popstate", close);
  win.addEventListener("hashchange", close);
  win.addEventListener("pagehide", close);
  win.visualViewport?.addEventListener("resize", positionLayer);
  win.visualViewport?.addEventListener("scroll", positionLayer);
  (win.navigator as VirtualKeyboardNavigator).virtualKeyboard?.addEventListener("geometrychange", handleVirtualKeyboardGeometryChange);
  const healthTimer = win.setInterval(healthCheck, 120);

  return () => {
    close();
    win.clearInterval(healthTimer);
    doc.removeEventListener("mousemove", handleEditorMouseMove, true);
    doc.removeEventListener("mouseup", endEditorDrag, true);
    doc.removeEventListener("pointerdown", handlePointerDown, true);
    doc.removeEventListener("touchstart", handleTouchStart, true);
    doc.removeEventListener("click", handleClick, true);
    doc.removeEventListener("focusin", handleFocusIn, true);
    doc.removeEventListener("submit", handleSubmit, true);
    doc.removeEventListener(SOFT_KEYBOARD_CHANGE_EVENT, handleSoftKeyboardChange);
    win.removeEventListener("resize", positionLayer);
    win.removeEventListener("orientationchange", handleOrientationChange);
    win.removeEventListener("popstate", close);
    win.removeEventListener("hashchange", close);
    win.removeEventListener("pagehide", close);
    win.visualViewport?.removeEventListener("resize", positionLayer);
    win.visualViewport?.removeEventListener("scroll", positionLayer);
    (win.navigator as VirtualKeyboardNavigator).virtualKeyboard?.removeEventListener("geometrychange", handleVirtualKeyboardGeometryChange);
    layer.remove();
    delete root.dataset.softKeyboardEditor;
    root.style.removeProperty("--soft-keyboard-editor-top");
  };
}

export function useSoftKeyboardEditor() {
  useEffect(() => installSoftKeyboardEditor(), []);
}

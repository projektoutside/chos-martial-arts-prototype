import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  copyKeyboardEditorSelection,
  createKeyboardEditorDescriptor,
  installSoftKeyboardEditor,
  readKeyboardEditorValue,
  writeKeyboardEditorValue
} from "./softKeyboardEditor";

function dispatchPointerDown(target: EventTarget, pointerType: "mouse" | "pen" | "touch") {
  const event = new Event("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  target.dispatchEvent(event);
  return event;
}

describe("soft keyboard editor helpers", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: 5 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true })
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.body.replaceChildren();
    delete document.documentElement.dataset.softKeyboardEditor;
    vi.restoreAllMocks();
  });

  it("copies input keyboard semantics without copying source identity", () => {
    const source = document.createElement("input");
    source.id = "member-email";
    source.type = "email";
    source.value = "member@example.com";
    source.placeholder = "Email";
    source.autocomplete = "email";
    source.inputMode = "email";
    source.enterKeyHint = "next";
    source.maxLength = 80;
    source.minLength = 4;
    source.required = true;
    source.spellcheck = false;
    source.setAttribute("aria-label", "Member email");

    expect(createKeyboardEditorDescriptor(source)).toEqual({
      kind: "input",
      type: "email",
      value: "member@example.com",
      placeholder: "Email",
      autocomplete: "email",
      inputMode: "email",
      enterKeyHint: "next",
      maxLength: 80,
      minLength: 4,
      required: true,
      spellcheck: false,
      ariaLabel: "Member email"
    });
  });

  it("uses a multiline editor for textareas and content-editable textboxes", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Line one";
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.textContent = "Editable note";

    expect(createKeyboardEditorDescriptor(textarea)).toMatchObject({ kind: "textarea", value: "Line one", type: "text" });
    expect(createKeyboardEditorDescriptor(editable)).toMatchObject({ kind: "textarea", value: "Editable note", type: "text" });
  });

  it("writes inputs through the native setter and emits a bubbling input event", () => {
    const source = document.createElement("input");
    const setter = vi.spyOn(HTMLInputElement.prototype, "value", "set");
    const observed: string[] = [];
    source.addEventListener("input", () => observed.push(source.value));

    writeKeyboardEditorValue(source, "Cho's", {
      data: "s",
      inputType: "insertText",
      isComposing: false
    });

    expect(setter).toHaveBeenCalledWith("Cho's");
    expect(source.value).toBe("Cho's");
    expect(observed).toEqual(["Cho's"]);
  });

  it("reads and writes content-editable text", () => {
    const source = document.createElement("div");
    source.contentEditable = "true";
    source.textContent = "Before";

    writeKeyboardEditorValue(source, "After");

    expect(readKeyboardEditorValue(source)).toBe("After");
  });

  it("copies input selection when both controls support it", () => {
    const source = document.createElement("input");
    const editor = document.createElement("input");
    source.value = "Cho's Martial Arts";
    editor.value = source.value;
    editor.setSelectionRange(2, 7, "backward");

    copyKeyboardEditorSelection(editor, source);

    expect(source.selectionStart).toBe(2);
    expect(source.selectionEnd).toBe(7);
    expect(source.selectionDirection).toBe("backward");
  });

  it("opens a matching editor synchronously for a touch text target", () => {
    const source = document.createElement("input");
    source.className = "input manager-home-search";
    source.value = "member";
    source.setAttribute("aria-label", "Search members");
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    const pointerEvent = dispatchPointerDown(source, "touch");

    const editor = document.querySelector<HTMLInputElement>("input[data-soft-keyboard-editor-control]");
    expect(pointerEvent.defaultPrevented).toBe(true);
    expect(editor).toBe(document.activeElement);
    expect(editor?.value).toBe("member");
    expect(editor).toHaveAttribute("aria-label", "Search members");
    expect(document.documentElement.dataset.softKeyboardEditor).toBe("open");
  });

  it("keeps the mirror directly above an Android keyboard when only the layout viewport resizes", () => {
    const source = document.createElement("input");
    document.body.append(source);
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 844 },
      offsetTop: { configurable: true, value: 0 }
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    dispatchPointerDown(source, "touch");
    window.innerHeight = 500;
    window.dispatchEvent(new Event("resize"));

    expect(document.documentElement.style.getPropertyValue("--soft-keyboard-editor-top")).toBe("492px");
  });

  it("keeps the mirror directly above an overlay keyboard that does not resize either viewport", () => {
    const source = document.createElement("input");
    document.body.append(source);
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 844 },
      offsetTop: { configurable: true, value: 0 }
    });
    const virtualKeyboard = new EventTarget() as EventTarget & { overlaysContent: boolean; boundingRect: DOMRect };
    virtualKeyboard.overlaysContent = false;
    virtualKeyboard.boundingRect = new DOMRect(0, 500, 390, 344);
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window.navigator, "virtualKeyboard", { configurable: true, value: virtualKeyboard });
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    dispatchPointerDown(source, "touch");
    virtualKeyboard.dispatchEvent(new Event("geometrychange"));

    expect(document.documentElement.style.getPropertyValue("--soft-keyboard-editor-top")).toBe("492px");
  });

  it("synchronizes edits live and closes from the Done action", () => {
    const source = document.createElement("input");
    source.value = "before";
    const observed: string[] = [];
    source.addEventListener("input", () => observed.push(source.value));
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");
    const editor = document.querySelector<HTMLInputElement>("input[data-soft-keyboard-editor-control]")!;

    editor.value = "updated";
    editor.setSelectionRange(3, 5);
    editor.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      data: "d",
      inputType: "insertText"
    }));

    expect(source.value).toBe("updated");
    expect(source.selectionStart).toBe(3);
    expect(source.selectionEnd).toBe(5);
    expect(observed).toEqual(["updated"]);

    document.querySelector<HTMLButtonElement>("button[aria-label='Done editing']")!.click();
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard-editor");
    expect(document.querySelector(".soft-keyboard-editor-layer")).toHaveAttribute("hidden");
  });

  it("uses textarea and password editors without changing their semantics", () => {
    const textarea = document.createElement("textarea");
    textarea.value = "Multiline note";
    const password = document.createElement("input");
    password.type = "password";
    password.value = "secret";
    document.body.append(textarea, password);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    dispatchPointerDown(textarea, "touch");
    expect(document.activeElement).toBe(document.querySelector("textarea[data-soft-keyboard-editor-control]"));
    document.querySelector<HTMLButtonElement>("button[aria-label='Done editing']")!.click();

    dispatchPointerDown(password, "touch");
    expect(document.querySelector<HTMLInputElement>("input[data-soft-keyboard-editor-control]")?.type).toBe("password");
  });

  it("closes on Escape and when the source is removed", () => {
    vi.useFakeTimers();
    const source = document.createElement("input");
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    dispatchPointerDown(source, "touch");
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard-editor");

    dispatchPointerDown(source, "touch");
    source.remove();
    vi.advanceTimersByTime(120);
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard-editor");
    vi.useRealTimers();
  });

  it("keeps ordinary desktop mouse focus native", () => {
    const source = document.createElement("input");
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    const pointerEvent = dispatchPointerDown(source, "mouse");

    expect(pointerEvent.defaultPrevented).toBe(false);
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard-editor");
    expect(document.querySelector(".soft-keyboard-editor-layer")).toHaveAttribute("hidden");
  });

  it("forwards composition, before-input, and Enter form behavior to the source", () => {
    const form = document.createElement("form");
    const source = document.createElement("input");
    source.value = "member";
    form.append(source);
    document.body.append(form);
    const observed: string[] = [];
    source.addEventListener("compositionstart", () => observed.push("compositionstart"));
    source.addEventListener("beforeinput", () => observed.push("beforeinput"));
    source.addEventListener("keydown", (event) => observed.push(`keydown:${event.key}`));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      observed.push("submit");
    });
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");
    const editor = document.querySelector<HTMLInputElement>("input[data-soft-keyboard-editor-control]")!;

    editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "m" }));
    editor.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, data: "m", inputType: "insertCompositionText" }));
    editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", code: "Enter" }));

    expect(observed).toEqual(["compositionstart", "beforeinput", "keydown:Enter", "submit"]);
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard-editor");
  });
});

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
    Object.defineProperty(window.navigator, "virtualKeyboard", { configurable: true, value: undefined });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
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
      kind: "textarea",
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

    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]");
    expect(pointerEvent.defaultPrevented).toBe(true);
    expect(editor).toBe(document.activeElement);
    expect(editor?.value).toBe("member");
    expect(editor).toHaveAttribute("aria-label", "Search members");
    expect(document.documentElement.dataset.softKeyboardEditor).toBe("open");
  });

  it("opens the editor when a phone user taps an input's associated label", () => {
    const label = document.createElement("label");
    label.htmlFor = "member-name";
    label.textContent = "Member name";
    const source = document.createElement("input");
    source.id = "member-name";
    source.value = "Jordan";
    document.body.append(label, source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    const pointerEvent = dispatchPointerDown(label, "touch");
    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]");

    expect(pointerEvent.defaultPrevented).toBe(true);
    expect(editor).toBe(document.activeElement);
    expect(editor?.value).toBe("Jordan");
    expect(editor).toHaveAttribute("aria-label", "Member name");
  });

  it("opens the editor when a phone label contains nested presentation content", () => {
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    labelText.textContent = "Notes";
    const source = document.createElement("textarea");
    source.value = "Follow up";
    label.append(labelText, source);
    document.body.append(label);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    dispatchPointerDown(labelText, "touch");

    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]");
    expect(editor).toBe(document.activeElement);
    expect(editor?.value).toBe("Follow up");
  });

  it("uses the global editor when a text field receives focus on a coarse-pointer phone", () => {
    const source = document.createElement("input");
    source.value = "Autofilled name";
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    source.focus();

    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]");
    expect(editor).toBe(document.activeElement);
    expect(editor?.value).toBe("Autofilled name");
    expect(source).toHaveAttribute("data-soft-keyboard-source-active", "true");
  });

  it("does not proxy focus on a non-coarse desktop or for readonly controls", () => {
    Object.defineProperty(window.navigator, "maxTouchPoints", { configurable: true, value: 0 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    });
    const desktopSource = document.createElement("input");
    const readonlySource = document.createElement("input");
    readonlySource.readOnly = true;
    document.body.append(desktopSource, readonlySource);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    desktopSource.focus();
    expect(desktopSource).toBe(document.activeElement);
    desktopSource.blur();
    readonlySource.focus();

    expect(readonlySource).toBe(document.activeElement);
    expect(document.documentElement.dataset.softKeyboardEditor).toBeUndefined();
  });

  it("centers the mirror in the usable phone area when only the layout viewport resizes", () => {
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

    expect(document.documentElement.style.getPropertyValue("--soft-keyboard-editor-top")).toBe("230px");
  });

  it("centers the mirror in the usable phone area for an overlay keyboard", () => {
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

    expect(document.documentElement.style.getPropertyValue("--soft-keyboard-editor-top")).toBe("230px");
  });

  it("centers the mirror within a visual viewport that is offset by browser chrome", () => {
    const source = document.createElement("input");
    document.body.append(source);
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 500 },
      offsetTop: { configurable: true, value: 120 }
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window.navigator, "virtualKeyboard", { configurable: true, value: undefined });
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    dispatchPointerDown(source, "touch");

    expect(document.documentElement.style.getPropertyValue("--soft-keyboard-editor-top")).toBe("350px");
  });

  it("does not jump the editor to the top during transient keyboard geometry", () => {
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
    virtualKeyboard.boundingRect = new DOMRect(0, 844, 390, 0);
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window.navigator, "virtualKeyboard", { configurable: true, value: virtualKeyboard });
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });

    dispatchPointerDown(source, "touch");
    expect(document.documentElement.style.getPropertyValue("--soft-keyboard-editor-top")).toBe("388px");

    Object.defineProperty(viewport, "height", { configurable: true, value: 40 });
    virtualKeyboard.boundingRect = new DOMRect(0, 0, 390, 844);
    virtualKeyboard.dispatchEvent(new Event("geometrychange"));

    expect(document.documentElement.style.getPropertyValue("--soft-keyboard-editor-top")).toBe("388px");
  });

  it("closes the hovering editor when the phone keyboard closes", () => {
    const source = document.createElement("input");
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");

    document.dispatchEvent(new CustomEvent("cho:soft-keyboard-change", {
      detail: { state: "closed" }
    }));

    expect(document.documentElement.dataset.softKeyboardEditor).toBeUndefined();
    expect(document.querySelector(".soft-keyboard-editor-layer")).toHaveAttribute("hidden");
    expect(source).not.toHaveAttribute("data-soft-keyboard-source-active");
  });

  it("closes the hovering editor when the user taps outside it", () => {
    const source = document.createElement("input");
    const outside = document.createElement("button");
    outside.textContent = "Outside";
    document.body.append(source, outside);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");

    dispatchPointerDown(outside, "touch");

    expect(document.documentElement.dataset.softKeyboardEditor).toBeUndefined();
    expect(document.querySelector(".soft-keyboard-editor-layer")).toHaveAttribute("hidden");
    expect(source).not.toHaveAttribute("data-soft-keyboard-source-active");
  });

  it("closes the hovering editor on browser Back navigation", () => {
    const source = document.createElement("input");
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");

    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(document.documentElement.dataset.softKeyboardEditor).toBeUndefined();
    expect(document.querySelector(".soft-keyboard-editor-layer")).toHaveAttribute("hidden");
    expect(source).not.toHaveAttribute("data-soft-keyboard-source-active");
  });

  it("grows a wrapping editor with long ordinary input text", () => {
    const source = document.createElement("input");
    source.value = "A long value that should wrap across several visible lines on a phone.";
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");

    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]:not([hidden])")!;
    Object.defineProperty(editor, "scrollHeight", { configurable: true, value: 180 });
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "x" }));

    expect(editor).toBe(document.activeElement);
    expect(editor.style.height).toBe("180px");
    expect(editor.style.overflowY).toBe("hidden");
  });

  it("caps a growing editor at the usable device height and then scrolls", () => {
    const source = document.createElement("textarea");
    document.body.append(source);
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 500 });
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");

    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]:not([hidden])")!;
    Object.defineProperty(editor, "scrollHeight", { configurable: true, value: 900 });
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "x" }));

    expect(Number.parseFloat(editor.style.height)).toBeLessThan(500);
    expect(Number.parseFloat(editor.style.height)).toBeGreaterThan(300);
    expect(editor.style.overflowY).toBe("auto");
  });

  it("keeps a growing editor safely above the keyboard edge", () => {
    const source = document.createElement("textarea");
    document.body.append(source);
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 844 });
    const viewport = new EventTarget() as VisualViewport;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 500 },
      offsetTop: { configurable: true, value: 0 }
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    const surface = document.querySelector<HTMLElement>(".soft-keyboard-editor-surface")!;
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 390, bottom: 422, width: 390, height: 422, toJSON: () => ({})
    });

    dispatchPointerDown(source, "touch");

    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]:not([hidden])")!;
    expect(document.documentElement.style.getPropertyValue("--soft-keyboard-editor-top")).toBe("230px");
    expect(Number.parseFloat(editor.style.maxHeight)).toBeLessThanOrEqual(404);
  });

  it("advances ordinary forms to the next editable field without submitting", () => {
    const form = document.createElement("form");
    const username = document.createElement("input");
    username.autocomplete = "username";
    const password = document.createElement("input");
    password.type = "password";
    let submitCount = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitCount += 1;
    });
    form.append(username, password);
    document.body.append(form);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(username, "touch");

    document.querySelector<HTMLButtonElement>(".soft-keyboard-editor-done")!.click();

    expect(submitCount).toBe(0);
    expect(password).toHaveAttribute("data-soft-keyboard-source-active", "true");
    expect(document.querySelector<HTMLInputElement>("input[data-soft-keyboard-editor-control]:not([hidden])")).toBe(document.activeElement);
  });

  it("commits and closes from the final ordinary field without submitting", () => {
    const form = document.createElement("form");
    const source = document.createElement("input");
    let submitCount = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitCount += 1;
    });
    form.append(source);
    document.body.append(form);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");

    document.querySelector<HTMLButtonElement>(".soft-keyboard-editor-done")!.click();

    expect(submitCount).toBe(0);
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard-editor");
  });

  it("submits only the existing live chat composer from Send", () => {
    const form = document.createElement("form");
    form.className = "live-chat-composer";
    const source = document.createElement("input");
    let submitCount = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitCount += 1;
    });
    form.append(source);
    document.body.append(form);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");

    const action = document.querySelector<HTMLButtonElement>(".soft-keyboard-editor-done")!;
    expect(action).toHaveTextContent("Send");
    action.click();

    expect(submitCount).toBe(1);
  });

  it("synchronizes edits live and closes from the final-field Send action", () => {
    const source = document.createElement("input");
    source.value = "before";
    const observed: string[] = [];
    source.addEventListener("input", () => observed.push(source.value));
    document.body.append(source);
    cleanup = installSoftKeyboardEditor({ win: window, doc: document });
    dispatchPointerDown(source, "touch");
    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]")!;

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

    document.querySelector<HTMLButtonElement>(".soft-keyboard-editor-done")!.click();
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
    document.querySelector<HTMLButtonElement>(".soft-keyboard-editor-done")!.click();

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

  it("forwards composition and before-input while Enter applies a final ordinary field", () => {
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
    const editor = document.querySelector<HTMLTextAreaElement>("textarea[data-soft-keyboard-editor-control]")!;

    editor.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "m" }));
    editor.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, data: "m", inputType: "insertCompositionText" }));
    editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", code: "Enter" }));

    expect(observed).toEqual(["compositionstart", "beforeinput", "keydown:Enter"]);
    expect(document.documentElement).not.toHaveAttribute("data-soft-keyboard-editor");
  });
});

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyKeyboardEditorSelection,
  createKeyboardEditorDescriptor,
  readKeyboardEditorValue,
  writeKeyboardEditorValue
} from "./softKeyboardEditor";

describe("soft keyboard editor helpers", () => {
  afterEach(() => {
    document.body.replaceChildren();
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
});

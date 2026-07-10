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
    kind: textarea || hasEditableContent(source) ? "textarea" : "input",
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

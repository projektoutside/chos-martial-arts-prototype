import { expect, test, type Page } from "playwright/test";

const mobileLayoutViewport = { width: 390, height: 844 };
const reducedVisualViewportHeight = 500;

type TestVisualViewport = VisualViewport & {
  setTestHeight: (height: number) => void;
};

type TestVirtualKeyboard = EventTarget & {
  boundingRect: DOMRect;
  overlaysContent: boolean;
  showCallCount: number;
  show: () => void;
  setTestGeometry: (top: number, height: number) => void;
};

async function installVisualViewportHarness(page: Page) {
  await page.addInitScript(() => {
    let visibleHeight = window.innerHeight;
    const viewport = new EventTarget() as TestVisualViewport;

    Object.defineProperties(viewport, {
      width: { configurable: true, get: () => window.innerWidth },
      height: { configurable: true, get: () => visibleHeight },
      offsetLeft: { configurable: true, get: () => 0 },
      offsetTop: { configurable: true, get: () => 0 },
      pageLeft: { configurable: true, get: () => window.scrollX },
      pageTop: { configurable: true, get: () => window.scrollY },
      scale: { configurable: true, get: () => 1 },
      setTestHeight: {
        configurable: true,
        value: (height: number) => {
          visibleHeight = height;
          viewport.dispatchEvent(new Event("resize"));
        }
      }
    });

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport
    });
  });
}

async function setVisualViewportHeight(page: Page, height: number) {
  await page.evaluate((nextHeight) => {
    (window.visualViewport as TestVisualViewport).setTestHeight(nextHeight);
  }, height);
}

async function installVirtualKeyboardHarness(page: Page) {
  await page.addInitScript(() => {
    const keyboard = new EventTarget() as TestVirtualKeyboard;
    keyboard.overlaysContent = false;
    keyboard.showCallCount = 0;
    keyboard.show = () => {
      keyboard.showCallCount += 1;
    };
    keyboard.boundingRect = new DOMRect(0, window.innerHeight, window.innerWidth, 0);
    keyboard.setTestGeometry = (top, height) => {
      keyboard.boundingRect = new DOMRect(0, top, window.innerWidth, height);
      keyboard.dispatchEvent(new Event("geometrychange"));
    };
    Object.defineProperty(window.navigator, "virtualKeyboard", { configurable: true, value: keyboard });
  });
}

async function readMobileLayout(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const shell = document.querySelector<HTMLElement>(".portrait-app-shell");
    const frame = document.querySelector<HTMLElement>(".portrait-app-frame");
    const loginPanel = document.querySelector<HTMLElement>(".login-panel");
    const username = document.querySelector<HTMLInputElement>("input[placeholder='Username']");
    const editor = document.querySelector<HTMLElement>("[data-soft-keyboard-editor-control]:not([hidden])");
    if (!shell || !frame || !loginPanel || !username) throw new Error("The login portrait geometry is unavailable.");

    const shellRect = shell.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const panelRect = loginPanel.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect();
    const sourceStyle = getComputedStyle(username);
    const editorStyle = editor ? getComputedStyle(editor) : undefined;
    return {
      maxTouchPoints: window.navigator.maxTouchPoints,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      touchInputState: root.dataset.touchInput,
      layoutViewportHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport?.height ?? window.innerHeight,
      reportedVisibleHeight: Number.parseFloat(root.style.getPropertyValue("--app-visible-viewport-height")),
      shell: { top: shellRect.top, left: shellRect.left, width: shellRect.width, height: shellRect.height },
      frame: { top: frameRect.top, left: frameRect.left, width: frameRect.width, height: frameRect.height },
      loginPanel: { top: panelRect.top, left: panelRect.left, width: panelRect.width, height: panelRect.height },
      editor: editorRect ? { top: editorRect.top, bottom: editorRect.bottom, left: editorRect.left, right: editorRect.right } : null,
      sourceStyle: {
        fontFamily: sourceStyle.fontFamily,
        fontSize: sourceStyle.fontSize,
        color: sourceStyle.color,
        backgroundColor: sourceStyle.backgroundColor,
        borderRadius: sourceStyle.borderRadius
      },
      editorStyle: editorStyle ? {
        fontFamily: editorStyle.fontFamily,
        fontSize: editorStyle.fontSize,
        color: editorStyle.color,
        backgroundColor: editorStyle.backgroundColor,
        borderRadius: editorStyle.borderRadius
      } : null,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      inputFontSize: Number.parseFloat(getComputedStyle(username).fontSize)
    };
  });
}

test("keeps the entire app frozen while a matching editor follows the phone keyboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "chromium-desktop", "Keyboard geometry runs on touch devices.");

  await page.setViewportSize(mobileLayoutViewport);
  await installVisualViewportHarness(page);
  await page.goto("/");

  const root = page.locator("html");
  const username = page.locator(".auth-gate input[placeholder='Username']");
  await expect(username).toBeVisible();
  await expect(page.locator(".launch-loader")).toHaveCount(0);

  const before = await readMobileLayout(page);
  expect(before.maxTouchPoints > 0 || before.coarsePointer).toBe(true);
  expect(before.touchInputState).toBe("true");
  await username.tap();
  const editor = page.locator("textarea[data-soft-keyboard-editor-control]:not([hidden])");
  await expect(editor).toBeFocused();
  await expect(root).toHaveAttribute("data-soft-keyboard-editor", "open");
  await setVisualViewportHeight(page, reducedVisualViewportHeight);
  await expect(root).toHaveAttribute("data-soft-keyboard", "open");

  const during = await readMobileLayout(page);
  expect(during.visualViewportHeight).toBe(reducedVisualViewportHeight);
  expect(during.visualViewportHeight).toBeLessThan(before.visualViewportHeight);
  expect(during.layoutViewportHeight).toBe(before.layoutViewportHeight);
  expect(Math.abs(during.reportedVisibleHeight - reducedVisualViewportHeight)).toBeLessThanOrEqual(1);
  expect(during.shell).toEqual(before.shell);
  expect(during.frame).toEqual(before.frame);
  expect(during.loginPanel).toEqual(before.loginPanel);
  expect(during.scrollX).toBe(before.scrollX);
  expect(during.scrollY).toBe(before.scrollY);
  expect(during.editor).not.toBeNull();
  expect(Math.abs(((during.editor!.top + during.editor!.bottom) / 2) - (reducedVisualViewportHeight / 2))).toBeLessThanOrEqual(32);
  expect(during.editorStyle).toEqual(during.sourceStyle);
  expect(during.scrollWidth).toBeLessThanOrEqual(during.clientWidth + 1);
  expect(during.inputFontSize).toBeGreaterThanOrEqual(16);

  await editor.fill("manager.one");
  await expect(username).toHaveValue("manager.one");
  await page.locator(".soft-keyboard-editor-done").tap();
  await expect(page.locator("input[data-soft-keyboard-editor-control]:not([hidden])")).toBeFocused();
  await page.locator(".soft-keyboard-editor-backdrop").tap({ position: { x: 12, y: 12 } });
  await expect(root).not.toHaveAttribute("data-soft-keyboard-editor");

  await setVisualViewportHeight(page, before.visualViewportHeight);
  await expect(root).not.toHaveAttribute("data-soft-keyboard");

  const after = await readMobileLayout(page);
  expect(after.visualViewportHeight).toBe(before.visualViewportHeight);
  expect(after.layoutViewportHeight).toBe(before.layoutViewportHeight);
  expect(after.shell).toEqual(before.shell);
  expect(after.frame).toEqual(before.frame);
  expect(after.loginPanel).toEqual(before.loginPanel);
  expect(after.scrollX).toBe(before.scrollX);
  expect(after.scrollY).toBe(before.scrollY);
  expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth + 1);
});

test("uses a capped multiline mirror without moving the phone app", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "chromium-desktop", "Multiline keyboard geometry runs on touch devices.");

  await page.setViewportSize(mobileLayoutViewport);
  await installVisualViewportHarness(page);
  await page.goto("/");
  await expect(page.locator(".launch-loader")).toHaveCount(0);
  await page.evaluate(() => {
    const textarea = document.createElement("textarea");
    textarea.setAttribute("aria-label", "Test multiline note");
    textarea.className = "input";
    document.querySelector(".login-panel")?.append(textarea);
  });
  const before = await readMobileLayout(page);
  await page.getByRole("textbox", { name: "Test multiline note" }).tap();
  await setVisualViewportHeight(page, reducedVisualViewportHeight);
  const editor = page.locator("textarea[data-soft-keyboard-editor-control]:not([hidden])");
  await expect(editor).toBeFocused();
  await editor.fill("Line one\nLine two\nLine three");
  await expect(page.getByRole("textbox", { name: "Test multiline note" }).first()).toHaveValue("Line one\nLine two\nLine three");
  const editorBox = await editor.boundingBox();
  expect(editorBox).not.toBeNull();
  expect(editorBox!.height).toBeGreaterThanOrEqual(48);
  expect(editorBox!.height).toBeLessThan(reducedVisualViewportHeight);
  await editor.fill(Array.from({ length: 60 }, (_, index) => `Long visible line ${index + 1}`).join("\n"));
  const cappedEditorBox = await editor.boundingBox();
  const overflowState = await editor.evaluate((element) => ({
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight
  }));
  expect(cappedEditorBox).not.toBeNull();
  expect(cappedEditorBox!.height).toBeLessThan(reducedVisualViewportHeight);
  expect(cappedEditorBox!.y + cappedEditorBox!.height).toBeLessThanOrEqual(reducedVisualViewportHeight - 16);
  expect(overflowState.overflowY).toBe("auto");
  expect(overflowState.scrollHeight).toBeGreaterThan(overflowState.clientHeight);
  const touchScrollTop = await editor.evaluate((element) => {
    element.scrollTop = 0;
    const start = new Event("touchstart", { bubbles: true, cancelable: true });
    Object.defineProperty(start, "touches", { value: [{ clientY: 260 }] });
    element.dispatchEvent(start);
    const move = new Event("touchmove", { bubbles: true, cancelable: true });
    Object.defineProperty(move, "touches", { value: [{ clientY: 140 }] });
    element.dispatchEvent(move);
    element.dispatchEvent(new Event("touchend", { bubbles: true }));
    return element.scrollTop;
  });
  expect(touchScrollTop).toBe(120);
  const wheelScrollTop = await editor.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 90 }));
    return element.scrollTop;
  });
  expect(wheelScrollTop).toBe(90);
  const during = await readMobileLayout(page);
  expect(during.shell).toEqual(before.shell);
  expect(during.frame).toEqual(before.frame);
  expect(during.scrollX).toBe(before.scrollX);
  expect(during.scrollY).toBe(before.scrollY);
});

test("opens the global editor for label taps and focus-only phone activation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "chromium-desktop", "Mobile activation coverage runs on touch devices.");

  await page.setViewportSize(mobileLayoutViewport);
  await installVisualViewportHarness(page);
  await page.goto("/");
  await expect(page.locator(".launch-loader")).toHaveCount(0);
  await page.evaluate(() => {
    const panel = document.querySelector(".login-panel");
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    const labelledInput = document.createElement("input");
    labelText.textContent = "Label-activated field";
    labelledInput.value = "Label value";
    label.append(labelText, labelledInput);

    const focusedInput = document.createElement("input");
    focusedInput.setAttribute("aria-label", "Focus-activated field");
    focusedInput.value = "Focus value";
    panel?.append(label, focusedInput);
  });

  await page.getByText("Label-activated field").tap();
  const editor = page.locator("textarea[data-soft-keyboard-editor-control]:not([hidden])");
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("Label value");
  await page.locator(".soft-keyboard-editor-done").tap();
  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue("Focus value");
  await expect(page.locator("html")).toHaveAttribute("data-soft-keyboard-editor", "open");
});

test("removes the hovering editor when the phone keyboard is dismissed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "chromium-desktop", "Keyboard dismissal coverage runs on touch devices.");

  await page.setViewportSize(mobileLayoutViewport);
  await installVisualViewportHarness(page);
  await page.goto("/");
  await expect(page.locator(".launch-loader")).toHaveCount(0);

  const root = page.locator("html");
  const initialViewportHeight = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
  await page.locator(".auth-gate input[placeholder='Username']").tap();
  await setVisualViewportHeight(page, reducedVisualViewportHeight);
  await expect(root).toHaveAttribute("data-soft-keyboard", "open");
  await expect(root).toHaveAttribute("data-soft-keyboard-editor", "open");

  await setVisualViewportHeight(page, initialViewportHeight);

  await expect.poll(() => page.evaluate(() => ({
    visibleHeight: window.visualViewport?.height,
    stableHeight: document.documentElement.style.getPropertyValue("--app-stable-viewport-height"),
    keyboardState: document.documentElement.dataset.softKeyboard
  }))).toEqual({
    visibleHeight: initialViewportHeight,
    stableHeight: `${initialViewportHeight}px`,
    keyboardState: undefined
  });

  await expect(root).not.toHaveAttribute("data-soft-keyboard");
  await expect(root).not.toHaveAttribute("data-soft-keyboard-editor");
  await expect(page.locator(".soft-keyboard-editor-layer:not([hidden])")).toHaveCount(0);
});

test("removes the hovering editor when an Android overlay keyboard is dismissed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-phone", "Android overlay geometry runs in mobile Chromium.");

  await page.setViewportSize(mobileLayoutViewport);
  await installVirtualKeyboardHarness(page);
  await page.goto("/");
  await expect(page.locator(".launch-loader")).toHaveCount(0);
  const root = page.locator("html");
  await page.locator(".auth-gate input[placeholder='Username']").tap();
  await expect(page.locator("textarea[data-soft-keyboard-editor-control]:not([hidden])")).toBeFocused();
  await expect.poll(() => page.evaluate(() => (
    window.navigator as Navigator & { virtualKeyboard: TestVirtualKeyboard }
  ).virtualKeyboard.showCallCount)).toBeGreaterThan(0);
  await page.evaluate(() => {
    (window.navigator as Navigator & { virtualKeyboard: TestVirtualKeyboard }).virtualKeyboard.setTestGeometry(500, 344);
  });
  await expect(root).toHaveAttribute("data-soft-keyboard-editor", "open");

  await page.evaluate(() => {
    (window.navigator as Navigator & { virtualKeyboard: TestVirtualKeyboard }).virtualKeyboard.setTestGeometry(844, 0);
  });

  await expect(root).not.toHaveAttribute("data-soft-keyboard-editor");
  await expect(page.locator(".soft-keyboard-editor-layer:not([hidden])")).toHaveCount(0);
});

test("removes the hovering editor on outside taps and Back navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "chromium-desktop", "Mobile dismissal coverage runs on touch devices.");

  await page.setViewportSize(mobileLayoutViewport);
  await page.goto("/");
  await expect(page.locator(".launch-loader")).toHaveCount(0);
  await page.evaluate(() => {
    const outside = document.createElement("button");
    outside.type = "button";
    outside.textContent = "Outside target";
    document.querySelector(".login-panel")?.append(outside);
  });

  const root = page.locator("html");
  const username = page.locator(".auth-gate input[placeholder='Username']");
  await username.tap();
  await expect(root).toHaveAttribute("data-soft-keyboard-editor", "open");
  await page.locator(".soft-keyboard-editor-backdrop").tap({ position: { x: 12, y: 12 } });
  await expect(root).not.toHaveAttribute("data-soft-keyboard-editor");
  await expect(page.getByRole("button", { name: "Outside target" })).toBeVisible();

  await page.evaluate(() => window.history.pushState({}, "", "?typing-test=1"));
  await username.tap();
  await expect(root).toHaveAttribute("data-soft-keyboard-editor", "open");
  await page.goBack();
  await expect(root).not.toHaveAttribute("data-soft-keyboard-editor");
  await expect(page.locator(".soft-keyboard-editor-layer:not([hidden])")).toHaveCount(0);
});

test("uses the full device height even when safe-area insets are present", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "chromium-desktop", "Full-device phone geometry runs on touch devices.");

  await page.setViewportSize(mobileLayoutViewport);
  await page.goto("/");
  await expect(page.locator(".launch-loader")).toHaveCount(0);
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-area-inset-top", "24px");
    document.documentElement.style.setProperty("--safe-area-inset-bottom", "32px");
  });

  const shell = page.locator(".portrait-app-shell");
  const frame = page.locator(".portrait-app-frame");
  const shellBox = await shell.boundingBox();
  const frameBox = await frame.boundingBox();
  expect(shellBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  expect(Math.abs(frameBox!.y - shellBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameBox!.height - shellBox!.height)).toBeLessThanOrEqual(1);
});

test("ordinary desktop text focus keeps the login frame stable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "Desktop assertion runs once in Chromium.");

  await page.goto("/");

  const root = page.locator("html");
  const frame = page.locator(".portrait-app-frame");
  const username = page.locator(".auth-gate input[placeholder='Username']");
  await expect(username).toBeVisible();
  await expect(page.locator(".launch-loader")).toHaveCount(0);

  const frameBefore = await frame.boundingBox();
  expect(frameBefore).not.toBeNull();

  await username.click();
  await expect(username).toBeFocused();
  await page.waitForTimeout(500);
  await expect(root).not.toHaveAttribute("data-soft-keyboard");
  await expect(root).not.toHaveAttribute("data-soft-keyboard-editor");
  await expect(page.locator(".soft-keyboard-editor-layer:not([hidden])")).toHaveCount(0);

  const frameAfter = await frame.boundingBox();
  expect(frameAfter).not.toBeNull();
  expect(Math.abs(frameAfter!.width - frameBefore!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameAfter!.height - frameBefore!.height)).toBeLessThanOrEqual(1);
});

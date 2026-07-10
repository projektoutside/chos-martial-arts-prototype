import { expect, test, type Page } from "playwright/test";

const mobileLayoutViewport = { width: 390, height: 844 };
const reducedVisualViewportHeight = 500;

type TestVisualViewport = VisualViewport & {
  setTestHeight: (height: number) => void;
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

async function readMobileLayout(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const shell = document.querySelector<HTMLElement>(".portrait-app-shell");
    const frame = document.querySelector<HTMLElement>(".portrait-app-frame");
    const loginPanel = document.querySelector<HTMLElement>(".login-panel");
    const username = document.querySelector<HTMLInputElement>("input[placeholder='Username']");
    const editor = document.querySelector<HTMLInputElement>("input[data-soft-keyboard-editor-control]:not([hidden])");
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
  const editor = page.locator("input[data-soft-keyboard-editor-control]:not([hidden])");
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
  expect(during.editor!.bottom).toBeLessThanOrEqual(reducedVisualViewportHeight);
  expect(during.editor!.bottom).toBeGreaterThan(reducedVisualViewportHeight - 60);
  expect(during.editorStyle).toEqual(during.sourceStyle);
  expect(during.scrollWidth).toBeLessThanOrEqual(during.clientWidth + 1);
  expect(during.inputFontSize).toBeGreaterThanOrEqual(16);

  await editor.fill("manager.one");
  await expect(username).toHaveValue("manager.one");
  await page.getByRole("button", { name: "Done editing" }).tap();
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
  expect(editorBox!.height).toBeLessThanOrEqual(160);
  const during = await readMobileLayout(page);
  expect(during.shell).toEqual(before.shell);
  expect(during.frame).toEqual(before.frame);
  expect(during.scrollX).toBe(before.scrollX);
  expect(during.scrollY).toBe(before.scrollY);
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

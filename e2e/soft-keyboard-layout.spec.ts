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
    const username = document.querySelector<HTMLInputElement>("input[placeholder='Username']");
    if (!shell || !frame || !username) throw new Error("The login portrait geometry is unavailable.");

    const shellRect = shell.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    return {
      maxTouchPoints: window.navigator.maxTouchPoints,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      touchInputState: root.dataset.touchInput,
      layoutViewportHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport?.height ?? window.innerHeight,
      reportedVisibleHeight: Number.parseFloat(root.style.getPropertyValue("--app-visible-viewport-height")),
      shellHeight: shellRect.height,
      frameWidth: frameRect.width,
      frameLeft: frameRect.left,
      frameRight: frameRect.right,
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      inputFontSize: Number.parseFloat(getComputedStyle(username).fontSize)
    };
  });
}

test("keeps the portrait frame stable while the visual keyboard viewport is reduced", async ({ page }) => {
  await page.setViewportSize(mobileLayoutViewport);
  await installVisualViewportHarness(page);
  await page.goto("/");

  const root = page.locator("html");
  const username = page.getByPlaceholder("Username");
  await expect(username).toBeVisible();
  await expect(page.locator(".launch-loader")).toHaveCount(0);

  const before = await readMobileLayout(page);
  expect(before.maxTouchPoints > 0 || before.coarsePointer).toBe(true);
  expect(before.touchInputState).toBe("true");
  await username.tap();
  await expect(username).toBeFocused();
  await setVisualViewportHeight(page, reducedVisualViewportHeight);
  await expect(root).toHaveAttribute("data-soft-keyboard", "open");

  const during = await readMobileLayout(page);
  expect(during.visualViewportHeight).toBe(reducedVisualViewportHeight);
  expect(during.visualViewportHeight).toBeLessThan(before.visualViewportHeight);
  expect(during.layoutViewportHeight).toBe(before.layoutViewportHeight);
  expect(Math.abs(during.reportedVisibleHeight - reducedVisualViewportHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(during.shellHeight - reducedVisualViewportHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(during.frameWidth - before.frameWidth)).toBeLessThanOrEqual(1);
  expect(during.scrollWidth).toBeLessThanOrEqual(during.clientWidth + 1);
  expect(during.frameLeft).toBeGreaterThanOrEqual(-1);
  expect(during.frameRight).toBeLessThanOrEqual(during.clientWidth + 1);
  expect(during.inputFontSize).toBeGreaterThanOrEqual(16);

  await setVisualViewportHeight(page, before.visualViewportHeight);
  await expect(root).not.toHaveAttribute("data-soft-keyboard");
  await username.blur();
  await expect(username).not.toBeFocused();
  await expect.poll(async () => {
    const restored = await readMobileLayout(page);
    return Math.abs(restored.shellHeight - before.shellHeight);
  }).toBeLessThanOrEqual(1);

  const after = await readMobileLayout(page);
  expect(after.visualViewportHeight).toBe(before.visualViewportHeight);
  expect(after.layoutViewportHeight).toBe(before.layoutViewportHeight);
  expect(Math.abs(after.frameWidth - before.frameWidth)).toBeLessThanOrEqual(1);
  expect(after.scrollWidth).toBeLessThanOrEqual(after.clientWidth + 1);
});

test("ordinary desktop text focus keeps secondary navigation and frame geometry", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "Desktop assertion runs once in Chromium");

  const managerSession = {
    email: "manager123@chos.prototype",
    remembered: true,
    createdAt: "2026-07-09T00:00:00.000Z"
  };
  await page.addInitScript((session) => {
    const value = JSON.stringify(session);
    window.localStorage.setItem("chos.session.v1", value);
    window.sessionStorage.setItem("chos.session.v1", value);
  }, managerSession);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/manager?tool=students");

  const root = page.locator("html");
  const frame = page.locator(".portrait-app-frame");
  const sidebar = page.locator("nav[data-keyboard-secondary-navigation='true']");
  const search = page.getByPlaceholder("Search students");
  await expect(sidebar).toBeVisible();
  await expect(search).toBeVisible();

  const frameBefore = await frame.boundingBox();
  const sidebarBefore = await sidebar.boundingBox();
  expect(frameBefore).not.toBeNull();
  expect(sidebarBefore).not.toBeNull();

  await search.focus();
  await expect(search).toBeFocused();
  await page.waitForTimeout(500);
  await expect(root).not.toHaveAttribute("data-soft-keyboard");
  await expect(sidebar).toBeVisible();

  const frameAfter = await frame.boundingBox();
  const sidebarAfter = await sidebar.boundingBox();
  expect(frameAfter).not.toBeNull();
  expect(sidebarAfter).not.toBeNull();
  expect(Math.abs(frameAfter!.width - frameBefore!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(frameAfter!.height - frameBefore!.height)).toBeLessThanOrEqual(1);
  expect(sidebarAfter!.width).toBeGreaterThan(1);
  expect(sidebarAfter!.height).toBeGreaterThan(1);
});

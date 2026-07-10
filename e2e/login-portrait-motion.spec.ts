import { expect, test, type Page } from "playwright/test";

type PortraitFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  filter: string;
};

async function readPortraitFrame(page: Page): Promise<PortraitFrame> {
  return page.locator(".login-portrait-stage").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      opacity: Number.parseFloat(style.opacity),
      filter: style.filter
    };
  });
}

test("softly reveals the login portrait without moving or scaling it", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const portrait = page.locator(".login-portrait-stage");
  await expect(portrait).toHaveCount(1);

  await page.waitForTimeout(2240);
  const opening = await readPortraitFrame(page);
  await page.waitForTimeout(340);
  const middle = await readPortraitFrame(page);
  await page.waitForTimeout(470);
  const settled = await readPortraitFrame(page);

  for (const frame of [middle, settled]) {
    expect(frame.x).toBeCloseTo(opening.x, 0);
    expect(frame.y).toBeCloseTo(opening.y, 0);
    expect(frame.width).toBeCloseTo(opening.width, 0);
    expect(frame.height).toBeCloseTo(opening.height, 0);
  }
  if (testInfo.project.name === "webkit-iphone" && opening.opacity === settled.opacity) {
    expect(opening.opacity).toBeGreaterThanOrEqual(0.9);
  } else {
    expect(opening.opacity).toBeLessThan(middle.opacity);
    expect(middle.opacity).toBeLessThanOrEqual(settled.opacity);
    expect(opening.filter).not.toBe(settled.filter);
  }
  await page.screenshot({ path: testInfo.outputPath("login-portrait-settled.png"), fullPage: false });
});

test("renders the final portrait immediately when reduced motion is requested", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const portrait = page.locator(".login-portrait-stage");
  await expect(portrait).toHaveCount(1);
  const frame = await readPortraitFrame(page);

  expect(frame.opacity).toBeGreaterThanOrEqual(0.9);
  expect(frame.filter).not.toContain("brightness(0.28)");
  expect(frame.filter).not.toContain("blur(3px)");
});

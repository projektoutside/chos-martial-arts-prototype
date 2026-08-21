import { expect, test } from "playwright/test";
import { readFile } from "node:fs/promises";

function relativeLuminance(color: string) {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  const linear = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

for (const theme of [
  { name: "dark", htmlAttributes: 'data-theme="dark"' },
  { name: "light", htmlAttributes: 'data-theme="light"' },
  {
    name: "adversarial custom palette",
    htmlAttributes: 'data-theme="dark" data-custom-colors="true"',
    customVariables: "--user-visual-border:#777;--user-visual-text:#777;--user-visual-mutedText:#777;--user-visual-elevatedSurface:#777"
  }
]) {
test(`keeps the disabled account submit readable in the ${theme.name} browser cascade`, async ({ page }) => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  await page.setContent(`<html ${theme.htmlAttributes} style="${theme.customVariables ?? ""}"><head><style>${styles}</style></head><body><main class="manager-shell"><form class="create-account-form"><button class="create-account-submit" type="button" disabled>Create Account</button></form></main></body></html>`);
  const submit = page.getByRole("button", { name: "Create Account" });
  await expect(submit).toBeDisabled();

  const computed = await submit.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { opacity: styles.opacity, color: styles.color, backgroundColor: styles.backgroundColor };
  });
  expect(computed.opacity).toBe("1");
  expect(contrastRatio(computed.color, computed.backgroundColor)).toBeGreaterThanOrEqual(4.5);
});
}

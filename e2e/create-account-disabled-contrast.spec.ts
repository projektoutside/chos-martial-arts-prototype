import { expect, test } from "playwright/test";
import { readFile } from "node:fs/promises";

test("keeps the disabled account submit fully opaque in the real browser cascade", async ({ page }) => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  await page.setContent(`<style>${styles}</style><button class="create-account-submit" type="button" disabled>Create Account</button>`);
  const submit = page.getByRole("button", { name: "Create Account" });
  await expect(submit).toBeDisabled();

  const opacity = await submit.evaluate((element) => getComputedStyle(element).opacity);
  expect(opacity).toBe("1");
});

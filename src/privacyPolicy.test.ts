import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public privacy policy artifact", () => {
  const policy = readFileSync(resolve(process.cwd(), "public/privacy-policy.html"), "utf8");

  it("is directly indexable and contains the required mobile privacy statement", () => {
    expect(policy).toContain('name="robots" content="index,follow"');
    expect(policy).toContain("will not be shared, sold, rented, or disclosed to third parties or affiliates for marketing or promotional purposes");
  });

  it("states SMS consent, rate, opt-out, and help terms", () => {
    expect(policy).toContain("SMS consent is not a condition of purchase");
    expect(policy).toContain("Message and data rates may apply");
    expect(policy).toContain("STOP");
    expect(policy).toContain("HELP");
  });
});

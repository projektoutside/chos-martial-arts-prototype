import { describe, expect, it } from "vitest";
import { accountPasswordPolicyText, validateAccountPasswordChange } from "./accountPassword";

describe("account password validation", () => {
  it("requires a strong matching replacement password", () => {
    expect(validateAccountPasswordChange("", "")).toBe("Enter and confirm a new password.");
    expect(validateAccountPasswordChange("StrongPass123!", "DifferentPass123!")).toBe("Passwords must match.");
    expect(validateAccountPasswordChange("short", "short")).toBe(accountPasswordPolicyText);
    expect(validateAccountPasswordChange(" StrongPass123! ", "StrongPass123!")).toBeUndefined();
  });
});

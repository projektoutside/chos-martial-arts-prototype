import { describe, expect, it } from "vitest";
import {
  activatedAppMetadata,
  activationRequiredAppMetadata,
  requiresPasswordChange,
  validateActivationPassword
} from "../supabase/functions/_shared/account-activation";

describe("new-account activation contract", () => {
  it("treats only an explicit admin flag as activation-required", () => {
    expect(requiresPasswordChange(undefined)).toBe(false);
    expect(requiresPasswordChange({ requires_password_change: false })).toBe(false);
    expect(requiresPasswordChange({ requires_password_change: true })).toBe(true);
  });

  it("preserves metadata while setting and clearing the activation flag", () => {
    expect(activationRequiredAppMetadata({ role: "staff" })).toEqual({
      role: "staff",
      requires_password_change: true
    });
    expect(activatedAppMetadata({ role: "staff", requires_password_change: true })).toEqual({
      role: "staff",
      requires_password_change: false
    });
  });

  it("rejects weak or reused replacement passwords", () => {
    expect(validateActivationPassword("short", "TemporaryPass123!")).toMatch(/12 characters/i);
    expect(validateActivationPassword("TemporaryPass123!", "TemporaryPass123!")).toMatch(/different/i);
    expect(validateActivationPassword("PermanentPass456!", "TemporaryPass123!")).toBeUndefined();
  });
});

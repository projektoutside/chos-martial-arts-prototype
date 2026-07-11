import { describe, expect, it } from "vitest";

import { resolveAppEnvironment } from "./appEnvironment";

function env(values: Partial<ImportMetaEnv> = {}): ImportMetaEnv {
  return {
    BASE_URL: "/",
    DEV: false,
    MODE: "production",
    PROD: true,
    SSR: false,
    ...values
  } as ImportMetaEnv;
}

describe("resolveAppEnvironment", () => {
  it("creates a network-disabled demo environment for the testing variant", () => {
    const result = resolveAppEnvironment(env({
      VITE_APP_VARIANT: "testing",
      VITE_SUPABASE_URL: "https://zfuwbbepsnmmlpgfkmhz.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "must-not-be-used"
    }));

    expect(result).toEqual({
      variant: "testing",
      kind: "demo",
      displayName: "Cho's Testing",
      demo: true,
      supabaseUrl: "",
      supabasePublicKey: "",
      capabilities: {
        supabase: false,
        sms: false,
        email: false,
        push: false,
        payments: false
      }
    });
  });

  it("accepts the approved Cho Supabase host for stable builds", () => {
    const result = resolveAppEnvironment(env({
      VITE_APP_VARIANT: "stable",
      VITE_SUPABASE_URL: "https://zfuwbbepsnmmlpgfkmhz.supabase.co"
    }));

    expect(result.variant).toBe("stable");
    expect(result.supabaseUrl).toBe("https://zfuwbbepsnmmlpgfkmhz.supabase.co");
    expect(result.capabilities.supabase).toBe(true);
  });

  it("rejects missing and unknown variants in production", () => {
    expect(() => resolveAppEnvironment(env())).toThrow("VITE_APP_VARIANT must be stable or testing");
    expect(() => resolveAppEnvironment(env({ VITE_APP_VARIANT: "preview" as "stable" }))).toThrow(
      "VITE_APP_VARIANT must be stable or testing"
    );
  });

  it("rejects a foreign Supabase host in a stable build", () => {
    expect(() => resolveAppEnvironment(env({
      VITE_APP_VARIANT: "stable",
      VITE_SUPABASE_URL: "https://foreign-project.supabase.co"
    }))).toThrow("Stable builds may only use the approved Cho Supabase project");
  });

  it("does not expose a Supabase URL or key to testing consumers", async () => {
    const result = resolveAppEnvironment(env({
      VITE_APP_VARIANT: "testing",
      VITE_SUPABASE_URL: "https://zfuwbbepsnmmlpgfkmhz.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "stable-key"
    }));
    expect(result.supabaseUrl).toBe("");
    expect(result.supabasePublicKey).toBe("");
  });
});

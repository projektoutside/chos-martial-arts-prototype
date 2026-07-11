export type AppVariant = "stable" | "testing";
export type RemoteCapability = "supabase" | "sms" | "email" | "push" | "payments";

export interface AppEnvironment {
  variant: AppVariant;
  kind: "stable" | "demo";
  displayName: "Cho's Martial Arts" | "Cho's Testing";
  demo: boolean;
  supabaseUrl: string;
  capabilities: Readonly<Record<RemoteCapability, boolean>>;
}

const approvedChoSupabaseHost = "zfuwbbepsnmmlpgfkmhz.supabase.co";
const disabledCapabilities: Readonly<Record<RemoteCapability, boolean>> = Object.freeze({
  supabase: false,
  sms: false,
  email: false,
  push: false,
  payments: false
});
const stableCapabilities: Readonly<Record<RemoteCapability, boolean>> = Object.freeze({
  supabase: true,
  sms: true,
  email: true,
  push: true,
  payments: true
});

function productionVariant(env: ImportMetaEnv): AppVariant {
  const variant = env.VITE_APP_VARIANT?.trim();
  if (variant === "stable" || variant === "testing") return variant;
  if (!env.PROD) return "stable";
  throw new Error("VITE_APP_VARIANT must be stable or testing for production builds.");
}

function approvedStableSupabaseUrl(rawUrl: string | undefined) {
  const url = rawUrl?.trim() ?? "";
  if (!url) return "";
  let hostname = "";
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error("Stable builds require a valid Cho Supabase URL.");
  }
  if (hostname !== approvedChoSupabaseHost) {
    throw new Error("Stable builds may only use the approved Cho Supabase project.");
  }
  return url.replace(/\/+$/, "");
}

export function resolveAppEnvironment(env: ImportMetaEnv): AppEnvironment {
  const variant = productionVariant(env);
  if (variant === "testing") {
    return {
      variant,
      kind: "demo",
      displayName: "Cho's Testing",
      demo: true,
      supabaseUrl: "",
      capabilities: disabledCapabilities
    };
  }

  return {
    variant,
    kind: "stable",
    displayName: "Cho's Martial Arts",
    demo: false,
    supabaseUrl: approvedStableSupabaseUrl(env.VITE_SUPABASE_URL),
    capabilities: stableCapabilities
  };
}

export const appEnvironment = resolveAppEnvironment(import.meta.env);

export function isDemoEnvironment() {
  return appEnvironment.demo;
}

export function assertRemoteCapability(capability: RemoteCapability) {
  if (!appEnvironment.capabilities[capability]) {
    throw new Error(`Remote capability ${capability} is disabled in the demo environment.`);
  }
}

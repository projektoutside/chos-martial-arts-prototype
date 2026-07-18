import { getSupabaseBrowserConfig, isSupabaseAuthConfigured, readSupabaseAuthSession } from "./supabaseAccounts";

export const guidedOnboardingProgressStoragePrefix = "chos.guidedOnboarding";

type StoredGuidedOnboardingProgress = {
  schemaVersion: 1;
  seenFeatureIds: string[];
  updatedAt: string;
};

type RemoteGuidedOnboardingProgress = {
  feature_id?: unknown;
};

const validFeatureIdPattern = /^[a-z0-9][a-z0-9._-]{2,119}$/;

export function normalizeGuidedOnboardingFeatureId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return validFeatureIdPattern.test(normalized) ? normalized : undefined;
}

function normalizeIdentity(identity?: string) {
  return (identity ?? "user")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "") || "user";
}

export function guidedOnboardingProgressStorageKey(identity?: string) {
  return `${guidedOnboardingProgressStoragePrefix}.${normalizeIdentity(identity)}.v1`;
}

export function normalizeGuidedOnboardingFeatureIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeGuidedOnboardingFeatureId).filter((item): item is string => Boolean(item)))].sort();
}

export function mergeGuidedOnboardingFeatureIds(...collections: readonly (Iterable<string>)[]) {
  return normalizeGuidedOnboardingFeatureIds(collections.flatMap((collection) => [...collection]));
}

export function readLocalGuidedOnboardingProgress(identity?: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(guidedOnboardingProgressStorageKey(identity));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredGuidedOnboardingProgress>;
    return normalizeGuidedOnboardingFeatureIds(parsed.seenFeatureIds);
  } catch {
    return [];
  }
}

export function writeLocalGuidedOnboardingProgress(identity: string | undefined, featureIds: Iterable<string>) {
  const seenFeatureIds = normalizeGuidedOnboardingFeatureIds([...featureIds]);
  if (typeof window === "undefined") return seenFeatureIds;
  try {
    const payload: StoredGuidedOnboardingProgress = {
      schemaVersion: 1,
      seenFeatureIds,
      updatedAt: new Date().toISOString()
    };
    window.localStorage.setItem(guidedOnboardingProgressStorageKey(identity), JSON.stringify(payload));
  } catch {
    // The current in-memory tutorial session still works when storage is unavailable.
  }
  return seenFeatureIds;
}

function remoteRequestContext() {
  if (!isSupabaseAuthConfigured()) return undefined;
  const session = readSupabaseAuthSession();
  const config = getSupabaseBrowserConfig();
  if (!session || !config.url || !config.publicKey) return undefined;
  return { config, session };
}

async function readRemoteGuidedOnboardingProgress() {
  const context = remoteRequestContext();
  if (!context) return undefined;
  const url = new URL(`${context.config.url.replace(/\/+$/, "")}/rest/v1/user_onboarding_progress`);
  url.searchParams.set("select", "feature_id");
  url.searchParams.set("user_id", `eq.${context.session.userId}`);

  const response = await fetch(url, {
    headers: {
      apikey: context.config.publicKey,
      Authorization: `Bearer ${context.session.accessToken}`
    }
  });
  if (!response.ok) throw new Error("Unable to verify remote guided onboarding progress.");
  const rows = await response.json() as RemoteGuidedOnboardingProgress[];
  return normalizeGuidedOnboardingFeatureIds(rows.map((row) => row.feature_id));
}

export async function loadGuidedOnboardingProgress(identity?: string) {
  const localFeatureIds = readLocalGuidedOnboardingProgress(identity);
  const remoteFeatureIds = await readRemoteGuidedOnboardingProgress();
  const mergedFeatureIds = mergeGuidedOnboardingFeatureIds(localFeatureIds, remoteFeatureIds ?? []);
  writeLocalGuidedOnboardingProgress(identity, mergedFeatureIds);
  if (remoteFeatureIds && mergedFeatureIds.length !== remoteFeatureIds.length) {
    await persistGuidedOnboardingProgress(identity, mergedFeatureIds);
  }
  return mergedFeatureIds;
}

export async function persistGuidedOnboardingProgress(identity: string | undefined, featureIds: Iterable<string>) {
  const featureIdsToPersist = normalizeGuidedOnboardingFeatureIds([...featureIds]);
  const seenFeatureIds = mergeGuidedOnboardingFeatureIds(readLocalGuidedOnboardingProgress(identity), featureIdsToPersist);
  writeLocalGuidedOnboardingProgress(identity, seenFeatureIds);
  const context = remoteRequestContext();
  if (!context) return;

  if (!featureIdsToPersist.length) return;
  const response = await fetch(`${context.config.url.replace(/\/+$/, "")}/rest/v1/user_onboarding_progress?on_conflict=user_id,feature_id`, {
    method: "POST",
    headers: {
      apikey: context.config.publicKey,
      Authorization: `Bearer ${context.session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify(featureIdsToPersist.map((featureId) => ({
      user_id: context.session.userId,
      feature_id: featureId
    })))
  });
  if (!response.ok) throw new Error("Unable to save remote guided onboarding progress.");
}

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabaseAccounts", () => ({
  getSupabaseBrowserConfig: () => ({ url: "https://example.supabase.co", publicKey: "public-test-key" }),
  isSupabaseAuthConfigured: () => true,
  readSupabaseAuthSession: () => ({ accessToken: "test-access-token", userId: "11111111-1111-1111-1111-111111111111" })
}));

import {
  guidedOnboardingProgressStorageKey,
  loadGuidedOnboardingProgress,
  persistGuidedOnboardingProgress,
  writeLocalGuidedOnboardingProgress
} from "./onboardingProgress";

describe("guided onboarding remote progress", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads remotely completed features before choosing a tutorial target", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([
      { feature_id: "staff.panel.v1" },
      { feature_id: "staff.launcher.studyguide.v1" }
    ]), { status: 200 }));

    await expect(loadGuidedOnboardingProgress("staff.one")).resolves.toEqual([
      "staff.launcher.studyguide.v1",
      "staff.panel.v1"
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(window.localStorage.getItem(guidedOnboardingProgressStorageKey("staff.one")) ?? "{}").seenFeatureIds).toEqual([
      "staff.launcher.studyguide.v1",
      "staff.panel.v1"
    ]);
  });

  it("adds only the newly completed immutable feature row without dropping local history", async () => {
    writeLocalGuidedOnboardingProgress("staff.two", ["staff.panel.v1"]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 201 }));

    await persistGuidedOnboardingProgress("staff.two", ["Staff.Launcher.StudyGuide.V1"]);

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toContain("on_conflict=user_id,feature_id");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual([{
      user_id: "11111111-1111-1111-1111-111111111111",
      feature_id: "staff.launcher.studyguide.v1"
    }]);
    expect(JSON.parse(window.localStorage.getItem(guidedOnboardingProgressStorageKey("staff.two")) ?? "{}").seenFeatureIds).toEqual([
      "staff.launcher.studyguide.v1",
      "staff.panel.v1"
    ]);
  });

  it("fails closed when authenticated cross-device progress cannot be verified", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));

    await expect(loadGuidedOnboardingProgress("staff.three")).rejects.toThrow("offline");
  });

  it("reports a rejected remote completion so the next load can retry it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));

    await expect(persistGuidedOnboardingProgress("staff.four", ["staff.panel.v1"]))
      .rejects.toThrow("Unable to save remote guided onboarding progress.");
  });
});

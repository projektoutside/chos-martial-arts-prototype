import { beforeEach, describe, expect, it } from "vitest";
import {
  guidedOnboardingProgressStorageKey,
  mergeGuidedOnboardingFeatureIds,
  normalizeGuidedOnboardingFeatureId,
  normalizeGuidedOnboardingFeatureIds,
  readLocalGuidedOnboardingProgress,
  writeLocalGuidedOnboardingProgress
} from "./onboardingProgress";

describe("guided onboarding progress", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("uses a normalized per-user storage key", () => {
    expect(guidedOnboardingProgressStorageKey(" Manager 123@Cho's Prototype ")).toBe("chos.guidedOnboarding.manager-123-cho-s-prototype.v1");
  });

  it("deduplicates, validates, and sorts stable feature IDs", () => {
    expect(normalizeGuidedOnboardingFeatureId(" Staff.Launcher.StudyGuide.V1 ")).toBe("staff.launcher.studyguide.v1");
    expect(normalizeGuidedOnboardingFeatureIds([
      "staff.students.v1",
      "staff.dashboard.v1",
      "staff.students.v1",
      "Invalid Feature",
      "x"
    ])).toEqual(["staff.dashboard.v1", "staff.students.v1"]);
    expect(mergeGuidedOnboardingFeatureIds(["student.panel.v1"], new Set(["student.profile.v1"]))).toEqual([
      "student.panel.v1",
      "student.profile.v1"
    ]);
  });

  it("round-trips only valid progress without throwing on corrupt storage", () => {
    writeLocalGuidedOnboardingProgress("parent.one", ["parent.add-child.v1", "bad id"]);
    expect(readLocalGuidedOnboardingProgress("parent.one")).toEqual(["parent.add-child.v1"]);

    window.localStorage.setItem(guidedOnboardingProgressStorageKey("parent.two"), "not-json");
    expect(readLocalGuidedOnboardingProgress("parent.two")).toEqual([]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  hasSeenTestingUpdate,
  markTestingUpdateSeen,
  testingUpdateNotice,
  testingUpdateNotices
} from "./testingUpdateNotice";

describe("testing update acknowledgements", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exposes newest-first versioned update history", () => {
    expect(testingUpdateNotices[0]).toMatchObject({
      id: "2026-07-19-app-update-history",
      version: "0.1.6-testing",
      title: "App updates are always easy to find"
    });
    expect(testingUpdateNotices[1]).toMatchObject({
      id: "2026-07-10-new-installed-app-icon",
      version: "0.1.6",
      title: "A new Cho's app icon"
    });
    expect(testingUpdateNotices[2]).toMatchObject({
      id: "2026-07-10-locked-intro-keyboard-anchor",
      version: "0.1.5",
      title: "A smoother start and better phone typing"
    });
    expect(testingUpdateNotices[3]).toMatchObject({
      id: "2026-07-10-immersive-mobile-typing",
      version: "0.1.4",
      title: "A cleaner full-screen phone experience"
    });
    expect(testingUpdateNotices[4]).toMatchObject({
      id: "2026-07-10-android-keyboard-first-tap",
      version: "0.1.3",
      title: "Phone typing now opens more reliably"
    });
    expect(testingUpdateNotices[5]).toMatchObject({ version: "0.1.2" });
    expect(testingUpdateNotices[6]).toMatchObject({ version: "0.1.1" });
    expect(testingUpdateNotices.length).toBeGreaterThan(0);

    for (const notice of testingUpdateNotices) {
      expect(notice.version.trim()).not.toBe("");
      expect(notice.date.trim()).not.toBe("");
      expect(notice.title.trim()).not.toBe("");
      expect(notice.changes.length).toBeGreaterThan(0);
      expect(notice.changes.every((change) => change.trim() !== "")).toBe(true);
    }
  });

  it("keeps the newest notice as the acknowledgement alias", () => {
    expect(testingUpdateNotice).toBe(testingUpdateNotices[0]);
  });

  it("tracks each notice acknowledgement for the signed-in account", () => {
    const managerEmail = "Manager123@chos.prototype";

    expect(hasSeenTestingUpdate(managerEmail)).toBe(false);

    markTestingUpdateSeen(managerEmail);

    expect(hasSeenTestingUpdate(managerEmail)).toBe(true);
    expect(hasSeenTestingUpdate("student456@chos.prototype")).toBe(false);
    expect(hasSeenTestingUpdate(managerEmail, `${testingUpdateNotice.id}-next`)).toBe(false);
  });
});

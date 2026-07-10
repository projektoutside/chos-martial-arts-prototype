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
    expect(testingUpdateNotices[0]).toMatchObject({ version: "0.1.1" });
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

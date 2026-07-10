import { beforeEach, describe, expect, it } from "vitest";
import {
  hasSeenTestingUpdate,
  markTestingUpdateSeen,
  testingUpdateNotice
} from "./testingUpdateNotice";

describe("testing update acknowledgements", () => {
  beforeEach(() => {
    localStorage.clear();
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

import { describe, expect, it } from "vitest";
import { createKarateActionSchedule, getIntroCharacterAction, pickRandomKarateAction } from "./loginCharacterMotion";

describe("login character motion scheduling", () => {
  it("starts with the roundhouse kick unless reduced motion is preferred", () => {
    expect(getIntroCharacterAction(false)).toBe("roundhouseKick");
    expect(getIntroCharacterAction(true)).toBe("guardIdle");
  });

  it("selects deterministic random karate actions from an injected RNG", () => {
    expect(pickRandomKarateAction(() => 0)).toBe("frontPunch");
    expect(pickRandomKarateAction(() => 0.49)).toBe("sideKick");
    expect(pickRandomKarateAction(() => 0.99)).toBe("readyBounce");
  });

  it("creates a deterministic schedule with idle gaps after the intro", () => {
    const values = [0.2, 0.2, 0.95, 0.8];
    const schedule = createKarateActionSchedule({
      count: 2,
      random: () => values.shift() ?? 0
    });

    expect(schedule).toEqual([
      { name: "roundhouseKick", delayMs: 0, durationMs: 1800 },
      { name: "highBlock", delayMs: 2280, durationMs: 1100 },
      { name: "readyBounce", delayMs: 3720, durationMs: 1200 }
    ]);
  });

  it("uses one static guard action for reduced motion", () => {
    expect(createKarateActionSchedule({ reducedMotion: true, count: 4, random: () => 0.5 })).toEqual([
      { name: "guardIdle", delayMs: 0, durationMs: 0 }
    ]);
  });
});

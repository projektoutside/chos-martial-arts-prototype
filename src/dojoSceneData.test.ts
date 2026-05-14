import { describe, expect, it } from "vitest";
import { buildDojoScenePanels } from "./dojoSceneData";
import type { AppTopic, BeltRank, ClassEvent } from "./types";

const topics: AppTopic[] = [
  { slug: "today", label: "Today", summary: "See what to do next.", path: "/", tone: "today", group: "student" },
  { slug: "classes", label: "Classes", summary: "Find today and this week.", path: "/classes", tone: "schedule", group: "student" },
  { slug: "progress", label: "My Progress", summary: "Check belt rank and goals.", path: "/my-account?topic=progress", tone: "progress", group: "student" }
];

const guardianTopics: AppTopic[] = [
  { slug: "orders", label: "Orders", summary: "Pickup and order history.", path: "/my-account?topic=orders", tone: "orders", group: "parent" }
];

const currentBelt: BeltRank = {
  slug: "yellow",
  name: "Yellow",
  color: "#f3c400",
  textColor: "#161109",
  level: "Early Growth",
  focus: "Stronger front kicks and class confidence.",
  meaning: "Like sunlight on new growth, fundamentals begin to take root.",
  classesRequired: 14
};

const nextBelt: BeltRank = {
  slug: "orange",
  name: "Orange",
  color: "#ef7a16",
  textColor: "#1b0b03",
  level: "Building Power",
  focus: "Timing and turning kicks.",
  meaning: "Energy increases with intent.",
  classesRequired: 20
};

const nextClass: ClassEvent = {
  id: "class-1",
  ruleId: "classes",
  title: "Youth Beginners Martial Training",
  date: "2026-05-12",
  startTime: "5:00 PM",
  endTime: "5:40 PM",
  description: "Beginner youth martial arts fundamentals."
};

describe("buildDojoScenePanels", () => {
  it("builds exactly one dojo panel for each visible topic and preserves CTA paths", () => {
    const panels = buildDojoScenePanels({
      studentTopics: topics,
      guardianTopics,
      displayName: "student",
      currentBelt,
      nextBelt,
      nextClass,
      ordersCount: 2,
      bookingsCount: 1,
      guardianChildrenCount: 3
    });

    expect(panels.map((panel) => panel.id)).toEqual(["today", "classes", "progress", "orders"]);
    expect(new Set(panels.map((panel) => panel.id)).size).toBe(panels.length);
    expect(panels.find((panel) => panel.id === "classes")?.cta).toEqual({
      label: "Open Classes",
      href: "/classes"
    });
    expect(panels.find((panel) => panel.id === "progress")?.stats).toContainEqual({
      label: "Current belt",
      value: "Yellow"
    });
    expect(panels.find((panel) => panel.id === "orders")?.stats).toContainEqual({
      label: "Saved orders",
      value: "2"
    });
  });
});

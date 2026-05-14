import type { AppTopic, BeltRank, ClassEvent } from "./types";
import { displayDate } from "./utils";
import type { DojoPanelData, DojoPanelStat } from "./dojoSceneTypes";

interface BuildDojoScenePanelsInput {
  studentTopics: AppTopic[];
  guardianTopics: AppTopic[];
  displayName: string;
  currentBelt: BeltRank;
  nextBelt?: BeltRank;
  nextClass?: ClassEvent;
  ordersCount: number;
  bookingsCount: number;
  guardianChildrenCount: number;
}

function ctaLabel(topic: AppTopic) {
  return `Open ${topic.label.replace(/^My\s+/i, "")}`;
}

function countStat(label: string, count: number): DojoPanelStat {
  return { label, value: String(count) };
}

function buildPanelForTopic(topic: AppTopic, input: BuildDojoScenePanelsInput): DojoPanelData {
  const nextClassLabel = input.nextClass ? `${displayDate(input.nextClass.date)} at ${input.nextClass.startTime}` : "Check the class schedule";
  const base: DojoPanelData = {
    id: topic.slug,
    buttonLabel: topic.label,
    eyebrow: topic.group === "parent" ? "Guardian Parent" : "Student Path",
    title: topic.label,
    subtitle: topic.summary,
    description: topic.summary,
    cta: { label: ctaLabel(topic), href: topic.path },
    tone: topic.tone,
    group: topic.group
  };

  switch (topic.slug) {
    case "today":
      return {
        ...base,
        eyebrow: "Awakening Dojo",
        title: "Today",
        subtitle: `Welcome back, ${input.displayName}.`,
        description: "Start with the next class, your current belt, and one clear action for the day.",
        stats: [
          { label: "Current belt", value: input.currentBelt.name },
          { label: "Next class", value: nextClassLabel },
          { label: "Next goal", value: input.nextBelt ? `${input.nextBelt.name} Belt` : "Black Belt training" }
        ],
        sections: [
          {
            heading: "Focus",
            body: input.currentBelt.focus
          },
          {
            heading: "Mindset",
            body: input.currentBelt.meaning
          }
        ],
        cta: { label: "Open Classes", href: "/classes" }
      };
    case "classes":
      return {
        ...base,
        description: "See upcoming class times and keep your training rhythm steady.",
        stats: [
          { label: "Next class", value: input.nextClass?.title ?? "Class schedule" },
          { label: "Time", value: nextClassLabel }
        ],
        sections: [
          {
            heading: "What to check",
            body: "Confirm the time, age group, and training focus before you head to the dojo."
          }
        ]
      };
    case "progress":
      return {
        ...base,
        description: "Track belt progress, readiness habits, and the next rank you are training toward.",
        stats: [
          { label: "Current belt", value: input.currentBelt.name },
          { label: "Level", value: input.currentBelt.level },
          { label: "Next goal", value: input.nextBelt ? input.nextBelt.name : "Black Belt training" }
        ],
        sections: [
          {
            heading: "Current focus",
            body: input.currentBelt.focus
          },
          {
            heading: "Rank meaning",
            body: input.currentBelt.meaning
          }
        ]
      };
    case "practice":
      return {
        ...base,
        description: "Review simple goals for forms, kicks, stance work, and respectful training habits.",
        sections: [
          {
            heading: "Training cue",
            body: "Choose one skill to repeat calmly before adding speed or power."
          },
          {
            heading: "Dojo standard",
            body: "Respect, discipline, focus, and perseverance shape every practice session."
          }
        ]
      };
    case "programs":
      return {
        ...base,
        description: "Explore the training paths available at Cho's and choose the program that fits your goals.",
        sections: [
          {
            heading: "Training path",
            body: "Youth Taekwondo, MMA, self-defense, and fitness options all connect back to steady personal growth."
          }
        ]
      };
    case "help":
      return {
        ...base,
        description: "Send a quick question, call the studio, or ask for help choosing the next training step.",
        sections: [
          {
            heading: "Support",
            body: "Use this when you need schedule help, account help, lesson questions, or a simple next-step answer."
          }
        ]
      };
    case "children":
      return {
        ...base,
        description: "Create and monitor child subaccounts from one guardian-friendly place.",
        stats: [countStat("Child accounts", input.guardianChildrenCount)]
      };
    case "orders":
      return {
        ...base,
        description: "Review pickup orders and order history without leaving the student home flow.",
        stats: [countStat("Saved orders", input.ordersCount)]
      };
    case "bookings":
      return {
        ...base,
        description: "Check saved class and private lesson requests for the family.",
        stats: [countStat("Saved bookings", input.bookingsCount)]
      };
    case "shop":
      return {
        ...base,
        description: "Open uniforms, gear, and starter program items from the dojo scene."
      };
    case "profile":
      return {
        ...base,
        description: "Keep student contact settings and account details current."
      };
    default:
      return base;
  }
}

export function buildDojoScenePanels(input: BuildDojoScenePanelsInput): DojoPanelData[] {
  const topics = [...input.studentTopics, ...input.guardianTopics];
  const panels = topics.map((topic) => buildPanelForTopic(topic, input));
  const seen = new Set<string>();
  return panels.filter((panel) => {
    if (seen.has(panel.id)) {
      return false;
    }
    seen.add(panel.id);
    return true;
  });
}

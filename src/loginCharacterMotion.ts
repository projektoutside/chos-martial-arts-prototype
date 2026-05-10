export const randomKarateActions = ["frontPunch", "highBlock", "sideKick", "bow", "readyBounce"] as const;
export const loginCharacterActions = ["roundhouseKick", "guardIdle", ...randomKarateActions] as const;

export type RandomKarateAction = (typeof randomKarateActions)[number];
export type LoginCharacterAction = (typeof loginCharacterActions)[number];

export interface ScheduledKarateAction {
  name: LoginCharacterAction;
  delayMs: number;
  durationMs: number;
}

interface ScheduleOptions {
  count?: number;
  random?: () => number;
  reducedMotion?: boolean;
}

const actionDurations: Record<LoginCharacterAction, number> = {
  roundhouseKick: 1800,
  guardIdle: 0,
  frontPunch: 900,
  highBlock: 1100,
  sideKick: 1300,
  bow: 1400,
  readyBounce: 1200
};

export function getIntroCharacterAction(reducedMotion: boolean): LoginCharacterAction {
  return reducedMotion ? "guardIdle" : "roundhouseKick";
}

export function pickRandomKarateAction(random: () => number = Math.random): RandomKarateAction {
  const value = Math.max(0, Math.min(0.999999, random()));
  return randomKarateActions[Math.floor(value * randomKarateActions.length)];
}

export function createKarateActionSchedule({ count = 6, random = Math.random, reducedMotion = false }: ScheduleOptions = {}): ScheduledKarateAction[] {
  if (reducedMotion) {
    return [{ name: "guardIdle", delayMs: 0, durationMs: actionDurations.guardIdle }];
  }

  const schedule: ScheduledKarateAction[] = [{ name: "roundhouseKick", delayMs: 0, durationMs: actionDurations.roundhouseKick }];
  for (let index = 0; index < count; index += 1) {
    const name = pickRandomKarateAction(random);
    const delayMs = Math.round(1800 + Math.max(0, Math.min(0.999999, random())) * 2400);
    schedule.push({ name, delayMs, durationMs: actionDurations[name] });
  }
  return schedule;
}

import type { StudentRecord } from "./types";

export const DEMO_DATA_VERSION = 1;
export const demoStoragePrefix = `chos.testing.demo.v${DEMO_DATA_VERSION}.`;

export interface DemoState {
  students: StudentRecord[];
}

export function createDemoState(): DemoState {
  return {
    students: [
      {
        id: "demo-student-maya",
        firstName: "Maya",
        lastName: "Rivera",
        dateOfBirth: "2014-04-18",
        phone: "+1-312-555-0101",
        email: "maya.rivera@example.com",
        guardianName: "Elena Rivera",
        guardianPhone: "+1-312-555-0102",
        guardianEmail: "elena.rivera@example.com",
        enrollmentDate: "2025-09-03",
        program: "Youth Foundations",
        status: "active",
        beltRank: "Yellow Belt",
        classesAttended: 31,
        missedClassCount: 1,
        lastCheckIn: "2026-07-09T17:02:00.000Z",
        profileUpdatedAt: "2026-07-01T14:00:00.000Z",
        joinedAt: "2025-09-03T14:00:00.000Z",
        notes: "Demo student: preparing for the next belt evaluation."
      },
      {
        id: "demo-student-noah",
        firstName: "Noah",
        lastName: "Bennett",
        dateOfBirth: "2011-11-09",
        phone: "+1-312-555-0111",
        email: "noah.bennett@example.com",
        guardianName: "Jordan Bennett",
        guardianPhone: "+1-312-555-0112",
        guardianEmail: "jordan.bennett@example.com",
        enrollmentDate: "2024-02-12",
        program: "Family Training",
        status: "active",
        beltRank: "Green Belt",
        classesAttended: 78,
        missedClassCount: 0,
        lastCheckIn: "2026-07-10T18:01:00.000Z",
        profileUpdatedAt: "2026-06-24T16:30:00.000Z",
        joinedAt: "2024-02-12T15:00:00.000Z",
        notes: "Demo student: leadership-team candidate."
      }
    ]
  };
}

export function demoStorageKey(stableKey: string) {
  return `${demoStoragePrefix}${stableKey.replace(/^chos\./, "")}`;
}

export function resetDemoState(storage: Pick<Storage, "length" | "key" | "removeItem">) {
  const demoKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(demoStoragePrefix)) demoKeys.push(key);
  }
  for (const key of demoKeys) storage.removeItem(key);
}

import { describe, expect, it } from "vitest";

import { createDemoState, demoStorageKey, resetDemoState } from "./demoData";

describe("demo data", () => {
  it("is deterministic and uses fictional contact details", () => {
    const first = createDemoState();
    const second = createDemoState();

    expect(first).toEqual(second);
    expect(first.students.length).toBeGreaterThan(1);
    for (const student of first.students) {
      expect(student.email).toMatch(/@example\.com$/);
      expect(student.phone).toMatch(/^\+1-312-555-01\d{2}$/);
      expect(student.guardianEmail).toMatch(/@example\.com$/);
      expect(student.guardianPhone).toMatch(/^\+1-312-555-01\d{2}$/);
    }
    expect(JSON.stringify(first)).not.toContain("zfuwbbepsnmmlpgfkmhz");
    expect(JSON.stringify(first)).not.toContain("supabase.co");
  });

  it("namespaces demo storage without changing stable keys", () => {
    expect(demoStorageKey("chos.operations.students.v1")).toBe("chos.testing.demo.v1.operations.students.v1");
  });

  it("resets only demo storage", () => {
    const values = new Map([
      ["chos.testing.demo.v1.operations.students.v1", "demo"],
      ["chos.testing.demo.v1.session.v1", "demo-session"],
      ["chos.operations.students.v1", "stable"]
    ]);
    const storage = {
      get length() { return values.size; },
      key(index: number) { return [...values.keys()][index] ?? null; },
      removeItem(key: string) { values.delete(key); }
    };

    resetDemoState(storage);

    expect([...values.entries()]).toEqual([["chos.operations.students.v1", "stable"]]);
  });
});

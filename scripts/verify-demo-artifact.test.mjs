import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { scanDemoArtifact } from "./verify-demo-artifact.mjs";

test("accepts a safe demo artifact", () => {
  const root = mkdtempSync(path.join(tmpdir(), "chos-demo-safe-"));
  try {
    writeFileSync(path.join(root, "app.js"), "Demo Environment; no remote services configured.");
    assert.deepEqual(scanDemoArtifact(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports stable project references without exposing unrelated content", () => {
  const root = mkdtempSync(path.join(tmpdir(), "chos-demo-forbidden-"));
  try {
    mkdirSync(path.join(root, "assets"));
    writeFileSync(path.join(root, "assets", "app.js"), "https://zfuwbbepsnmmlpgfkmhz.supabase.co");
    assert.deepEqual(scanDemoArtifact(root), [{ file: "assets/app.js", rule: "cho-stable-supabase-project" }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

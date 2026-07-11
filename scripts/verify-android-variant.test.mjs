import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gradle = readFileSync(new URL("../android/app/build.gradle", import.meta.url), "utf8");

test("defines stable and testing Android identities", () => {
  assert.match(gradle, /flavorDimensions\s+["']environment["']/);
  assert.match(gradle, /stable\s*\{[\s\S]*applicationId\s+["']com\.xatoridev\.chosmartialarts["']/);
  assert.match(gradle, /demo\s*\{[\s\S]*applicationId\s+["']com\.xatoridev\.chosmartialarts\.testing["']/);
});

test("keeps independent version codes and names", () => {
  assert.match(gradle, /stable\s*\{[\s\S]*versionCode\s+7[\s\S]*versionName\s+["']0\.1\.6["']/);
  assert.match(gradle, /demo\s*\{[\s\S]*versionCode\s+1[\s\S]*versionName\s+["']0\.1\.0-testing["']/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gradle = readFileSync(new URL("../android/app/build.gradle", import.meta.url), "utf8");

test("defines stable and testing Android identities", () => {
  assert.match(gradle, /flavorDimensions\s+["']environment["']/);
  assert.match(gradle, /stable\s*\{[\s\S]*applicationId\s+["']com\.xatoridev\.chosmartialarts["']/);
  assert.match(gradle, /demo\s*\{[\s\S]*applicationId\s+["']com\.xatoridev\.chosmartialarts\.testing["']/);
});

test("keeps independent default versions with release overrides", () => {
  assert.match(gradle, /releaseVersionCode\s*=\s*\(System\.getenv\(['"]ANDROID_VERSION_CODE['"]\)/);
  assert.match(gradle, /stable\s*\{[\s\S]*versionCode releaseVersionCode > 0 \? releaseVersionCode : 7[\s\S]*versionName releaseVersionName \?: ["']0\.1\.6["']/);
  assert.match(gradle, /demo\s*\{[\s\S]*versionCode releaseVersionCode > 0 \? releaseVersionCode : 1[\s\S]*versionName releaseVersionName \?: ["']0\.1\.0-testing["']/);
});

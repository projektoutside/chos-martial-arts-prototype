import assert from "node:assert/strict";
import test from "node:test";

import { validatePlayReleaseInput } from "./validate-play-release-input.mjs";

test("accepts the two exact closed-testing destinations", () => {
  assert.deepEqual(validatePlayReleaseInput({
    variant: "testing", packageName: "com.xatoridev.chosmartialarts.testing", track: "client-preview",
    versionCode: "2", versionName: "0.1.1-testing", releaseNotes: "Preview the new attendance flow."
  }), []);
  assert.deepEqual(validatePlayReleaseInput({
    variant: "stable", packageName: "com.xatoridev.chosmartialarts", track: "client-stable",
    versionCode: "8", versionName: "0.1.7", releaseNotes: "Approved client-testing update."
  }), []);
});

test("rejects cross-package, public-track, and incomplete releases", () => {
  const errors = validatePlayReleaseInput({
    variant: "testing", packageName: "com.xatoridev.chosmartialarts", track: "production",
    versionCode: "0", versionName: "", releaseNotes: ""
  });
  assert.ok(errors.includes("Package name does not match the selected variant."));
  assert.ok(errors.includes("Track must be the private client-preview closed-testing track."));
  assert.ok(errors.includes("Version code must be a positive integer."));
  assert.ok(errors.includes("Version name is required."));
  assert.ok(errors.includes("Release notes are required."));
});

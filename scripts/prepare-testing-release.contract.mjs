import assert from "node:assert/strict";
import test from "node:test";

import { prepareTestingRelease, TESTING_BUILD_OFFSET } from "./prepare-testing-release.mjs";

const base = {
  runNumber: "8",
  packageVersion: "0.1.6",
  releaseNotes: "",
  commitSubject: "Add attendance filters",
  eventName: "push",
  manualUploadRequested: "",
  automaticUploadEnabled: "true",
  gitRef: "refs/heads/main"
};

test("creates one monotonic build identity for both private testing stores", () => {
  assert.deepEqual(prepareTestingRelease(base), {
    buildNumber: String(TESTING_BUILD_OFFSET + 8),
    iosVersionName: "0.1.6",
    androidVersionName: "0.1.6-testing",
    releaseNotes: "Add attendance filters",
    uploadEnabled: "true"
  });
});

test("keeps push uploads behind the automatic release kill switch", () => {
  assert.equal(
    prepareTestingRelease({ ...base, automaticUploadEnabled: "false" }).uploadEnabled,
    "false"
  );
  assert.equal(
    prepareTestingRelease({
      ...base,
      eventName: "workflow_dispatch",
      automaticUploadEnabled: "true",
      manualUploadRequested: "false"
    }).uploadEnabled,
    "false"
  );
  assert.equal(
    prepareTestingRelease({
      ...base,
      eventName: "workflow_dispatch",
      automaticUploadEnabled: "false",
      manualUploadRequested: "true"
    }).uploadEnabled,
    "true"
  );
});

test("rejects invalid release versions and build inputs", () => {
  assert.throws(() => prepareTestingRelease({ ...base, runNumber: "0" }), /positive integer/);
  assert.throws(() => prepareTestingRelease({ ...base, packageVersion: "0.1" }), /three numeric/);
  assert.throws(
    () => prepareTestingRelease({ ...base, gitRef: "refs/heads/feature/demo" }),
    /must originate from main/
  );
});

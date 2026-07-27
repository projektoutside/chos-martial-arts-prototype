import assert from "node:assert/strict";
import test from "node:test";

import { prepareTestingRelease, TESTING_BUILD_OFFSET } from "./prepare-testing-release.mjs";

const base = {
  runNumber: "8",
  packageVersion: "0.1.6",
  releaseNotes: "",
  commitSubject: "Add attendance filters",
  eventName: "push",
  manualBuildRequested: "",
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
    buildEnabled: "true",
    uploadEnabled: "true"
  });
});

test("keeps push uploads behind the automatic release kill switch", () => {
  const disabledPush = prepareTestingRelease({ ...base, automaticUploadEnabled: "false" });
  assert.equal(disabledPush.buildEnabled, "false");
  assert.equal(disabledPush.uploadEnabled, "false");

  const manualVerify = prepareTestingRelease({
    ...base,
    eventName: "workflow_dispatch",
    automaticUploadEnabled: "true",
    manualBuildRequested: "false",
    manualUploadRequested: "false"
  });
  assert.equal(manualVerify.buildEnabled, "false");
  assert.equal(manualVerify.uploadEnabled, "false");

  const manualUpload = prepareTestingRelease({
    ...base,
    eventName: "workflow_dispatch",
    automaticUploadEnabled: "false",
    manualBuildRequested: "false",
    manualUploadRequested: "true"
  });
  assert.equal(manualUpload.buildEnabled, "true");
  assert.equal(manualUpload.uploadEnabled, "true");
});

test("builds signed artifacts without enabling either store upload", () => {
  const buildOnly = prepareTestingRelease({
    ...base,
    eventName: "workflow_dispatch",
    automaticUploadEnabled: "false",
    manualBuildRequested: "true",
    manualUploadRequested: "false"
  });
  assert.equal(buildOnly.buildEnabled, "true");
  assert.equal(buildOnly.uploadEnabled, "false");
});

test("rejects invalid release versions and build inputs", () => {
  assert.throws(() => prepareTestingRelease({ ...base, runNumber: "0" }), /positive integer/);
  assert.throws(() => prepareTestingRelease({ ...base, packageVersion: "0.1" }), /three numeric/);
  assert.throws(
    () => prepareTestingRelease({ ...base, gitRef: "refs/heads/feature/demo" }),
    /must originate from main/
  );
  assert.throws(
    () => prepareTestingRelease({
      ...base,
      eventName: "workflow_dispatch",
      automaticUploadEnabled: "false",
      manualBuildRequested: "true",
      manualUploadRequested: "false",
      gitRef: "refs/heads/feature/demo"
    }),
    /Signed private-store builds must originate from main/
  );
});

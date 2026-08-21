import assert from "node:assert/strict";
import test from "node:test";
import {
  IOS_RELEASE_IDENTITIES,
  IOS_RELEASE_IDENTITY,
  validateIosReleaseInput
} from "./validate-ios-release-input.mjs";

const validInput = {
  variant: "stable",
  ...IOS_RELEASE_IDENTITY,
  versionName: "0.1.13",
  buildNumber: "1",
  operation: "archive-only"
};

test("accepts the stable Cho archive-only identity", () => {
  assert.deepEqual(validateIosReleaseInput(validInput), validInput);
});

test("accepts the isolated testing identity for archive and TestFlight upload only", () => {
  const testingInput = {
    variant: "testing",
    ...IOS_RELEASE_IDENTITIES.testing,
    versionName: "0.1.6",
    buildNumber: "100001",
    operation: "testflight-upload"
  };
  assert.deepEqual(validateIosReleaseInput(testingInput), testingInput);
  assert.deepEqual(
    validateIosReleaseInput({ ...testingInput, operation: "archive-only" }),
    { ...testingInput, operation: "archive-only" }
  );
});

test("rejects cross-app or unrelated Apple identities", () => {
  assert.throws(
    () => validateIosReleaseInput({ ...validInput, bundleId: "com.xatoridev.chosmartialarts.testing" }),
    /bundle ID/
  );
  assert.throws(() => validateIosReleaseInput({ ...validInput, teamId: "ABCDEFGHIJ" }), /Apple team/);
});

test("rejects upload operations and invalid Apple versions", () => {
  assert.throws(
    () => validateIosReleaseInput({ ...validInput, operation: "testflight-upload" }),
    /must never upload/
  );
  assert.throws(
    () => validateIosReleaseInput({
      ...validInput,
      variant: "testing",
      ...IOS_RELEASE_IDENTITIES.testing,
      operation: "app-store-review"
    }),
    /only archive or upload to TestFlight/
  );
  assert.throws(() => validateIosReleaseInput({ ...validInput, versionName: "0.1" }), /three numeric/);
  assert.throws(() => validateIosReleaseInput({ ...validInput, buildNumber: "0" }), /positive integer/);
});

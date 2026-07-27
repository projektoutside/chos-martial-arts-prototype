import assert from "node:assert/strict";
import test from "node:test";
import { IOS_RELEASE_IDENTITY, validateIosReleaseInput } from "./validate-ios-release-input.mjs";

const validInput = {
  ...IOS_RELEASE_IDENTITY,
  versionName: "0.1.13",
  buildNumber: "1",
  operation: "archive-only"
};

test("accepts the stable Cho archive-only identity", () => {
  assert.deepEqual(validateIosReleaseInput(validInput), validInput);
});

test("rejects testing or unrelated Apple identities", () => {
  assert.throws(
    () => validateIosReleaseInput({ ...validInput, bundleId: "com.xatoridev.chosmartialarts.testing" }),
    /bundle ID/
  );
  assert.throws(() => validateIosReleaseInput({ ...validInput, teamId: "ABCDEFGHIJ" }), /Apple team/);
});

test("rejects upload operations and invalid Apple versions", () => {
  assert.throws(() => validateIosReleaseInput({ ...validInput, operation: "upload" }), /must never upload/);
  assert.throws(() => validateIosReleaseInput({ ...validInput, versionName: "0.1" }), /three numeric/);
  assert.throws(() => validateIosReleaseInput({ ...validInput, buildNumber: "0" }), /positive integer/);
});

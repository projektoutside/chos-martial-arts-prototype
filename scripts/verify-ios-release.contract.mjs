import assert from "node:assert/strict";
import test from "node:test";
import { verifyIosRelease } from "./verify-ios-release.mjs";

test("verifies the checked-in stable iOS target and signing inputs", () => {
  assert.deepEqual(verifyIosRelease(), {
    bundleId: "com.xatoridev.chosmartialarts",
    teamId: "9R42C8LZ43",
    version: "0.1.13",
    build: "1",
    deploymentTarget: "15.0",
    capacitorVersion: "8.4.1"
  });
});

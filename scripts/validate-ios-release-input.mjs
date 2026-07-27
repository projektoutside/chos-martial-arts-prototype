import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

export const IOS_RELEASE_IDENTITY = Object.freeze({
  appName: "Cho's Martial Arts",
  bundleId: "com.xatoridev.chosmartialarts",
  teamId: "9R42C8LZ43"
});

export function validateIosReleaseInput({
  appName,
  bundleId,
  teamId,
  versionName,
  buildNumber,
  operation
}) {
  assert.equal(appName, IOS_RELEASE_IDENTITY.appName, "Only the stable Cho's Martial Arts app is allowed");
  assert.equal(bundleId, IOS_RELEASE_IDENTITY.bundleId, "The iOS bundle ID does not match the stable app");
  assert.equal(teamId, IOS_RELEASE_IDENTITY.teamId, "The Apple team does not match Cho's registered team");
  assert.equal(operation, "archive-only", "This workflow must never upload or submit an Apple build");
  assert.match(versionName, /^\d+\.\d+\.\d+$/, "Version must use three numeric components, for example 0.1.13");
  assert.ok(versionName.length <= 18, "Version must be 18 characters or fewer");
  assert.match(buildNumber, /^[1-9]\d*$/, "Build number must be a positive integer");
  assert.ok(buildNumber.length <= 18, "Build number must be 18 digits or fewer");

  return {
    appName,
    bundleId,
    teamId,
    versionName,
    buildNumber,
    operation
  };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const [appName, bundleId, teamId, versionName, buildNumber, operation] = process.argv.slice(2);
  validateIosReleaseInput({ appName, bundleId, teamId, versionName, buildNumber, operation });
  console.log(
    `Validated archive-only iOS release ${bundleId} ${versionName} (${buildNumber}) for Apple team ${teamId}.`
  );
}

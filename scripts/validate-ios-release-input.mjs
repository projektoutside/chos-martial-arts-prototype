import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { APPLE_TEAM_ID, releaseIdentity } from "./release-identities.mjs";

export const IOS_RELEASE_IDENTITIES = Object.freeze({
  stable: Object.freeze({
    appName: releaseIdentity("stable").appName,
    bundleId: releaseIdentity("stable").appleBundleId,
    teamId: APPLE_TEAM_ID
  }),
  testing: Object.freeze({
    appName: releaseIdentity("testing").appName,
    bundleId: releaseIdentity("testing").appleBundleId,
    teamId: APPLE_TEAM_ID
  })
});

export const IOS_RELEASE_IDENTITY = IOS_RELEASE_IDENTITIES.stable;

export function validateIosReleaseInput({
  variant = "stable",
  appName,
  bundleId,
  teamId,
  versionName,
  buildNumber,
  operation
}) {
  const identity = IOS_RELEASE_IDENTITIES[variant];
  assert.ok(identity, "Variant must be stable or testing");
  assert.equal(appName, identity.appName, `The iOS app name does not match the ${variant} app`);
  assert.equal(bundleId, identity.bundleId, `The iOS bundle ID does not match the ${variant} app`);
  assert.equal(teamId, identity.teamId, "The Apple team does not match Cho's registered team");
  if (variant === "stable") {
    assert.equal(operation, "archive-only", "The stable Apple workflow must never upload or submit a build");
  } else {
    assert.ok(
      operation === "archive-only" || operation === "testflight-upload",
      "The testing Apple workflow may only archive or upload to TestFlight"
    );
  }
  assert.match(versionName, /^\d+\.\d+\.\d+$/, "Version must use three numeric components, for example 0.1.13");
  assert.ok(versionName.length <= 18, "Version must be 18 characters or fewer");
  assert.match(buildNumber, /^[1-9]\d*$/, "Build number must be a positive integer");
  assert.ok(buildNumber.length <= 18, "Build number must be 18 digits or fewer");

  return {
    variant,
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
  const [variant, appName, bundleId, teamId, versionName, buildNumber, operation] = process.argv.slice(2);
  validateIosReleaseInput({ variant, appName, bundleId, teamId, versionName, buildNumber, operation });
  console.log(
    `Validated ${operation} iOS ${variant} release ${bundleId} ${versionName} (${buildNumber}) for Apple team ${teamId}.`
  );
}

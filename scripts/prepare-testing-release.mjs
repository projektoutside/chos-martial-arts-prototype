import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

export const TESTING_BUILD_OFFSET = 100_000;

export function prepareTestingRelease({
  runNumber,
  packageVersion,
  releaseNotes,
  commitSubject,
  eventName,
  manualBuildRequested,
  manualUploadRequested,
  automaticUploadEnabled,
  gitRef
}) {
  assert.match(String(runNumber), /^[1-9]\d*$/, "GitHub run number must be a positive integer");
  assert.match(packageVersion, /^\d+\.\d+\.\d+$/, "Package version must use three numeric components");
  assert.ok(packageVersion.length <= 18, "Package version must be 18 characters or fewer");

  const buildNumber = TESTING_BUILD_OFFSET + Number(runNumber);
  assert.ok(Number.isSafeInteger(buildNumber), "Computed testing build number must be a safe integer");
  assert.ok(buildNumber <= 2_100_000_000, "Computed testing build number exceeds Google Play's limit");

  const notes = (releaseNotes?.trim() || commitSubject?.trim() || `Testing build ${buildNumber}`)
    .replace(/\s+/g, " ")
    .slice(0, 500);
  assert.ok(notes, "Release notes are required");

  const uploadEnabled =
    (eventName === "workflow_dispatch" && manualUploadRequested === "true") ||
    (eventName === "push" && automaticUploadEnabled === "true");
  const buildEnabled =
    uploadEnabled ||
    (eventName === "workflow_dispatch" && manualBuildRequested === "true");
  if (buildEnabled) {
    assert.equal(gitRef, "refs/heads/main", "Signed private-store builds must originate from main");
  }

  return {
    buildNumber: String(buildNumber),
    iosVersionName: packageVersion,
    androidVersionName: `${packageVersion}-testing`,
    releaseNotes: notes,
    buildEnabled: String(buildEnabled),
    uploadEnabled: String(uploadEnabled)
  };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const [
    runNumber,
    packageVersion,
    releaseNotes,
    commitSubject,
    eventName,
    manualBuildRequested,
    manualUploadRequested,
    automaticUploadEnabled,
    gitRef
  ] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(prepareTestingRelease({
    runNumber,
    packageVersion,
    releaseNotes,
    commitSubject,
    eventName,
    manualBuildRequested,
    manualUploadRequested,
    automaticUploadEnabled,
    gitRef
  })));
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function verifyTestingStoreWorkflow(root = process.cwd()) {
  const workflow = readFileSync(`${root}/.github/workflows/release-testing-stores.yml`, "utf8");
  const fastfile = readFileSync(`${root}/fastlane/Fastfile`, "utf8");

  assert.match(workflow, /branches:\s*\n\s+- main\b/, "Automatic releases must originate from main");
  assert.match(workflow, /TESTING_STORE_AUTO_UPLOAD_ENABLED/, "Push uploads need a global kill switch");
  assert.match(workflow, /build_signed_artifacts/, "Manual runs need a signed-build-only mode");
  assert.match(workflow, /build_enabled/, "Signed builds need an independent upload gate");
  assert.match(workflow, /build_enabled: release\.buildEnabled/);
  assert.match(workflow, /upload_enabled: release\.uploadEnabled/);
  assert.match(workflow, /build_number: release\.buildNumber/);
  assert.match(workflow, /ios_version_name: release\.iosVersionName/);
  assert.match(workflow, /android_version_name: release\.androidVersionName/);
  assert.match(workflow, /release_notes: release\.releaseNotes/);
  assert.match(workflow, /gitRef: process\.env\.GITHUB_REF/, "Uploads must verify their source branch");
  assert.match(workflow, /ANDROID_PACKAGE_NAME: com\.xatoridev\.chosmartialarts\.testing/);
  assert.match(workflow, /APPLE_BUNDLE_ID: com\.xatoridev\.chosmartialarts\.testing/);
  assert.match(workflow, /PLAY_TRACK: internal/);
  assert.match(workflow, /needs:\s*\n\s+- quality\s*\n\s+- build-android\s*\n\s+- build-ios/g);
  assert.match(workflow, /environment: google-play-testing/g);
  assert.match(workflow, /environment: apple-testflight-testing/g);
  assert.match(workflow, /APPLE_PROVISIONING_PROFILE_BASE64/);
  assert.match(workflow, /CODE_SIGN_STYLE=Manual/);
  assert.match(workflow, /CODE_SIGN_IDENTITY="Apple Distribution"/);
  assert.match(workflow, /PROVISIONING_PROFILE_SPECIFIER="\$APPLE_PROVISIONING_PROFILE_NAME"/);
  assert.match(workflow, /<key>signingStyle<\/key>\s*\n\s*<string>manual<\/string>/);
  assert.match(workflow, /<key>provisioningProfiles<\/key>/);
  assert.doesNotMatch(workflow, /CODE_SIGN_STYLE=Automatic/);
  assert.match(
    workflow,
    /name: Build signed Android testing bundle[\s\S]*?if: needs\.quality\.outputs\.build_enabled == 'true'/
  );
  assert.match(
    workflow,
    /name: Build signed iOS testing archive[\s\S]*?if: needs\.quality\.outputs\.build_enabled == 'true'/
  );
  assert.match(
    workflow,
    /name: Upload to Google Play internal testing[\s\S]*?if: needs\.quality\.outputs\.upload_enabled == 'true'/
  );
  assert.match(
    workflow,
    /name: Upload to Apple TestFlight[\s\S]*?if: needs\.quality\.outputs\.upload_enabled == 'true'/
  );
  assert.match(workflow, /testflight-upload/);
  assert.match(workflow, /status: completed/);
  assert.doesNotMatch(workflow, /track:\s*(production|beta|alpha)\b/i);

  assert.match(fastfile, /expected_bundle_id = "com\.xatoridev\.chosmartialarts\.testing"/);
  assert.match(fastfile, /upload_to_testflight/);
  assert.match(fastfile, /skip_submission: !distribute/);
  assert.match(fastfile, /distribute_external: distribute/);
  assert.match(fastfile, /notify_external_testers: distribute/);
  assert.doesNotMatch(fastfile, /\bupload_to_app_store\b|\bdeliver\s*\(/);

  return {
    androidPackage: "com.xatoridev.chosmartialarts.testing",
    appleBundle: "com.xatoridev.chosmartialarts.testing",
    playTrack: "internal",
    appleDestination: "TestFlight"
  };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const result = verifyTestingStoreWorkflow();
  console.log(
    `Verified paired private-store workflow: ${result.androidPackage} -> ${result.playTrack}; ${result.appleBundle} -> ${result.appleDestination}.`
  );
}

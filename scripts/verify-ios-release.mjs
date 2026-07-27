import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APPLE_TEAM_ID, releaseIdentity } from "./release-identities.mjs";

const EXPECTED_CAPACITOR_VERSION = "8.4.1";
const EXPECTED_IOS_VERSION = "0.1.13";
const EXPECTED_IOS_BUILD = "1";

export function readPngHeader(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  assert.equal(signature, "89504e470d0a1a0a", "App icon must be a PNG");
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR", "PNG must begin with an IHDR chunk");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25]
  };
}

function count(source, value) {
  return source.split(value).length - 1;
}

export function verifyIosRelease(root = process.cwd(), variant = "stable") {
  const identity = releaseIdentity(variant);
  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  assert.equal(
    packageJson.dependencies["@capacitor/ios"],
    EXPECTED_CAPACITOR_VERSION,
    "@capacitor/ios must be pinned to the same release as the existing Capacitor packages"
  );
  assert.equal(packageJson.dependencies["@capacitor/core"], `^${EXPECTED_CAPACITOR_VERSION}`);
  assert.equal(packageJson.dependencies["@capacitor/android"], `^${EXPECTED_CAPACITOR_VERSION}`);
  assert.equal(packageJson.devDependencies["@capacitor/cli"], `^${EXPECTED_CAPACITOR_VERSION}`);

  const capacitorConfig = JSON.parse(readFileSync(resolve(root, "capacitor.config.json"), "utf8"));
  assert.equal(capacitorConfig.appId, releaseIdentity("stable").appleBundleId);
  assert.equal(capacitorConfig.appName, releaseIdentity("stable").appName);
  assert.equal(capacitorConfig.webDir, "dist");

  const project = readFileSync(resolve(root, "ios/App/App.xcodeproj/project.pbxproj"), "utf8");
  assert.equal(count(project, `PRODUCT_BUNDLE_IDENTIFIER = ${releaseIdentity("stable").appleBundleId};`), 2);
  assert.equal(count(project, `DEVELOPMENT_TEAM = ${APPLE_TEAM_ID};`), 2);
  assert.equal(count(project, `APP_DISPLAY_NAME = "${releaseIdentity("stable").appName}";`), 2);
  assert.equal(count(project, "CODE_SIGN_STYLE = Automatic;"), 2);
  assert.equal(count(project, "IPHONEOS_DEPLOYMENT_TARGET = 15.0;") >= 2, true);
  assert.equal(count(project, `MARKETING_VERSION = ${EXPECTED_IOS_VERSION};`), 2);
  assert.equal(count(project, `CURRENT_PROJECT_VERSION = ${EXPECTED_IOS_BUILD};`), 2);

  const infoPlist = readFileSync(resolve(root, "ios/App/App/Info.plist"), "utf8");
  assert.match(infoPlist, /<key>CFBundleIdentifier<\/key>\s*<string>\$\(PRODUCT_BUNDLE_IDENTIFIER\)<\/string>/);
  assert.match(infoPlist, /<key>CFBundleDisplayName<\/key>\s*<string>\$\(APP_DISPLAY_NAME\)<\/string>/);
  assert.match(infoPlist, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);

  const swiftPackage = readFileSync(resolve(root, "ios/App/CapApp-SPM/Package.swift"), "utf8");
  assert.match(swiftPackage, /platforms: \[\.iOS\(\.v15\)\]/);
  assert.match(
    swiftPackage,
    new RegExp(`capacitor-swift-pm\\.git", exact: "${EXPECTED_CAPACITOR_VERSION.replaceAll(".", "\\.")}"`)
  );

  const icon = readPngHeader(
    readFileSync(resolve(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"))
  );
  assert.deepEqual(
    { width: icon.width, height: icon.height },
    { width: 1024, height: 1024 },
    "App Store icon must be 1024x1024"
  );
  assert.equal(icon.colorType, 2, "App Store icon must be RGB without an alpha channel");

  const testingIcon = readPngHeader(
    readFileSync(resolve(root, "ios/App/App/Assets.xcassets/AppIconTesting.appiconset/AppIconTesting-1024.png"))
  );
  assert.deepEqual(
    { width: testingIcon.width, height: testingIcon.height },
    { width: 1024, height: 1024 },
    "Testing App Store icon must be 1024x1024"
  );
  assert.equal(testingIcon.colorType, 2, "Testing App Store icon must be RGB without an alpha channel");

  const nativeConfig = JSON.parse(readFileSync(resolve(root, "ios/App/App/capacitor.config.json"), "utf8"));
  assert.equal(nativeConfig.appId, identity.appleBundleId, `Generated iOS config must match ${variant}`);
  assert.equal(nativeConfig.appName, identity.appName, `Generated iOS display name must match ${variant}`);

  return {
    variant,
    bundleId: identity.appleBundleId,
    teamId: APPLE_TEAM_ID,
    version: EXPECTED_IOS_VERSION,
    build: EXPECTED_IOS_BUILD,
    deploymentTarget: "15.0",
    capacitorVersion: EXPECTED_CAPACITOR_VERSION
  };
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  const variant = process.argv[2] ?? "stable";
  const result = verifyIosRelease(process.cwd(), variant);
  console.log(
    `Verified iOS ${result.variant} archive inputs: ${result.bundleId} ${result.version} (${result.build}), team ${result.teamId}, iOS ${result.deploymentTarget}+, Capacitor ${result.capacitorVersion}.`
  );
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { assertMainActivitySoftInputMode } from "./android-manifest-contract.mjs";
import { assertImmersiveMainActivity, assertImmersiveTheme } from "./android-immersive-contract.mjs";

const root = process.cwd();
const expected = {
  appId: "com.xatoridev.chosmartialarts",
  appName: "Cho's Martial Arts",
  webDir: "dist",
  versionCode: 6,
  versionName: "0.1.5"
};

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(existsSync(absolutePath), `${relativePath} must exist`);
  return readFileSync(absolutePath, "utf8");
}

function sha256(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(existsSync(absolutePath), `${relativePath} must exist`);
  return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
}

const capacitorConfig = JSON.parse(read("capacitor.config.json"));
assert.equal(capacitorConfig.appId, expected.appId, "Capacitor appId must stay stable");
assert.equal(capacitorConfig.appName, expected.appName, "Capacitor appName must match the Play app");
assert.equal(capacitorConfig.webDir, expected.webDir, "Capacitor must package the Vite dist directory");
assert.equal(capacitorConfig.loggingBehavior, "none", "Release builds must not emit Capacitor logs");
assert.equal(capacitorConfig.server?.androidScheme, "https", "Android must use a secure local origin");

const packageJson = JSON.parse(read("package.json"));
assert.equal(packageJson.version, expected.versionName, "Package version must match Android versionName");
assert.match(packageJson.dependencies?.["@capacitor/core"] ?? "", /^\^?8\./, "Capacitor core v8 is required");
assert.match(packageJson.dependencies?.["@capacitor/android"] ?? "", /^\^?8\./, "Capacitor Android v8 is required");
assert.match(packageJson.devDependencies?.["@capacitor/cli"] ?? "", /^\^?8\./, "Capacitor CLI v8 is required");

const appGradle = read("android/app/build.gradle");
assert.match(appGradle, new RegExp(`namespace\\s*=?\\s*["']${expected.appId.replaceAll(".", "\\.")}["']`));
assert.match(appGradle, new RegExp(`applicationId ["']${expected.appId.replaceAll(".", "\\.")}["']`));
assert.match(appGradle, new RegExp(`versionCode ${expected.versionCode}(?:\\D|$)`));
assert.match(appGradle, new RegExp(`versionName ["']${expected.versionName.replaceAll(".", "\\.")}["']`));
assert.match(appGradle, /rootProject\.file\(["']key\.properties["']\)/, "Release signing must read android/key.properties");
assert.match(appGradle, /signingConfigs\s*\{[\s\S]*release\s*\{/, "A release signing config is required");
assert.match(appGradle, /signingConfig signingConfigs\.release/, "Release bundles must use the upload key");

const signingExample = read("android/key.properties.example");
for (const field of ["storeFile", "storePassword", "keyAlias", "keyPassword"]) {
  assert.match(signingExample, new RegExp(`^${field}=`, "m"), `Signing example must document ${field}`);
}

const variablesGradle = read("android/variables.gradle");
const minSdk = Number(variablesGradle.match(/minSdkVersion\s*=\s*(\d+)/)?.[1]);
const targetSdk = Number(variablesGradle.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1]);
assert.ok(minSdk >= 24, `minSdkVersion must be at least 24, received ${minSdk}`);
assert.ok(targetSdk >= 35, `targetSdkVersion must be at least 35, received ${targetSdk}`);

const manifest = read("android/app/src/main/AndroidManifest.xml");
assertMainActivitySoftInputMode(manifest);
assert.match(manifest, /android\.permission\.INTERNET/, "Android app must be allowed to reach Supabase staging");
assertImmersiveMainActivity(read("android/app/src/main/java/com/xatoridev/chosmartialarts/MainActivity.java"));
assertImmersiveTheme(read("android/app/src/main/res/values/styles.xml"));

const gitignore = read(".gitignore");
assert.match(gitignore, /^\*\.jks$/m, "Signing keystores must be ignored");
assert.match(gitignore, /^android\/key\.properties$/m, "Signing properties must be ignored");

if (process.env.REQUIRE_ANDROID_SIGNING === "1") {
  const signingProperties = read("android/key.properties");
  const properties = Object.fromEntries(
    signingProperties
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split(/=(.*)/s).slice(0, 2))
  );
  assert.ok(properties.storeFile, "Signing properties must include storeFile");
  assert.ok(properties.storePassword, "Signing properties must include storePassword");
  assert.ok(properties.keyAlias, "Signing properties must include keyAlias");
  assert.ok(properties.keyPassword, "Signing properties must include keyPassword");
  assert.ok(existsSync(path.join(root, "android", properties.storeFile)), "The configured upload keystore must exist");
}

assert.equal(
  sha256("assets/icon-only.png"),
  sha256("public/icons/icon-512.png"),
  "Android launcher assets must be generated from the existing Cho's icon"
);
assert.equal(
  sha256("assets/splash.png"),
  sha256("public/icons/icon-512.png"),
  "Android splash assets must be generated from the existing Cho's icon"
);
assert.notEqual(
  sha256("android/app/src/main/res/drawable/splash.png"),
  "5cf98b4451bd99b20df26f9e608a46946118be6b0ae90762f9ca1786a30c76ff",
  "The default Capacitor splash screen must be replaced"
);
for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
  assert.ok(
    existsSync(path.join(root, `android/app/src/main/res/mipmap-${density}/ic_launcher.png`)),
    `Android launcher icon must exist for ${density}`
  );
  assert.equal(
    sha256(`android/app/src/main/res/mipmap-${density}/ic_launcher_foreground_cho.png`),
    sha256(`android/app/src/main/res/mipmap-${density}/ic_launcher.png`),
    `Adaptive launcher foreground must reuse the padded Cho's icon for ${density}`
  );
}
for (const launcherName of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
  const adaptiveIcon = read(`android/app/src/main/res/mipmap-anydpi-v26/${launcherName}`);
  assert.match(adaptiveIcon, /@mipmap\/ic_launcher_foreground_cho/, `${launcherName} must use the padded Cho's branded foreground`);
  assert.doesNotMatch(adaptiveIcon, /@mipmap\/ic_launcher_foreground["']/, `${launcherName} must not use the default Capacitor foreground`);
}
assert.match(
  read("android/app/src/main/res/values/ic_launcher_background.xml"),
  /#080809/i,
  "Adaptive launcher icons must use the Cho's dark background"
);

console.log(
  `Android release config verified: ${expected.appId} v${expected.versionName} (${expected.versionCode}), target SDK ${targetSdk}.`
);

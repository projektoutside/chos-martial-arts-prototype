import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareIosVariant } from "./prepare-ios-variant.mjs";

test("rewrites only generated Capacitor identity for the testing iOS archive", () => {
  const root = mkdtempSync(path.join(tmpdir(), "chos-ios-variant-"));
  try {
    const configDir = path.join(root, "ios", "App", "App");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      path.join(configDir, "capacitor.config.json"),
      JSON.stringify({ appId: "stable", appName: "Stable", webDir: "dist", plugins: { SplashScreen: {} } })
    );
    const result = prepareIosVariant("testing", root);
    const config = JSON.parse(readFileSync(result.nativeConfigPath, "utf8"));
    assert.equal(config.appId, "com.xatoridev.chosmartialarts.testing");
    assert.equal(config.appName, "Cho's Testing");
    assert.equal(config.webDir, "dist");
    assert.deepEqual(config.plugins, { SplashScreen: {} });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects unknown iOS variants", () => {
  assert.throws(() => prepareIosVariant("preview"), /stable or testing/);
});

import { describe, expect, it } from "vitest";

import { assertMainActivitySoftInputMode } from "./android-manifest-contract.mjs";

function activity(name, softInputModes = []) {
  const modeAttributes = softInputModes
    .map((mode) => `android:windowSoftInputMode="${mode}"`)
    .join(" ");
  return `<activity android:name="${name}" ${modeAttributes}></activity>`;
}

function manifest(...declarations) {
  return `<manifest xmlns:android="http://schemas.android.com/apk/res/android">${declarations.join("")}</manifest>`;
}

describe("Android manifest soft-input contract", () => {
  it("accepts one MainActivity with one adjustResize declaration", () => {
    expect(() => assertMainActivitySoftInputMode(manifest(activity(".MainActivity", ["adjustResize"])))).not.toThrow();
  });

  it("rejects a missing MainActivity", () => {
    expect(() => assertMainActivitySoftInputMode(manifest(activity(".OtherActivity")))).toThrow();
  });

  it("rejects a MainActivity missing its soft-input mode", () => {
    expect(() => assertMainActivitySoftInputMode(manifest(activity(".MainActivity")))).toThrow();
  });

  it("rejects duplicate MainActivity declarations", () => {
    expect(() =>
      assertMainActivitySoftInputMode(
        manifest(activity(".MainActivity", ["adjustResize"]), activity(".MainActivity"))
      )
    ).toThrow();
  });

  it("rejects duplicate soft-input declarations", () => {
    expect(() =>
      assertMainActivitySoftInputMode(manifest(activity(".MainActivity", ["adjustResize", "adjustResize"])))
    ).toThrow();
  });

  it("rejects adjustResize declared on the wrong activity", () => {
    expect(() =>
      assertMainActivitySoftInputMode(
        manifest(activity(".MainActivity"), activity(".OtherActivity", ["adjustResize"]))
      )
    ).toThrow();
  });

  it("rejects another activity with a conflicting soft-input mode", () => {
    expect(() =>
      assertMainActivitySoftInputMode(
        manifest(activity(".MainActivity", ["adjustResize"]), activity(".OtherActivity", ["adjustPan"]))
      )
    ).toThrow();
  });

  it("rejects adjustPan on MainActivity", () => {
    expect(() => assertMainActivitySoftInputMode(manifest(activity(".MainActivity", ["adjustPan"])))).toThrow();
  });

  it("rejects adjustNothing on MainActivity", () => {
    expect(() => assertMainActivitySoftInputMode(manifest(activity(".MainActivity", ["adjustNothing"])))).toThrow();
  });
});

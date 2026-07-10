import assert from "node:assert/strict";

function attributeValues(source, attributeName) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attributePattern = new RegExp(`\\b${escapedName}\\s*=\\s*(["'])(.*?)\\1`, "gs");
  return [...source.matchAll(attributePattern)].map((match) => match[2]);
}

export function assertMainActivitySoftInputMode(manifest) {
  const manifestWithoutComments = manifest.replace(/<!--[\s\S]*?-->/g, "");
  const activities = manifestWithoutComments.match(/<activity(?=\s|>)[^>]*>/g) ?? [];
  const mainActivities = activities.filter((tag) =>
    attributeValues(tag, "android:name").includes(".MainActivity")
  );
  assert.equal(
    mainActivities.length,
    1,
    "Android manifest must declare exactly one .MainActivity activity"
  );

  const manifestSoftInputModes = attributeValues(manifestWithoutComments, "android:windowSoftInputMode");
  assert.equal(
    manifestSoftInputModes.length,
    1,
    "Android manifest must declare exactly one android:windowSoftInputMode"
  );

  const mainActivitySoftInputModes = attributeValues(mainActivities[0], "android:windowSoftInputMode");
  assert.equal(
    mainActivitySoftInputModes.length,
    1,
    ".MainActivity must declare exactly one android:windowSoftInputMode"
  );
  assert.equal(
    mainActivitySoftInputModes[0],
    "adjustResize",
    "Android must resize the visible WebView for the software keyboard"
  );
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

function findOpeningTagEnd(source, markerIndex) {
  let quote;
  let braceDepth = 0;
  for (let index = markerIndex; index < source.length; index += 1) {
    const character = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (character === quote && previous !== "\\") quote = undefined;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") braceDepth += 1;
    if (character === "}") braceDepth = Math.max(0, braceDepth - 1);
    if (character === ">" && braceDepth === 0) return index;
  }
  return -1;
}

test("keeps the guided onboarding rules in the instructions Codex reads", async () => {
  const [agentInstructions, contract] = await Promise.all([
    readProjectFile("AGENTS.md"),
    readProjectFile("docs/guided-onboarding-contract.md")
  ]);

  assert.match(agentInstructions, /## Mandatory Guided Onboarding Contract/);
  assert.match(agentInstructions, /docs\/guided-onboarding-contract\.md/);
  assert.match(agentInstructions, /never make a user repeat an identical guide/i);
  assert.match(contract, /Stable feature identity/);
  assert.match(contract, /Definition of done/);
  assert.match(contract, /Never require the final activation of a destructive/i);
});

test("requires complete, versioned metadata on every runtime guide target", async () => {
  const marker = "data-guided-onboarding-id=";
  let targetCount = 0;

  for (const relativePath of ["src/OperationsApp.tsx", "src/TestingUpdateHistoryDialog.tsx"]) {
    const source = await readProjectFile(relativePath);
    let markerIndex = source.indexOf(marker);

    while (markerIndex >= 0) {
      const tagStart = source.lastIndexOf("<", markerIndex);
      const tagEnd = findOpeningTagEnd(source, markerIndex);
      assert.ok(tagStart >= 0 && tagEnd > markerIndex, `Could not parse guided target in ${relativePath} near character ${markerIndex}.`);
      const openingTag = source.slice(tagStart, tagEnd + 1);
      assert.match(openingTag, /data-guided-onboarding-title=/, `Missing guide title: ${openingTag}`);
      assert.match(openingTag, /data-guided-onboarding-instruction=/, `Missing guide instruction: ${openingTag}`);
      assert.match(openingTag, /data-guided-onboarding-priority=/, `Missing guide priority: ${openingTag}`);

      const literalId = openingTag.match(/data-guided-onboarding-id="([^"]+)"/)?.[1];
      if (literalId) {
        assert.match(literalId, /^[a-z0-9][a-z0-9._-]{1,116}\.v\d+$/, `Invalid guided feature ID: ${literalId}`);
      } else {
        assert.match(openingTag, /data-guided-onboarding-id=[^\r\n]*\.v\d+/, `Dynamic guided feature ID must contain an explicit version: ${openingTag}`);
      }

      targetCount += 1;
      markerIndex = source.indexOf(marker, tagEnd + 1);
    }
  }

  assert.ok(targetCount >= 20, `Expected the authenticated feature inventory, found only ${targetCount} guided targets.`);
});

test("preserves exact-action locking and immutable owner-only remote progress", async () => {
  const [provider, progress, migration] = await Promise.all([
    readProjectFile("src/GuidedOnboarding.tsx"),
    readProjectFile("src/onboardingProgress.ts"),
    readProjectFile("supabase/migrations/20260717225610_normalize_user_onboarding_progress_rows.sql")
  ]);

  assert.match(provider, /markFeatureSeen\(current\.featureId\)/);
  assert.match(provider, /addEventListener\("pointerdown", blockUnrelatedPointer, true\)/);
  assert.match(provider, /addEventListener\("wheel", blockBackgroundScroll/);
  assert.match(provider, /if \(!seenFeatureIdsRef\.current\.has\(featureId\)\)/);
  assert.match(progress, /resolution=ignore-duplicates,return=minimal/);
  assert.match(migration, /primary key \(user_id, feature_id\)/i);
  assert.match(migration, /grant select, insert on public\.user_onboarding_progress to authenticated/i);
  assert.doesNotMatch(migration, /grant[^;]*(update|delete)[^;]*to authenticated/i);
});

test("keeps the App updates history inside the portrait frame", async () => {
  const styles = await readProjectFile("src/styles.css");

  assert.match(
    styles,
    /\.testing-update-history-modal,[\s\S]*?width:\s*min\(100%,\s*560px\);/,
    "The nested App updates dialog must size from its portrait-frame backdrop instead of the browser viewport."
  );
});

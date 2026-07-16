import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../supabase/functions/activate-account/index.ts", import.meta.url);

test("activation binds the password update to the bearer-token user", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /userClient\.auth\.getUser\(token\)/);
  assert.match(source, /\.eq\("id", authData\.user\.id\)/);
  assert.match(source, /requiresPasswordChange\(authData\.user\.app_metadata\)/);
  assert.match(source, /signInWithPassword\(/);
  assert.match(source, /updateUserById\(authData\.user\.id/);
  assert.doesNotMatch(source, /body\.userId|body\.user_id/);
});

test("activation changes the password and flag in one admin update", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const updateBlock = source.match(/updateUserById\(authData\.user\.id,[\s\S]*?\n  \}\);/)?.[0] ?? "";
  assert.match(updateBlock, /password: newPassword/);
  assert.match(updateBlock, /app_metadata: activatedAppMetadata/);
  assert.match(source, /invitation_status: "accepted"/);
  assert.match(source, /invitation_accepted_at: new Date\(\)\.toISOString\(\)/);
});

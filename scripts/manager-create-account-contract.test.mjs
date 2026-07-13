import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../supabase/functions/manager-create-account/index.ts", import.meta.url);

test("account creation authorizes any active staff owner without a username gate", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const authorizationBlock = source.match(/if \(\s*callerProfileError[\s\S]*?let body: AccountRequest/)?.[0] ?? "";
  assert.doesNotMatch(authorizationBlock, /callerProfile\.username|Manager123/);
  assert.match(authorizationBlock, /callerProfile\.role !== "staff"/);
  assert.match(authorizationBlock, /callerProfile\.status !== "active"/);
  assert.match(authorizationBlock, /callerProfile\.is_owner !== true/);
});

test("administrator usernames are reserved and new profiles start without welcome acknowledgement", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /username === "manager1"/);
  assert.match(source, /username === "dev123"/);
  assert.match(source, /welcome_seen_at: null/);
  assert.match(source, /is_owner: false/);
});

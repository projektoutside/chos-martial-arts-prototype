import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../supabase/functions/manager-create-account/index.ts", import.meta.url);
const invitationMigrationUrl = new URL("../supabase/migrations/20260714044725_add_account_invitation_status.sql", import.meta.url);
const stylesUrl = new URL("../src/styles.css", import.meta.url);

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

test("new accounts use assigned usernames and temporary passwords that require activation", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /password\?: unknown/);
  assert.match(source, /authEmailForUsername\(username\)/);
  assert.match(source, /auth\.admin\.createUser\(/);
  assert.match(source, /password,/);
  assert.match(source, /app_metadata: activationRequiredAppMetadata/);
  assert.match(source, /email_confirm: true/);
  assert.doesNotMatch(source, /auth\.admin\.inviteUserByEmail\(/);
  assert.doesNotMatch(source, /JSON\.stringify\([^)]*serviceRoleKey/);
});

test("contact data is optional while the internal Auth identity and nullable profile data remain required", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.doesNotMatch(source, /!contactEmail/);
  assert.match(source, /const contactEmail = cleanString\(body\.email\)\.toLowerCase\(\) \|\| null/);
  assert.match(source, /contact_email: contactEmail/);
  assert.match(source, /created_contact_email: contactEmail/);
  assert.match(source, /email: authEmail/);
});

test("custom-color account creation submit styling preserves enabled-green and disabled-neutral states", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  const genericCustomColorRule = styles.indexOf('html[data-custom-colors="true"] .student-editor-actions button');
  const enabledRule = styles.indexOf('html[data-custom-colors="true"] .create-account-submit:not(:disabled)');
  const disabledRule = styles.indexOf('html[data-custom-colors="true"] .create-account-submit:disabled');
  assert.ok(genericCustomColorRule >= 0);
  assert.ok(enabledRule > genericCustomColorRule);
  assert.ok(disabledRule > genericCustomColorRule);
  assert.match(styles.slice(enabledRule, disabledRule), /background: linear-gradient\(135deg, #a8efbb, #54c978\)/);
  assert.match(styles.slice(disabledRule), /border-color: color-mix\(in srgb, var\(--user-visual-border\) 82%, var\(--user-visual-text\)\)/);
  assert.match(styles.slice(disabledRule), /background: color-mix\(in srgb, var\(--user-visual-elevatedSurface\) 82%, var\(--user-visual-border\)\)/);
  assert.match(styles, /html\[data-theme="light"\] \.create-account-submit:disabled \{[\s\S]*?border-color: #667085;[\s\S]*?background: #eaecf0;/);
});

test("new profiles persist pending invitation state", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /invitation_status: "pending"/);
  assert.match(source, /invited_at: new Date\(\)\.toISOString\(\)/);
  assert.match(source, /invitationStatus: "pending"/);
});

test("invitation migration preserves legacy accounts and records acceptance", async () => {
  const migration = await readFile(invitationMigrationUrl, "utf8");
  assert.match(migration, /invitation_status text not null default 'accepted'/);
  assert.match(migration, /after update of email_confirmed_at on auth\.users/);
  assert.match(migration, /set invitation_status = 'accepted'/);
  assert.match(migration, /invitation_accepted_at = coalesce/);
});

test("an audit insert failure removes the incomplete auth user before reporting failure", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const auditBlock = source.match(/const \{ error: auditError \}[\s\S]*?return jsonResponse\(\{[\s\S]*?account:/)?.[0] ?? "";
  assert.match(auditBlock, /if \(auditError\)/);
  assert.match(auditBlock, /adminClient\.auth\.admin\.deleteUser\(createdUser\.user\.id\)/);
  assert.match(auditBlock, /if \(rollbackError\)/);
  assert.match(auditBlock, /No account was created/);
});

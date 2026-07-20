import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/20260720010000_get_my_student_record.sql", import.meta.url);
const authSetupUrl = new URL("../docs/supabase-auth-setup.md", import.meta.url);

test("own-student RPC returns one server-filtered record with minimal privileges", async () => {
  const source = await readFile(migrationUrl, "utf8").catch(() => "");
  assert.match(source, /create or replace function public\.get_my_student_record\(\)/i);
  assert.match(source, /returns jsonb/i);
  assert.match(source, /security definer/i);
  assert.match(source, /set search_path = ''/i);
  assert.match(source, /auth\.uid\(\)/i);
  assert.match(source, /public\.profiles/i);
  assert.match(source, /profiles\.status = 'active'/i);
  assert.match(source, /profiles\.role = 'student'/i);
  assert.match(source, /profiles\.student_id/i);
  assert.match(source, /public\.app_state_items/i);
  assert.match(source, /app_state_items\.key = 'chos\.operations\.students\.v1'/i);
  assert.match(source, /jsonb_array_elements/i);
  assert.match(source, /student_record->>'id' = profiles\.student_id/i);
  assert.doesNotMatch(source, /returns\s+(setof|table)/i);
  assert.doesNotMatch(source, /jsonb_agg/i);
  assert.match(source, /revoke all on function public\.get_my_student_record\(\) from public/i);
  assert.match(source, /revoke all on function public\.get_my_student_record\(\) from anon/i);
  assert.match(source, /grant execute on function public\.get_my_student_record\(\) to authenticated/i);
});

test("operator docs require the safe hosted account deployment order", async () => {
  const docs = await readFile(authSetupUrl, "utf8");
  const activate = docs.indexOf("deploy and verify `activate-account`");
  const ownStudentMigration = docs.indexOf("apply and verify `20260720010000_get_my_student_record.sql`");
  const managerCreate = docs.indexOf("deploy and verify the updated `manager-create-account`");
  const frontend = docs.indexOf("deploy the frontend");
  assert.ok(activate >= 0);
  assert.ok(ownStudentMigration > activate);
  assert.ok(managerCreate > ownStudentMigration);
  assert.ok(frontend > managerCreate);
});

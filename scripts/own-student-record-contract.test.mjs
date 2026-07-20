import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../supabase/migrations/20260720010000_get_my_student_record.sql", import.meta.url);
const authSetupUrl = new URL("../docs/supabase-auth-setup.md", import.meta.url);
const rolloutPlanUrl = new URL("../docs/superpowers/plans/2026-07-16-new-account-activation.md", import.meta.url);

test("own-student RPC returns one server-filtered record with minimal privileges", async () => {
  const source = await readFile(migrationUrl, "utf8").catch(() => "");
  const ownStudentRpc = source.match(/create or replace function public\.get_my_student_record\(\)[\s\S]*?\$function\$;/i)?.[0] ?? "";
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
  assert.match(source, /student_record->>'status'[\s\S]*?'inactive'/i);
  assert.doesNotMatch(source, /returns\s+(setof|table)/i);
  assert.doesNotMatch(ownStudentRpc, /jsonb_agg/i);
  assert.match(source, /revoke all on function public\.get_my_student_record\(\) from public/i);
  assert.match(source, /revoke all on function public\.get_my_student_record\(\) from anon/i);
  assert.match(source, /grant execute on function public\.get_my_student_record\(\) to authenticated/i);
  assert.match(source, /profiles\.is_owner or 'students' = any\(coalesce\(profiles\.access/i);
  assert.match(source, /key <> 'chos\.operations\.students\.v1'/i);
  assert.match(source, /drop policy if exists "Authorized profiles can read app state"/i);
  assert.match(source, /create policy "Authorized profiles can read app state"/i);
  assert.doesNotMatch(source, /create policy "Active profiles can read app state"/i);
  assert.match(source, /Student roster delete ids cannot be null or blank/i);
  assert.match(source, /where not coalesce\(existing\.student_record->>'id' = any/i);
});

test("operator docs require the safe hosted account deployment order", async () => {
  for (const docsUrl of [authSetupUrl, rolloutPlanUrl]) {
    const docs = await readFile(docsUrl, "utf8");
    const scopedDocs = docsUrl === rolloutPlanUrl
      ? docs.slice(docs.indexOf("### Task 6: Staging deployment and live proof"))
      : docs;
    if (docsUrl === rolloutPlanUrl) {
      const exactSteps = [
        "**Step 2: Deploy and probe the activation endpoint first**",
        "**Step 3: Apply the student-access migration before provisioning or frontend changes**",
        "**Step 4: Deploy and probe the updated provisioning function**",
        "**Step 5: Publish the verified frontend**"
      ];
      let previousStep = -1;
      exactSteps.forEach((step) => {
        const stepIndex = scopedDocs.indexOf(step);
        assert.ok(stepIndex > previousStep, `${docsUrl.pathname} must keep ${step} in Task 6 order`);
        previousStep = stepIndex;
      });
    }
    const activate = scopedDocs.indexOf("activate-account");
    const ownStudentMigration = scopedDocs.indexOf("20260720010000_get_my_student_record.sql");
    const managerCreate = scopedDocs.indexOf("manager-create-account", ownStudentMigration);
    const frontend = scopedDocs.indexOf("frontend", managerCreate);
    assert.ok(activate >= 0, `${docsUrl.pathname} must mention activate-account`);
    assert.ok(ownStudentMigration > activate, `${docsUrl.pathname} must apply the migration after activate-account`);
    assert.ok(managerCreate > ownStudentMigration, `${docsUrl.pathname} must deploy manager-create-account after the migration`);
    assert.ok(frontend > managerCreate, `${docsUrl.pathname} must publish the frontend last`);
  }
});

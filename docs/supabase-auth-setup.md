# Supabase Auth Setup

This app keeps the browser on publishable Supabase credentials only. Administrator and managed-user sign-in uses Supabase Auth directly, and chat/message records use Supabase REST and Realtime with row-level security. The service role key never enters Vite or localStorage.

## Required project setup

1. Create or connect the Cho's Supabase project. Current staging is `chos-martial-arts-operations-app-staging` / `zfuwbbepsnmmlpgfkmhz`.
2. Apply the existing baseline migrations required to create Auth profiles and app state. For this account-release migration, follow the mandatory rollout order below.
3. Deploy the account functions only in the documented order when administrator-created live staff, student, and parent accounts are in scope. Both use `verify_jwt = false` because they perform their own bearer-token, Supabase Auth user, and active-profile checks; do not deploy them without those checks. Account creation keeps the service-role key server-side, creates an internal username-based Auth identity, accepts omitted contact email and phone data, stores absent profile/audit contact email as `null`, and requires a password change. Activation binds the password replacement to the bearer-token user and reauthenticates the assigned temporary password.
4. Set the deployed app env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. For a new environment, seed or update the Manager owner after the migration. Provision the Developer owner separately through the approved privileged two-admin setup; never place either password in source control:

```powershell
$env:SUPABASE_URL="https://PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
$env:MANAGER_USERNAME="Manager1"
$env:MANAGER_PASSWORD="<generated-strong-password>"
$env:MANAGER_AUTH_EMAIL="manager1@accounts.chosmartialarts.app"
node scripts/seed-supabase-manager.mjs
```

`MANAGER_PASSWORD` is required and must be at least 12 characters with uppercase, lowercase, a number, and a symbol. Store the actual value in 1Password or the approved secret store, not in this repository or chat. The seed script creates or updates only the owner login by default. To delete every other Supabase Auth user, run it with `--delete-extra-auth-users --yes-delete-extra-auth-users`; do that only after confirming the target project is the correct environment.

### Mandatory hosted account rollout order

For this release, deploy and verify `activate-account` first, including its unauthenticated rejection and temporary-password reauthentication behavior. Next, apply and verify `20260720010000_get_my_student_record.sql`; confirm an authenticated student receives only the one active student row linked through `profiles.student_id`, while anonymous, unlinked, inactive, and non-student callers receive no roster data. Then deploy and verify the updated `manager-create-account` so newly created users cannot be flagged for activation before the activation path and student lookup are ready. Finally, deploy the frontend and verify sign-in, activation, refresh, student profile, and live-chat identity against the hosted project.

The `get_my_student_record` function is exposed in `public` only because PostgREST RPC discovery requires an exposed schema. It is `SECURITY DEFINER` with an empty search path, resolves `auth.uid()` to an active student profile, returns one JSON object or `null`, and grants execution only to `authenticated`; it never returns the shared roster array.

Do not run Cho's migrations, seed scripts, smoke checks, or Edge Function deploys against MongTeng's Supabase project `mongteng-food-market-ordering-app-staging` / `jqvclzlvrhdcsfhhvekr`. This app also refuses that project ref at runtime if it is accidentally placed in `VITE_SUPABASE_URL`.

For an existing staging project, rotate any legacy seeded owner password by rerunning this script with a generated `MANAGER_PASSWORD` from the approved secret store. Do not preserve sample or prototype passwords in Supabase Auth.

## Runtime behavior

- `Manager1` signs in through Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured. The legacy `Manager123` username is an alias for the same live `Manager1` Auth profile.
- `Dev123` signs in through Supabase when `VITE_ENABLE_DEVELOPER_ACCOUNT=true`; its internal Auth email is `dev123@accounts.chosmartialarts.app`.
- Any authenticated active staff owner, including `Manager1` and `Dev123`, can create staff, student, and parent accounts through the deployed function and must securely give the user the assigned account name and temporary password.
- The login-page **Access New Account** action verifies those assigned credentials, then requires a different policy-compliant personal password before an app session is created. Entering temporary credentials in normal **Sign In** routes to the same required password-change step.
- The login-page **Create Account** action is informational only. It never calls public signup.
- `live_chat_messages`, `direct_messages`, `message_logs`, and `app_state_items` persist in Supabase when the user is signed in with a valid Supabase session.
- When Supabase env vars are configured but a Supabase auth session is unavailable, operations records do not fall back to localStorage. Device-local preferences can still use browser storage.
- The local prototype fallback for credential and operations records is only used when Supabase env vars are absent.

## Hosted Auth hardening

- Keep public email signup disabled in Supabase Auth. Administrator-created credentials plus **Access New Account** are the supported activation path.
- Enable Supabase leaked-password protection in Auth settings after the Supabase organization is on Pro or higher. The Free plan leaves the Security Advisor warning `auth_leaked_password_protection` active.
- Keep the local password policy in the seed script even after hosted leaked-password protection is enabled; the hosted check rejects known compromised passwords, while the local policy blocks short or composition-weak passwords.

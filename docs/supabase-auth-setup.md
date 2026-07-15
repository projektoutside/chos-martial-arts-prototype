# Supabase Auth Setup

This app keeps the browser on publishable Supabase credentials only. Administrator and invited-user sign-in uses Supabase Auth directly, and chat/message records use Supabase REST and Realtime with row-level security. The service role key never enters Vite or localStorage.

## Required project setup

1. Create or connect the Cho's Supabase project. Current staging is `chos-martial-arts-operations-app-staging` / `zfuwbbepsnmmlpgfkmhz`.
2. Apply the migrations in `supabase/migrations`.
3. Deploy `supabase/functions/manager-create-account/index.ts` when administrator-created live staff, student, and parent accounts are in scope. Set the Edge Function secret `INVITE_REDIRECT_URL` to an allow-listed app URL (for production, `https://chos-martial-arts-operations-app.pages.dev/`). The function uses `verify_jwt = false` because it performs its own bearer-token, Supabase Auth user, and active-owner-profile checks; do not deploy it without those checks. It keeps the service-role key server-side, invites the user's real email through Supabase Auth, and persists a pending invitation until Auth confirms the email.
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

Do not run Cho's migrations, seed scripts, smoke checks, or Edge Function deploys against MongTeng's Supabase project `mongteng-food-market-ordering-app-staging` / `jqvclzlvrhdcsfhhvekr`. This app also refuses that project ref at runtime if it is accidentally placed in `VITE_SUPABASE_URL`.

For an existing staging project, rotate any legacy seeded owner password by rerunning this script with a generated `MANAGER_PASSWORD` from the approved secret store. Do not preserve sample or prototype passwords in Supabase Auth.

## Runtime behavior

- `Manager1` signs in through Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are configured. The legacy `Manager123` username is an alias for the same live `Manager1` Auth profile.
- `Dev123` signs in through Supabase when `VITE_ENABLE_DEVELOPER_ACCOUNT=true`; its internal Auth email is `dev123@accounts.chosmartialarts.app`.
- Any authenticated active staff owner, including `Manager1` and `Dev123`, can create staff, student, and parent invitations through the deployed function.
- The login-page **Create Account** action is activation-only. It requests a magic link with `create_user=false` for an existing administrator-created Auth identity and never calls public signup.
- `live_chat_messages`, `direct_messages`, `message_logs`, and `app_state_items` persist in Supabase when the user is signed in with a valid Supabase session.
- When Supabase env vars are configured but a Supabase auth session is unavailable, operations records do not fall back to localStorage. Device-local preferences can still use browser storage.
- The local prototype fallback for credential and operations records is only used when Supabase env vars are absent.

## Hosted Auth hardening

- Keep public email signup disabled in Supabase Auth. Invitations and existing-account magic links remain the only supported activation paths.
- Enable Supabase leaked-password protection in Auth settings after the Supabase organization is on Pro or higher. The Free plan leaves the Security Advisor warning `auth_leaked_password_protection` active.
- Keep the local password policy in the seed script even after hosted leaked-password protection is enabled; the hosted check rejects known compromised passwords, while the local policy blocks short or composition-weak passwords.

# Platform Inventory

Last updated: 2026-07-09

## GitHub

| Item | Current value |
| --- | --- |
| Legacy owner/repo | `projektoutside/chos-martial-arts-prototype` |
| Target owner/repo | `xatori-dev/chos-martial-arts-operations-app` |
| Local Xatori repo path | `C:\Dev\Business\Clients\active\chos-martial-arts\operations-app\repo` |
| Default branch | `main` |
| Current release branch | `main` |
| Branch protection | Not configured on target repo yet |
| Target repo status | Created and reachable at `https://github.com/xatori-dev/chos-martial-arts-operations-app`; `origin/main` is the Xatori target branch |
| Local branch tracking | Local `main` tracks `origin/main`; `legacy-origin` and `desktop-source` remain as references only |
| Local GitHub CLI identity | `gh auth status` reports `projektoutside`; the account has admin access, but switch to an intended Xatori operator before live repo administration |

## Hosting

| Item | Current value |
| --- | --- |
| Legacy hosting | GitHub Pages |
| Legacy Pages URL | `https://projektoutside.github.io/chos-martial-arts-prototype/` |
| Legacy workflow | `.github/workflows/deploy-pages.yml` |
| Target staging hosting | Cloudflare Pages Direct Upload from the Xatori repo, verified |
| Target Pages URL | `https://chos-martial-arts-operations-app.pages.dev/` |
| Target deployment workflow | `Verify main web release` validates `main`; authenticated Wrangler publishes the verified `dist` artifact |
| Staging build variables | GitHub repo variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_ENABLE_DEVELOPER_ACCOUNT=true`; workflow preflight requires Cho's staging Supabase ref `zfuwbbepsnmmlpgfkmhz` |
| SPA fallback behavior | `dist/_redirects` routes deep links such as `/messages` to `/index.html` with HTTP 200 on Cloudflare Pages. |
| Target Cloudflare Pages name | `chos-martial-arts-operations-app` |
| DNS/custom domain | Not configured in phase 1 |

## Google Workspace

| Item | Target value |
| --- | --- |
| Account | `xatori@xatoridev.com` |
| Drive folder | `chos-martial-arts - operations-app` |
| Drive package document | `Cho's Martial Arts Operations App - Xatori Onboarding and Handoff Package` / https://docs.google.com/document/d/1E22ubixiSzLEZPNklvmA8Wiujq63J7olDCSN1YEkkh4/edit?usp=drivesdk |
| Gmail labels | `Clients`, `Clients/chos-martial-arts`, `Clients/chos-martial-arts/operations-app` |
| Status | Drive account confirmed as `xatori@xatoridev.com`; package document created for the current handoff refresh |

## 1Password

| Vault | Purpose | Status |
| --- | --- | --- |
| `client-chos-martial-arts Development` | Local, preview, staging references | Planned or pending vault-scope verification |
| `client-chos-martial-arts Production` | Production secret references | Planned or pending vault-scope verification |
| `client-chos-martial-arts Handoff` | Handoff package and final transfer references | Planned or pending vault-scope verification |

No raw secret values belong in this repository or in chat. Record item names and 1Password references only.

## Supabase

| Environment | Target project | Status |
| --- | --- | --- |
| Staging | `chos-martial-arts-operations-app-staging` / `zfuwbbepsnmmlpgfkmhz` | Active in Xatori Dev, us-east-2 |
| Production | `chos-martial-arts-operations-app-production` | Reserved name only |

Project boundary: MongTeng uses a separate Supabase project, `mongteng-food-market-ordering-app-staging` / `jqvclzlvrhdcsfhhvekr`. Do not use that ref, URL, keys, migrations, Edge Functions, or seed scripts for Cho's work.

Staging has Supabase Auth profiles, RLS, `account_creation_audit`, `live_chat_messages`, `direct_messages`, `message_logs`, and an active `manager-create-account` Edge Function for owner-created staff, student, and parent profiles. Public signup is disabled in hosted Auth (`disable_signup=true`). New profiles use internal username-based Auth emails, an administrator-assigned temporary password, and `app_metadata.requires_password_change=true`; the `activate-account` Edge Function reauthenticates that temporary password and clears the flag only while replacing the password. No-auth function calls return 401, and both account functions validate the bearer token and active profile before privileged changes. Migration `20260720010000_get_my_student_record.sql` is present locally but has not been applied to staging in this change; it is required before the updated frontend because student sessions now use its authenticated, server-filtered one-record RPC instead of reading the shared student roster. The `twilio_messaging_relay` migration has been applied to staging, creating `sms_consent_records` and `twilio_relay_attempts`, and the hosted `twilio-messaging` Edge Function is deployed with `verify_jwt = false` for Twilio webhooks. Hosted Twilio secrets are not set yet because `supabase secrets set/list --project-ref zfuwbbepsnmmlpgfkmhz` currently returns `403` / `Your account does not have the necessary privileges to access this endpoint`. The supported administrator sign-ins are `Manager1` and `Dev123`, both active staff owners; `Manager123` is retained only as a username alias for the live `Manager1` identity. Their internal Auth emails are `manager1@accounts.chosmartialarts.app` and `dev123@accounts.chosmartialarts.app`. Other profiles are administrator-created and must use **Access New Account** before their first app session.

The Xatori Dev Supabase organization is currently on the Free plan. The staging Security Advisor still reports `auth_leaked_password_protection` because Supabase leaked-password protection requires Pro or higher. Until the plan is upgraded and the Auth setting is enabled, the seed script enforces the local 12-character mixed password policy for the owner account.

Production remains uncreated until staging is accepted.

## Twilio

| Resource | Target name | Status |
| --- | --- | --- |
| Dev subaccount | `xd-chos-martial-arts-operations-app-dev` | Planned |
| Production subaccount | `xd-chos-martial-arts-operations-app-prod` | Planned |
| Transactional Messaging Service | `xd-chos-martial-arts-operations-app-txn` | Planned |
| Broadcast Messaging Service | `Cho's Martial Arts Broadcasts` / `MG3f346aee214d3fef62064a1350bd556e` | Created in the active `xatori-dev` Twilio profile; inbound/status callbacks point at the Supabase relay |
| 10DLC sender path | Cho local number `+12625003283` / `PN20d1e4fb3d9eb07bcb076cb64558e69a` + A2P Brand/Campaign | SMS/MMS sender attached; `usAppToPersonRegistered=false`; A2P approval required before US mass texting |

The browser app currently provides credential-free Twilio relay, consent, webhook, and Web Push contracts. The deployed Supabase `twilio-messaging` relay is the intended private server path for live SMS, with manager JWT checks, server-side consent records, Twilio webhook signature validation, idempotency, and message-log reconciliation. Live SMS still requires hosted Supabase secrets, a Twilio Auth Token for webhook signatures, and Twilio Console 10DLC approval. Twilio Trust Hub Customer Profile `Xatori Dev` / `BU2de33a5cd41a39e09907d4390a2cd98a` is still `draft`; evaluation `EL7b9b87c9707c1bcb2168131d7f8b3959` is `compliant` after correcting `business_registration_identifier` to `EIN`, but API submission is blocked with `400` / `This operation is restricted via API for Primary Customer Profiles.Use Twilio Console instead.`

## Stripe

| Item | Status |
| --- | --- |
| Account | Xatori Dev target only if legal/payment ownership allows it |
| Test webhook | `chos-martial-arts-operations-app-test` reserved |
| Live webhook | `chos-martial-arts-operations-app-live` reserved |
| Products/prices | Not currently integrated |

## Email, Analytics, Monitoring

| System | Status |
| --- | --- |
| Email provider | Not currently integrated |
| Analytics | Not currently integrated |
| Monitoring/Sentry | Not currently integrated |

Add a dedicated provider/project only when production scope requires it.

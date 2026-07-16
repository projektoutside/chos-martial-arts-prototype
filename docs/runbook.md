# Runbook

## Local Development

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/`.

## Validation

```powershell
npm run test
npm run build:cloudflare
npm audit --audit-level=moderate
git diff --check
```

`npm run build:cloudflare` must create `dist/app-version.json` and preserve `dist/_redirects` for the SPA fallback.

## Current Deployment

- Xatori repository: `xatori-dev/chos-martial-arts-operations-app`
- Legacy repository: `projektoutside/chos-martial-arts-prototype`
- Legacy Pages URL: `https://projektoutside.github.io/chos-martial-arts-prototype/`
- Hosted pilot URL: `https://chos-martial-arts-operations-app.pages.dev/`
- Cloudflare Pages project: `chos-martial-arts-operations-app` in the Xatori account
- Workflow: `.github/workflows/deploy-pages.yml` verifies the release build; Cloudflare Pages uses Direct Upload
- Status: Cloudflare Pages is the active hosted pilot target. GitHub Pages is unavailable while the Xatori repository is private on the current organization plan.
- Staging build requirements: repo variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_ENABLE_DEVELOPER_ACCOUNT=true` must be present before the workflow builds the Pages artifact. `VITE_SUPABASE_URL` must point to Cho's staging Supabase project `zfuwbbepsnmmlpgfkmhz`.
- Public staging account model: `Manager1` and `Dev123` validate through their active Supabase owner profiles. The legacy `Manager123` username routes to the same `Manager1` identity. Other users must first be created by an active staff owner with an assigned account name and temporary password, then use **Access New Account** to replace that password before entering the app. **Create Account** remains informational and public self-registration stays disabled.

## Xatori Deployment Workflow

1. Confirm GitHub CLI or connector identity is ready for `xatori-dev`; local `gh` currently authenticates as `projektoutside`.
2. Confirm local `main` tracks `origin/main`.
3. Confirm repository variables are set for Cho's staging Supabase project and `VITE_ENABLE_DEVELOPER_ACCOUNT=true`.
4. Push to `main`, then wait for `Verify main web release` to complete successfully.
5. Run `npm run build:cloudflare`, then deploy with `npx wrangler pages deploy dist --project-name chos-martial-arts-operations-app --branch main --commit-hash <full-main-sha>`.
6. Verify the permanent hosted URL, immutable deployment URL, `app-version.json.version`, and live bundle before inviting pilot users.
7. Only after verification, decide whether to archive the legacy repo, redirect users, or leave a documented exception.

## Messaging And Notifications

- The static app can queue SMS work, export credential-free relay manifests, validate browser-safe relay health responses, and call the Supabase `twilio-messaging` relay when health is ready.
- The staging Twilio relay endpoints are deployed under `https://zfuwbbepsnmmlpgfkmhz.supabase.co/functions/v1/twilio-messaging`.
- Migration `twilio_messaging_relay` is applied and Edge Function `twilio-messaging` is active on staging. Hosted secrets still need an owner/admin Supabase step because the current CLI token gets `403` on `supabase secrets set/list`.
- Required relay secrets/settings: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_KEY_SECRET`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_FUNCTION_PUBLIC_URL`, `TWILIO_SENDER_TYPE=10dlc`, `TWILIO_A2P_BRAND_APPROVED`, and `TWILIO_A2P_CAMPAIGN_APPROVED`.
- Twilio Messaging Service `Cho's Martial Arts Broadcasts` / `MG3f346aee214d3fef62064a1350bd556e` exists with inbound/status callbacks pointed at the Supabase relay and SMS/MMS local sender `+12625003283` attached.
- Live US mass texting remains blocked until Twilio Console submits and approves the `Xatori Dev` Trust Hub Customer Profile, A2P Brand and Campaign are approved, and the required Twilio secrets are available in Supabase for sending and webhook signature validation. The Trust Hub `business_registration_identifier` mismatch was corrected on 2026-06-17 and evaluation `EL7b9b87c9707c1bcb2168131d7f8b3959` is `compliant`; submitting the Primary Customer Profile through the API returned `400` / `This operation is restricted via API for Primary Customer Profiles.Use Twilio Console instead.`
- Server implementation must enforce manager auth, server-held credentials, consent evidence, opt-out handling, rate limits, idempotency, audit logs, and Twilio webhook signatures.
- Active Supabase-backed profiles can open shared Cho's Room live chat. Live account creation is authorized server-side for authenticated active staff owners; `Manager1` and `Dev123` are the approved owner profiles.

## Rollback

For the current Cloudflare Pages hosted pilot:

1. Identify the last successful production deployment with `npx wrangler pages deployment list --project-name chos-martial-arts-operations-app`.
2. Revert or reset through a normal reviewed Git commit.
3. Push to `main`.
4. Rebuild and Direct Upload the reverted commit, then verify `app-version.json.version` on the permanent URL.

For future Xatori staging/production:

1. Document the exact deployment platform before first production release.
2. Keep the previous artifact/build available.
3. Record rollback owner, command, and validation URL in this runbook.

## Incident Notes

- Treat any raw secret in the repo, chat, browser localStorage export, or public artifact as a rotation event.
- Do not claim production readiness while provider readiness is incomplete.

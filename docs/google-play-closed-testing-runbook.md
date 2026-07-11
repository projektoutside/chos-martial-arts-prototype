# Google Play Private Client Testing Runbook

## App identities

| App | Package | Play track | Purpose |
| --- | --- | --- | --- |
| Cho's Martial Arts | `com.xatoridev.chosmartialarts` | `client-stable` | Approved launch-candidate features |
| Cho's Testing | `com.xatoridev.chosmartialarts.testing` | `client-preview` | Fake-data feature demonstrations |

Both tracks are private closed-testing tracks. Never select Production or Open testing for this workflow.

## Current verified Play state (2026-07-11)

- Developer account ID: `5585964567030960868`.
- Existing Cho's Martial Arts app ID: `4972929944903339499`.
- Existing package: `com.xatoridev.chosmartialarts`.
- Existing internal release: version `0.1.6`, version code `7`, released July 10, 2026.
- Existing internal tester list: `Cho Internal Testers` with two users.
- Existing internal opt-in URL: `https://play.google.com/apps/internaltest/4701284583253394780`.
- Play currently displays the temporary name `com.xatoridev.chosmartialarts (unreviewed)` until required app setup is completed and reviewed.
- The existing app uses the local upload key stored outside Git. Both new bundles must continue using this key unless Google Play explicitly performs an upload-key reset.

## Required Play Console setup

### Cho's Martial Arts

1. Open Test and release > Testing > Closed testing.
2. Create a track named `client-stable`.
3. Attach the existing `Cho Internal Testers` email list.
4. Create the first release with the signed stable AAB.
5. Confirm the package is `com.xatoridev.chosmartialarts` and the version code is greater than every prior upload.
6. Add plain-language release notes and roll out only to `client-stable`.
7. Record the closed-test opt-in URL.

### Cho's Testing

1. From All apps, create an app named `Cho's Testing` using the same default language and organization ownership as the stable app.
2. Select App (not Game), Free, and complete the owner-confirmed declarations shown by Play.
3. Upload the signed demo AAB once manually so Play permanently registers `com.xatoridev.chosmartialarts.testing`.
4. Enroll in Play App Signing when prompted; retain the same local upload key outside Git.
5. Create the closed track `client-preview` and attach `Cho Internal Testers`.
6. Confirm the `TEST` launcher badge and the `Cho's Testing` name.
7. Add testing release notes and roll out only to `client-preview`.
8. Record the separate closed-test opt-in URL.

## Owner-confirmed declarations

Play declarations are legal and policy statements. Confirm them from the behavior of the submitted build rather than copying guesses.

- App access: explain the private test login or provide reviewer access if Google requests it.
- Ads: declare whether the build contains ads. The current repository contains no ad SDK.
- Content rating: answer the Play questionnaire truthfully for the current app content.
- Target audience: select the intended client/studio audience; do not mark the app as child-directed without owner review.
- Data safety: stable may process authentication and operations records through the approved Cho staging service; testing uses device-local fake data and disables remote delivery.
- Privacy policy: provide a valid public privacy-policy URL before review if Play requires it.
- Countries/regions: keep testing availability as narrow as the client test requires.

## GitHub protected environments

Create `google-play-stable` and `google-play-testing` under Repository Settings > Environments. Add these secrets to both environments:

- `ANDROID_UPLOAD_KEYSTORE_BASE64`
- `ANDROID_UPLOAD_STORE_PASSWORD`
- `ANDROID_UPLOAD_KEY_ALIAS`
- `ANDROID_UPLOAD_KEY_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

Add stable environment variables:

- `VITE_SUPABASE_URL=https://zfuwbbepsnmmlpgfkmhz.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<browser-safe Cho publishable key>`

Keep `PLAY_UPLOAD_ENABLED=false` until both first manual releases, track names, service-account permissions, and dry-run artifacts are verified. Then set it to `true` separately in each protected environment.

## Service-account access

1. Enable the Google Play Android Developer API in the selected Google Cloud project.
2. Create a release-only service account.
3. In Play Console > Users and permissions, invite the service-account email.
4. Grant only the app/release permissions needed for the two Cho packages; do not grant financial or account-owner access.
5. Store the JSON key only in the protected GitHub environment secret.

## Releasing

- Run `Release Cho's Testing to Google Play` for experimental demonstrations.
- Run `Release Cho's Martial Arts to Google Play` only from an approved stable commit.
- Enter a new positive version code, the matching version name, and useful client-facing release notes.
- The workflows reject package/track crossovers and never target Production.
- Download the GitHub build artifact and record its workflow run and commit SHA.

## Promoting an approved feature

1. Identify the focused feature commit demonstrated in Cho's Testing.
2. Create a branch from `main`.
3. Cherry-pick only the approved commit or reapply the focused change if demo-only code must be excluded.
4. Run stable tests and build checks.
5. Review the diff for demo-data, `.testing`, or `Demo Environment` leakage.
6. Merge into `main`, then run the stable Play workflow with a new version code.

## Rollback

Android version codes cannot be reused. To correct a bad release, return to a known-good Git commit, build it with a higher version code, and publish the corrective bundle to the same private track. Pause the affected track in Play Console if clients must stop receiving it immediately.

## Evidence checklist

For every release record:

- App name and package ID.
- Version name and version code.
- Git commit SHA and workflow run URL.
- Signed AAB artifact name and SHA-256.
- Play track and release state.
- Private opt-in URL.
- Real-device installation result.

Never record tester email addresses, upload-key passwords, or service-account JSON in Git.


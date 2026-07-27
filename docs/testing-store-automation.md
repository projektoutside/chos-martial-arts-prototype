# Paired Private-Testing Store Automation

The workflow **Release Cho's Testing to both private stores** keeps the existing stable Android, stable iOS, and web release paths unchanged. It packages only the isolated fake-data testing app:

| Store | App identity | Destination |
| --- | --- | --- |
| Google Play | `com.xatoridev.chosmartialarts.testing` | Internal testing |
| Apple | `com.xatoridev.chosmartialarts.testing` | TestFlight |

This workflow never selects Google Play Production and contains no App Store publication or App Review submission lane.

## Release behavior

App-affecting pushes to `main` always run tests plus the fake-data isolation build. Automatic uploads occur only when the repository variable `TESTING_STORE_AUTO_UPLOAD_ENABLED` is exactly `true`.

A manual workflow run behaves the same way:

- `upload=false`: quality and isolation verification only.
- `upload=true`: create both signed artifacts, wait for both builds to pass, then upload the same release identity to both private stores.

The workflow derives both store build numbers from `100000 + github.run_number`. Both stores receive the package version from `package.json`, the same commit, and the same normalized release notes. Build numbers are never reused.

Store APIs cannot provide an atomic two-store transaction. The workflow reduces split releases by refusing to begin either upload until both signed artifacts have built and passed identity checks. If one provider rejects an upload after that point, correct the provider issue and rerun the same commit; the new run will intentionally use a higher build number.

## Required GitHub configuration

Repository variable:

- `TESTING_STORE_AUTO_UPLOAD_ENABLED=false` while onboarding; change to `true` only after the first paired manual upload is verified.

Environment `google-play-testing`:

- Secret `ANDROID_UPLOAD_KEYSTORE_BASE64`
- Secret `ANDROID_UPLOAD_STORE_PASSWORD`
- Secret `ANDROID_UPLOAD_KEY_ALIAS`
- Secret `ANDROID_UPLOAD_KEY_PASSWORD`

Google authentication remains keyless through the existing GitHub OIDC provider and release-only service account. The service account must remain restricted to the two Cho packages and testing-track releases.

Environment `apple-testflight-testing`:

- Secret `APPLE_ASC_KEY_ID`
- Secret `APPLE_ASC_ISSUER_ID`
- Secret `APPLE_ASC_PRIVATE_KEY`
- Secret `APPLE_DISTRIBUTION_CERTIFICATE_BASE64`
- Secret `APPLE_DISTRIBUTION_CERTIFICATE_PASSWORD`
- Variable `APPLE_TESTFLIGHT_DISTRIBUTE_ENABLED=false` for the first upload-only run
- Variable `APPLE_TESTFLIGHT_EXTERNAL_GROUP=Cho Client Testers`

Use an App Store Connect **team API key**, not an individual key, because the signed archive job uses Apple provisioning endpoints. The private key is used only from GitHub's protected environment and is written to the ephemeral macOS runner during the job. The Apple Distribution certificate must include its private key and be exported as a password-protected `.p12` before base64 encoding.

Never commit, print, artifact, or paste the raw Apple key, P12, P12 password, Android keystore, or keystore passwords into repository files.

## One-time Apple setup

Completed on 2026-07-27:

1. Registered explicit App ID `com.xatoridev.chosmartialarts.testing` under team `9R42C8LZ43`.
2. Created the App Store Connect record:
   - Platform: iOS
   - Name: `Cho's Testing`
   - Primary language: English (U.S.)
   - Bundle ID: `com.xatoridev.chosmartialarts.testing`
   - SKU: `chos-testing-ios`
   - User access: Full Access
   - Apple app ID: `6795251405`
3. Created a valid Apple Distribution certificate for the team and exported it with its private key.
4. Created a team App Store Connect API key with App Manager access and installed all five Apple secrets in the protected `apple-testflight-testing` GitHub environment.
5. Verified the key and app identity through a read-only App Store Connect API request with status `200`.

Remaining:

1. Resolve the GitHub Actions billing/spending-limit block so a hosted runner can start.
2. Create an internal TestFlight group.
3. Create external group `Cho Client Testers`, complete TestFlight test information and Beta App Review contact information, and add approved client emails.
4. Keep `APPLE_TESTFLIGHT_DISTRIBUTE_ENABLED=false` for the first upload. After the build finishes processing and the external group metadata is complete, set it to `true`. The first external build may require Apple's Beta App Review; this is not public App Store review.

## First paired proof

1. Leave `TESTING_STORE_AUTO_UPLOAD_ENABLED=false`.
2. Run **Release Cho's Testing to both private stores** manually with `upload=false`.
3. Confirm quality and isolation checks pass.
4. Run it again from the same approved `main` commit with `upload=true` and useful client-facing release notes.
5. Confirm the GitHub run reports both upload jobs successful.
6. In Play Console, confirm the new version is on `internal` for `Cho Internal Testers`.
7. In App Store Connect, confirm the matching build appears under TestFlight for `Cho's Testing`.
8. Test installation on one Android device and one iPhone.
9. Enable external TestFlight distribution, run the next approved update, and verify an external tester receives Apple's invitation.
10. Set `TESTING_STORE_AUTO_UPLOAD_ENABLED=true`.

Afterward, every app-affecting merge to `main` automatically follows the paired path.

## Emergency stop and rollback

Set `TESTING_STORE_AUTO_UPLOAD_ENABLED=false` to stop automatic uploads immediately; pushes still run quality checks.

Neither store permits reusing or replacing a published build number. To correct a testing release:

1. Disable automatic uploads if clients should not receive more builds.
2. Restore the last known-good code in a new commit.
3. Run the paired workflow again, producing a higher build number.
4. Pause the Play internal release or remove the affected TestFlight build/group access in the store console if immediate tester access must stop.

## Evidence to retain

- Git commit SHA and GitHub run URL.
- Shared build number and version.
- Android AAB and iOS IPA artifact names and SHA-256 values.
- Google Play internal release state and opt-in URL.
- App Store Connect processed-build state and TestFlight group.
- Android and iPhone installation results.

Do not retain raw signing credentials in release evidence.

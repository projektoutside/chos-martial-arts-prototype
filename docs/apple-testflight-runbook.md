# First TestFlight Archive Runbook

This runbook stops before upload. It prepares and validates the exact path to App Store Connect without adding a build to TestFlight.

## Release identity

| Field | Value |
| --- | --- |
| App name | `Cho's Martial Arts` |
| Bundle ID | `com.xatoridev.chosmartialarts` |
| Apple team | `9R42C8LZ43` |
| Version | `0.1.13` |
| Build | `1` |
| SKU | `chos-martial-arts-ios` |
| Minimum iOS | `15.0` |

Keep the bundle ID exact. App Store Connect permanently associates uploaded builds with the bundle ID, version, and build number.

## 1. Create the Apple records

In Apple Developer, register an explicit iOS App ID for `com.xatoridev.chosmartialarts`.

In App Store Connect, create one iOS app:

- Name: `Cho's Martial Arts`
- Primary language: English (U.S.)
- Bundle ID: the exact explicit ID above
- SKU: `chos-martial-arts-ios`
- User access: Full Access

Do not create the `.testing` record during this stable first-upload pass.

## 2. Prepare on a Mac

Capacitor 8 requires Xcode 26 or newer. On a Mac with the Apple account added to Xcode:

```bash
npm ci
npm run test
npm run build:ios
npx cap open ios
```

In Xcode, select the `App` target and confirm:

- Team: La Xiong (`9R42C8LZ43`)
- Automatically manage signing: enabled
- Bundle Identifier: `com.xatoridev.chosmartialarts`
- Version: `0.1.13`
- Build: `1`
- Deployment target: iOS 15.0

Xcode can create or download the needed cloud-managed distribution signing assets. Never copy certificates, provisioning profiles, private keys, or App Store Connect API keys into this repository.

## 3. Create and validate the archive

1. Select the `App` scheme and `Any iOS Device (arm64)`.
2. Choose **Product > Archive**.
3. In Organizer, select the new `Cho's Martial Arts` archive.
4. Confirm the archive identity is version `0.1.13` build `1`.
5. Choose **Validate App** and use automatic signing.
6. Resolve every validation error or warning that affects upload readiness.
7. Stop when Xcode reports successful validation.

Do not choose **Distribute App**, **Upload**, **TestFlight & App Store**, or **Submit for Review** during this verification pass.

## 4. Optional repository archive proof

The manual workflow **Verify Cho's iOS archive (no upload)** runs on GitHub's `macos-26` image. It builds the stable web app, syncs the native target, compiles an unsigned archive, verifies the embedded bundle/version/build identity, and saves the archive as evidence.

It cannot upload because:

- its release-input contract accepts only `archive-only`;
- code signing is explicitly disabled;
- it has no App Store Connect credential step;
- it has no upload or submission command.

If GitHub reports that the job did not start because account payments failed or the spending limit must be increased, fix repository-owner billing before treating CI as archive proof.

## 5. First real upload later

After a successful no-upload validation, return to the same Organizer archive and choose **Distribute App > TestFlight & App Store > Upload**. Uploading creates the first processed build in App Store Connect; it still does not submit the app to App Review.

Record the archive version/build, Git commit, signing team, validation result, upload timestamp, processed-build status, and internal TestFlight group. Increment the Apple build number for every replacement archive.

## Store work that remains separate from this archive check

- App privacy answers based on actual stable data flows.
- Age rating and the new social-media questions.
- Reviewer access instructions for the private sign-in gate.
- Privacy policy URL and support/contact metadata.
- EU trader-status decision and any country/region availability choices.
- TestFlight internal tester group.
- The separate `Cho's Testing` bundle ID, iOS target, icon, fake-data isolation check, and App Store Connect record.

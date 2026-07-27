# Apple TestFlight Readiness

Status: stable archive verification plus an isolated `Cho's Testing` TestFlight build/upload path are implemented. No build has been uploaded or submitted.

## Stable app identity

- App: `Cho's Martial Arts`
- Bundle ID: `com.xatoridev.chosmartialarts`
- Apple team: `9R42C8LZ43`
- First aligned TestFlight version: `0.1.13`
- First Apple build number: `1`
- Minimum iOS version: `15.0`
- Signing style: Xcode automatic signing
- Capacitor: `8.4.1` with Swift Package Manager

The stable identity matches the existing Android package. The testing/demo target uses `com.xatoridev.chosmartialarts.testing`, packages only the network-disabled fake-data environment, and uses a separate `TEST` icon.

## Current account snapshot (2026-07-27)

- Apple Developer and App Store Connect access is active for La Xiong.
- The stable explicit App ID `com.xatoridev.chosmartialarts` is registered.
- The stable App Store Connect record `Cho's Martial Arts` exists in Prepare for Submission with no TestFlight builds.
- The testing App ID and `Cho's Testing` App Store Connect record remain the next one-time account setup.
- A team App Store Connect API key and an Apple Distribution certificate with its private key remain required for signed GitHub archives.

## What is now checked in

- Native Xcode project under `ios/`.
- Cho-branded 1024x1024 RGB App Store icon and dark launch assets.
- Exact Apple team, stable bundle ID, iOS 15 deployment target, version, and build defaults.
- Export-compliance key for an app using only exempt system encryption.
- `npm run build:ios` to build stable web assets, sync Capacitor, and verify native release inputs.
- `npm run build:ios:testing` to build fake-data-only assets, verify isolation, sync Capacitor, and prepare the testing native identity.
- A manual GitHub workflow that compiles an unsigned Xcode archive on `macos-26` and has no upload or submission step.
- A paired protected workflow that waits for both signed testing artifacts before uploading to Google Play internal testing and Apple TestFlight.
- Secret exclusions for Apple keys, certificates, profiles, archives, and IPAs.

Use [apple-testflight-runbook.md](apple-testflight-runbook.md) for the first signed archive and Xcode **Validate App** handoff.
Use [testing-store-automation.md](testing-store-automation.md) for the automated testing-app onboarding and paired private release path.

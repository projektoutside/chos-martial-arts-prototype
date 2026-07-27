# Apple TestFlight Readiness

Status: iOS source target and archive-only verification are implemented. No build has been uploaded or submitted.

## Stable app identity

- App: `Cho's Martial Arts`
- Bundle ID: `com.xatoridev.chosmartialarts`
- Apple team: `9R42C8LZ43`
- First aligned TestFlight version: `0.1.13`
- First Apple build number: `1`
- Minimum iOS version: `15.0`
- Signing style: Xcode automatic signing
- Capacitor: `8.4.1` with Swift Package Manager

The stable identity matches the existing Android package. The testing/demo app remains a later, separate target using `com.xatoridev.chosmartialarts.testing`; this first-upload change does not package demo data or change Android flavors.

## Current account snapshot (2026-07-27)

- Apple Developer and App Store Connect access is active for La Xiong.
- App Store Connect currently contains no app records.
- Certificates, Identifiers & Profiles currently contains no App IDs or signing certificates.
- The Apple-side bundle ID and app record must therefore be created before a signed archive can validate.

## What is now checked in

- Native Xcode project under `ios/`.
- Cho-branded 1024x1024 RGB App Store icon and dark launch assets.
- Exact Apple team, stable bundle ID, iOS 15 deployment target, version, and build defaults.
- Export-compliance key for an app using only exempt system encryption.
- `npm run build:ios` to build stable web assets, sync Capacitor, and verify native release inputs.
- A manual GitHub workflow that compiles an unsigned Xcode archive on `macos-26` and has no upload or submission step.
- Secret exclusions for Apple keys, certificates, profiles, archives, and IPAs.

Use [apple-testflight-runbook.md](apple-testflight-runbook.md) for the first signed archive and Xcode **Validate App** handoff.

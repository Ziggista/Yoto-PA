# Building Yoto-PA for iOS

iOS apps can only be compiled on macOS. There's no Mac in this setup, so iOS builds run on a GitHub
Actions macOS runner (`.github/workflows/ios.yml`). App behaviour on iOS and the deferred iOS work
are in [ios.md](ios.md).

Status: the iOS project is scaffolded but has **not been compiled yet**. Run the `unsigned` mode
once to prove it builds.

## What's in the repo

| Path | Purpose |
| --- | --- |
| `ios/` | Capacitor 8 Xcode project (Swift Package Manager, no CocoaPods). Bundle ID `dev.ziggi.yotopa`, iOS 15+. |
| `ios/App/App/Info.plist` | `NFCReaderUsageDescription`, `CFBundleURLTypes` for the `dev.ziggi.yotopa` sign-in callback, `ITSAppUsesNonExemptEncryption = false` (skips the TestFlight export-compliance question). |
| `ios/App/App/App.entitlements` | Core NFC tag reading (`TAG` format). Wired up via `CODE_SIGN_ENTITLEMENTS`. |
| `ios/ExportOptions.plist` | App Store Connect export with automatic signing and direct upload. |
| `ios-plugins/exxili-capacitor-nfc/` | Local copy of the NFC plugin's Swift sources. Upstream pins `capacitor-swift-pm` to `branch: main`, which SwiftPM can't resolve next to Capacitor 8's exact version. This is also where the blank-card format port goes (IOS-LATER in `NFCWriter.swift`). |
| `scripts/override-capacitor-ios.mjs` | Runs automatically after `npx cap sync` (the `capacitor:sync:after` hook) and points `CapApp-SPM` at `ios-plugins/` instead of `node_modules`. |

`npm run ios:sync` builds the web app and syncs it into `ios/`. It works on Windows too; only the
Xcode build needs macOS.

## Workflow modes

Actions → **iOS build** → Run workflow, then pick a mode. Both are manual only: on a private
repo, macOS minutes count 10× against the free 2,000 a month, so expect roughly 20 builds a month.

- **unsigned**: no Apple account needed. Compiles the app and uploads `Yoto-PA-unsigned.ipa` as a
  workflow artifact. You can re-sign it with Sideloadly or AltStore and a free Apple ID to try the app
  on an iPhone. It expires after 7 days, and **NFC won't work** because free accounts can't use Core NFC.
- **testflight**: needs the Apple Developer Program and the secrets below. Archives, signs
  automatically and uploads to TestFlight. Card reading and writing work.

## TestFlight setup (when you join the Apple Developer Program)

1. Enrol at https://developer.apple.com/programs/enroll/ (US$99/yr, individual is fine). Approval can
   take up to 48 hours.
2. Note your **Team ID**: developer.apple.com → Account → Membership details.
3. Register the App ID: Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App.
   Bundle ID (explicit) `dev.ziggi.yotopa`, and tick **NFC Tag Reading**.
4. Create the app: App Store Connect → Apps → + → New App with the same bundle ID. Nothing is
   submitted for review; internal TestFlight testing needs no review.
5. Create an API key: App Store Connect → Users and Access → Integrations → App Store Connect API →
   Team Keys → +, role **Admin** (so Xcode can create the cloud-managed distribution certificate and
   profiles). Download the `.p8` (one download only) and note the **Key ID** and **Issuer ID**.
6. Add repository secrets (Settings → Secrets and variables → Actions):

   | Secret | Value |
   | --- | --- |
   | `APPLE_TEAM_ID` | Team ID |
   | `APP_STORE_CONNECT_KEY_ID` | Key ID |
   | `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
   | `APP_STORE_CONNECT_KEY_P8` | the `.p8` base64 encoded. PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXX.p8"))` |

7. Run the workflow in `testflight` mode. The build appears in App Store Connect → TestFlight about
   15 minutes later. Add both of you as internal testers once, then install from the TestFlight app.

The build number is the workflow run number, so every upload is unique. The marketing version is set
in Xcode (`MARKETING_VERSION`, currently 0.1.0).

## Building on a Mac instead

On any Apple Silicon Mac with current Xcode: `npm ci && npm run ios:sync && npm run ios:open`, pick
your team under Signing & Capabilities, and run on a connected iPhone. Free personal teams can't sign
the NFC entitlement, so remove **Near Field Communication Tag Reading** from the capability list
for a free-account build.

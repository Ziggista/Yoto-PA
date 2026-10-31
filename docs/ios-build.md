# Building Yoto-PA for iOS

iOS apps can only be compiled with Xcode on macOS. Ziggi-PC is Windows, and this project uses no
cloud CI (no GitHub-hosted runners or paid build services), so **iOS builds need a Mac**. Until one is
available the iOS project is kept ready in the repo but isn't built. App behaviour on iOS and the
deferred iOS work are in [ios.md](ios.md).

Status: the iOS project is scaffolded and `npx cap sync ios` works, but it has **not been compiled
in Xcode yet**.

## What's in the repo

| Path | Purpose |
| --- | --- |
| `ios/` | Capacitor 8 Xcode project (Swift Package Manager, no CocoaPods). Bundle ID `dev.ziggi.yotopa`, iOS 15+. |
| `ios/App/App/Info.plist` | `NFCReaderUsageDescription`, `CFBundleURLTypes` for the `dev.ziggi.yotopa` sign-in callback, `ITSAppUsesNonExemptEncryption = false` (skips the TestFlight export-compliance question). |
| `ios/App/App/App.entitlements` | Core NFC tag reading (`TAG` format). Wired up via `CODE_SIGN_ENTITLEMENTS`. |
| `ios/ExportOptions.plist` | App Store Connect export with automatic signing, for command-line archives. |
| `ios-plugins/exxili-capacitor-nfc/` | Local copy of the NFC plugin's Swift sources. Upstream pins `capacitor-swift-pm` to `branch: main`, which SwiftPM can't resolve next to Capacitor 8's exact version. This is also where the blank-card format port goes (IOS-LATER in `NFCWriter.swift`). |
| `scripts/override-capacitor-ios.mjs` | Runs automatically after `npx cap sync` (the `capacitor:sync:after` hook) and points `CapApp-SPM` at `ios-plugins/` instead of `node_modules`. |

`npm run ios:sync` builds the web app and syncs it into `ios/`. It runs on Windows too, so keep
running it there when web code changes; only the Xcode step needs the Mac.

## Which Mac

Any Apple Silicon Mac that runs current Xcode. The cheapest sensible option is a used **Mac mini M1
(2020)**, ideally 16 GB RAM / 512 GB. Avoid Intel Macs: Apple is dropping them from macOS and Xcode.

## Apple account: free vs paid

| | Free Apple ID | Apple Developer Program (US$99/yr) |
| --- | --- | --- |
| Install on your own iPhones | Yes, from Xcode over USB | Yes, via TestFlight or Xcode |
| App lifetime | Re-install every 7 days | 90 days per TestFlight build |
| **NFC card reading/writing** | **No** (Apple doesn't allow Core NFC for free teams) | Yes |

## Building on the Mac

1. Install Xcode from the App Store, plus Node 22 and git.
2. `git clone https://github.com/Ziggista/Yoto-PA && cd Yoto-PA && npm ci && npm run ios:sync && npm run ios:open`
3. In Xcode, select the **App** target → Signing & Capabilities, tick *Automatically manage signing*
   and pick your team.
   - **Free Apple ID:** remove the **Near Field Communication Tag Reading** capability first, or
     signing fails. (Don't commit that change.)
4. Plug in the iPhone, enable Developer Mode on it when prompted, pick it as the run destination and
   press Run.

### TestFlight (paid program)

One-time setup:

1. Enrol at https://developer.apple.com/programs/enroll/ (individual is fine; approval can take
   up to 48 hours).
2. Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App. Bundle ID (explicit)
   `dev.ziggi.yotopa`, tick **NFC Tag Reading**.
3. App Store Connect → Apps → + → New App with the same bundle ID. Nothing is submitted for review;
   internal TestFlight testing needs no review.

Each release: in Xcode choose *Any iOS Device*, then Product → Archive → Distribute App →
TestFlight & App Store. Bump the build number (`CURRENT_PROJECT_VERSION`) for each upload. Add both of
you as internal testers once, then install from the TestFlight app.

## Optional later: automate builds on the Mac

If the Mac stays on, it can be registered as a **self-hosted** GitHub Actions runner (Settings →
Actions → Runners → New self-hosted runner → macOS). Jobs that target `runs-on: [self-hosted, macOS]`
run on your own hardware and use no GitHub minutes. No workflow is committed for this yet; add one
only once the runner exists, and never target GitHub-hosted runners.

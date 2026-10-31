# Yoto-PA

Yoto-PA is a phone app for Yoto families. It signs in to your own Yoto account through your own Yoto
developer app, lists your Make Your Own playlists and family library, and writes a playlist link onto a
blank DIY NFC card so a Yoto player plays it.

There is no server. The app talks to `login.yotoplay.com` and `api.yotoplay.com` directly, and your
sign-in is kept in the phone's secure storage (Android Keystore, iOS Keychain).

Platforms: Android now, iOS next (see docs/ios.md). Forked from YotoWebMgr, whose history is preserved here.

## What's in release 0.1

- Guided setup of your own Yoto developer app, then PKCE sign-in in the system browser.
- My playlists (`/content/mine`) and family library (`/card/family/library`) with search.
- Write a playlist link to a DIY card, then scan it to check it.
- Scan any card to see which playlist it plays.

Upload of new audio comes in a later release.

## Develop

```bash
npm install
npm run dev          # browser preview at http://localhost:5173 (no NFC)
npm run build        # type-check and build dist/
```

For browser sign-in during development, add `http://localhost:5173/auth/callback` to your Yoto
app's allowed callback URLs as well.

## Android

```bash
npm run android:sync       # build, cap sync, re-point the patched NFC plugin
npm run android:apk:debug  # Windows: build a debug APK with Android Studio's JDK
npm run android:open       # open in Android Studio
```

- Releases: `npm run release -- 0.1.0-beta.1` builds a signed APK on this PC and publishes a GitHub
  release. See `docs/releasing.md`.
- App ID: `dev.ziggi.yotopa`
- OAuth callback: `dev.ziggi.yotopa://auth/callback`

`android-plugins/exxili-capacitor-nfc` is a patched copy of the NFC plugin that formats blank Type 2
tags correctly. `npm run android:sync` re-points Gradle at it after every `cap sync`.

## Layout

```text
src/
  App.tsx            tabs, OAuth callback handling, data loading
  screens/           Setup, Library, LinkCard, ScanCard, Account
  yoto/              config, PKCE, auth (tokens + refresh), API client, card link URL
  lib/               secure storage and platform-neutral NFC helpers
android/             Capacitor Android project
android-plugins/     patched NFC plugin
docs/                setup guide and architecture notes
```

## License

MIT

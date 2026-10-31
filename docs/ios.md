# iOS plan

Yoto-PA is written so the same web layer runs on iOS. Build tooling (Xcode project under `ios/`,
Core NFC entitlement, signing) is covered in `docs/ios-build.md`.

Builds and CI run locally only. Do not add GitHub Actions or other cloud CI that uses paid minutes;
an iOS build needs a local Mac. This page covers app behaviour on iOS and what is deliberately left for later.

Search the code for `IOS-LATER` to find every deferred item.

## Already iOS-ready

| Area | How |
| --- | --- |
| Sign-in | PKCE with `@capacitor/browser` (SFSafariViewController) and the `dev.ziggi.yotopa://auth/callback` scheme. The callback arrives via `@capacitor/app` `appUrlOpen`, the same as Android. Needs `CFBundleURLTypes` for `dev.ziggi.yotopa` in `Info.plist`. |
| Token storage | `@aparajita/capacitor-secure-storage` uses the iOS Keychain. |
| Yoto API calls | `CapacitorHttp` runs requests natively on iOS too, so CORS does not apply. |
| NFC | All NFC goes through `src/lib/nfc.ts`. Reads and writes only start from a button tap, as Core NFC requires. `cancelWriteAndroid` is only called on Android. |
| Platform differences | `src/lib/platform.ts` (`nfcBehaviour`) holds the hold-the-card hint, system-sheet behaviour, blank-card support and timeouts per platform. |
| User cancels the scan sheet | Mapped to `NfcCancelledError`; screens reset quietly instead of showing an error. |
| Layout | Safe-area insets (`env(safe-area-inset-*)`, `viewport-fit=cover`) for the notch and home indicator. |

## Deferred (IOS-LATER)

1. **Format brand-new blank cards on iPhone.** The upstream `@exxili/capacitor-nfc` Swift writer only
   writes to cards that are already NDEF formatted. Android uses the patched plugin in
   `android-plugins/`, which formats blank Type 2 tags itself. Port that fallback to Swift using
   `NFCTagReaderSession` + `NFCMiFareTag.sendMiFareCommand` (write the capability container to page 3,
   then the NDEF TLV), probably as `ios-plugins/exxili-capacitor-nfc` with a sync script like
   `scripts/override-capacitor-settings.mjs`. Then set `formatsBlankCards: true` for iOS in
   `src/lib/platform.ts`. Until then the app tells iPhone users the card must already be formatted.
2. **Clear the Keychain after a reinstall.** Keychain items survive uninstall, so a reinstalled app would
   still hold old tokens. Add a first-launch flag and clear the store once (`src/lib/secureStore.ts`).
3. **ASWebAuthenticationSession for sign-in.** Optional polish: the standard iOS sign-in sheet and shared
   Safari cookies (`src/yoto/auth.ts`).
4. **Write-success detection.** The iOS writer confirms success inside its own sheet; check on a device
   that the plugin's `nfcWriteSuccess` event reaches the app reliably so the Check step lights up.
5. **App icon and launch screen** for iOS sizes (Android ones live under `android/app/src/main/res`).

## Testing checklist for the first TestFlight build

- First-run setup: copy the callback URL, paste the Client ID, sign in, come back to the app.
- Kill the app while the Yoto login page is open, finish sign-in, check the app still completes it.
- Playlists and family library load; pull Refresh works.
- Write a card that was formatted on Android; Check reads it back; Scan card finds the playlist.
- Cancel the scan sheet: no error message should appear.

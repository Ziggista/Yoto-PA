# Architecture

Yoto-PA is a Capacitor 8 app with a React 18 + TypeScript + Vite web layer. There is no backend.

## Auth

- Authorization code flow with PKCE (S256) against `https://login.yotoplay.com`, using the user's
  own public Client ID. No client secret exists anywhere.
- `startSignIn` stores the verifier, state, redirect URI and client ID in secure storage before opening
  the system browser (`@capacitor/browser`), so the exchange still works if Android kills the app.
- The browser returns to `dev.ziggi.yotopa://auth/callback`. Android routes it through the intent
  filter in `AndroidManifest.xml`; `@capacitor/app` delivers it via `appUrlOpen` (or `getLaunchUrl`
  on a cold start).
- Tokens live in `@aparajita/capacitor-secure-storage` (Android Keystore / iOS Keychain). Access tokens
  are refreshed 60 seconds before expiry, and once more on a 401.

## Network

`CapacitorHttp` is enabled in `capacitor.config.ts`, so `fetch` runs through native HTTP and Yoto's
CORS policy does not apply inside the app. In a desktop browser (`npm run dev`) requests go straight
from the page and depend on Yoto's CORS headers.

## Card linking

A DIY card carries one NDEF Well Known URI record. The URL is the card's share link if Yoto returns
one, otherwise `https://yoto.io/<cardId>`. This is the format verified on real cards in YotoWebMgr.
The record uses the `https://` prefix code (0x04) so it fits 48-byte MIFARE Ultralight EV1 tags.

`src/lib/nfc.ts` is the only module that touches the NFC plugin. Every read and write starts from a
user tap, which iOS Core NFC requires. `cancelWriteAndroid` is only called on Android.

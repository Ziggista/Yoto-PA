# AGENTS.md — Yoto-PA

Yoto-PA is a mobile-only (Android now, iOS next) Yoto companion app with **no backend**. It was forked
from YotoWebMgr; the backend, worker and Kubernetes pieces were removed in the fork commit.

## Rules

- No server components. Everything runs on the phone and talks to Yoto directly.
- Users bring their own Yoto developer app (public client, PKCE). Never add a client secret or a
  shared client ID.
- Tokens only go in secure storage (`src/lib/secureStore.ts`). Never log tokens or put them in
  `localStorage` directly.
- All NFC access goes through `src/lib/nfc.ts` and must start from a user action, so iOS keeps working.
- Keep screens small and in `src/screens/`. Do not grow a single giant `App.tsx` again.
- Run `npm run build` before committing; it type-checks.

## Roadmap after 0.1

1. Upload: pick audio on the phone, upload and transcode via Yoto, create a MYO playlist.
2. iOS platform, TestFlight build and Core NFC entitlement. App-side plan in docs/ios.md; grep `IOS-LATER` for deferred items.
3. Playlist detail (chapters, artwork) and card history.

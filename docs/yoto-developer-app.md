# Setting up your Yoto developer app

Yoto-PA has no shared client ID. Each household creates its own Yoto developer app, which keeps the
API access under your own account. The app walks you through this on first launch; this page is the
same steps for reference.

1. Open the Yoto developer dashboard (https://dashboard.yoto.dev/) and sign in with your normal Yoto
   account.
2. Create a new app. Choose the public / native client type so it has **no client secret**. Yoto-PA
   uses PKCE, which is the standard for mobile apps that cannot keep a secret.
3. Add the callback URL exactly as shown in Yoto-PA:
   - Android / iOS app: `dev.ziggi.yotopa://auth/callback`
   - Browser dev build: `http://localhost:5173/auth/callback`
4. Enable (pre-approve) these permissions on the Yoto app: `family:library:view` and
   `user:content:view`.
5. Copy the Client ID into Yoto-PA and tap **Sign in with Yoto**.

## Scopes requested

`openid offline_access family:library:view user:content:view`

`offline_access` provides the refresh token so you stay signed in. Upload will add
`user:content:manage`; you'll need to enable it and sign in again when that release ships.

## Troubleshooting

- **"access_denied: ... scopes that have not been pre-approved"** on the Yoto page: enable the listed
  scopes on your Yoto app, save, and sign in again.
- **"Callback URL mismatch"** on the Yoto page: the callback in your Yoto app must match character
  for character, including `://auth/callback`.
- **Yoto rejected the token request**: usually a wrong Client ID, or the Yoto app was created as a
  confidential client with a secret. Create a public/native one.
- **Signed out unexpectedly**: the refresh token was revoked or expired. Sign in again.

export const YOTO_AUTH_BASE_URL = "https://login.yotoplay.com";
export const YOTO_API_BASE_URL = "https://api.yotoplay.com";
export const YOTO_DEVELOPER_PORTAL_URL = "https://dashboard.yoto.dev/";

/** Custom URL scheme registered in AndroidManifest.xml (and Info.plist for iOS). */
export const APP_URL_SCHEME = "dev.ziggi.yotopa";

/** Callback URL to register with the user's own Yoto developer app. */
export const NATIVE_REDIRECT_URI = `${APP_URL_SCHEME}://auth/callback`;

/**
 * Scopes for this release. Each one must be enabled (pre-approved) on the user's Yoto developer app,
 * otherwise Yoto's login page stops with "access_denied: ... scopes that have not been pre-approved".
 * Upload will add user:content:manage later; it is left out until it is used.
 */
export const YOTO_OAUTH_SCOPES = ["openid", "offline_access", "family:library:view", "user:content:view"];

/** The scopes the user has to enable on their Yoto app (openid/offline_access are standard). */
export const YOTO_APP_PERMISSIONS = YOTO_OAUTH_SCOPES.filter((scope) => scope.includes(":"));

export const YOTO_OAUTH_SCOPE = YOTO_OAUTH_SCOPES.join(" ");

/** Redirect URI used when the app runs in a desktop browser via `npm run dev`. */
export function browserRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

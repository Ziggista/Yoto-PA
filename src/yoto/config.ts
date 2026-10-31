export const YOTO_AUTH_BASE_URL = "https://login.yotoplay.com";
export const YOTO_API_BASE_URL = "https://api.yotoplay.com";
export const YOTO_DEVELOPER_PORTAL_URL = "https://dashboard.yoto.dev/";

/** Custom URL scheme registered in AndroidManifest.xml (and Info.plist for iOS). */
export const APP_URL_SCHEME = "dev.ziggi.yotopa";

/** Callback URL to register with the user's own Yoto developer app. */
export const NATIVE_REDIRECT_URI = `${APP_URL_SCHEME}://auth/callback`;

/**
 * Scopes for rev 1. Upload (user:content:manage) is requested now so the user does not need to
 * re-authorise when upload ships.
 */
export const YOTO_OAUTH_SCOPE = [
  "openid",
  "offline_access",
  "family:library:view",
  "user:content:view",
  "user:content:manage",
].join(" ");

/** Redirect URI used when the app runs in a desktop browser via `npm run dev`. */
export function browserRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

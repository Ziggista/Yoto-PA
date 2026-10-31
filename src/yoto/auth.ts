import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { readJson, removeKey, writeJson } from "../lib/secureStore";
import { createPkcePair, randomUrlSafeString } from "./pkce";
import {
  NATIVE_REDIRECT_URI,
  YOTO_API_BASE_URL,
  YOTO_AUTH_BASE_URL,
  YOTO_OAUTH_SCOPE,
  browserRedirectUri,
} from "./config";

const SETTINGS_KEY = "settings";
const PENDING_KEY = "pkce_pending";
const TOKENS_KEY = "tokens";

export interface AppSettings {
  clientId: string;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  scope: string | null;
  /** Epoch milliseconds. */
  expiresAt: number | null;
}

interface PendingAuth {
  verifier: string;
  state: string;
  redirectUri: string;
  clientId: string;
  createdAt: number;
}

export interface AccountSummary {
  label: string;
  scope: string | null;
  expiresAt: number | null;
}

export class YotoAuthError extends Error {}

export function redirectUri(): string {
  return Capacitor.isNativePlatform() ? NATIVE_REDIRECT_URI : browserRedirectUri();
}

export async function loadSettings(): Promise<AppSettings | null> {
  return readJson<AppSettings>(SETTINGS_KEY);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await writeJson(SETTINGS_KEY, { clientId: settings.clientId.trim() });
}

export async function loadTokens(): Promise<StoredTokens | null> {
  return readJson<StoredTokens>(TOKENS_KEY);
}

export async function startSignIn(clientId: string): Promise<void> {
  const trimmed = clientId.trim();
  if (!trimmed) {
    throw new YotoAuthError("Enter your Yoto Client ID first.");
  }
  const { verifier, challenge } = await createPkcePair();
  const state = randomUrlSafeString(24);
  const pending: PendingAuth = {
    verifier,
    state,
    redirectUri: redirectUri(),
    clientId: trimmed,
    createdAt: Date.now(),
  };
  // Persist so the exchange still works if Android kills the app while the browser is open.
  await writeJson(PENDING_KEY, pending);

  const query = new URLSearchParams({
    audience: YOTO_API_BASE_URL,
    response_type: "code",
    client_id: trimmed,
    redirect_uri: pending.redirectUri,
    scope: YOTO_OAUTH_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  const url = `${YOTO_AUTH_BASE_URL}/authorize?${query.toString()}`;

  if (Capacitor.isNativePlatform()) {
    // Android: Custom Tab. iOS: SFSafariViewController, closed again in completeSignIn.
    // IOS-LATER: consider ASWebAuthenticationSession (via a small plugin) so iOS shows its standard
    // "wants to use yotoplay.com to sign in" sheet and shares Safari's Yoto login cookies.
    await Browser.open({ url });
  } else {
    window.location.assign(url);
  }
}

/** True when a URL is our OAuth callback (native scheme or the dev-browser path). */
export function isAuthCallbackUrl(url: string): boolean {
  return url.startsWith(NATIVE_REDIRECT_URI) || url.startsWith(browserRedirectUri());
}

export async function completeSignIn(callbackUrl: string): Promise<StoredTokens> {
  if (Capacitor.isNativePlatform()) {
    void Browser.close().catch(() => undefined);
  }
  const params = new URL(callbackUrl).searchParams;
  const providerError = params.get("error");
  if (providerError) {
    await removeKey(PENDING_KEY);
    const description = params.get("error_description");
    throw new YotoAuthError(`Yoto sign-in was not completed: ${description || providerError}`);
  }
  const code = params.get("code");
  const state = params.get("state");
  const pending = await readJson<PendingAuth>(PENDING_KEY);
  if (!code || !state) {
    throw new YotoAuthError("The Yoto callback did not include an authorisation code.");
  }
  if (!pending || pending.state !== state) {
    throw new YotoAuthError("This sign-in attempt has expired or did not start in this app. Try signing in again.");
  }

  const payload = await postTokenRequest({
    grant_type: "authorization_code",
    client_id: pending.clientId,
    code_verifier: pending.verifier,
    code,
    redirect_uri: pending.redirectUri,
  });
  await removeKey(PENDING_KEY);
  const tokens = tokensFromPayload(payload, null);
  await writeJson(TOKENS_KEY, tokens);
  return tokens;
}

let refreshInFlight: Promise<StoredTokens> | null = null;

/** Returns a non-expired access token, refreshing it with the stored refresh token if needed. */
export async function getValidAccessToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new YotoAuthError("You are not signed in to Yoto.");
  }
  const expiresSoon = tokens.expiresAt !== null && tokens.expiresAt <= Date.now() + 60_000;
  if (!options.forceRefresh && !expiresSoon) {
    return tokens.accessToken;
  }
  if (!refreshInFlight) {
    refreshInFlight = refreshTokens(tokens).finally(() => {
      refreshInFlight = null;
    });
  }
  return (await refreshInFlight).accessToken;
}

async function refreshTokens(current: StoredTokens): Promise<StoredTokens> {
  const settings = await loadSettings();
  if (!current.refreshToken || !settings?.clientId) {
    throw new YotoAuthError("Your Yoto session has expired. Sign in again.");
  }
  const payload = await postTokenRequest({
    grant_type: "refresh_token",
    client_id: settings.clientId,
    refresh_token: current.refreshToken,
  });
  const tokens = tokensFromPayload(payload, current.refreshToken);
  await writeJson(TOKENS_KEY, tokens);
  return tokens;
}

export async function signOut(): Promise<void> {
  await removeKey(TOKENS_KEY);
  await removeKey(PENDING_KEY);
}

export function summariseAccount(tokens: StoredTokens): AccountSummary {
  const claims = decodeJwtPayload(tokens.idToken ?? "") ?? decodeJwtPayload(tokens.accessToken) ?? {};
  const label =
    stringClaim(claims, "email") ||
    stringClaim(claims, "name") ||
    stringClaim(claims, "nickname") ||
    "Yoto account";
  return { label, scope: tokens.scope, expiresAt: tokens.expiresAt };
}

async function postTokenRequest(form: Record<string, string>): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${YOTO_AUTH_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
  } catch (networkError) {
    throw new YotoAuthError(
      `Could not reach Yoto to complete sign-in (${networkError instanceof Error ? networkError.message : "network error"}).`,
    );
  }
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok || !isRecord(payload) || typeof payload.access_token !== "string") {
    const detail = isRecord(payload)
      ? String(payload.error_description ?? payload.error ?? text)
      : text || `HTTP ${response.status}`;
    throw new YotoAuthError(
      `Yoto rejected the token request: ${detail.slice(0, 240)}. Check that the Client ID and the callback URL in your Yoto app match exactly.`,
    );
  }
  return payload;
}

function tokensFromPayload(payload: Record<string, unknown>, existingRefreshToken: string | null): StoredTokens {
  const accessToken = String(payload.access_token);
  const claims = decodeJwtPayload(accessToken);
  let expiresAt: number | null = null;
  if (claims && typeof claims.exp === "number") {
    expiresAt = claims.exp * 1000;
  } else if (typeof payload.expires_in === "number") {
    expiresAt = Date.now() + payload.expires_in * 1000;
  }
  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : existingRefreshToken,
    idToken: typeof payload.id_token === "string" ? payload.id_token : null,
    scope: typeof payload.scope === "string" ? payload.scope : null,
    expiresAt,
  };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      Array.from(atob(padded))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    const value: unknown = JSON.parse(json);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function stringClaim(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

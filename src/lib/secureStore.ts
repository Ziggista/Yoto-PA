import { SecureStorage } from "@aparajita/capacitor-secure-storage";

/**
 * Thin wrapper over Android Keystore / iOS Keychain backed storage.
 * In a desktop browser (npm run dev) the plugin falls back to localStorage.
 *
 * IOS-LATER: Keychain items survive uninstalling the app, so a reinstall would still be signed in
 * with old tokens. Add a first-launch check (for example a flag in @capacitor/preferences) that
 * clears this store once after a fresh install.
 */

const KEY_PREFIX = "yotopa_";
let prefixReady: Promise<void> | null = null;

function ensurePrefix(): Promise<void> {
  if (!prefixReady) {
    prefixReady = SecureStorage.setKeyPrefix(KEY_PREFIX).catch(() => undefined);
  }
  return prefixReady;
}

export async function readJson<T>(key: string): Promise<T | null> {
  await ensurePrefix();
  try {
    const raw = await SecureStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  await ensurePrefix();
  await SecureStorage.setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await ensurePrefix();
  try {
    await SecureStorage.removeItem(key);
  } catch {
    // Missing keys are fine.
  }
}

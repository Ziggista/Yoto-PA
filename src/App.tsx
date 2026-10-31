import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  YotoAuthError,
  completeSignIn,
  isAuthCallbackUrl,
  loadSettings,
  loadTokens,
  signOut,
  summariseAccount,
  type StoredTokens,
} from "./yoto/auth";
import { listFamilyLibrary, listMyPlaylists, type PlaylistSource, type YotoPlaylist } from "./yoto/api";
import { isNfcAvailable } from "./lib/nfc";
import { Setup } from "./screens/Setup";
import { Library, type LibraryState } from "./screens/Library";
import { LinkCard } from "./screens/LinkCard";
import { ScanCard } from "./screens/ScanCard";
import { Account } from "./screens/Account";

type Tab = "playlists" | "scan" | "account";

const EMPTY: LibraryState = { items: null, loading: false, error: null };

export default function App() {
  const [ready, setReady] = useState(false);
  const [clientId, setClientId] = useState("");
  const [tokens, setTokens] = useState<StoredTokens | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [completingSignIn, setCompletingSignIn] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState(false);
  const [tab, setTab] = useState<Tab>("playlists");
  const [selected, setSelected] = useState<YotoPlaylist | null>(null);
  const [myo, setMyo] = useState<LibraryState>(EMPTY);
  const [family, setFamily] = useState<LibraryState>(EMPTY);
  const handledCallbacks = useRef(new Set<string>());

  const handleCallback = useCallback(async (url: string) => {
    if (handledCallbacks.current.has(url)) {
      return;
    }
    handledCallbacks.current.add(url);
    setCompletingSignIn(true);
    setSetupError(null);
    try {
      setTokens(await completeSignIn(url));
      setTab("playlists");
    } catch (callbackError) {
      setSetupError(callbackError instanceof Error ? callbackError.message : "Yoto sign-in failed.");
    } finally {
      setCompletingSignIn(false);
    }
  }, []);

  // Initial load, OAuth callback wiring and NFC capability check.
  useEffect(() => {
    let cancelled = false;
    const listeners: Array<Promise<{ remove: () => Promise<void> }>> = [];

    void (async () => {
      const [settings, storedTokens, nfc] = await Promise.all([loadSettings(), loadTokens(), isNfcAvailable()]);
      if (cancelled) {
        return;
      }
      setClientId(settings?.clientId ?? "");
      setTokens(storedTokens);
      setNfcAvailable(nfc);
      setReady(true);

      if (Capacitor.isNativePlatform()) {
        const launch = await CapacitorApp.getLaunchUrl();
        if (launch?.url && isAuthCallbackUrl(launch.url)) {
          void handleCallback(launch.url);
        }
      } else if (isAuthCallbackUrl(window.location.href.split("?")[0])) {
        const url = window.location.href;
        window.history.replaceState(null, "", "/");
        void handleCallback(url);
      }
    })();

    if (Capacitor.isNativePlatform()) {
      listeners.push(
        CapacitorApp.addListener("appUrlOpen", ({ url }) => {
          if (isAuthCallbackUrl(url)) {
            void handleCallback(url);
          }
        }),
      );
    }

    return () => {
      cancelled = true;
      listeners.forEach((listener) => void listener.then((handle) => handle.remove()));
    };
  }, [handleCallback]);

  const handleSignOut = useCallback(async (message: string | null = null) => {
    await signOut();
    setTokens(null);
    setSelected(null);
    setMyo(EMPTY);
    setFamily(EMPTY);
    setSetupError(message);
  }, []);

  const load = useCallback(
    async (source: PlaylistSource) => {
      const setState = source === "myo" ? setMyo : setFamily;
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const items = source === "myo" ? await listMyPlaylists() : await listFamilyLibrary();
        setState({ items, loading: false, error: null });
      } catch (loadError) {
        if (loadError instanceof YotoAuthError) {
          await handleSignOut(loadError.message);
          return;
        }
        setState((current) => ({
          ...current,
          loading: false,
          error: loadError instanceof Error ? loadError.message : "Could not load from Yoto.",
        }));
      }
    },
    [handleSignOut],
  );

  const signedIn = tokens !== null;
  useEffect(() => {
    if (signedIn) {
      void load("myo");
      void load("library");
    }
  }, [signedIn, load]);

  // Android back button: close the link screen, then return to Playlists, then leave the app.
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") {
      return;
    }
    const handle = CapacitorApp.addListener("backButton", () => {
      if (selected) {
        setSelected(null);
      } else if (tab !== "playlists") {
        setTab("playlists");
      } else {
        void CapacitorApp.exitApp();
      }
    });
    return () => void handle.then((listener) => listener.remove());
  }, [selected, tab]);

  if (!ready || completingSignIn) {
    return (
      <div className="app">
        <div className="centered muted">{completingSignIn ? "Finishing Yoto sign-in…" : "Loading…"}</div>
      </div>
    );
  }

  if (!tokens) {
    return (
      <div className="app">
        <Setup initialClientId={clientId} error={setupError} onSaved={setClientId} />
      </div>
    );
  }

  const allPlaylists = [...(myo.items ?? []), ...(family.items ?? [])];

  return (
    <div className="app">
      <main className="content">
        {selected ? (
          <LinkCard playlist={selected} nfcAvailable={nfcAvailable} onBack={() => setSelected(null)} />
        ) : tab === "playlists" ? (
          <Library myo={myo} family={family} onRefresh={(source) => void load(source)} onSelect={setSelected} />
        ) : tab === "scan" ? (
          <ScanCard playlists={allPlaylists} nfcAvailable={nfcAvailable} onOpen={setSelected} />
        ) : (
          <Account
            account={summariseAccount(tokens)}
            clientId={clientId}
            onSignOut={() => void handleSignOut()}
            onChangeApp={() => void handleSignOut()}
          />
        )}
      </main>

      <nav className="tabbar">
        {(
          [
            ["playlists", "Playlists"],
            ["scan", "Scan card"],
            ["account", "Account"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key && !selected ? "active" : ""}
            onClick={() => {
              setSelected(null);
              setTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

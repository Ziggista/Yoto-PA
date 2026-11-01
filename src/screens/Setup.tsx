import { useState } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { redirectUri, saveSettings, startSignIn } from "../yoto/auth";
import { YOTO_APP_PERMISSIONS, YOTO_DEVELOPER_PORTAL_URL } from "../yoto/config";
import { CopyField } from "./CopyField";

interface SetupProps {
  initialClientId: string;
  error: string | null;
  onSaved: (clientId: string) => void;
}

export function Setup({ initialClientId, error, onSaved }: SetupProps) {
  const [clientId, setClientId] = useState(initialClientId);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const callback = redirectUri();

  async function openPortal() {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: YOTO_DEVELOPER_PORTAL_URL });
    } else {
      window.open(YOTO_DEVELOPER_PORTAL_URL, "_blank", "noopener");
    }
  }

  async function signIn() {
    setLocalError(null);
    setBusy(true);
    try {
      await saveSettings({ clientId });
      onSaved(clientId.trim());
      await startSignIn(clientId);
    } catch (signInError) {
      setLocalError(signInError instanceof Error ? signInError.message : "Could not start Yoto sign-in.");
    } finally {
      setBusy(false);
    }
  }

  const shownError = localError ?? error;

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Connect your Yoto account</h1>
        <p className="muted">
          Yoto-PA talks to Yoto directly from this phone using your own Yoto developer app. Nothing goes through
          anyone else's server. This takes about two minutes, once.
        </p>
      </header>

      <ol className="steps">
        <li className="card">
          <h2>Create your Yoto developer app</h2>
          <p>
            Open the Yoto developer dashboard and sign in with the same account you use in the Yoto app. Create a new
            app and choose the public or native client type, so it has no client secret.
          </p>
          <button type="button" className="secondary" onClick={() => void openPortal()}>
            Open Yoto developer dashboard
          </button>
        </li>

        <li className="card">
          <h2>Add this callback URL</h2>
          <p>
            In your Yoto app's settings, paste this exactly into <strong>Allowed Callback URLs</strong> and save.
          </p>
          <CopyField value={callback} />
        </li>

        <li className="card">
          <h2>Allow these permissions</h2>
          <p>
            In the same Yoto app, enable these permissions (scopes) and save. If one is missing, Yoto's sign-in page
            stops with "scopes that have not been pre-approved".
          </p>
          <ul className="scope-list">
            {YOTO_APP_PERMISSIONS.map((scope) => (
              <li key={scope} className="mono">
                {scope}
              </li>
            ))}
          </ul>
        </li>

        <li className="card">
          <h2>Paste your Client ID</h2>
          <p>Copy the Client ID from your Yoto app and paste it here.</p>
          <label className="field">
            <span>Client ID</span>
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. a1B2c3D4e5F6..."
            />
          </label>
        </li>

        <li className="card">
          <h2>Sign in to Yoto</h2>
          <p>You'll approve access in the browser and come straight back here.</p>
          {shownError ? <p className="error">{shownError}</p> : null}
          <button type="button" className="primary" disabled={busy || !clientId.trim()} onClick={() => void signIn()}>
            {busy ? "Opening Yoto…" : "Sign in with Yoto"}
          </button>
        </li>
      </ol>
    </div>
  );
}

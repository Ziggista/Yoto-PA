import { redirectUri, type AccountSummary } from "../yoto/auth";
import { CopyField } from "./CopyField";

interface AccountProps {
  account: AccountSummary;
  clientId: string;
  onSignOut: () => void;
  onChangeApp: () => void;
}

export function Account({ account, clientId, onSignOut, onChangeApp }: AccountProps) {
  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Account</h1>
      </header>

      <div className="card">
        <h2>Signed in</h2>
        <p>{account.label}</p>
        {account.scope ? <p className="muted small">Access: {account.scope}</p> : null}
        <button type="button" className="secondary" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <div className="card">
        <h2>Your Yoto developer app</h2>
        <p className="muted small">Client ID</p>
        <p className="mono">{clientId}</p>
        <p className="muted small">Callback URL</p>
        <CopyField value={redirectUri()} />
        <button type="button" className="secondary" onClick={onChangeApp}>
          Use a different Yoto app
        </button>
      </div>

      <p className="muted small">Your sign-in is stored only on this phone, in its secure keystore.</p>
    </div>
  );
}

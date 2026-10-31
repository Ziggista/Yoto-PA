import { useState } from "react";
import type { YotoPlaylist } from "../yoto/api";
import { cardLinkUrl } from "../yoto/cardLink";
import { NfcCancelledError, readTagOnce, sameUri, writeUriToTag } from "../lib/nfc";
import { nfcBehaviour } from "../lib/platform";
import { Cover, formatDuration } from "./Library";

type Phase =
  | { kind: "idle" }
  | { kind: "writing" }
  | { kind: "written" }
  | { kind: "verifying" }
  | { kind: "verified" }
  | { kind: "mismatch"; observed: string | null }
  | { kind: "error"; message: string };

interface LinkCardProps {
  playlist: YotoPlaylist;
  nfcAvailable: boolean;
  onBack: () => void;
}

export function LinkCard({ playlist, nfcAvailable, onBack }: LinkCardProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const link = cardLinkUrl(playlist);
  const busy = phase.kind === "writing" || phase.kind === "verifying";
  const nfc = nfcBehaviour();
  const waitingLabel = nfc.systemSheet ? "Scanning…" : `${nfc.holdHint}…`;

  async function write() {
    setPhase({ kind: "writing" });
    try {
      await writeUriToTag(link);
      setPhase({ kind: "written" });
    } catch (writeError) {
      if (writeError instanceof NfcCancelledError) {
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "error", message: writeError instanceof Error ? writeError.message : "The NFC write failed." });
    }
  }

  async function verify() {
    setPhase({ kind: "verifying" });
    try {
      const result = await readTagOnce();
      setPhase(sameUri(result.uri, link) ? { kind: "verified" } : { kind: "mismatch", observed: result.uri });
    } catch (readError) {
      if (readError instanceof NfcCancelledError) {
        setPhase({ kind: "idle" });
        return;
      }
      setPhase({ kind: "error", message: readError instanceof Error ? readError.message : "The NFC read failed." });
    }
  }

  return (
    <div className="screen">
      <button type="button" className="link-button" onClick={onBack}>
        ‹ Back
      </button>

      <div className="card playlist-hero">
        <Cover url={playlist.coverUrl} title={playlist.title} large />
        <div>
          <h1>{playlist.title}</h1>
          <p className="muted small">
            {[playlist.author, formatDuration(playlist.durationSeconds)].filter(Boolean).join(" · ")}
          </p>
          <p className="mono small">{link}</p>
        </div>
      </div>

      {playlist.source === "library" ? (
        <p className="notice">
          Linking DIY cards to family library cards hasn't been tested yet. Make Your Own playlists are the verified
          path.
        </p>
      ) : null}

      {!nfcAvailable ? (
        <p className="notice">
          NFC isn't available here. Card writing works in the phone app, with NFC switched on.
        </p>
      ) : null}

      {nfcAvailable && !nfc.formatsBlankCards ? (
        <p className="notice">
          On iPhone the card must already be NFC formatted. A card written once from Android or NFC Tools works;
          formatting brand-new blank cards from iPhone is coming later.
        </p>
      ) : null}

      <ol className="steps">
        <li className="card">
          <h2>Write the card</h2>
          <p>Tap Write, then {nfc.holdHint.charAt(0).toLowerCase() + nfc.holdHint.slice(1)} until it confirms.</p>
          <button type="button" className="primary" disabled={!nfcAvailable || busy} onClick={() => void write()}>
            {phase.kind === "writing" ? waitingLabel : "Write card"}
          </button>
        </li>
        <li className="card">
          <h2>Check it</h2>
          <p>Tap Check and hold the card to the phone again to confirm it carries this playlist.</p>
          <button type="button" className="secondary" disabled={!nfcAvailable || busy} onClick={() => void verify()}>
            {phase.kind === "verifying" ? waitingLabel : "Check card"}
          </button>
        </li>
      </ol>

      <Status phase={phase} expected={link} />
    </div>
  );
}

function Status({ phase, expected }: { phase: Phase; expected: string }) {
  switch (phase.kind) {
    case "written":
      return <p className="success">Card written. Check it to be sure, then pop it in your Yoto player.</p>;
    case "verified":
      return <p className="success">This card is linked to the playlist and ready to play.</p>;
    case "mismatch":
      return (
        <p className="error">
          The card says {phase.observed ? <span className="mono">{phase.observed}</span> : "nothing readable"}, not{" "}
          <span className="mono">{expected}</span>. Write it again.
        </p>
      );
    case "error":
      return <p className="error">{phase.message}</p>;
    default:
      return null;
  }
}

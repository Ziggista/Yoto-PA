import { useState } from "react";
import type { YotoPlaylist } from "../yoto/api";
import { cardLinkUrl } from "../yoto/cardLink";
import { readTagOnce, sameUri, type TagReadResult } from "../lib/nfc";
import { Cover } from "./Library";

interface ScanCardProps {
  playlists: YotoPlaylist[];
  nfcAvailable: boolean;
  onOpen: (playlist: YotoPlaylist) => void;
}

export function ScanCard({ playlists, nfcAvailable, onOpen }: ScanCardProps) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<TagReadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const match = result ? playlists.find((playlist) => sameUri(cardLinkUrl(playlist), result.uri)) ?? null : null;

  async function scan() {
    setScanning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await readTagOnce());
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "The NFC read failed.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>What's on this card?</h1>
        <p className="muted">Scan any DIY card to see which of your playlists it plays.</p>
      </header>

      {!nfcAvailable ? <p className="notice">NFC isn't available here.</p> : null}

      <button type="button" className="primary" disabled={!nfcAvailable || scanning} onClick={() => void scan()}>
        {scanning ? "Hold the card to the phone…" : "Scan a card"}
      </button>

      {error ? <p className="error">{error}</p> : null}

      {result ? (
        <div className="card">
          {match ? (
            <button type="button" className="playlist-row" onClick={() => onOpen(match)}>
              <Cover url={match.coverUrl} title={match.title} />
              <span className="playlist-text">
                <span className="playlist-title">{match.title}</span>
                <span className="muted small">Linked to this playlist</span>
              </span>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </button>
          ) : (
            <p>
              {result.uri ? (
                <>
                  This card carries <span className="mono">{result.uri}</span>, which doesn't match any loaded
                  playlist.
                </>
              ) : (
                "This card has no link on it yet, so it's ready to write."
              )}
            </p>
          )}
          {result.uid ? <p className="muted small mono">Chip ID {result.uid}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

import { useMemo, useState } from "react";
import type { PlaylistSource, YotoPlaylist } from "../yoto/api";

export interface LibraryState {
  items: YotoPlaylist[] | null;
  loading: boolean;
  error: string | null;
}

interface LibraryProps {
  myo: LibraryState;
  family: LibraryState;
  onRefresh: (source: PlaylistSource) => void;
  onSelect: (playlist: YotoPlaylist) => void;
}

export function Library({ myo, family, onRefresh, onSelect }: LibraryProps) {
  const [source, setSource] = useState<PlaylistSource>("myo");
  const [query, setQuery] = useState("");
  const current = source === "myo" ? myo : family;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const items = current.items ?? [];
    if (!needle) {
      return items;
    }
    return items.filter(
      (item) => item.title.toLowerCase().includes(needle) || (item.author ?? "").toLowerCase().includes(needle),
    );
  }, [current.items, query]);

  return (
    <div className="screen">
      <div className="segmented" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={source === "myo"}
          className={source === "myo" ? "active" : ""}
          onClick={() => setSource("myo")}
        >
          My playlists
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === "library"}
          className={source === "library" ? "active" : ""}
          onClick={() => setSource("library")}
        >
          Family library
        </button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search playlists"
        />
        <button type="button" className="secondary" disabled={current.loading} onClick={() => onRefresh(source)}>
          {current.loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {current.error ? <p className="error">{current.error}</p> : null}

      {current.items && filtered.length === 0 && !current.loading ? (
        <p className="muted empty">
          {query
            ? "Nothing matches that search."
            : source === "myo"
              ? "No Make Your Own playlists yet. Create one in the Yoto app and refresh."
              : "Your family library is empty."}
        </p>
      ) : null}

      <ul className="playlist-list">
        {filtered.map((item) => (
          <li key={`${item.source}-${item.cardId}`}>
            <button type="button" className="playlist-row" onClick={() => onSelect(item)}>
              <Cover url={item.coverUrl} title={item.title} />
              <span className="playlist-text">
                <span className="playlist-title">{item.title}</span>
                <span className="muted small">
                  {[item.author, formatDuration(item.durationSeconds)].filter(Boolean).join(" · ") || item.cardId}
                </span>
              </span>
              <span className="chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Cover({ url, title, large = false }: { url: string | null; title: string; large?: boolean }) {
  const className = large ? "cover cover-large" : "cover";
  if (!url) {
    return (
      <span className={`${className} cover-placeholder`} aria-hidden="true">
        {title.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <img className={className} src={url} alt="" loading="lazy" />;
}

export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) {
    return null;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

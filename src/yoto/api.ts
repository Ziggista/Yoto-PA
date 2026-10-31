import { getValidAccessToken } from "./auth";
import { YOTO_API_BASE_URL } from "./config";

export type PlaylistSource = "myo" | "library";

export interface YotoPlaylist {
  cardId: string;
  title: string;
  author: string | null;
  description: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  updatedAt: string | null;
  shareLinkUrl: string | null;
  source: PlaylistSource;
}

export class YotoApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

async function yotoGet(path: string): Promise<unknown> {
  const url = `${YOTO_API_BASE_URL}${path}`;
  let token = await getValidAccessToken();
  let response = await send(url, token);
  if (response.status === 401) {
    token = await getValidAccessToken({ forceRefresh: true });
    response = await send(url, token);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new YotoApiError(`Yoto returned HTTP ${response.status} for ${path}: ${text.slice(0, 200)}`, response.status);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new YotoApiError(`Yoto returned a response for ${path} that was not JSON.`, response.status);
  }
}

async function send(url: string, token: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (networkError) {
    throw new YotoApiError(
      `Could not reach Yoto (${networkError instanceof Error ? networkError.message : "network error"}).`,
      null,
    );
  }
}

/** The signed-in user's Make Your Own playlists. */
export async function listMyPlaylists(): Promise<YotoPlaylist[]> {
  const payload = await yotoGet("/content/mine?showdeleted=false");
  const cards = record(payload)?.cards;
  return sortByUpdated(
    asArray(cards)
      .map((raw) => parseCard(raw, "myo"))
      .filter((card): card is YotoPlaylist => card !== null),
  );
}

/** Cards in the family library (purchased cards plus MYO cards linked to the account). */
export async function listFamilyLibrary(): Promise<YotoPlaylist[]> {
  const payload = await yotoGet("/card/family/library");
  const cards = record(payload)?.cards;
  return asArray(cards)
    .map((raw) => {
      // Library entries usually wrap the card: { cardId, card: { title, metadata, ... } }.
      const entry = record(raw);
      const inner = record(entry?.card);
      return parseCard(inner ? { ...inner, cardId: inner.cardId ?? entry?.cardId } : raw, "library");
    })
    .filter((card): card is YotoPlaylist => card !== null)
    .sort((a, b) => a.title.localeCompare(b.title));
}

function parseCard(raw: unknown, source: PlaylistSource): YotoPlaylist | null {
  const card = record(raw);
  const cardId = str(card?.cardId);
  if (!card || !cardId) {
    return null;
  }
  if (card.deleted === true) {
    return null;
  }
  const metadata = record(card.metadata) ?? {};
  const content = record(card.content) ?? {};
  const cover = record(metadata.cover) ?? {};
  const media = record(metadata.media) ?? {};
  const sharing = record(card.sharing) ?? {};
  return {
    cardId,
    title: str(card.title) || str(metadata.title) || str(content.title) || `Yoto card ${cardId}`,
    author: str(metadata.author),
    description: str(metadata.description),
    coverUrl: str(cover.imageL) || str(cover.imageM) || str(cover.imageS),
    durationSeconds: num(media.duration),
    updatedAt: str(card.updatedAt) || str(card.createdAt),
    shareLinkUrl: str(sharing.linkUrl) || str(card.shareLinkUrl),
    source,
  };
}

function sortByUpdated(cards: YotoPlaylist[]): YotoPlaylist[] {
  return cards.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

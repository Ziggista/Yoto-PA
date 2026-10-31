import type { YotoPlaylist } from "./api";

/**
 * The URL a DIY card carries so a Yoto player plays this playlist. Prefers the share link Yoto
 * returns, otherwise the short yoto.io/<cardId> form that YotoWebMgr verified on real cards.
 */
export function cardLinkUrl(playlist: Pick<YotoPlaylist, "cardId" | "shareLinkUrl">): string {
  return playlist.shareLinkUrl?.trim() || `https://yoto.io/${playlist.cardId}`;
}

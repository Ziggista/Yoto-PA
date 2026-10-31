import { Capacitor } from "@capacitor/core";

/**
 * Platform differences in one place, so screens never branch on platform names directly.
 *
 * Grep for "IOS-LATER" to find iOS work that is deliberately deferred. docs/ios.md lists it.
 */

export type AppPlatform = "android" | "ios" | "web";

export function appPlatform(): AppPlatform {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : "web";
}

export interface NfcBehaviour {
  /** Where to hold the card, shown in instructions. */
  holdHint: string;
  /** iOS shows its own system sheet for every NFC session, so the app shows less of its own UI. */
  systemSheet: boolean;
  /**
   * Whether the app can format a completely blank (non-NDEF) card. Android uses the patched plugin in
   * android-plugins/. IOS-LATER: port the Type 2 format fallback to Swift (NFCMiFareTag
   * sendMiFareCommand) in the iOS plugin, then flip this to true.
   */
  formatsBlankCards: boolean;
  /**
   * How long the app waits for a tag. iOS ends its own session after 60 seconds and reports that as
   * an error, so the app timer only acts as a backstop there.
   */
  timeoutMs: number;
}

export function nfcBehaviour(platform: AppPlatform = appPlatform()): NfcBehaviour {
  if (platform === "ios") {
    return {
      holdHint: "Hold the card near the top of your iPhone",
      systemSheet: true,
      formatsBlankCards: false,
      timeoutMs: 65_000,
    };
  }
  return {
    holdHint: "Hold the card flat against the back of the phone",
    systemSheet: false,
    formatsBlankCards: platform === "android",
    timeoutMs: 20_000,
  };
}

/** True when an NFC error just means the user closed the iOS scan sheet. */
export function isUserCancelledNfc(message: string): boolean {
  return /cancel|invalidated by user|user canceled/i.test(message);
}

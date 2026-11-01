import { Capacitor } from "@capacitor/core";
import { NFC, type NDEFMessagesTransformable } from "@exxili/capacitor-nfc";
import { isUserCancelledNfc, nfcBehaviour } from "./platform";

/**
 * Platform-neutral NFC helpers. Every call here must start from a user tap: iOS only allows
 * Core NFC sessions from a user action and shows its own system sheet while one is open.
 */

/** Raised when the user closes the iOS scan sheet, so screens can reset quietly. */
export class NfcCancelledError extends Error {}

function nfcError(message: string): Error {
  return isUserCancelledNfc(message) ? new NfcCancelledError(message) : new Error(message);
}

export interface TagReadResult {
  uri: string | null;
  uid: string | null;
}

const URI_PREFIXES: Array<{ prefix: string; code: number }> = [
  { prefix: "http://www.", code: 0x01 },
  { prefix: "https://www.", code: 0x02 },
  { prefix: "http://", code: 0x03 },
  { prefix: "https://", code: 0x04 },
];

const isAndroid = () => Capacitor.getPlatform() === "android";

export async function isNfcAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }
  try {
    const { supported } = await NFC.isSupported();
    return supported;
  } catch {
    return false;
  }
}

/**
 * Encodes an NDEF Well Known URI record payload using the shortest standard prefix code, which
 * keeps the record small enough for 48-byte MIFARE Ultralight EV1 cards.
 */
export function encodeUriRecordPayload(uri: string): Uint8Array {
  const encoder = new TextEncoder();
  for (const { prefix, code } of URI_PREFIXES) {
    if (uri.startsWith(prefix)) {
      const rest = encoder.encode(uri.slice(prefix.length));
      const bytes = new Uint8Array(rest.length + 1);
      bytes[0] = code;
      bytes.set(rest, 1);
      return bytes;
    }
  }
  const rest = encoder.encode(uri);
  const bytes = new Uint8Array(rest.length + 1);
  bytes.set(rest, 1);
  return bytes;
}

/** Writes a single URI record to the next tag presented. Resolves once the plugin confirms. */
export function writeUriToTag(uri: string, timeoutMs = nfcBehaviour().timeoutMs): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      removeWrite();
      removeError();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const removeWrite = NFC.onWrite(() => finish());
    const removeError = NFC.onError((error) => finish(nfcError(error.error || "The NFC write failed.")));
    const timer = window.setTimeout(() => {
      if (isAndroid()) {
        void NFC.cancelWriteAndroid().catch(() => undefined);
      } else {
        void NFC.cancelScan().catch(() => undefined);
      }
      finish(new Error(`No card was detected in time. Try again. ${nfcBehaviour().holdHint}.`));
    }, timeoutMs);

    NFC.writeNDEF({ records: [{ type: "U", payload: encodeUriRecordPayload(uri) }] }).catch((startError: unknown) =>
      finish(startError instanceof Error ? startError : new Error("Could not start the NFC write.")),
    );
  });
}

/** Reads the next tag presented and returns the first URI record, if any. */
export function readTagOnce(timeoutMs = nfcBehaviour().timeoutMs): Promise<TagReadResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (result: TagReadResult | null, error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      removeRead();
      removeError();
      if (error || !result) {
        reject(error ?? new Error("No card was read."));
      } else {
        resolve(result);
      }
    };
    const removeRead = NFC.onRead((data: NDEFMessagesTransformable) => {
      const decoded = data.string();
      const records = decoded.messages.flatMap((message) => message.records);
      const uriRecord = records.find((record) => record.type === "U") ?? records[0];
      const uri = typeof uriRecord?.payload === "string" ? uriRecord.payload.trim() || null : null;
      finish({ uri, uid: decoded.tagInfo?.uid ?? null });
    });
    const removeError = NFC.onError((error) => finish(null, nfcError(error.error || "The NFC read failed.")));
    const timer = window.setTimeout(() => {
      if (!isAndroid()) {
        void NFC.cancelScan().catch(() => undefined);
      }
      finish(null, new Error("No card was detected in time."));
    }, timeoutMs);

    // Android delivers tags to the listener while the app is in the foreground and rejects
    // startScan, so only iOS opens a scan session.
    if (!isAndroid()) {
      NFC.startScan().catch((startError: unknown) =>
        finish(null, startError instanceof Error ? startError : new Error("Could not start NFC scanning.")),
      );
    }
  });
}

/** Compares URIs ignoring scheme/host case and a trailing slash. */
export function sameUri(a: string | null, b: string | null): boolean {
  const normalise = (value: string | null) => {
    if (!value) {
      return "";
    }
    try {
      const url = new URL(value.trim());
      // Card IDs in the path are case sensitive, so only the scheme and host are lower-cased.
      return `${url.protocol}//${url.host}`.toLowerCase() + `${url.pathname.replace(/\/$/, "")}${url.search}`;
    } catch {
      return value.trim().replace(/\/$/, "");
    }
  };
  return normalise(a) !== "" && normalise(a) === normalise(b);
}

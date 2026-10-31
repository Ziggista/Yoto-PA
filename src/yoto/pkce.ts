// PKCE helpers ported from YotoWebMgr. The SHA-256 fallback covers runtimes without SubtleCrypto.

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256Fallback(bytes: Uint8Array): Uint8Array {
  const words: number[] = [];
  const bitLength = bytes.length * 8;
  for (let index = 0; index < bytes.length; index += 1) {
    words[index >> 2] = (words[index >> 2] || 0) | (bytes[index] << (24 - (index % 4) * 8));
  }
  words[bitLength >> 5] = (words[bitLength >> 5] || 0) | (0x80 << (24 - (bitLength % 32)));
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength;

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const schedule = new Array<number>(64);

  for (let blockStart = 0; blockStart < words.length; blockStart += 16) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = words[blockStart + index] || 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0Word = schedule[index - 15];
      const s1Word = schedule[index - 2];
      const s0 =
        ((s0Word >>> 7) | (s0Word << 25)) ^
        ((s0Word >>> 18) | (s0Word << 14)) ^
        (s0Word >>> 3);
      const s1 =
        ((s1Word >>> 17) | (s1Word << 15)) ^
        ((s1Word >>> 19) | (s1Word << 13)) ^
        (s1Word >>> 10);
      schedule[index] = (schedule[index - 16] + s0 + schedule[index - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + k[index] + schedule[index]) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  const digest = new Uint8Array(32);
  hash.forEach((value, index) => {
    digest[index * 4] = (value >>> 24) & 0xff;
    digest[index * 4 + 1] = (value >>> 16) & 0xff;
    digest[index * 4 + 2] = (value >>> 8) & 0xff;
    digest[index * 4 + 3] = value & 0xff;
  });
  return digest;
}

async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.subtle) {
    const digestInput = new Uint8Array(bytes.byteLength);
    digestInput.set(bytes);
    const digest = await webCrypto.subtle.digest("SHA-256", digestInput);
    return new Uint8Array(digest);
  }
  return sha256Fallback(bytes);
}

export function randomUrlSafeString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("This runtime does not provide secure random numbers for PKCE.");
  }
  const verifier = randomUrlSafeString(64);
  const digest = await sha256Bytes(new TextEncoder().encode(verifier));
  return { verifier, challenge: base64UrlEncode(digest) };
}

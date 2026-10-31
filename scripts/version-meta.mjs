// Single source of truth for Yoto-PA version numbers.
//
// package.json "version" is the release version: MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-beta.N.
// Android versionCode is derived so every later build installs over an earlier one:
//   versionCode = MAJOR * 1_000_000 + MINOR * 10_000 + PATCH * 100 + (beta ? N : 99)
// e.g. 0.1.0-beta.1 -> 10001, 0.1.0-beta.2 -> 10002, 0.1.0 -> 10099, 0.1.1-beta.1 -> 10101.
//
// Builds that are not exactly at the matching git tag get "+<sha>" on the version name so a
// development APK is never mistaken for a published release.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

export function parseVersion(version) {
  const match = VERSION_PATTERN.exec(String(version).trim());
  if (!match) {
    throw new Error(`"${version}" is not a Yoto-PA version. Use MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-beta.N.`);
  }
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const beta = match[4] === undefined ? null : Number(match[4]);
  if (minor > 99 || patch > 99) {
    throw new Error("MINOR and PATCH must be 0-99 so the Android versionCode stays ordered.");
  }
  if (beta !== null && (beta < 1 || beta > 98)) {
    throw new Error("Beta numbers must be 1-98.");
  }
  return { major, minor, patch, beta, prerelease: beta !== null };
}

export function versionCodeFor(version) {
  const { major, minor, patch, beta } = parseVersion(version);
  return major * 1_000_000 + minor * 10_000 + patch * 100 + (beta ?? 99);
}

function git(args, fallback) {
  try {
    return execFileSync("git", ["-C", appDir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fallback;
  }
}

export function loadVersionMeta() {
  const version = String(JSON.parse(readFileSync(resolve(appDir, "package.json"), "utf8")).version);
  const parsed = parseVersion(version);
  const buildSha = (process.env.APP_BUILD_SHA ?? git(["rev-parse", "--short", "HEAD"], "dev")).trim();
  const tag = `v${version}`;
  const tagCommit = git(["rev-list", "-n", "1", tag], "");
  const headCommit = git(["rev-parse", "HEAD"], "");
  const dirty = git(["status", "--porcelain", "--untracked-files=no"], "") !== "";
  const isRelease = process.env.YOTOPA_RELEASE === "1" || (tagCommit !== "" && tagCommit === headCommit && !dirty);
  return {
    version,
    tag,
    prerelease: parsed.prerelease,
    versionCode: versionCodeFor(version),
    versionName: isRelease ? version : `${version}+${buildSha}`,
    buildSha,
    isRelease,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const meta = loadVersionMeta();
  const args = process.argv.slice(2);
  if (args[0] === "--field" && args[1]) {
    const value = meta[args[1]];
    if (value === undefined) {
      process.exitCode = 1;
    } else {
      process.stdout.write(`${String(value)}\n`);
    }
  } else {
    process.stdout.write(`${JSON.stringify(meta, null, 2)}\n`);
  }
}

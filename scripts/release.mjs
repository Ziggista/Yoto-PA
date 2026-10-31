#!/usr/bin/env node
// Local release for Yoto-PA. Runs entirely on this PC: no GitHub Actions.
//
//   npm run release -- 0.1.0-beta.1            build, tag, push, publish a GitHub pre-release
//   npm run release -- 0.1.0                   same, as a full release
//   npm run release -- 0.1.0-beta.1 --dry-run  build the signed APK only; no commit, tag or upload
//
// Needs: a clean tree on main in sync with origin, android/keystore.properties, and an
// authenticated GitHub CLI (`gh auth status`).

import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseVersion, versionCodeFor } from "./version-meta.mjs";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const repo = "Ziggista/Yoto-PA";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const version = args.find((arg) => !arg.startsWith("--"));

function fail(message) {
  console.error(`\nRelease stopped: ${message}`);
  process.exit(1);
}

// npm and npx are .cmd shims on Windows and need a shell; git, gh and powershell must not use one,
// so multi-line arguments such as release notes are passed through untouched.
const needsShell = (command) => isWindows && (command === "npm" || command === "npx");

function run(command, commandArgs, options = {}) {
  console.log(`> ${command} ${commandArgs.join(" ")}`);
  const result = spawnSync(command, commandArgs, { cwd: appDir, stdio: "inherit", shell: needsShell(command), ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(" ")} exited with ${result.status}`);
  }
}

function output(command, commandArgs) {
  return execFileSync(command, commandArgs, {
    cwd: appDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: needsShell(command),
  }).trim();
}

function sha256(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolvePromise(hash.digest("hex")))
      .on("error", reject);
  });
}

if (!version) {
  fail("give a version, e.g. `npm run release -- 0.1.0-beta.1`.");
}
let parsed;
try {
  parsed = parseVersion(version);
} catch (error) {
  fail(error.message);
}
const tag = `v${version}`;
const versionCode = versionCodeFor(version);

// --- Preflight -------------------------------------------------------------------------------
if (output("git", ["status", "--porcelain"]) !== "") {
  fail("the working tree has uncommitted changes. Commit or stash them first.");
}
const branch = output("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (!dryRun && branch !== "main") {
  fail(`releases are cut from main, but you are on ${branch}.`);
}
if (!dryRun) {
  run("git", ["fetch", "origin", "main", "--tags"]);
  if (output("git", ["rev-parse", "HEAD"]) !== output("git", ["rev-parse", "origin/main"])) {
    fail("main is not in sync with origin/main. Pull or push first.");
  }
  if (output("git", ["tag", "--list", tag]) !== "") {
    fail(`tag ${tag} already exists.`);
  }
  try {
    output("gh", ["auth", "status"]);
  } catch {
    fail("the GitHub CLI is not signed in. Run `gh auth login`.");
  }
}
if (!existsSync(resolve(appDir, "android", "keystore.properties"))) {
  fail("android/keystore.properties is missing, so the APK cannot be signed. See docs/releasing.md.");
}

const previousCode = (() => {
  const latest = output("git", ["tag", "--list", "v*", "--sort=-v:refname"]).split("\n").filter(Boolean)[0];
  if (!latest) return 0;
  try {
    return versionCodeFor(latest.slice(1));
  } catch {
    return 0;
  }
})();
if (versionCode <= previousCode) {
  fail(`${version} (versionCode ${versionCode}) is not newer than the latest tag (versionCode ${previousCode}).`);
}

console.log(`\nReleasing Yoto-PA ${version} (versionCode ${versionCode}${parsed.prerelease ? ", pre-release" : ""})${dryRun ? " [dry run]" : ""}\n`);

// --- Bump and build --------------------------------------------------------------------------
const restoreVersionFiles = () => {
  try {
    run("git", ["checkout", "--", "package.json", "package-lock.json"]);
  } catch {
    // Best effort.
  }
};

let apkOut;
try {
  run("npm", ["version", version, "--no-git-tag-version", "--allow-same-version"]);
  const env = { ...process.env, YOTOPA_RELEASE: "1" };
  run("npm", ["run", "build"], { env });
  run("npx", ["cap", "sync", "android"], { env });
  run("npm", ["run", "android:override-settings"], { env });
  if (isWindows) {
    run("powershell", ["-ExecutionPolicy", "Bypass", "-File", "scripts/build-android-apk.ps1", "-Release"], { env });
  } else {
    run("./gradlew", ["assembleRelease"], { env, cwd: resolve(appDir, "android"), shell: false });
  }

  const apkDir = resolve(appDir, "android", "app", "build", "outputs", "apk", "release");
  const signedApk = resolve(apkDir, "app-release.apk");
  if (!existsSync(signedApk)) {
    throw new Error(
      existsSync(resolve(apkDir, "app-release-unsigned.apk"))
        ? "Gradle produced an unsigned APK. Check android/keystore.properties."
        : `No release APK found in ${apkDir}.`,
    );
  }
  mkdirSync(resolve(appDir, "release"), { recursive: true });
  apkOut = resolve(appDir, "release", `Yoto-PA-${version}.apk`);
  copyFileSync(signedApk, apkOut);
} catch (error) {
  restoreVersionFiles();
  fail(error.message);
}

const apkHash = await sha256(apkOut);
const apkMb = (statSync(apkOut).size / 1024 / 1024).toFixed(1);
console.log(`\nSigned APK: ${apkOut} (${apkMb} MB)\nSHA-256: ${apkHash}`);

if (dryRun) {
  restoreVersionFiles();
  console.log("\nDry run finished. Nothing was committed, tagged or uploaded.");
  process.exit(0);
}

// --- Commit, tag, push, publish ---------------------------------------------------------------
try {
  run("git", ["add", "package.json", "package-lock.json"]);
  run("git", ["commit", "-m", `Release ${tag}`]);
  run("git", ["tag", "-a", tag, "-m", `Yoto-PA ${version}`]);
  run("git", ["push", "origin", "main", tag]);
  const notes = [
    `Android APK for Yoto-PA ${version} (versionCode ${versionCode}).`,
    "",
    `SHA-256 \`${apkHash}\``,
    "",
    "Install: download the APK on your phone and open it, or `adb install -r <apk>`.",
  ].join("\n");
  run("gh", [
    "release",
    "create",
    tag,
    apkOut,
    "--repo",
    repo,
    "--title",
    `Yoto-PA ${version}`,
    "--notes",
    notes,
    "--generate-notes",
    "--verify-tag",
    ...(parsed.prerelease ? ["--prerelease"] : ["--latest"]),
  ]);
} catch (error) {
  fail(`${error.message}\nThe build succeeded; finish the remaining steps by hand (see docs/releasing.md).`);
}

console.log(`\nPublished https://github.com/${repo}/releases/tag/${tag}`);

// Runs automatically after `npx cap sync` / `npx cap update` (package.json "capacitor:sync:after"
// and "capacitor:update:after" hooks). For iOS it points the generated CapApp-SPM package at
// ios-plugins/exxili-capacitor-nfc instead of node_modules, the same way
// override-capacitor-settings.mjs does for Android.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const platform = process.env.CAPACITOR_PLATFORM_NAME;
if (platform && platform !== "ios") {
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(root, "ios", "App", "CapApp-SPM", "Package.swift");
if (!existsSync(packagePath)) {
  console.log("No iOS project yet; skipping the iOS NFC plugin override.");
  process.exit(0);
}

const original = readFileSync(packagePath, "utf8");
const expected = 'path: "../../../node_modules/@exxili/capacitor-nfc"';
const replacement = 'path: "../../../ios-plugins/exxili-capacitor-nfc"';

if (original.includes(replacement)) {
  console.log("CapApp-SPM already points at the local iOS NFC plugin.");
  process.exit(0);
}
if (!original.includes(expected)) {
  throw new Error(`Could not find the generated Exxili NFC plugin path in ${packagePath}`);
}

writeFileSync(packagePath, original.replace(expected, replacement), "utf8");
console.log("Rewired CapApp-SPM to the local iOS NFC plugin (ios-plugins/exxili-capacitor-nfc).");

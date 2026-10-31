# Releasing Yoto-PA

Releases are built and published from Ziggi-PC. There is no GitHub Actions or other cloud CI.

## Version numbers

`package.json` `version` is the single source of truth (`scripts/version-meta.mjs`).

| Version | Git tag | GitHub release | Android versionCode |
| --- | --- | --- | --- |
| `0.1.0-beta.1` | `v0.1.0-beta.1` | pre-release | 10001 |
| `0.1.0-beta.2` | `v0.1.0-beta.2` | pre-release | 10002 |
| `0.1.0` | `v0.1.0` | latest release | 10099 |
| `0.1.1-beta.1` | `v0.1.1-beta.1` | pre-release | 10101 |

`versionCode = MAJOR * 1,000,000 + MINOR * 10,000 + PATCH * 100 + (beta number, or 99 for a final release)`,
so every later version installs over an earlier one. MINOR and PATCH go up to 99, betas to 98.

- **PATCH**: fixes. **MINOR**: new features (for example upload). **MAJOR**: 1.0 when it's ready for others.
- Development builds that are not at a release tag show the version with `+<commit>`, for example
  `0.1.0+28a5720`, in Android's app info and on the Account screen.

## One-time setup

1. **Create the release keystore** (keep it outside the repo and back it up together with the passwords;
   if it is lost, phones can't upgrade, only uninstall and reinstall):

   ```powershell
   mkdir C:\Users\Ziggi\keys
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v `
     -keystore C:\Users\Ziggi\keys\yoto-pa-release.jks -alias yoto-pa `
     -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Copy `android/keystore.properties.example` to `android/keystore.properties` (gitignored) and fill in
   the path and passwords.
3. Sign in the GitHub CLI once: `gh auth login`.

## Cutting a release

On `main`, with a clean tree that matches `origin/main`:

```powershell
npm run release -- 0.1.0-beta.1             # pre-release
npm run release -- 0.1.0                    # full release
npm run release -- 0.1.0-beta.1 --dry-run   # build the signed APK only, publish nothing
```

The script:

1. Checks the version format, that the tag is new and newer than the last one, the keystore, and `gh`.
2. Sets the version in `package.json`, builds the web app, syncs Capacitor and runs `assembleRelease`.
3. Copies the signed APK to `release/Yoto-PA-<version>.apk` (gitignored) and prints its SHA-256.
4. Commits `Release v<version>`, creates an annotated tag, pushes `main` and the tag.
5. Creates the GitHub release with the APK attached, the SHA-256 and generated notes. Betas are marked
   as pre-releases.

If a build step fails, the version change is reverted and nothing is pushed. If a step after the build
fails (for example the upload), the script says so; finish by hand with
`gh release create v<version> release/Yoto-PA-<version>.apk --verify-tag`.

## iOS

iOS builds need a Mac. When one is available, iOS uses the same version: `CFBundleShortVersionString`
is MAJOR.MINOR.PATCH and `CFBundleVersion` is the Android versionCode.

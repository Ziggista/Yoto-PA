param(
  # Build a signed release APK (assembleRelease) instead of a debug APK.
  [switch]$Release
)

$ErrorActionPreference = "Stop"

$androidProjectDir = Join-Path $PSScriptRoot "..\android"
$sdkRoot = $env:ANDROID_SDK_ROOT
$javaHome = $env:JAVA_HOME
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"

if (-not $sdkRoot) {
  $defaultSdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"

  if (Test-Path $defaultSdkRoot) {
    $sdkRoot = $defaultSdkRoot
  }
}

if (-not $sdkRoot) {
  throw "ANDROID_SDK_ROOT is not set and no SDK was found under $env:LOCALAPPDATA\Android\Sdk"
}

$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot

function Get-JavaMajorVersion([string]$jdkHome) {
  $javaExe = Join-Path $jdkHome "bin\java.exe"
  if (-not (Test-Path $javaExe)) { return 0 }
  # java -version prints to stderr; keep that from tripping $ErrorActionPreference = "Stop".
  $ErrorActionPreference = "Continue"
  $versionLine = (& $javaExe -version 2>&1 | Select-Object -First 1).ToString()
  if ($versionLine -match '"1\.(\d+)') { return [int]$Matches[1] }
  if ($versionLine -match '"(\d+)') { return [int]$Matches[1] }
  return 0
}

# The Android Gradle plugin needs JDK 17+. Fall back to Android Studio's bundled JDK when
# JAVA_HOME is unset or points at an older Java (for example a system-wide Java 8).
if ($javaHome -and (Get-JavaMajorVersion $javaHome) -lt 17) {
  Write-Host "JAVA_HOME ($javaHome) is older than Java 17; trying Android Studio's JDK instead."
  $javaHome = $null
}

if (-not $javaHome -and (Test-Path (Join-Path $studioJbr "bin\java.exe"))) {
  $javaHome = $studioJbr
}

if (-not $javaHome) {
  throw "JAVA_HOME is not set and Android Studio JBR was not found."
}

$env:JAVA_HOME = $javaHome

$gradleWrapper = Join-Path $androidProjectDir "gradlew.bat"

if (-not (Test-Path $gradleWrapper)) {
  throw "Could not find Android Gradle wrapper at $gradleWrapper. Run 'npm run android:sync' first."
}

Push-Location $androidProjectDir

try {
  $task = if ($Release) { "assembleRelease" } else { "assembleDebug" }
  & $gradleWrapper $task
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle $task failed with exit code $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}

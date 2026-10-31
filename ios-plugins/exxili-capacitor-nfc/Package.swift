// swift-tools-version: 5.9
import PackageDescription

// Local copy of @exxili/capacitor-nfc 0.0.13's iOS sources, used instead of node_modules
// (scripts/override-capacitor-ios.mjs rewires CapApp-SPM to this folder after `cap sync ios`).
//
// Why a copy:
// 1. Upstream depends on capacitor-swift-pm `branch: "main"`, which SwiftPM cannot resolve next to
//    the app's exact Capacitor 8 version pin.
// 2. iOS-specific NFC fixes (blank DIY card formatting) go here, mirroring android-plugins/.
let package = Package(
    name: "ExxiliCapacitorNfc",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ExxiliCapacitorNfc",
            targets: ["NFCPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "NFCPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/NFCPlugin")
    ]
)

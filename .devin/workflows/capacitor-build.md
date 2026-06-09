---
description: Build and deploy Capacitor apps for Android, iOS, and Clover marketplace
---

# Capacitor Build Workflow

This workflow sets up Capacitor for multi-platform deployment (Android, iOS, Clover).

## Prerequisites

- Node.js 18+ installed
- Android Studio (for Android builds)
- Xcode 15+ (for iOS builds, macOS only)
- CocoaPods (iOS dependencies)

## Phase 1: Install Capacitor Dependencies

```bash
cd apps/web

# Install Capacitor core and CLI
pnpm add @capacitor/core @capacitor/cli

# Install platform dependencies
pnpm add @capacitor/android @capacitor/ios

# Install essential plugins
pnpm add @capacitor/splash-screen @capacitor/status-bar @capacitor/keyboard @capacitor/push-notifications @capacitor/local-notifications @capacitor/browser @capacitor/share @capacitor/geolocation
```

## Phase 2: Initialize Capacitor

```bash
# Initialize Capacitor (already configured via capacitor.config.ts)
npx cap init VisibleShelf com.visibleshelf.app --web-dir out
```

## Phase 3: Configure Next.js for Static Export

Add to `next.config.ts`:

```typescript
// For Capacitor static export
output: 'export',
distDir: 'out',
images: {
  unoptimized: true, // Required for static export
},
```

**Note**: Static export disables server-side features. For dynamic content, use:
- ISR (Incremental Static Regeneration)
- Client-side data fetching
- API routes via separate backend

## Phase 4: Build and Sync

```bash
# Build Next.js static export
pnpm build

# Sync to native platforms
npx cap sync

# Or sync specific platform
npx cap sync android
npx cap sync ios
```

## Phase 5: Android Build

```bash
# Open in Android Studio
npx cap open android

# Or build from CLI
cd android
./gradlew assembleDebug
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Phase 6: iOS Build (macOS only)

```bash
# Open in Xcode
npx cap open ios

# Or build from CLI
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath ./build/App.xcarchive archive
```

## Platform-Specific Configurations

### Android (Google Play Store)

Package ID: `com.visibleshelf.app`

Signing: Use `android.keystore` (same as TWA)

### iOS (App Store)

Bundle ID: `com.visibleshelf.app`

Requirements:
- Apple Developer Account ($99/year)
- App Store Connect setup
- Push notification certificates (APNs)

### Clover Marketplace

Package ID: `com.visibleshelf.clover`

Additional requirements:
- Clover Developer Account ($99/year)
- Clover SDK integration
- Clover OAuth for merchant login
- Clover payment processing

## Clover-Specific Setup

### 1. Install Clover SDK

```bash
# In android/app/build.gradle
dependencies {
    implementation 'com.clover.sdk:clover-android-sdk:4.0.0'
    implementation 'com.clover:clover-connector:3.0.0'
}
```

### 2. Create Clover Build Variant

In `capacitor.config.ts`:

```typescript
android: {
  buildOptions: {
    // Clover-specific build
    keystorePath: 'clover.keystore',
    keystoreAlias: 'clover',
  },
},
```

### 3. Clover OAuth Integration

Replace Auth0 with Clover OAuth for Clover builds:

```typescript
// Conditional auth based on platform
const isClover = Capacitor.getPlatform() === 'android' && isCloverBuild();

if (isClover) {
  // Use Clover OAuth
  await CloverAuth.login();
} else {
  // Use Auth0
  await auth0.login();
}
```

### 4. Clover Payment Processing

```typescript
// Use Clover Connector for payments
import { CloverConnector } from 'com.clover.connector';

const connector = new CloverConnector({
  endpoint: 'wss://api.clover.com',
  merchantId: merchantId,
});

await connector.sale(amount, orderId);
```

## Build Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "cap:sync": "cap sync",
    "cap:open:android": "cap open android",
    "cap:open:ios": "cap open ios",
    "build:android": "pnpm build && cap sync android && cd android && ./gradlew assembleRelease",
    "build:ios": "pnpm build && cap sync ios",
    "build:clover": "pnpm build && cap sync android --variant clover"
  }
}
```

## Environment Variables

Create `.env.capacitor`:

```
# Android
ANDROID_KEYSTORE_PASSWORD=xxx
ANDROID_KEY_PASSWORD=xxx

# iOS
APPLE_ID=xxx
APPLE_TEAM_ID=xxx

# Clover (for Clover builds)
CLOVER_APP_ID=xxx
CLOVER_APP_SECRET=xxx
```

## Troubleshooting

### "WebDir not found"
Ensure Next.js is configured for static export and `out` directory exists.

### iOS build fails
```bash
cd ios/App
pod install
```

### Android build fails
Check Android SDK path:
```bash
export ANDROID_HOME=$HOME/Android/Sdk
```

## Files Created

- `capacitor.config.ts` - Capacitor configuration
- `android/` - Android native project (generated)
- `ios/` - iOS native project (generated)

## Next Steps

1. Test on Android device/emulator
2. Test on iOS device/simulator (macOS required)
3. Configure Clover SDK for Clover marketplace
4. Set up push notifications (FCM for Android, APNs for iOS)

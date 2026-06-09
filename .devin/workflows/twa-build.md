---
description: Build and deploy TWA (Trusted Web Activity) to Google Play Store
---

# TWA Build Workflow

This workflow packages the VisibleShelf PWA as an Android app for Google Play Store using Trusted Web Activity (TWA).

## Prerequisites

- Node.js 18+ installed
- Java JDK 17+ installed
- Android SDK installed (or Android Studio)
- Google Play Console account ($25 one-time fee)
- PWA deployed and accessible at `https://visibleshelf.store`

## Phase 1: Install Bubblewrap CLI

```bash
# Install bubblewrap globally
npm install -g @anthropic/bubblewrap

# Or use npx for one-time usage
npx @anthropic/bubblewrap --version
```

## Phase 2: Initialize TWA Project

```bash
# Navigate to web app directory
cd apps/web

# Initialize TWA project from manifest
npx @anthropic/bubblewrap init --manifest=twa-manifest.json
```

This will:
- Create `android-app/` directory with Android project
- Download and configure necessary dependencies
- Generate signing key (or use existing)

## Phase 3: Build Android App Bundle (AAB)

```bash
# Navigate to generated project
cd android-app

# Build release AAB for Play Store
npx @anthropic/bubblewrap build --release
```

Output: `android-app/app/build/outputs/bundle/release/app-release.aab`

## Phase 4: Generate Signing Key (if not created during init)

```bash
# Generate keystore
keytool -genkeypair -v \
  -keystore android.keystore \
  -alias visibleshelf \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass <password> \
  -keypass <password>
```

**IMPORTANT**: Backup the keystore file! You'll need it for all future updates.

## Phase 5: Submit to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app:
   - App name: `VisibleShelf`
   - Default language: `English (United States)`
   - Free or Paid: `Free`
   - Available on Android Auto: `No`

3. Complete store listing:
   - Short description: `Product visibility platform for retail`
   - Full description: `Browse products, manage inventory, and connect with local stores`
   - Screenshots: Upload from `public/screenshots/`
   - App icon: `public/icons/icon-512x512.png`

4. Upload AAB:
   - Go to Release > Testing > Internal testing
   - Create new release
   - Upload `app-release.aab`
   - Enter release notes

5. Complete content rating questionnaire

6. Set pricing & distribution

7. Submit for review (typically 1-3 days)

## Phase 6: Configure Auth0 for Android App

Add these redirect URIs in Auth0 Dashboard:

```
https://visibleshelf.store/auth/callback
android-app://com.visibleshelf.app
```

Also add to allowed logout URLs:
```
https://visibleshelf.store
android-app://com.visibleshelf.app
```

## Alternative: PWA Builder (Web-based)

If you prefer a web interface over CLI:

1. Go to https://www.pwabuilder.com/
2. Enter URL: `https://visibleshelf.store`
3. Click "Generate Package"
4. Download Android package
5. Upload to Play Console

## Troubleshooting

### Build fails with "SDK not found"
```bash
# Set ANDROID_HOME environment variable
export ANDROID_HOME=$HOME/Android/Sdk
# or on Windows
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
```

### Signing key issues
Ensure `twa-manifest.json` points to correct keystore path.

### PWA quality issues
Run Lighthouse audit and ensure:
- Performance > 80
- Accessibility > 80
- Best Practices > 80
- SEO > 80

## Files Created

- `twa-manifest.json` - TWA configuration
- `android.keystore` - Signing key (keep secure!)
- `android-app/` - Generated Android project

## Next Steps After TWA

Once TWA is live on Play Store:
1. Monitor crash reports in Play Console
2. Set up Google Play Billing if selling digital goods
3. Plan Capacitor migration for Clover/iOS support

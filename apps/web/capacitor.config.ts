import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.visibleshelf.app',
  appName: 'VisibleShelf',
  webDir: 'out', // Next.js static export directory
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    url: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : undefined, // Use production URL in production builds
    cleartext: true, // Allow HTTP in development
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#1971c2',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#1971c2',
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#ffffff',
    buildOptions: {
      keystorePath: 'android.keystore',
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD || '',
      keystoreAlias: 'visibleshelf',
      keystoreAliasPassword: process.env.ANDROID_KEY_PASSWORD || '',
      signingType: 'apksigner',
    },
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    preferredContentMode: 'mobile',
    scheme: 'VisibleShelf',
    backgroundColor: '#ffffff',
  },
};

export default config;

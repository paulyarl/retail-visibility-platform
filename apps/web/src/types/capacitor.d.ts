declare module '@capacitor/cli' {
  export interface CapacitorConfig {
    appId?: string;
    appName?: string;
    webDir?: string;
    server?: {
      androidScheme?: string;
      iosScheme?: string;
      url?: string;
      cleartext?: boolean;
    };
    plugins?: Record<string, any>;
    android?: {
      allowMixedContent?: boolean;
      captureInput?: boolean;
      webContentsDebuggingEnabled?: boolean;
      backgroundColor?: string;
      buildOptions?: {
        keystorePath?: string;
        keystorePassword?: string;
        keystoreAlias?: string;
        keystoreAliasPassword?: string;
        signingType?: string;
      };
    };
    ios?: {
      contentInset?: string;
      allowsLinkPreview?: boolean;
      scrollEnabled?: boolean;
      preferredContentMode?: string;
      scheme?: string;
      backgroundColor?: string;
    };
  }
}

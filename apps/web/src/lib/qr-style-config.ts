/**
 * Shared QR Style Configuration
 *
 * Theme presets for BSaaS promo/grant QR codes using qr-code-styling.
 * Used by PromoCodeQRDialog (Phase 3) and PrivateFeatureGrantDialog (Phase 4).
 */

export type QRThemeName = 'promo' | 'promo-sale' | 'bundle-promo' | 'private-grant';

export interface QRThemeConfig {
  name: QRThemeName;
  label: string;
  dotType: 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded' | 'square';
  dotColor: string;
  cornerSquareType: 'dot' | 'square' | 'extra-rounded' | 'rounded';
  cornerSquareColor: string;
  cornerDotType: 'dot' | 'square';
  cornerDotColor: string;
  logoShape: 'square' | 'circle';
  backgroundColor: string;
  description: string;
}

export const QR_THEMES: Record<QRThemeName, QRThemeConfig> = {
  promo: {
    name: 'promo',
    label: 'Promo (Default)',
    dotType: 'rounded',
    dotColor: '#1a56db',
    cornerSquareType: 'extra-rounded',
    cornerSquareColor: '#1a56db',
    cornerDotType: 'dot',
    cornerDotColor: '#ffffff',
    logoShape: 'square',
    backgroundColor: '#f8fafc',
    description: 'General marketing',
  },
  'promo-sale': {
    name: 'promo-sale',
    label: 'Promo (Sale)',
    dotType: 'classy-rounded',
    dotColor: '#dc2626',
    cornerSquareType: 'rounded',
    cornerSquareColor: '#dc2626',
    cornerDotType: 'dot',
    cornerDotColor: '#ffffff',
    logoShape: 'square',
    backgroundColor: '#fef2f2',
    description: 'Flash sales, limited-time',
  },
  'bundle-promo': {
    name: 'bundle-promo',
    label: 'Bundle Promo',
    dotType: 'extra-rounded',
    dotColor: '#16a34a',
    cornerSquareType: 'extra-rounded',
    cornerSquareColor: '#16a34a',
    cornerDotType: 'dot',
    cornerDotColor: '#ffffff',
    logoShape: 'square',
    backgroundColor: '#f0fdf4',
    description: 'Bundle discount campaigns',
  },
  'private-grant': {
    name: 'private-grant',
    label: 'Private Grant',
    dotType: 'dots',
    dotColor: '#7c3aed',
    cornerSquareType: 'dot',
    cornerSquareColor: '#7c3aed',
    cornerDotType: 'dot',
    cornerDotColor: '#ffffff',
    logoShape: 'square',
    backgroundColor: '#faf5ff',
    description: 'Enterprise deals, trade shows',
  },
};

export const QR_THEME_LIST = Object.values(QR_THEMES);

/**
 * Build a qr-code-styling options object from a theme + data + image.
 * Used by PromoCodeQRDialog (Phase 3).
 */
export function buildQROptions(
  data: string,
  image: string | undefined,
  theme: QRThemeConfig,
  size = 512,
) {
  return {
    width: size,
    height: size,
    type: 'svg' as const,
    data,
    image: image || undefined,
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 10,
      imageSize: 0.35,
      hideBackgroundDots: true,
      imageShape: theme.logoShape,
    } as any,
    dotsOptions: {
      color: theme.dotColor,
      type: theme.dotType,
    },
    cornersSquareOptions: {
      color: theme.cornerSquareColor,
      type: theme.cornerSquareType,
    },
    cornersDotOptions: {
      color: theme.cornerDotColor,
      type: theme.cornerDotType,
    },
    backgroundOptions: {
      color: theme.backgroundColor,
    },
    qrOptions: {
      errorCorrectionLevel: 'H' as const,
    },
  };
}

/**
 * QR style settings — mirrors the storefront_qr capability merchant settings.
 * Used by the admin Grant QR dialog for full styling control (no tier gating).
 */
export interface QrStyleSettings {
  dotType: string;
  cornerType: string;
  cornerDotType: string;
  dotColor: string;
  cornerColor: string;
  cornerDotColor: string;
  bgColor: string;
  customColorsEnabled: boolean;
  gradientEnabled: boolean;
  gradientStart: string;
  gradientEnd: string;
}

/**
 * Default style settings derived from the "private-grant" theme.
 */
export const DEFAULT_QR_STYLE_SETTINGS: QrStyleSettings = {
  dotType: QR_THEMES['private-grant'].dotType,
  cornerType: QR_THEMES['private-grant'].cornerSquareType,
  cornerDotType: QR_THEMES['private-grant'].cornerDotType,
  dotColor: QR_THEMES['private-grant'].dotColor,
  cornerColor: QR_THEMES['private-grant'].cornerSquareColor,
  cornerDotColor: QR_THEMES['private-grant'].cornerDotColor,
  bgColor: QR_THEMES['private-grant'].backgroundColor,
  customColorsEnabled: true,
  gradientEnabled: false,
  gradientStart: '#7c3aed',
  gradientEnd: '#1a56db',
};

/**
 * Apply a theme preset to a QrStyleSettings object.
 * Returns a new settings object with the theme's colors/types.
 */
export function applyThemeToSettings(theme: QRThemeName): QrStyleSettings {
  const t = QR_THEMES[theme];
  return {
    dotType: t.dotType,
    cornerType: t.cornerSquareType,
    cornerDotType: t.cornerDotType,
    dotColor: t.dotColor,
    cornerColor: t.cornerSquareColor,
    cornerDotColor: t.cornerDotColor,
    bgColor: t.backgroundColor,
    customColorsEnabled: true,
    gradientEnabled: false,
    gradientStart: t.dotColor,
    gradientEnd: t.cornerSquareColor,
  };
}

/**
 * Build qr-code-styling options from QrStyleSettings.
 * This mirrors how QrPreviewPane builds options from merchant QR settings,
 * giving the admin Grant QR dialog the same styling awareness as the
 * storefront_qr capability.
 */
export function buildQROptionsFromSettings(
  data: string,
  settings: QrStyleSettings,
  size = 512,
) {
  const dotColor = settings.customColorsEnabled ? settings.dotColor : '#1a56db';
  const cornerColor = settings.customColorsEnabled ? settings.cornerColor : '#1a56db';
  const cornerDotColor = settings.customColorsEnabled ? settings.cornerDotColor : '#ffffff';
  const bgColor = settings.customColorsEnabled ? settings.bgColor : '#ffffff';

  return {
    width: size,
    height: size,
    type: 'svg' as const,
    data,
    image: undefined,
    imageOptions: {
      crossOrigin: 'anonymous',
      margin: 10,
      imageSize: 0.35,
      hideBackgroundDots: true,
    } as any,
    dotsOptions: {
      color: dotColor,
      type: settings.dotType as any,
      gradient: settings.gradientEnabled ? {
        type: 'linear' as const,
        rotation: 45,
        colorStops: [
          { offset: 0, color: settings.gradientStart },
          { offset: 1, color: settings.gradientEnd },
        ],
      } : undefined,
    },
    cornersSquareOptions: {
      color: cornerColor,
      type: settings.cornerType as any,
    },
    cornersDotOptions: {
      color: cornerDotColor,
      type: settings.cornerDotType as any,
    },
    backgroundOptions: {
      color: bgColor,
    },
    qrOptions: {
      errorCorrectionLevel: 'H' as const,
    },
  };
}

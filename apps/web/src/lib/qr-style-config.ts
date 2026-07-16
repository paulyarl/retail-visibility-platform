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
    backgroundColor: '#faf5ff',
    description: 'Enterprise deals, trade shows',
  },
};

export const QR_THEME_LIST = Object.values(QR_THEMES);

/**
 * Build a qr-code-styling options object from a theme + data + image.
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
    },
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

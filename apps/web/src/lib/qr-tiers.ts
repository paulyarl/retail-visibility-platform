/**
 * QR Code feature tiers
 * Aligns with subscription tiers (Starter/Pro/Enterprise)
 */

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise' | 'trial';

export interface QRCodeFeatures {
  enabled: boolean;
  maxResolution: number;
  customColors: boolean;
  customLogo: boolean;
  bulkDownload: boolean;
  analytics: boolean;
  printTemplates: boolean;
  whiteLabel: boolean;
  dynamicQR: boolean;
}

export const QR_TIER_FEATURES: Record<SubscriptionTier, QRCodeFeatures> = {
  trial: {
    enabled: true, // Free during trial
    maxResolution: 512,
    customColors: false,
    customLogo: false,
    bulkDownload: false,
    analytics: false,
    printTemplates: false,
    whiteLabel: false,
    dynamicQR: false,
  },
  starter: {
    enabled: true,
    maxResolution: 512,
    customColors: false,
    customLogo: false,
    bulkDownload: false,
    analytics: false,
    printTemplates: false,
    whiteLabel: false,
    dynamicQR: false,
  },
  professional: {
    enabled: true,
    maxResolution: 1024,
    customColors: true,
    customLogo: false,
    bulkDownload: true,
    analytics: true,
    printTemplates: true,
    whiteLabel: false,
    dynamicQR: false,
  },
  enterprise: {
    enabled: true,
    maxResolution: 2048,
    customColors: true,
    customLogo: true,
    bulkDownload: true,
    analytics: true,
    printTemplates: true,
    whiteLabel: true,
    dynamicQR: true,
  },
};

export function getQRFeatures(tier: SubscriptionTier | string | null | undefined): QRCodeFeatures {
  const normalizedTier = (tier?.toLowerCase() || 'trial') as SubscriptionTier;
  return QR_TIER_FEATURES[normalizedTier] || QR_TIER_FEATURES.trial;
}

export function canUseQRFeature(tier: SubscriptionTier | string | null | undefined): boolean {
  return getQRFeatures(tier).enabled;
}

export function getQRResolution(tier: SubscriptionTier | string | null | undefined): number {
  return getQRFeatures(tier).maxResolution;
}

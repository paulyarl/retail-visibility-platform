/**
 * QR Code feature tiers
 * Aligns with subscription tiers (Starter/Pro/Enterprise)
 */

import type { SubscriptionTier } from '@/lib/tiers';

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

const QR_FEATURES_STARTER: QRCodeFeatures = {
  enabled: true,
  maxResolution: 512,
  customColors: false,
  customLogo: false,
  bulkDownload: false,
  analytics: false,
  printTemplates: false,
  whiteLabel: false,
  dynamicQR: false,
};

const QR_FEATURES_DISCOVERY: QRCodeFeatures = {
  enabled: true,
  maxResolution: 512,
  customColors: false,
  customLogo: false,
  bulkDownload: false,
  analytics: false,
  printTemplates: false,
  whiteLabel: false,
  dynamicQR: false,
};

const QR_FEATURES_STOREFRONT: QRCodeFeatures = {
  enabled: true,
  maxResolution: 1024,
  customColors: true,
  customLogo: false,
  bulkDownload: true,
  analytics: true,
  printTemplates: true,
  whiteLabel: false,
  dynamicQR: false,
};
const QR_FEATURES_COMMITMENT: QRCodeFeatures = {
  enabled: true,
  maxResolution: 1024,
  customColors: true,
  customLogo: true,  // Tenant logo available from Commitment (commerce begins)
  bulkDownload: true,
  analytics: true,
  printTemplates: true,
  whiteLabel: false,
  dynamicQR: false,
};

const QR_FEATURES_ECOMMERCE: QRCodeFeatures = {
  enabled: true,
  maxResolution: 1024,
  customColors: true,
  customLogo: true,  // Tenant logo available for commerce tiers
  bulkDownload: true,
  analytics: true,
  printTemplates: true,
  whiteLabel: false,
  dynamicQR: false,
};

const QR_FEATURES_OMNICHANNEL: QRCodeFeatures = {
  enabled: true,
  maxResolution: 1024,
  customColors: true,
  customLogo: true,  // Tenant logo available for commerce tiers
  bulkDownload: true,
  analytics: true,
  printTemplates: true,
  whiteLabel: false,
  dynamicQR: false,
};

const QR_FEATURES_PROFESSIONAL: QRCodeFeatures = {
  enabled: true,
  maxResolution: 1024,
  customColors: true,
  customLogo: true,  // Tenant logo available for commerce tiers
  bulkDownload: true,
  analytics: true,
  printTemplates: true,
  whiteLabel: false,
  dynamicQR: false,
};
const QR_FEATURES_CHAIN_STARTER: QRCodeFeatures = {
  enabled: true,
  maxResolution: 1024,
  customColors: true,
  customLogo: false,
  bulkDownload: true,
  analytics: true,
  printTemplates: true,
  whiteLabel: false,
  dynamicQR: false,
};

const QR_FEATURES_ENTERPRISE: QRCodeFeatures = {
  enabled: true,
  maxResolution: 2048,
  customColors: true,
  customLogo: true,
  bulkDownload: true,
  analytics: true,
  printTemplates: true,
  whiteLabel: true,
  dynamicQR: true,
};

const QR_FEATURES_DISABLED: QRCodeFeatures = {
  enabled: false,
  maxResolution: 0,
  customColors: false,
  customLogo: false,
  bulkDownload: false,
  analytics: false,
  printTemplates: false,
  whiteLabel: false,
  dynamicQR: false,
};

export const QR_TIER_FEATURES: Record<SubscriptionTier, QRCodeFeatures> = {
  google_only: QR_FEATURES_DISCOVERY,
  discovery: QR_FEATURES_DISCOVERY,
  storefront: QR_FEATURES_STOREFRONT,
  commitment: QR_FEATURES_COMMITMENT,
  ecommerce: QR_FEATURES_ECOMMERCE,
  omnichannel: QR_FEATURES_OMNICHANNEL,
  professional: QR_FEATURES_PROFESSIONAL,
  starter: QR_FEATURES_STOREFRONT,
  chain_starter: QR_FEATURES_CHAIN_STARTER,
  enterprise: QR_FEATURES_ENTERPRISE,
  organization: QR_FEATURES_ENTERPRISE,

  // Trial wrappers inherit target tier features
  trial_google_only: QR_FEATURES_DISCOVERY,
  trial_discovery: QR_FEATURES_DISCOVERY,
  trial_storefront: QR_FEATURES_STOREFRONT,
  trial_commitment: QR_FEATURES_COMMITMENT,
  trial_ecommerce: QR_FEATURES_ECOMMERCE,
  trial_omnichannel: QR_FEATURES_OMNICHANNEL,
  trial_starter: QR_FEATURES_STOREFRONT,
  trial_professional: QR_FEATURES_PROFESSIONAL,
  trial_chain_starter: QR_FEATURES_CHAIN_STARTER,

  // Expired trial - no QR features
  expired_trial: QR_FEATURES_DISABLED,
};

export function getQRFeatures(tier_key: SubscriptionTier | string | null | undefined): QRCodeFeatures {
  const normalizedTier = (tier_key?.toLowerCase() || 'starter') as SubscriptionTier;
  return QR_TIER_FEATURES[normalizedTier] || QR_TIER_FEATURES.starter;
}

export function canUseQRFeature(tier: SubscriptionTier | string | null | undefined): boolean {
  return getQRFeatures(tier).enabled;
}

export function getQRResolution(tier: SubscriptionTier | string | null | undefined): number {
  return getQRFeatures(tier).maxResolution;
}

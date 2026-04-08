/**
 * Landing page feature tiers
 * Defines what customization options are available per subscription tier
 */

import type { SubscriptionTier } from '@/lib/tiers';

export interface LandingPageFeatures {
  // Content features
  customMarketingDescription: boolean;
  imageGallery: boolean;
  maxGalleryImages: number;
  customCta: boolean;
  socialLinks: boolean;
  
  // QR Code features
  qrCodes: boolean;
  
  // Branding features
  showBusinessLogo: boolean; // Professional+ tier
  removePlatformBranding: boolean;
  customLogo: boolean;
  customColors: boolean;
  customSections: boolean;
  maxCustomSections: number;
  
  // Advanced features
  customTheme: boolean;
  customDomain: boolean;
  abTesting: boolean;
  advancedAnalytics: boolean;
}

export const LANDING_PAGE_TIER_FEATURES: Record<SubscriptionTier, LandingPageFeatures> = {
  google_only: {
    customMarketingDescription: false,
    imageGallery: false,
    maxGalleryImages: 1,
    customCta: false,
    socialLinks: false,
    qrCodes: false,
    showBusinessLogo: false,
    removePlatformBranding: false,
    customLogo: false,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  },
  starter: {
    customMarketingDescription: false,
    imageGallery: false,
    maxGalleryImages: 1,
    customCta: false,
    socialLinks: false,
    qrCodes: true, // Enable basic QR codes for all tiers
    showBusinessLogo: false,
    removePlatformBranding: false,
    customLogo: false,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  },
  professional: {
    customMarketingDescription: true,
    imageGallery: true,
    maxGalleryImages: 5,
    customCta: true,
    socialLinks: true,
    qrCodes: true,
    showBusinessLogo: true,
    removePlatformBranding: false,
    customLogo: false,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  },
  enterprise: {
    customMarketingDescription: true,
    imageGallery: true,
    maxGalleryImages: 10,
    customCta: true,
    socialLinks: true,
    qrCodes: true,
    showBusinessLogo: true,
    removePlatformBranding: true,
    customLogo: true,
    customColors: true,
    customSections: true,
    maxCustomSections: 5,
    customTheme: true,
    customDomain: true,
    abTesting: true,
    advancedAnalytics: true,
  },
  organization: {
    customMarketingDescription: true,
    imageGallery: true,
    maxGalleryImages: 10,
    customCta: true,
    socialLinks: true,
    qrCodes: true,
    showBusinessLogo: true,
    removePlatformBranding: true,
    customLogo: true,
    customColors: true,
    customSections: true,
    maxCustomSections: 5,
    customTheme: true,
    customDomain: true,
    abTesting: true,
    advancedAnalytics: true,
  },

  // Trial wrappers - inherit features from target tier
  trial_google_only: {
    customMarketingDescription: false,
    imageGallery: false,
    maxGalleryImages: 1,
    customCta: false,
    socialLinks: false,
    qrCodes: false,
    showBusinessLogo: false,
    removePlatformBranding: false,
    customLogo: false,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  },
  trial_starter: {
    customMarketingDescription: false,
    imageGallery: false,
    maxGalleryImages: 1,
    customCta: false,
    socialLinks: false,
    qrCodes: true,
    showBusinessLogo: false,
    removePlatformBranding: false,
    customLogo: false,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  },
  trial_professional: {
    customMarketingDescription: true,
    imageGallery: true,
    maxGalleryImages: 5,
    customCta: true,
    socialLinks: true,
    qrCodes: true,
    showBusinessLogo: true,
    removePlatformBranding: false,
    customLogo: false,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  },
  trial_chain_starter: {
    customMarketingDescription: true,
    imageGallery: true,
    maxGalleryImages: 5,
    customCta: true,
    socialLinks: true,
    qrCodes: true,
    showBusinessLogo: true,
    removePlatformBranding: false,
    customLogo: false,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  },

  // Expired trial - no features
  expired_trial: {
    customMarketingDescription: false,
    imageGallery: false,
    maxGalleryImages: 0,
    customCta: false,
    socialLinks: false,
    qrCodes: false,
    showBusinessLogo: false,
    removePlatformBranding: false,
    customLogo: false,
    customColors: false,
    customSections: false,
    maxCustomSections: 0,
    customTheme: false,
    customDomain: false,
    abTesting: false,
    advancedAnalytics: false,
  },
};

export function getLandingPageFeatures(tier: SubscriptionTier | string | null | undefined): LandingPageFeatures {
  const normalizedTier = (tier?.toLowerCase() || 'starter') as SubscriptionTier;
  return LANDING_PAGE_TIER_FEATURES[normalizedTier] || LANDING_PAGE_TIER_FEATURES.starter;
}

export function canUseFeature(tier: SubscriptionTier | string | null | undefined, feature: keyof LandingPageFeatures): boolean {
  return getLandingPageFeatures(tier)[feature] as boolean;
}

export function getFeatureLimit(tier: SubscriptionTier | string | null | undefined, feature: keyof LandingPageFeatures): number {
  const value = getLandingPageFeatures(tier)[feature];
  return typeof value === 'number' ? value : 0;
}

// Tier descriptions for upsell messaging
export const TIER_UPSELL_MESSAGES = {
  marketingDescription: {
    feature: 'Custom Marketing Description',
    starter: '💎 Upgrade to Professional to write custom marketing copy that sells!',
    professional: null,
    enterprise: null,
  },
  imageGallery: {
    feature: 'Image Gallery',
    starter: '💎 Upgrade to Professional to show products from multiple angles!',
    professional: '💎 Upgrade to Enterprise for up to 10 images per product!',
    enterprise: null,
  },
  customCta: {
    feature: 'Custom Call-to-Action',
    starter: '💎 Upgrade to Professional to add "Call Now" or "Visit Store" buttons!',
    professional: null,
    enterprise: null,
  },
  customBranding: {
    feature: 'Custom Branding',
    starter: '💎 Upgrade to Enterprise to use your own logo and brand colors!',
    professional: '💎 Upgrade to Enterprise to use your own logo and brand colors!',
    enterprise: null,
  },
  removeBranding: {
    feature: 'Remove Platform Branding',
    starter: '💎 Upgrade to Enterprise to remove our branding and make pages fully yours!',
    professional: '💎 Upgrade to Enterprise to remove our branding and make pages fully yours!',
    enterprise: null,
  },
};

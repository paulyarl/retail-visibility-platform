/**
 * Landing page feature tiers
 * Defines what customization options are available per subscription tier
 */

export type SubscriptionTier = 'trial' | 'starter' | 'professional' | 'enterprise';

export interface LandingPageFeatures {
  // Content features
  customMarketingDescription: boolean;
  imageGallery: boolean;
  maxGalleryImages: number;
  customCta: boolean;
  socialLinks: boolean;
  
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
  trial: {
    customMarketingDescription: false,
    imageGallery: false,
    maxGalleryImages: 1,
    customCta: false,
    socialLinks: false,
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
};

export function getLandingPageFeatures(tier: SubscriptionTier | string | null | undefined): LandingPageFeatures {
  const normalizedTier = (tier?.toLowerCase() || 'trial') as SubscriptionTier;
  return LANDING_PAGE_TIER_FEATURES[normalizedTier] || LANDING_PAGE_TIER_FEATURES.trial;
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

/**
 * Storefront Section Resolution
 *
 * Maps effective capabilities (storefront type + option flags + FAQ/CRM flags)
 * to section visibility. This is the single source of truth for which sections
 * render on a storefront page.
 *
 * Key principle: all sections are gated by capability (merchant preference + tier),
 * not by storefront type. The storefront type sets default emphasis; the merchant
 * can override via storefront_options.
 */

import { StorefrontOptionFlags } from '@/services/CapabilityResolutionService';
import { PublicFaqOptionsFlags } from '@/services/CapabilityResolutionService';
import { PublicCrmOptionsFlags } from '@/services/CapabilityResolutionService';

export interface StorefrontSectionConfig {
  // Store type flags (derived from storefront type settings)
  isRetailStore: boolean;
  isOnlineStore: boolean;
  isServiceStore: boolean;
  isSocialStore: boolean;
  isStorefrontEnabled: boolean;

  // Section visibility
  showProducts: boolean;
  showServices: boolean;
  showStoreInfo: boolean;
  showReviews: boolean;
  showFAQ: boolean;
  showInquiry: boolean;
  showRecommendations: boolean;
  showRecentlyViewed: boolean;
  showCatalogSidebar: boolean;
  showFeaturedBuckets: boolean;
  showSocialProof: boolean;

  // FAQ details
  faqFeedbackEnabled: boolean;
}

export interface ResolveStorefrontSectionsParams {
  storefrontType: string;
  isStorefrontEnabled: boolean;
  optFlags: StorefrontOptionFlags | null;
  faqFlags: PublicFaqOptionsFlags | null;
  crmFlags: PublicCrmOptionsFlags | null;
  productOptionFlags?: { merchantPreferences?: { product_service_enabled?: boolean } } | null;
  socialCommerceFlags?: { canUseShareButtons?: boolean; canUseSocialProof?: boolean; enabled?: boolean } | null;
}

export function resolveStorefrontSections({
  storefrontType,
  isStorefrontEnabled,
  optFlags,
  faqFlags,
  crmFlags,
  productOptionFlags,
  socialCommerceFlags,
}: ResolveStorefrontSectionsParams): StorefrontSectionConfig {
  const isRetailStore = storefrontType === 'retail' || storefrontType === 'flexible';
  const isOnlineStore = storefrontType === 'online' || storefrontType === 'flexible';
  const isServiceStore = storefrontType === 'service' || storefrontType === 'flexible';
  const isSocialStore = storefrontType === 'social' || storefrontType === 'flexible';

  const showsReviews = true;
  const showsFulfillment = true;

  const faqEnabled = !!(faqFlags?.faq_enabled && faqFlags?.faq_display_storefront_accordion);
  const faqFeedbackEnabled = !!(faqFlags?.faq_enabled && faqFlags?.faq_display_feedback);
  const crmInquiryStorefrontEnabled = !!(crmFlags?.crm_enabled && crmFlags?.crm_inquiry_storefront_enabled);

  const showsRecommendStore = optFlags?.showRecommendStore ?? true;
  const showsRecentlyViewed = optFlags?.showRecentlyViewed ?? true;
  const showsCategoryProduct = optFlags?.showCategoryProduct ?? true;

  return {
    isRetailStore,
    isOnlineStore,
    isServiceStore,
    isSocialStore,
    isStorefrontEnabled,

    showProducts: isStorefrontEnabled,
    showServices: !!(productOptionFlags?.merchantPreferences?.product_service_enabled),
    showStoreInfo: isRetailStore,
    showReviews: showsReviews,
    showFAQ: faqEnabled,
    showInquiry: crmInquiryStorefrontEnabled,
    showRecommendations: isRetailStore && showsRecommendStore,
    showRecentlyViewed: showsRecentlyViewed,
    showCatalogSidebar: isRetailStore && showsCategoryProduct,
    showFeaturedBuckets: isStorefrontEnabled,
    showSocialProof: !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseSocialProof) || isSocialStore,

    faqFeedbackEnabled,
  };
}

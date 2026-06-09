/**
 * Public FAQ Service — Frontend Singleton
 *
 * Extends PublicApiSingleton for unauthenticated FAQ display on
 * storefront, product, and directory pages.
 * Uses makeDefaultRequest with cache keys for automatic caching.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
  category_id: string;
  category_name?: string;
  slug?: string;
  tags?: string[];
  display_order: number;
}

export interface PublicFaqCategory {
  id: string;
  name: string;
  slug: string;
  display_order: number;
}

export interface PublicFaqOptionsFlags {
  faq_enabled: boolean;
  faq_display_storefront_accordion: boolean;
  faq_display_product_accordion: boolean;
  faq_display_feedback: boolean;
  faq_display_bot_handoff: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

class PublicFaqService extends PublicApiSingleton {
  private static instance: PublicFaqService;

  private constructor() {
    super('public-faq-service', { ttl: 10 * 60 * 1000 }); // 10 minutes
  }

  getServiceCachePatterns(): string[] {
    return [
      'public-faq-storefront-*',
      'public-faq-product-*',
      'public-faq-categories-*',
      'public-faq-options-*',
    ];
  }

  static getInstance(): PublicFaqService {
    if (!PublicFaqService.instance) {
      PublicFaqService.instance = new PublicFaqService();
    }
    return PublicFaqService.instance;
  }

  // ====================
  // Storefront FAQs
  // ====================

  async getStorefrontFAQs(tenantId: string): Promise<PublicFaq[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<PublicFaq[]>>(
      `/api/public/tenants/${tenantId}/faqs?scope=storefront`,
      { method: 'GET' },
      `public-faq-storefront-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.error || 'Failed to load storefront FAQs');
    return result.data.data || [];
  }

  // ====================
  // Product FAQs
  // ====================

  async getProductFAQs(tenantId: string, productId: string): Promise<{
    productFAQs: PublicFaq[];
    storefrontFAQs: PublicFaq[];
  }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ productFAQs: PublicFaq[]; storefrontFAQs: PublicFaq[] }>>(
      `/api/public/tenants/${tenantId}/faqs?scope=product&productId=${encodeURIComponent(productId)}`,
      { method: 'GET' },
      `public-faq-product-${tenantId}-${productId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.error || 'Failed to load product FAQs');
    return {
      productFAQs: result.data.data?.productFAQs || [],
      storefrontFAQs: result.data.data?.storefrontFAQs || [],
    };
  }

  // ====================
  // Categories
  // ====================

  async getCategories(tenantId: string): Promise<PublicFaqCategory[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<PublicFaqCategory[]>>(
      `/api/public/tenants/${tenantId}/faq-categories`,
      { method: 'GET' },
      `public-faq-categories-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.error || 'Failed to load FAQ categories');
    return result.data.data || [];
  }

  // ====================
  // FAQ Options (public capability flags)
  // ====================

  async getFaqOptionsFlags(tenantId: string): Promise<PublicFaqOptionsFlags | null> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; settings: PublicFaqOptionsFlags }>(
        `/api/public/tenant/${tenantId}/faq-options`,
        { method: 'GET' },
        `public-faq-options-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success) return null;
      return result.data?.settings || null;
    } catch {
      return null;
    }
  }

  // ====================
  // Feedback (fire-and-forget)
  // ====================

  async submitFeedback(tenantId: string, faqId: string, type: 'up' | 'down'): Promise<void> {
    try {
      await this.makeDefaultRequest<ApiEnvelope<any>>(
        `/api/public/tenants/${tenantId}/faqs/${faqId}/feedback`,
        { method: 'POST', body: JSON.stringify({ type }) },
        `public-faq-feedback-${faqId}-${type}`
      );
    } catch {
      // Non-critical — silently fail
    }
  }

  async suggestEdit(tenantId: string, faqId: string, comment: string, email?: string): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
        `/api/public/tenants/${tenantId}/faqs/${faqId}/suggest-edit`,
        { method: 'POST', body: JSON.stringify({ comment, email }) },
        `public-faq-suggest-${faqId}`
      );
      return result.success;
    } catch {
      return false;
    }
  }
}

export const publicFaqService = PublicFaqService.getInstance();

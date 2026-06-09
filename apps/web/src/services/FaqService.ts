/**
 * FAQ Service — Frontend Singleton
 *
 * Extends TenantApiSingleton for tenant-scoped FAQ operations.
 * No direct fetch() calls — all requests go through inherited methods.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface FaqItem {
  id: string;
  tenant_id: string;
  category_id: string | null;
  question: string;
  answer: string;
  scope: 'storefront' | 'product';
  status: 'draft' | 'active' | 'archived';
  tags: string[];
  display_order: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string };
  product_links?: { product_id: string; inherit_storefront: boolean }[];
}

export interface FaqCategory {
  id: string;
  tenant_id: string;
  name: string;
  display_order: number;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaqTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  pairs: any[];
  created_at: string;
  updated_at: string;
}

export interface CreateFaqInput {
  category_id: string | null;
  question: string;
  answer: string;
  scope: 'storefront' | 'product';
  status: 'draft' | 'active' | 'archived';
  tags?: string[];
  display_order?: number;
  product_ids?: string[];
}

export interface UpdateFaqInput {
  category_id?: string;
  question?: string;
  answer?: string;
  scope?: 'storefront' | 'product';
  status?: 'draft' | 'active' | 'archived';
  tags?: string[];
  display_order?: number;
  product_ids?: string[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

class FaqService extends TenantApiSingleton {
  private static instance: FaqService;

  private constructor() {
    super('faq-service', { ttl: 5 * 60 * 1000 }); // 5 minutes
  }

  getServiceCachePatterns(): string[] {
    return [
      'faq-list-*',
      'faq-detail-*',
      'faq-categories-*',
      'faq-product-list-*',
      'faq-templates-*',
      'faq-coverage-*',
      'faq-options-*',
    ];
  }

  async invalidateServiceCaches(tenantId?: string): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): FaqService {
    if (!FaqService.instance) {
      FaqService.instance = new FaqService();
    }
    return FaqService.instance;
  }

  // ====================
  // FAQs
  // ====================

  async listFAQs(tenantId: string, filters?: { scope?: string; status?: string; categoryId?: string; search?: string }): Promise<FaqItem[]> {
    const queryParams = new URLSearchParams();
    if (filters?.scope) queryParams.append('scope', filters.scope);
    if (filters?.status) queryParams.append('status', filters.status);
    if (filters?.categoryId) queryParams.append('categoryId', filters.categoryId);
    if (filters?.search) queryParams.append('search', filters.search);
    const queryString = queryParams.toString();
    const endpoint = `/api/tenants/${tenantId}/faqs${queryString ? `?${queryString}` : ''}`;

    const cacheKey = `faq-list-${tenantId}${queryString ? `-${queryString}` : ''}`;
    const result = await this.makeDefaultRequest<ApiEnvelope<FaqItem[]>>(
      endpoint,
      { method: 'GET' },
      cacheKey,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load FAQs');
    return result.data.data;
  }

  async getFAQ(tenantId: string, faqId: string): Promise<FaqItem> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FaqItem>>(
      `/api/tenants/${tenantId}/faqs/${faqId}`,
      { method: 'GET' },
      `faq-detail-${tenantId}-${faqId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to get FAQ');
    return result.data.data;
  }

  async createFAQ(tenantId: string, data: CreateFaqInput): Promise<FaqItem> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FaqItem>>(
      `/api/tenants/${tenantId}/faqs`,
      { method: 'POST', body: JSON.stringify(data) },
      `faq-create-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to create FAQ');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data;
  }

  async updateFAQ(tenantId: string, faqId: string, data: UpdateFaqInput): Promise<FaqItem> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FaqItem>>(
      `/api/tenants/${tenantId}/faqs/${faqId}`,
      { method: 'PUT', body: JSON.stringify(data) },
      `faq-update-${tenantId}-${faqId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to update FAQ');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data;
  }

  async deleteFAQ(tenantId: string, faqId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<null>>(
      `/api/tenants/${tenantId}/faqs/${faqId}`,
      { method: 'DELETE' },
      `faq-delete-${tenantId}-${faqId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to delete FAQ');
    await this.invalidateServiceCaches(tenantId);
  }

  async reorderFAQs(tenantId: string, orders: { id: string; display_order: number }[]): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<null>>(
      `/api/tenants/${tenantId}/faqs/reorder`,
      { method: 'POST', body: JSON.stringify({ orders }) },
      `faq-reorder-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to reorder FAQs');
    await this.invalidateServiceCaches(tenantId);
  }

  async bulkUpdateStatus(tenantId: string, faqIds: string[], status: 'draft' | 'active' | 'archived'): Promise<number> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ updated: number }>>(
      `/api/tenants/${tenantId}/faqs/bulk-status`,
      { method: 'POST', body: JSON.stringify({ faqIds, status }) },
      `faq-bulk-status-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to update FAQs');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.updated;
  }

  async bulkDelete(tenantId: string, faqIds: string[]): Promise<number> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ deleted: number }>>(
      `/api/tenants/${tenantId}/faqs/bulk-delete`,
      { method: 'POST', body: JSON.stringify({ faqIds }) },
      `faq-bulk-delete-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to delete FAQs');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data.deleted;
  }

  // ====================
  // Categories
  // ====================

  async listCategories(tenantId: string): Promise<FaqCategory[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FaqCategory[]>>(
      `/api/tenants/${tenantId}/faqs/categories`,
      { method: 'GET' },
      `faq-categories-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load categories');
    return result.data.data;
  }

  async createCategory(tenantId: string, name: string, displayOrder?: number): Promise<FaqCategory> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FaqCategory>>(
      `/api/tenants/${tenantId}/faqs/categories`,
      { method: 'POST', body: JSON.stringify({ name, display_order: displayOrder }) },
      `faq-create-category-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to create category');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data;
  }

  async deleteCategory(tenantId: string, categoryId: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<null>>(
      `/api/tenants/${tenantId}/faqs/categories/${categoryId}`,
      { method: 'DELETE' },
      `faq-delete-category-${tenantId}-${categoryId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to delete category');
    await this.invalidateServiceCaches(tenantId);
  }

  // ====================
  // Product FAQs
  // ====================

  async listProductFAQs(tenantId: string, productId: string): Promise<FaqItem[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FaqItem[]>>(
      `/api/tenants/${tenantId}/faqs/products/${productId}/faqs`,
      { method: 'GET' },
      `faq-product-list-${tenantId}-${productId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load product FAQs');
    return result.data.data;
  }

  // ====================
  // Templates
  // ====================

  async listTemplates(tenantId: string): Promise<FaqTemplate[]> {
    const result = await this.makeDefaultRequest<ApiEnvelope<FaqTemplate[]>>(
      `/api/tenants/${tenantId}/faqs/templates`,
      { method: 'GET' },
      `faq-templates-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to load templates');
    return result.data.data;
  }

  async applyTemplate(tenantId: string, templateId: string, selectedPairs?: number[]): Promise<{ created: number; skipped: number }> {
    const result = await this.makeDefaultRequest<ApiEnvelope<{ created: number; skipped: number }>>(
      `/api/tenants/${tenantId}/faqs/templates/${templateId}/apply`,
      { method: 'POST', body: JSON.stringify({ selectedPairs }) },
      `faq-apply-template-${tenantId}-${templateId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to apply template');
    await this.invalidateServiceCaches(tenantId);
    return result.data.data;
  }

  async getCoverage(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<ApiEnvelope<any>>(
      `/api/tenants/${tenantId}/faqs/coverage`,
      { method: 'GET' },
      `faq-coverage-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data.success) throw new Error(result.data.error || 'Failed to fetch coverage');
    return result.data.data;
  }

  async getOptions(tenantId: string): Promise<{ settings: Record<string, boolean>; tierState: any }> {
    const result = await this.makeDefaultRequest<{ success: boolean; settings: Record<string, boolean>; tierState: any; error?: string }>(
      `/api/tenants/${tenantId}/faq-options`,
      { method: 'GET' },
      `faq-options-${tenantId}`,
      2 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.error || 'Failed to fetch FAQ options');
    return { settings: result.data.settings, tierState: result.data.tierState };
  }

  async updateOptions(tenantId: string, settings: Record<string, boolean>): Promise<Record<string, boolean>> {
    const result = await this.makeDefaultRequest<{ success: boolean; settings: Record<string, boolean>; error?: string }>(
      `/api/tenants/${tenantId}/faq-options`,
      { method: 'PUT', body: JSON.stringify(settings) },
      `faq-update-options-${tenantId}`
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    if (!result.data?.success) throw new Error(result.data?.error || 'Failed to update FAQ options');
    await this.invalidateServiceCaches(tenantId);
    return result.data.settings;
  }
}

export const faqService = FaqService.getInstance();

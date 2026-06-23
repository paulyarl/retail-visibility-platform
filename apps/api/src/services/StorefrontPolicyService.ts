/**
 * Storefront Policy Service
 *
 * CRUD for per-tenant storefront policies (return, shipping, privacy, terms, refund).
 * Gated by the storefront_types capability type.
 * Extends BaseService for prisma + logger + error handling.
 */

import { BaseService } from './BaseService';
import { generateStorefrontPolicyId } from '../lib/id-generator';

export type PolicyType = 'return_policy' | 'shipping_policy' | 'privacy_policy' | 'terms_of_service' | 'refund_policy';

export interface StorefrontPolicies {
  return_policy: string | null;
  shipping_policy: string | null;
  privacy_policy: string | null;
  terms_of_service: string | null;
  refund_policy: string | null;
}

export interface StorefrontPoliciesWithMeta extends StorefrontPolicies {
  hasAnyPolicies: boolean;
  updatedAt: Date | null;
}

const DEFAULT_POLICIES: StorefrontPolicies = {
  return_policy: null,
  shipping_policy: null,
  privacy_policy: null,
  terms_of_service: null,
  refund_policy: null,
};

class StorefrontPolicyService extends BaseService {
  private static instance: StorefrontPolicyService;

  private constructor() {
    super();
  }

  static getInstance(): StorefrontPolicyService {
    if (!StorefrontPolicyService.instance) {
      StorefrontPolicyService.instance = new StorefrontPolicyService();
    }
    return StorefrontPolicyService.instance;
  }

  async getPolicies(tenantId: string): Promise<StorefrontPoliciesWithMeta> {
    try {
      const record = await this.prisma.tenant_storefront_policies.findUnique({
        where: { tenant_id: tenantId },
      });

      if (!record) {
        return { ...DEFAULT_POLICIES, hasAnyPolicies: false, updatedAt: null };
      }

      const policies: StorefrontPolicies = {
        return_policy: record.return_policy,
        shipping_policy: record.shipping_policy,
        privacy_policy: record.privacy_policy,
        terms_of_service: record.terms_of_service,
        refund_policy: record.refund_policy,
      };

      const hasAnyPolicies = Object.values(policies).some(v => v && v.trim().length > 0);

      return { ...policies, hasAnyPolicies, updatedAt: record.updated_at };
    } catch (error) {
      this.handleError(error);
      return { ...DEFAULT_POLICIES, hasAnyPolicies: false, updatedAt: null };
    }
  }

  async getPublicPolicy(tenantId: string, type: PolicyType): Promise<string | null> {
    const policies = await this.getPolicies(tenantId);
    return policies[type];
  }

  async upsertPolicies(tenantId: string, data: Partial<StorefrontPolicies>): Promise<StorefrontPolicies> {
    try {
      const existing = await this.prisma.tenant_storefront_policies.findUnique({
        where: { tenant_id: tenantId },
      });

      const updateData: any = { updated_at: new Date() };
      if (data.return_policy !== undefined) updateData.return_policy = data.return_policy;
      if (data.shipping_policy !== undefined) updateData.shipping_policy = data.shipping_policy;
      if (data.privacy_policy !== undefined) updateData.privacy_policy = data.privacy_policy;
      if (data.terms_of_service !== undefined) updateData.terms_of_service = data.terms_of_service;
      if (data.refund_policy !== undefined) updateData.refund_policy = data.refund_policy;

      let record;
      if (existing) {
        record = await this.prisma.tenant_storefront_policies.update({
          where: { tenant_id: tenantId },
          data: updateData,
        });
      } else {
        record = await this.prisma.tenant_storefront_policies.create({
          data: {
            id: generateStorefrontPolicyId(tenantId),
            tenant_id: tenantId,
            return_policy: data.return_policy ?? null,
            shipping_policy: data.shipping_policy ?? null,
            privacy_policy: data.privacy_policy ?? null,
            terms_of_service: data.terms_of_service ?? null,
            refund_policy: data.refund_policy ?? null,
          },
        });
      }

      return {
        return_policy: record.return_policy,
        shipping_policy: record.shipping_policy,
        privacy_policy: record.privacy_policy,
        terms_of_service: record.terms_of_service,
        refund_policy: record.refund_policy,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

const storefrontPolicyService = StorefrontPolicyService.getInstance();
export { storefrontPolicyService, StorefrontPolicyService };
export default storefrontPolicyService;

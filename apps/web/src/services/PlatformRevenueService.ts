/**
 * Platform Revenue Service
 * 
 * Singleton service for managing platform revenue collection via Stripe Connect.
 * Handles:
 * - Platform payment configuration
 * - Merchant Stripe Connect onboarding
 * - Revenue tracking and reporting
 * - Fee management
 * 
 * Uses AdminApiSingleton for all API calls (platform admin only).
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

// ====================
// TYPES
// ====================

export interface PlatformPaymentConfig {
  id: string;
  stripe_platform_account_id: string | null;
  stripe_platform_public_key: string | null;
  stripe_connect_client_id: string | null;
  default_platform_fee_percent: number;
  deposit_forfeit_fee_percent: number;
  subscription_fee_percent: number;
  platform_payout_schedule: string;
  platform_payout_minimum_cents: number;
  last_payout_at: string | null;
  last_payout_amount_cents: number;
  total_payout_cents: string; // BigInt as string
  is_active: boolean;
  onboarding_completed_at: string | null;
  onboarding_error: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface MerchantStripeConnection {
  id: string;
  tenant_id: string;
  stripe_account_id: string | null;
  stripe_account_type: 'express' | 'standard' | 'custom' | null;
  onboarding_status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  onboarding_expires_at: string | null;
  onboarding_link: string | null;
  onboarding_error: string | null;
  stripe_account_status: 'pending' | 'enabled' | 'restricted' | 'rejected' | null;
  stripe_payouts_enabled: boolean;
  stripe_payments_enabled: boolean;
  stripe_requirements: any[];
  platform_fee_override_percent: number | null;
  total_payout_cents: string; // BigInt as string
  last_payout_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  // Joined tenant info
  tenant_name?: string;
  tenant_email?: string;
}

export interface PlatformRevenueTransaction {
  id: string;
  tenant_id: string | null;
  order_id: string | null;
  payment_id: string | null;
  transaction_type: 'transaction_fee' | 'deposit_forfeit' | 'subscription' | 'payout';
  gross_amount_cents: number;
  platform_fee_cents: number;
  gateway_fee_cents: number;
  net_amount_cents: number;
  stripe_transaction_id: string | null;
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  processed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface RevenueSummary {
  total_transactions: number;
  gross_volume_cents: number;
  platform_revenue_cents: number;
  gateway_fees_cents: number;
  net_to_merchants_cents: number;
  pending_payouts_cents: number;
  by_type: {
    transaction_fees: number;
    deposit_forfeits: number;
    subscriptions: number;
  };
}

export interface OnboardingLinkResponse {
  onboarding_link: string;
  expires_at: string;
}

export interface UpdatePlatformConfigRequest {
  stripe_platform_public_key?: string;
  stripe_platform_secret_key?: string;
  stripe_webhook_secret?: string;
  stripe_connect_client_id?: string;
  stripe_connect_secret?: string;
  default_platform_fee_percent?: number;
  deposit_forfeit_fee_percent?: number;
  subscription_fee_percent?: number;
  platform_payout_schedule?: 'daily' | 'weekly' | 'monthly';
  platform_payout_minimum_cents?: number;
}

export interface UpdateMerchantFeeRequest {
  tenant_id: string;
  platform_fee_override_percent: number | null;
}

export interface FeeTier {
  id: string;
  tier_name: string;
  fee_percentage: string;
  fee_fixed_cents: number;
  min_transaction_cents: number;
  max_transaction_cents: number | null;
  min_transaction_count: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeeOverride {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  tenant_tier?: string;
  fee_percentage: string;
  fee_fixed_cents: number;
  reason: string;
  expires_at: string | null;
  created_at: string;
  approved_by: string;
}

export interface CreateFeeTierRequest {
  tier_name: string;
  fee_percentage: number;
  fee_fixed_cents?: number;
  min_transaction_cents?: number;
  max_transaction_cents?: number | null;
  min_transaction_count?: number;
  description?: string;
}

export interface CreateFeeOverrideRequest {
  tenant_id: string;
  fee_percentage: number;
  fee_fixed_cents?: number;
  reason?: string;
  expires_at?: string | null;
}

// ====================
// SERVICE
// ====================

class PlatformRevenueService extends AdminApiSingleton {
  private static instance: PlatformRevenueService;

  protected constructor() {
    super('platform-revenue-service', {
      ttl: 5 * 60 * 1000 // 5 minutes
    });
  }

  static getInstance(): PlatformRevenueService {
    if (!PlatformRevenueService.instance) {
      PlatformRevenueService.instance = new PlatformRevenueService();
    }
    return PlatformRevenueService.instance;
  }

  // ====================
  // PLATFORM CONFIG
  // ====================

  /**
   * Get platform payment configuration
   */
  async getPlatformConfig(): Promise<PlatformPaymentConfig | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      config: PlatformPaymentConfig;
    }>(
      '/api/admin/platform-revenue/config',
      {},
      'platform-revenue-config',
      60 * 60 * 1000 // 1 hour cache
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get platform config:', response?.error);
      return null;
    }

    return response.data?.config || null;
  }

  /**
   * Update platform payment configuration
   */
  async updatePlatformConfig(data: UpdatePlatformConfigRequest): Promise<PlatformPaymentConfig | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      config: PlatformPaymentConfig;
    }>(
      '/api/admin/platform-revenue/config',
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      'platform-revenue-config-update',
      0 // No cache for mutations
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to update platform config:', response?.error);
      return null;
    }

    // Invalidate cached config
    this.invalidateCache('platform-revenue-config');
    
    return response.data?.config || null;
  }

  /**
   * Initialize Stripe Connect onboarding for the platform
   */
  async initializePlatformOnboarding(): Promise<OnboardingLinkResponse | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      onboarding_link: string;
      expires_at: string;
    }>(
      '/api/admin/platform-revenue/onboarding/init',
      {
        method: 'POST',
      },
      'platform-onboarding-init',
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to initialize platform onboarding:', response?.error);
      return null;
    }

    return {
      onboarding_link: response.data?.onboarding_link || '',
      expires_at: response.data?.expires_at || '',
    };
  }

  // ====================
  // MERCHANT CONNECTIONS
  // ====================

  /**
   * Get all merchant Stripe connections
   */
  async getMerchantConnections(filters?: {
    status?: string;
    search?: string;
  }): Promise<MerchantStripeConnection[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await this.makeDefaultRequest<{
      success: boolean;
      connections: MerchantStripeConnection[];
    }>(
      `/api/admin/platform-revenue/merchants${query}`,
      {},
      'merchant-connections',
      5 * 60 * 1000
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get merchant connections:', response?.error);
      return [];
    }

    return response.data?.connections || [];
  }

  /**
   * Get a specific merchant's Stripe connection
   */
  async getMerchantConnection(tenantId: string): Promise<MerchantStripeConnection | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      connection: MerchantStripeConnection;
    }>(
      `/api/admin/platform-revenue/merchants/${tenantId}`,
      {},
      `merchant-connection-${tenantId}`,
      5 * 60 * 1000
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get merchant connection:', response?.error);
      return null;
    }

    return response.data?.connection || null;
  }

  /**
   * Create Stripe Connect onboarding link for a merchant
   */
  async createMerchantOnboardingLink(tenantId: string): Promise<OnboardingLinkResponse | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      onboarding_link: string;
      expires_at: string;
    }>(
      `/api/admin/platform-revenue/merchants/${tenantId}/onboarding`,
      {
        method: 'POST',
      },
      `merchant-onboarding-${tenantId}`,
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to create merchant onboarding link:', response?.error);
      return null;
    }

    return {
      onboarding_link: response.data?.onboarding_link || '',
      expires_at: response.data?.expires_at || '',
    };
  }

  /**
   * Update merchant fee override
   */
  async updateMerchantFee(data: UpdateMerchantFeeRequest): Promise<MerchantStripeConnection | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      connection: MerchantStripeConnection;
    }>(
      `/api/admin/platform-revenue/merchants/${data.tenant_id}/fee`,
      {
        method: 'PUT',
        body: JSON.stringify({ platform_fee_override_percent: data.platform_fee_override_percent }),
      },
      `merchant-fee-update-${data.tenant_id}`,
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to update merchant fee:', response?.error);
      return null;
    }

    // Invalidate cached connection
    this.invalidateCache(`merchant-connection-${data.tenant_id}`);
    
    return response.data?.connection || null;
  }

  /**
   * Refresh merchant Stripe account status
   */
  async refreshMerchantStatus(tenantId: string): Promise<MerchantStripeConnection | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      connection: MerchantStripeConnection;
    }>(
      `/api/admin/platform-revenue/merchants/${tenantId}/refresh`,
      {
        method: 'POST',
      },
      `merchant-refresh-${tenantId}`,
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to refresh merchant status:', response?.error);
      return null;
    }

    // Invalidate cached connection
    this.invalidateCache(`merchant-connection-${tenantId}`);
    
    return response.data?.connection || null;
  }

  // ====================
  // REVENUE TRACKING
  // ====================

  /**
   * Get revenue summary
   */
  async getRevenueSummary(period: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<RevenueSummary | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      summary: RevenueSummary;
    }>(
      `/api/admin/platform-revenue/summary?period=${period}`,
      {},
      `revenue-summary-${period}`,
      5 * 60 * 1000
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get revenue summary:', response?.error);
      return null;
    }

    return response.data?.summary || null;
  }

  /**
   * Get revenue transactions
   */
  async getRevenueTransactions(filters?: {
    type?: string;
    status?: string;
    tenant_id?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: PlatformRevenueTransaction[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tenant_id) params.append('tenant_id', filters.tenant_id);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await this.makeDefaultRequest<{
      success: boolean;
      transactions: PlatformRevenueTransaction[];
      total: number;
    }>(
      `/api/admin/platform-revenue/transactions${query}`,
      {},
      'revenue-transactions',
      60 * 1000 // 1 minute cache
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get revenue transactions:', response?.error);
      return { transactions: [], total: 0 };
    }

    return {
      transactions: response.data?.transactions || [],
      total: response.data?.total || 0,
    };
  }

  /**
   * Get revenue by tenant
   */
  async getRevenueByTenant(tenantId: string, period: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<{
    total_cents: number;
    platform_fees_cents: number;
    forfeit_fees_cents: number;
    transaction_count: number;
  } | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      revenue: {
        total_cents: number;
        platform_fees_cents: number;
        forfeit_fees_cents: number;
        transaction_count: number;
      };
    }>(
      `/api/admin/platform-revenue/tenants/${tenantId}/revenue?period=${period}`,
      {},
      `tenant-revenue-${tenantId}-${period}`,
      5 * 60 * 1000
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get tenant revenue:', response?.error);
      return null;
    }

    return response.data?.revenue || null;
  }

  // ====================
  // PAYOUTS
  // ====================

  /**
   * Get pending payouts summary
   */
  async getPendingPayouts(): Promise<{
    platform_pending_cents: number;
    merchant_pending: { tenant_id: string; tenant_name: string; amount_cents: number }[];
  } | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      platform_pending_cents: number;
      merchant_pending: { tenant_id: string; tenant_name: string; amount_cents: number }[];
    }>(
      '/api/admin/platform-revenue/payouts/pending',
      {},
      'pending-payouts',
      60 * 1000
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get pending payouts:', response?.error);
      return null;
    }

    return {
      platform_pending_cents: response.data?.platform_pending_cents || 0,
      merchant_pending: response.data?.merchant_pending || [],
    };
  }

  /**
   * Trigger platform payout
   */
  async triggerPlatformPayout(): Promise<{ payout_id: string; amount_cents: number } | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      payout_id: string;
      amount_cents: number;
    }>(
      '/api/admin/platform-revenue/payouts/trigger',
      {
        method: 'POST',
      },
      'trigger-payout',
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to trigger payout:', response?.error);
      return null;
    }

    // Invalidate revenue summaries
    this.invalidateCache('revenue-summary-');
    
    return {
      payout_id: response.data?.payout_id || '',
      amount_cents: response.data?.amount_cents || 0,
    };
  }

  // ====================
  // FEE TIERS
  // ====================

  /**
   * Get all fee tiers
   */
  async getFeeTiers(): Promise<FeeTier[]> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      tiers: FeeTier[];
    }>(
      '/api/admin/platform-revenue/fee-tiers',
      {},
      'fee-tiers',
      5 * 60 * 1000
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get fee tiers:', response?.error);
      return [];
    }

    return response.data?.tiers || [];
  }

  /**
   * Create a fee tier
   */
  async createFeeTier(data: CreateFeeTierRequest): Promise<FeeTier | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      tier: FeeTier;
    }>(
      '/api/admin/platform-revenue/fee-tiers',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'create-fee-tier',
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to create fee tier:', response?.error);
      return null;
    }

    this.invalidateCache('fee-tiers');
    return response.data?.tier || null;
  }

  /**
   * Update a fee tier
   */
  async updateFeeTier(id: string, data: Partial<CreateFeeTierRequest>): Promise<FeeTier | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      tier: FeeTier;
    }>(
      `/api/admin/platform-revenue/fee-tiers/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      'update-fee-tier',
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to update fee tier:', response?.error);
      return null;
    }

    this.invalidateCache('fee-tiers');
    return response.data?.tier || null;
  }

  /**
   * Delete a fee tier
   */
  async deleteFeeTier(id: string): Promise<boolean> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
    }>(
      `/api/admin/platform-revenue/fee-tiers/${id}`,
      {
        method: 'DELETE',
      },
      'delete-fee-tier',
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to delete fee tier:', response?.error);
      return false;
    }

    this.invalidateCache('fee-tiers');
    return true;
  }

  // ====================
  // FEE OVERRIDES
  // ====================

  /**
   * Get all fee overrides
   */
  async getFeeOverrides(): Promise<FeeOverride[]> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      overrides: FeeOverride[];
    }>(
      '/api/admin/platform-revenue/fee-overrides',
      {},
      'fee-overrides',
      5 * 60 * 1000
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to get fee overrides:', response?.error);
      return [];
    }

    return response.data?.overrides || [];
  }

  /**
   * Create a fee override
   */
  async createFeeOverride(data: CreateFeeOverrideRequest): Promise<FeeOverride | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      override: FeeOverride;
    }>(
      '/api/admin/platform-revenue/fee-overrides',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'create-fee-override',
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to create fee override:', response?.error);
      return null;
    }

    this.invalidateCache('fee-overrides');
    return response.data?.override || null;
  }

  /**
   * Delete a fee override
   */
  async deleteFeeOverride(id: string): Promise<boolean> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
    }>(
      `/api/admin/platform-revenue/fee-overrides/${id}`,
      {
        method: 'DELETE',
      },
      'delete-fee-override',
      0
    );

    if (!response?.data?.success) {
      console.error('[PlatformRevenueService] Failed to delete fee override:', response?.error);
      return false;
    }

    this.invalidateCache('fee-overrides');
    return true;
  }
}

// Export singleton instance
export const platformRevenueService = PlatformRevenueService.getInstance();
export default platformRevenueService;

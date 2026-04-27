/**
 * Tenant Billing Service
 * 
 * Service for interacting with tenant billing API endpoints
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

import { RequestType, ResponseType } from '@/providers/base/FlexibleApiSingleton';  
// Types for billing data
export interface BillingOverview {
  currentBalance: number;
  nextPaymentDue: Date | null;
  subscriptionStatus: 'active' | 'past_due' | 'canceled' | 'trialing';
  lastPaymentStatus: 'success' | 'failed' | 'pending';
  subscriptionTier: string;
  monthlyAmount: number;
}

export interface RiskFactor {
  type: 'payment_failure' | 'expiring_card' | 'high_balance' | 'late_payments' | 'subscription_lapse';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  timeframe: string;
}

export interface SubscriptionRisk {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  factors: RiskFactor[];
  projectedDefaultDate?: Date;
  recommendedActions: RiskAction[];
}

export interface RiskAction {
  type: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionUrl: string;
  actionText: string;
  dueDate?: Date;
}

export interface BillingAction {
  id: string;
  type: 'payment_required' | 'payment_method' | 'subscription_upgrade' | 'verify_account';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionUrl: string;
  actionText: string;
  dueDate?: Date;
}

export interface RecentActivity {
  id: string;
  type: 'payment' | 'invoice' | 'subscription_change';
  title: string;
  amount?: number;
  status: 'success' | 'failed' | 'pending' | 'paid' | 'succeeded';
  date: Date;
  dueDate?: Date;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

class TenantBillingService extends TenantApiSingleton {
  private static instance: TenantBillingService;

  private constructor() {
    super('TenantBillingService');
  }

  static getInstance(): TenantBillingService {
    if (!TenantBillingService.instance) {
      TenantBillingService.instance = new TenantBillingService();
    }
    return TenantBillingService.instance;
  }

  /**
   * PILOT: Declare cache patterns for billing service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'billing-overview-*',
      'billing-actions-*',
      'payment-methods-*',
      'invoices-*',
      'statements-*',
      'notifications-*',
      'analytics-*',
      'preferences-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation for billing service
   */
  public async invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    if (!tenantId) return;
    
    const patterns = this.getServiceCachePatterns();
    for (const pattern of patterns) {
      const cacheKey = pattern.replace('*', tenantId);
      await this.invalidateCache(cacheKey);
    }
  }

  /**
   * Get billing overview for tenant
   */
  async getBillingOverview(tenantId: string): Promise<BillingOverview> {
    try {
      const response = await this.makeDefaultRequest<BillingOverview>(
        `/api/tenants/${tenantId}/billing/overview`,
        { method: 'GET' },
        `billing-overview-${tenantId}`
      );
      
      // Handle double-wrapped response
      const actualData = response.data as any;
      const data = actualData?.success ? actualData.data : response.data;
      
      // Ensure the response has all required fields
      return {
        currentBalance: data?.currentBalance || 0,
        nextPaymentDue: data?.nextPaymentDue || null,
        subscriptionStatus: data?.subscriptionStatus || 'active',
        lastPaymentStatus: data?.lastPaymentStatus || 'pending',
        subscriptionTier: data?.subscriptionTier || 'Unknown',
        monthlyAmount: data?.monthlyAmount || 0
      };
    } catch (error) {
      // Return default overview object if API fails
      return {
        currentBalance: 0,
        nextPaymentDue: null,
        subscriptionStatus: 'active',
        lastPaymentStatus: 'pending',
        subscriptionTier: 'Unknown',
        monthlyAmount: 0
      };
    }
  }

  /**
   * Get subscription risk assessment
   */
  async getSubscriptionRisk(tenantId: string): Promise<SubscriptionRisk> {
    try {
      const response = await this.makeDefaultRequest<SubscriptionRisk>(
        `/api/tenants/${tenantId}/billing/risk`,
        { method: 'GET' },
        `billing-risk-${tenantId}`,
        5 * 60 * 1000 // 5 minutes cache
      );
      
      // Handle double-wrapped response
      const actualData = response.data as any;
      const data = actualData?.success ? actualData.data : response.data;
      
      // Ensure the response has all required fields
      return {
        level: data?.level || 'low',
        score: data?.score || 0,
        factors: data?.factors || [],
        projectedDefaultDate: data?.projectedDefaultDate,
        recommendedActions: data?.recommendedActions || []
      };
    } catch (error) {
      // Return default low risk object if API fails
      return {
        level: 'low',
        score: 0,
        factors: [],
        recommendedActions: []
      };
    }
  }

  /**
   * Get actionable billing tasks
   */
  async getBillingActions(tenantId: string): Promise<BillingAction[]> {
    try {
      const response = await this.makeDefaultRequest<BillingAction[]>(
        `/api/tenants/${tenantId}/billing/actions`,
        { method: 'GET' },
        `billing-actions-${tenantId}`,
        5 * 60 * 1000 // 5 minutes cache
      );
      
      // Handle double-wrapped response
      const actualData = response.data as any;
      if (actualData?.success && Array.isArray(actualData.data)) {
        return actualData.data;
      }
      // Fallback for single-wrapped response
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      // Return empty array if API fails
      return [];
    }
  }

  /**
   * Get recent billing activity
   */
  async getRecentActivity(tenantId: string, limit: number = 10): Promise<RecentActivity[]> {
    try {
      const response = await this.makeDefaultRequest<RecentActivity[]>(
        `/api/tenants/${tenantId}/billing/recent-activity?limit=${limit}`,
        { method: 'GET' },
        `billing-activity-${tenantId}`,
        2 * 60 * 1000 // 2 minutes cache
      );
      
      // Handle double-wrapped response: { success: true, data: { success: true, data: [...] } }
      const actualData = response.data as any;
      if (actualData?.success && Array.isArray(actualData.data)) {
        return actualData.data;
      }
      // Fallback for single-wrapped response
      if (response.success && Array.isArray(response.data)) {
        return response.data;
      }
      console.warn('[TenantBillingService] getRecentActivity - unexpected response:', response);
      return [];
    } catch (error) {
      console.error('[TenantBillingService] getRecentActivity error:', error);
      return [];
    }
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(tenantId: string): Promise<PaymentMethod[]> {
    const response = await this.makeDefaultRequest<PaymentMethod[]>(
      `/api/tenants/${tenantId}/billing/payment-methods`,
      { method: 'GET' },
      `payment-methods-${tenantId}`,
      10 * 60 * 1000 // 10 minutes cache
    );
    
    // Handle double-wrapped response
    const actualData = response.data as any;
    if (actualData?.success && Array.isArray(actualData.data)) {
      return actualData.data;
    }
    // Fallback for single-wrapped response
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  /**
   * Add payment method
   */
  async addPaymentMethod(tenantId: string, paymentMethodData: {
    type: 'card' | 'bank_account';
    paymentMethodId: string;
    isDefault?: boolean;
  }): Promise<{ success: boolean; paymentMethod?: PaymentMethod; error?: string }> {
    try {
      const response = await this.makeDefaultRequest<PaymentMethod>(
        `/api/tenants/${tenantId}/billing/payment-methods`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentMethodData)
        },
        undefined, // No cache for write operations
        undefined
      );
      
      // Invalidate relevant caches
      await this.invalidateServiceCaches(tenantId, 'payment-methods');
      
      return {
        success: true,
        paymentMethod: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to add payment method'
      };
    }
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(tenantId: string, paymentMethodId: string, updates: {
    isDefault?: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeDefaultRequest(
        `/api/tenants/${tenantId}/billing/payment-methods/${paymentMethodId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        },
        undefined, // No cache for write operations
        undefined
      );
      
      // Invalidate relevant caches
      await this.invalidateServiceCaches(tenantId, 'payment-methods');
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update payment method'
      };
    }
  }

  /**
   * Remove payment method
   */
  async removePaymentMethod(tenantId: string, paymentMethodId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeDefaultRequest(
        `/api/tenants/${tenantId}/billing/payment-methods/${paymentMethodId}`,
        { method: 'DELETE' },
        undefined, // No cache for write operations
        undefined
      );
      
      // Invalidate relevant caches
      await this.invalidateServiceCaches(tenantId, 'payment-methods');
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to remove payment method'
      };
    }
  }

  /**
   * Get billing statements
   */
  async getBillingStatements(tenantId: string, limit: number = 12): Promise<any[]> {
    try {
      const response = await this.makeDefaultRequest<{ success: boolean; statements: any[] }>(
        `/api/tenants/${tenantId}/billing/statements?limit=${limit}`,
        { method: 'GET' },
        `billing-statements-${tenantId}`,
        15 * 60 * 1000 // 15 minutes cache
      );
      
      // Handle double-wrapped response
      const actualData = response.data as any;
      if (actualData?.success && Array.isArray(actualData.statements)) {
        return actualData.statements;
      }
      // Fallback for single-wrapped response
      if (Array.isArray(actualData?.statements)) {
        return actualData.statements;
      }
      return [];
    } catch (error) {
      // Return empty array if API fails
      return [];
    }
  }

  /**
   * Download statement PDF
   */
  async downloadStatement(tenantId: string, statementId: string): Promise<Blob> {
    const result = await this.makeDefaultRequest<Blob>(
      `/api/tenants/${tenantId}/billing/statements/${statementId}/download`,
      { method: 'GET' },
      `statement-pdf-${statementId}`,
      0, // No caching for PDF downloads
      { responseType: ResponseType.BLOB }
    );

    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to download statement');
    }

    return result.data!;
  }

  /**
   * Get billing analytics
   */
  async getBillingAnalytics(tenantId: string, period: '3m' | '6m' | '12m' = '6m'): Promise<any> {
    const response = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/billing/analytics?period=${period}`,
      { method: 'GET' },
      `billing-analytics-${tenantId}-${period}`,
      30 * 60 * 1000 // 30 minutes cache
    );
    
    // Handle double-wrapped response
    const actualData = response.data as any;
    if (actualData?.success && actualData?.data) {
      return actualData.data;
    }
    return response.data;
  }

  /**
   * Refresh billing data (invalidate cache)
   */
  async refreshBillingData(tenantId: string): Promise<void> {
    await this.invalidateServiceCaches(tenantId, 'billing-overview', 'billing-actions', 'billing-activity');
  }

  /**
   * Get platform fee summary
   */
  async getPlatformFeeSummary(tenantId: string): Promise<{
    currentMonth: number;
    lastMonth: number;
    yearToDate: number;
    transactions: number;
  }> {
    const response = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/billing/platform-fees`,
      { method: 'GET' },
      `platform-fees-${tenantId}`,
      10 * 60 * 1000 // 10 minutes cache
    );
    
    // Handle double-wrapped response
    const actualData = response.data as any;
    if (actualData?.success && actualData?.data) {
      return actualData.data;
    }
    return response.data;
  }

  /**
   * Pay overdue invoice
   */
  async payInvoice(tenantId: string, invoiceId: string, paymentMethodId: string): Promise<{
    success: boolean;
    error?: string;
    paymentIntent?: string;
  }> {
    try {
      const response = await this.makeDefaultRequest<{
        success: boolean;
        paymentIntent?: string;
      }>(
        `/api/tenants/${tenantId}/billing/invoices/${invoiceId}/pay`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentMethodId })
        },
        undefined, // No cache for write operations
        undefined
      );
      
      // Invalidate relevant caches
      await this.invalidateServiceCaches(tenantId, 'billing-overview', 'billing-actions');
      
      return {
        success: response.data.success,
        paymentIntent: response.data.paymentIntent
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to process payment'
      };
    }
  }

  private getAuthToken(): string {
    // This should be implemented based on your auth context
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || '';
    }
    return '';
  }
}

// Export singleton instance
export const tenantBillingService = TenantBillingService.getInstance();
export default tenantBillingService;

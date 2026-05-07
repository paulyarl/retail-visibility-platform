/**
 * Admin Billing Service
 * 
 * Extends AdminApiSingleton to provide admin billing operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface FinancialMetrics {
  totalMRR: number;
  totalARR: number;
  totalRevenue: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  revenueGrowth: number;
  projectedRevenue: number;
  churnRate: number;
  netRevenueRetention: number;
  customerLifetimeValue: number;
  averageRevenuePerUser: number;
}

export interface RevenueTrend {
  date: string;
  mrr: number;
  arr: number;
  revenue: number;
  newCustomers: number;
  churnedCustomers: number;
}

export interface TenantFinancialMetrics {
  tenantId: string;
  tenantName: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  createdAt: string;
  mrr: number;
  arr: number;
  paymentMethods: any[];
  totalPaid: number;
  totalDue: number;
  lastPaymentDate?: string;
  nextBillingDate?: string;
  accountHealth: {
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    riskLevel: 'low' | 'medium' | 'high';
    lastPaymentDays?: number;
    failedPayments?: number;
  };
  usageMetrics: {
    totalOrders: number;
    totalProducts: number;
    totalUsers: number;
    storageUsed: number;
    apiCalls: number;
  };
}

export interface PlatformInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  invoiceNumber: string;
  status: 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  fees: {
    platformFees: number;
    processingFees: number;
    otherFees: number;
  };
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  pdfUrl?: string;
}

export interface PlatformRevenueTransaction {
  id: string;
  tenantId: string;
  orderId?: string;
  paymentId?: string;
  transactionType: 'subscription' | 'transaction_fees' | 'deposit_forfeits';
  grossAmountCents: number;
  platformFeeCents: number;
  gatewayFeeCents: number;
  netAmountCents: number;
  stripeTransactionId?: string;
  stripeTransferId?: string;
  stripePayoutId?: string;
  status: 'completed' | 'pending' | 'failed';
  processedAt?: string;
  failedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  metadata: any;
}

export interface PlatformRevenueSummary {
  totalTransactions: number;
  grossVolumeCents: number;
  platformRevenueCents: number;
  gatewayFeesCents: number;
  netToMerchantsCents: number;
  pendingPayoutsCents: number;
  byType: {
    transactionFees: number;
    depositForfeits: number;
    subscriptions: number;
  };
}

export interface ManualBillingInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  tier: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  amountCents: number;
  status: 'pending' | 'paid' | 'cancelled';
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
  isManual: boolean;
  paymentInstructions?: string;
  payments: Array<{
    id: string;
    gatewayType: string;
    transactionId: string;
    amountCents: number;
    status: string;
    createdAt: string;
  }>;
}

export interface ManualInvoice {
  id: string;
  amountCents: number;
  description: string;
  status: 'pending' | 'paid' | 'cancelled';
  dueDate: string;
  paidAt?: string;
  paymentInstructions?: string;
  adminCreatedBy: string;
  createdAt: string;
  tenant: {
    id: string;
    name: string;
  };
  payments: any[];
}

export interface ServiceCharge {
  id: string;
  tenantId: string;
  tenantName: string;
  chargeType: string;
  amountCents: number;
  description: string;
  invoiceId?: string;
  appliedAt: string;
  createdAt: string;
}

/**
 * Service for managing admin billing operations
 */
export class AdminBillingService extends AdminApiSingleton {
  private static instance: AdminBillingService;

  private constructor() {
    super('AdminBillingService');
  }

  static getInstance(): AdminBillingService {
    if (!AdminBillingService.instance) {
      AdminBillingService.instance = new AdminBillingService();
    }
    return AdminBillingService.instance;
  }

  /**
   * Get platform revenue overview metrics
   */
  async getRevenueOverview(period: string = '90d'): Promise<FinancialMetrics> {
    const result = await this.makeDefaultRequest<FinancialMetrics>(
      `/api/admin/billing/revenue/overview?period=${period}`,
      {},
      `admin-revenue-overview-${period}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to get revenue overview:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch revenue overview');
    }

    return result.data!;
  }

  /**
   * Get revenue trends data
   */
  async getRevenueTrends(period: string = '90d'): Promise<RevenueTrend[]> {
    const result = await this.makeDefaultRequest<RevenueTrend[]>(
      `/api/admin/billing/revenue/trends?period=${period}`,
      {},
      `admin-revenue-trends-${period}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to get revenue trends:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch revenue trends');
    }

    return result.data!;
  }

  /**
   * Get financial metrics for a specific tenant
   */
  async getTenantFinancialMetrics(tenantId: string): Promise<TenantFinancialMetrics> {
    const result = await this.makeDefaultRequest<TenantFinancialMetrics>(
      `/api/admin/billing/tenants/${tenantId}/financial-metrics`,
      {},
      `admin-tenant-financial-${tenantId}`,
      this.cacheTTL / 2 // Shorter cache for individual tenant data
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to get tenant financial metrics:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch tenant financial metrics');
    }

    return result.data!;
  }

  /**
   * Get tenant payment history
   */
  async getTenantPaymentHistory(tenantId: string, page: number = 1, limit: number = 50): Promise<{
    payments: any[];
    pagination: any;
  }> {
    const result = await this.makeDefaultRequest<{
      payments: any[];
      pagination: any;
    }>(
      `/api/admin/billing/tenants/${tenantId}/payment-history?page=${page}&limit=${limit}`,
      {},
      `admin-tenant-payments-${tenantId}-${page}`,
      this.cacheTTL / 2
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to get tenant payment history:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch tenant payment history');
    }

    return result.data!;
  }

  /**
   * Get account health metrics for a tenant
   */
  async getTenantAccountHealth(tenantId: string): Promise<{
    score: number;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    riskLevel: 'low' | 'medium' | 'high';
    factors: {
      paymentHistory: number;
      usageConsistency: number;
      subscriptionAge: number;
      supportTickets: number;
    };
    recommendations: string[];
  }> {
    const result = await this.makeDefaultRequest<{
      score: number;
      status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
      riskLevel: 'low' | 'medium' | 'high';
      factors: {
        paymentHistory: number;
        usageConsistency: number;
        subscriptionAge: number;
        supportTickets: number;
      };
      recommendations: string[];
    }>(
      `/api/admin/billing/tenants/${tenantId}/account-health`,
      {},
      `admin-tenant-health-${tenantId}`,
      this.cacheTTL / 2
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to get tenant account health:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch tenant account health');
    }

    return result.data!;
  }

  /**
   * Send payment reminder to tenant
   */
  async sendPaymentReminder(tenantId: string, options: {
    message?: string;
    severity?: 'gentle' | 'firm' | 'urgent';
  }): Promise<{ success: boolean; message: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; message: string }>(
      `/api/admin/billing/tenants/${tenantId}/send-reminder`,
      {
        method: 'POST',
        body: JSON.stringify(options)
      },
      `admin-reminder-${tenantId}`,
      0 // No cache for actions
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to send payment reminder:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to send payment reminder');
    }

    return result.data!;
  }

  /**
   * Apply manual credit to tenant
   */
  async applyManualCredit(tenantId: string, options: {
    amount: number;
    reason: string;
    expiresAt?: string;
  }): Promise<{ success: boolean; message: string; creditId?: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; message: string; creditId?: string }>(
      `/api/admin/billing/tenants/${tenantId}/manual-credit`,
      {
        method: 'POST',
        body: JSON.stringify(options)
      },
      `admin-credit-${tenantId}`,
      0 // No cache for actions
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to apply manual credit:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to apply manual credit');
    }

    return result.data!;
  }

  /**
   * Update tenant subscription status
   */
  async updateSubscriptionStatus(tenantId: string, options: {
    status: string;
    reason?: string;
    effectiveDate?: string;
  }): Promise<{ success: boolean; message: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; message: string }>(
      `/api/admin/billing/tenants/${tenantId}/subscription-status`,
      {
        method: 'PATCH',
        body: JSON.stringify(options)
      },
      `admin-subscription-status-${tenantId}`,
      0 // No cache for actions
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to update subscription status:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to update subscription status');
    }

    return result.data!;
  }

  /**
   * Get platform invoices with filtering
   */
  async getPlatformInvoices(filters: {
    status?: string;
    tenantId?: string;
    periodStart?: string;
    periodEnd?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    invoices: PlatformInvoice[];
    total: number;
    pagination: any;
  }> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.tenantId) params.append('tenant_id', filters.tenantId);
    if (filters.periodStart) params.append('period_start', filters.periodStart);
    if (filters.periodEnd) params.append('period_end', filters.periodEnd);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const result = await this.makeDefaultRequest<{
      invoices: any[];
      total: number;
      pagination: any;
    }>(
      `/api/admin/platform-fee-invoices?${params.toString()}`,
      {},
      `admin-invoices-${JSON.stringify(filters)}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to get platform invoices:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch platform invoices');
    }

    // Transform API data to component format
    const invoices: PlatformInvoice[] = result.data!.invoices.map(invoice => ({
      id: invoice.id,
      tenantId: invoice.tenant_id,
      tenantName: invoice.tenants?.name || 'Unknown',
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      totalAmount: invoice.total_fees_cents / 100,
      fees: {
        platformFees: invoice.platform_fees_cents / 100,
        processingFees: invoice.stripe_fees_cents / 100 + invoice.paypal_fees_cents / 100,
        otherFees: invoice.other_fees_cents / 100
      },
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      createdAt: invoice.created_at,
      pdfUrl: invoice.pdf_url
    }));

    return {
      invoices,
      total: result.data!.total,
      pagination: result.data!.pagination
    };
  }

  /**
   * Generate invoice PDF
   */
  async generateInvoicePdf(invoiceId: string): Promise<{ success: boolean; pdfUrl?: string; error?: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; pdfUrl?: string }>(
      `/api/admin/platform-fee-invoices/${invoiceId}/generate-pdf`,
      {
        method: 'POST'
      },
      `admin-invoice-pdf-${invoiceId}`,
      0 // No cache for actions
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to generate invoice PDF:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to generate invoice PDF');
    }

    return result.data!;
  }

  /**
   * Send invoice reminder
   */
  async sendInvoiceReminder(invoiceId: string, options: {
    message?: string;
    severity?: 'gentle' | 'firm' | 'urgent';
  }): Promise<{ success: boolean; message: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; message: string }>(
      `/api/admin/platform-fee-invoices/${invoiceId}/send-reminder`,
      {
        method: 'POST',
        body: JSON.stringify(options)
      },
      `admin-invoice-reminder-${invoiceId}`,
      0 // No cache for actions
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to send invoice reminder:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to send invoice reminder');
    }

    return result.data!;
  }

  /**
   * Waive invoice fees
   */
  async waiveInvoiceFees(invoiceId: string, options: {
    reason: string;
    amount?: number;
    waiveAll?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; message: string }>(
      `/api/admin/platform-fee-invoices/${invoiceId}/waive-fees`,
      {
        method: 'POST',
        body: JSON.stringify(options)
      },
      `admin-invoice-waive-${invoiceId}`,
      0 // No cache for actions
    );

    if (!result.success) {
      console.error('[AdminBillingService] Failed to waive invoice fees:', result.error);
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to waive invoice fees');
    }

    return result.data!;
  }
}

// Export singleton instance
export const adminBillingService = AdminBillingService.getInstance();

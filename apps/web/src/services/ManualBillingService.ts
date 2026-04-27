/**
 * Manual Billing Service
 * 
 * Service for interacting with manual billing API endpoints
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { ResponseType } from '@/providers/base/FlexibleApiSingleton';

export interface ManualInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  amountCents: number;
  description: string;
  status: 'pending' | 'paid' | 'cancelled';
  paymentInstructions?: string;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string;
  adminCreatedBy: string;
  manualPayment: boolean;
}

export interface ManualPaymentMethod {
  id: string;
  tenantId: string;
  tenantName: string;
  gatewayType: 'manual' | 'bank' | 'cash' | 'other';
  paymentReference: string;
  adminNotes?: string;
  isDefault: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface ServiceCharge {
  id: string;
  tenantId: string;
  tenantName: string;
  chargeType: 'setup_fee' | 'service_fee' | 'custom';
  amountCents: number;
  description: string;
  invoiceId?: string;
  appliedAt: string;
  createdBy: string;
  createdAt: string;
}

export interface ServiceChargeConfiguration {
  id: string;
  chargeType: 'setup_fee' | 'service_fee' | 'custom';
  name: string;
  description: string;
  defaultAmountCents: number;
  isActive: boolean;
  requiresApproval: boolean;
  createdAt: string;
}

export interface ServiceChargeStats {
  totalCharges: number;
  totalAmountCents: number;
  uninvoicedCharges: number;
  invoicedCharges: number;
}

export interface CreateManualInvoiceRequest {
  tenantId: string;
  organizationId?: string;
  amountCents: number;
  description: string;
  paymentInstructions?: string;
  adminCreatedBy: string;
  adminEmail: string;
  reason?: string;
}

export interface CreateManualPaymentMethodRequest {
  tenantId: string;
  gatewayType: 'manual' | 'bank' | 'cash' | 'other';
  paymentReference: string;
  adminNotes?: string;
  isDefault?: boolean;
  createdBy: string;
  createdByEmail: string;
}

export interface MarkInvoiceAsPaidRequest {
  invoiceId: string;
  paymentReference: string;
  amountCents?: number;
  paymentDate: string;
  notes?: string;
  verifiedBy: string;
  verifiedByEmail: string;
}

export interface AddServiceChargeRequest {
  tenantId: string;
  organizationId?: string;
  chargeType: 'setup_fee' | 'service_fee' | 'custom';
  amountCents: number;
  description: string;
  applyToInvoice?: boolean;
  createdBy: string;
  createdByEmail?: string;
  reason?: string;
}

export interface CreateServiceChargeInvoiceRequest {
  tenantId: string;
  serviceChargeIds: string[];
  createdBy: string;
  createdByEmail?: string;
}

class ManualBillingService extends AdminApiSingleton {
  private static instance: ManualBillingService;

  private constructor() {
    super('ManualBillingService');
  }

  static getInstance(): ManualBillingService {
    if (!ManualBillingService.instance) {
      ManualBillingService.instance = new ManualBillingService();
    }
    return ManualBillingService.instance;
  }

  /**
   * Manual Invoice Operations
   */
  async createManualInvoice(data: CreateManualInvoiceRequest): Promise<{
    success: boolean;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache for this tenant's invoices
      if (result.success) {
        this.invalidateCache(`manual-invoices-${data.tenantId}`);
      }
      
      return {
        success: result.success,
        invoiceId: (result.data as any)?.invoiceId,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error creating manual invoice:', error);
      return {
        success: false,
        error: 'Failed to create manual invoice'
      };
    }
  }

  async getManualInvoices(tenantId: string): Promise<ManualInvoice[]> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/manual-billing/invoices/${tenantId}`, {}, `manual-invoices-${tenantId}`, this.cacheTTL);
      return result.success ? ((result.data as any) || []) : [];
    } catch (error) {
      console.error('Error fetching manual invoices:', error);
      return [];
    }
  }

  async getAllManualInvoices(): Promise<ManualInvoice[]> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/invoices', {}, 'all-manual-invoices', this.cacheTTL);
      if (!result.success) return [];
      
      const invoices = (result.data as any)?.invoices || [];
      return invoices.map((invoice: any) => ({
        id: invoice.id,
        tenantId: invoice.tenantId,
        tenantName: invoice.tenantName,
        amountCents: invoice.amountCents,
        description: invoice.description,
        status: invoice.status,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
      }));
    } catch (error) {
      console.error('Error fetching all manual invoices:', error);
      return [];
    }
  }

  async getAllInvoices(): Promise<Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    tier: string;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    amountCents: number;
    status: string;
    dueDate?: Date;
    paidAt?: Date;
    createdAt: Date;
    updatedAt?: Date;
    isManual: boolean;
    paymentInstructions?: string;
    payments: Array<{
      id: string;
      gatewayType: string;
      transactionId: string;
      amountCents: number;
      status: string;
      createdAt: Date;
    }>;
  }>> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/all-invoices', {}, 'all-invoices', this.cacheTTL);
      if (!result.success) return [];
      
      return (result.data as any)?.invoices || [];
    } catch (error) {
      console.error('Error fetching all invoices:', error);
      return [];
    }
  }

  async markInvoiceAsPaid(data: MarkInvoiceAsPaidRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/mark-paid', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache for invoices (we don't have tenantId here, so we'll need to get it from the invoice)
      if (result.success) {
        // Could fetch invoice to get tenantId, or use a broader cache invalidation
        this.invalidateCachePattern('manual-invoices-');
      }
      
      return {
        success: result.success,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      return {
        success: false,
        error: 'Failed to mark invoice as paid'
      };
    }
  }

  async updateInvoice(invoiceId: string, data: {
    amountCents: number;
    description: string;
    paymentInstructions?: string;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/manual-billing/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache to ensure fresh data
      if (result.success) {
        this.invalidateCache('all-manual-invoices');
      }
      
      return {
        success: result.success,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error updating invoice:', error);
      return {
        success: false,
        error: 'Failed to update invoice'
      };
    }
  }

  async cancelInvoice(invoiceId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/cancel-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceId }),
      }, `cancel-invoice-${invoiceId}`, this.cacheTTL);

      return {
        success: result.success,
        error: typeof result.error === 'string' ? result.error : undefined
      };
    } catch (error) {
      console.error('Error cancelling invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel invoice'
      };
    }
  }

  async sendInvoice(invoiceId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/send-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceId }),
      }, `send-invoice-${invoiceId}`, this.cacheTTL);

      return {
        success: result.success,
        error: typeof result.error === 'string' ? result.error : undefined
      };
    } catch (error) {
      console.error('Error sending invoice:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send invoice'
      };
    }
  }

  async generateInvoicePDF(invoiceId: string): Promise<{
    success: boolean;
    pdfUrl?: string;
    error?: string;
  }> {
    try {
      // Use makeDefaultRequest with responseType BLOB to get proper blob response
      const result = await this.makeDefaultRequest<Blob>(
        '/api/admin/manual-billing/generate-invoice-pdf',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ invoiceId }),
        },
        `manual-invoice-pdf-${invoiceId}`,
        0, // No caching for PDF downloads
        {
          responseType: ResponseType.BLOB, // Use BLOB response type
        }
      );

      if (!result.success) {
        return {
          success: false,
          error: typeof result.error === 'string' 
            ? result.error 
            : (result.error as any)?.message || 'Failed to generate invoice PDF'
        };
      }

      // Create a blob URL for the PDF from the returned Blob
      const pdfUrl = URL.createObjectURL(result.data!);

      return {
        success: true,
        pdfUrl,
      };
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate invoice PDF'
      };
    }
  }

  /**
   * Manual Payment Method Operations
   */
  async addManualPaymentMethod(data: CreateManualPaymentMethodRequest): Promise<{
    success: boolean;
    paymentMethodId?: string;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/payment-methods', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache for this tenant's payment methods
      if (result.success) {
        this.invalidateCache('all-manual-payment-methods');
      }
      
      return {
        success: result.success,
        paymentMethodId: (result.data as any)?.paymentMethodId,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error adding manual payment method:', error);
      return {
        success: false,
        error: 'Failed to add manual payment method'
      };
    }
  }

  async updatePaymentMethod(paymentMethodId: string, data: {
    gatewayType: 'manual' | 'bank' | 'cash' | 'other';
    paymentReference: string;
    adminNotes?: string;
    isDefault: boolean;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/manual-billing/payment-methods/${paymentMethodId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache to ensure fresh data
      if (result.success) {
        this.invalidateCache('all-manual-payment-methods');
      }
      
      return {
        success: result.success,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error updating payment method:', error);
      return {
        success: false,
        error: 'Failed to update payment method'
      };
    }
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/manual-billing/payment-methods/${paymentMethodId}`, {
        method: 'DELETE'
      });
      
      // Invalidate cache to ensure fresh data
      if (result.success) {
        this.invalidateCache('all-manual-payment-methods');
      }
      
      return {
        success: result.success,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error deleting payment method:', error);
      return {
        success: false,
        error: 'Failed to delete payment method'
      };
    }
  }

  async getManualPaymentMethods(tenantId: string): Promise<ManualPaymentMethod[]> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/manual-billing/payment-methods/${tenantId}`, {}, `manual-payment-methods-${tenantId}`, this.cacheTTL);
      return result.success ? ((result.data as any) || []) : [];
    } catch (error) {
      console.error('Error fetching manual payment methods:', error);
      return [];
    }
  }

  async getAllManualPaymentMethods(): Promise<ManualPaymentMethod[]> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/payment-methods', {}, 'all-manual-payment-methods', this.cacheTTL);
      if (!result.success) return [];
      
      const paymentMethods = (result.data as any)?.paymentMethods || [];
      return paymentMethods.map((method: any) => ({
        id: method.id,
        tenantId: method.tenantId,
        tenantName: method.tenantName,
        gatewayType: method.gatewayType,
        paymentReference: method.paymentReference,
        adminNotes: method.adminNotes,
        isDefault: method.isDefault,
        verifiedBy: method.verifiedBy,
        verifiedAt: method.verifiedAt,
        createdAt: method.createdAt,
        updatedAt: method.updatedAt
      }));
    } catch (error) {
      console.error('Error fetching all manual payment methods:', error);
      return [];
    }
  }

  /**
   * Service Charge Operations
   */
  async addServiceCharge(data: AddServiceChargeRequest): Promise<{
    success: boolean;
    serviceChargeId?: string;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/service-charges', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache for this tenant's service charges and stats
      if (result.success) {
        this.invalidateCache(`service-charges-${data.tenantId}`);
        this.invalidateCache(`service-charge-stats-${data.tenantId}`);
      }
      
      return {
        success: result.success,
        serviceChargeId: (result.data as any)?.serviceChargeId,
        invoiceId: (result.data as any)?.invoiceId,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error adding service charge:', error);
      return {
        success: false,
        error: 'Failed to add service charge'
      };
    }
  }

  async updateServiceCharge(chargeId: string, data: {
    chargeType: 'setup_fee' | 'service_fee' | 'custom';
    amountCents: number;
    description: string;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/service-charges/${chargeId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache to ensure fresh data
      if (result.success) {
        this.invalidateCache('service-charges');
      }
      
      return {
        success: result.success,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error updating service charge:', error);
      return {
        success: false,
        error: 'Failed to update service charge'
      };
    }
  }

  async updateSubscriptionControl(tenantId: string, data: {
    enabled: boolean;
    expiresAt?: string;
    reason?: string;
  }): Promise<{
    success: boolean;
    tenant?: {
      id: string;
      name: string;
      manualSubscriptionControl: boolean;
      manualSubscriptionExpiresAt?: Date;
      manualSubscriptionReason?: string;
      subscriptionStatus: string;
      subscriptionTier: string;
      subscriptionEndsAt?: Date;
    };
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/manual-billing/subscription-control/${tenantId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache for tenant-related data
      if (result.success) {
        this.invalidateCache('tenants-list');
        this.invalidateCache(`manual-invoices-${tenantId}`);
        this.invalidateCache(`service-charges-${tenantId}`);
        // Also invalidate broader caches if needed
        this.invalidateCache('all-manual-invoices');
        this.invalidateCache('all-service-charges');
      }
      
      return {
        success: result.success,
        tenant: (result.data as any)?.tenant,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error updating subscription control:', error);
      return {
        success: false,
        error: 'Failed to update subscription control'
      };
    }
  }

  async getServiceChargeStats(tenantId: string): Promise<ServiceChargeStats> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/service-charges/${tenantId}/stats`, {}, `service-charge-stats-${tenantId}`, this.cacheTTL);
      return result.success ? ((result.data as any) || {
        totalCharges: 0,
        totalAmountCents: 0,
        uninvoicedCharges: 0,
        invoicedCharges: 0
      }) : {
        totalCharges: 0,
        totalAmountCents: 0,
        uninvoicedCharges: 0,
        invoicedCharges: 0
      };
    } catch (error) {
      console.error('Error fetching service charge stats:', error);
      return {
        totalCharges: 0,
        totalAmountCents: 0,
        uninvoicedCharges: 0,
        invoicedCharges: 0
      };
    }
  }

  async getAllTenants(): Promise<any[]> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/manual-billing/tenants', {}, 'tenants-list', 300000);
      // Handle nested structure: result.data.data contains the actual array
      return result.success ? ((result.data as any).data || []) : [];
    } catch (error) {
      console.error('Error fetching all tenants:', error);
      return [];
    }
  }

  async getServiceCharges(tenantId: string): Promise<ServiceCharge[]> {
    try {
      const result = await this.makeDefaultRequest(`/api/admin/service-charges/${tenantId}`, {}, `service-charges-${tenantId}`, this.cacheTTL);
      return result.success ? ((result.data as any) || []) : [];
    } catch (error) {
      console.error('Error fetching service charges:', error);
      return [];
    }
  }

  async getAllServiceCharges(): Promise<ServiceCharge[]> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/service-charges', {}, 'all-service-charges', this.cacheTTL);
      if (!result.success) return [];
      
      const charges = (result.data as any)?.charges || [];
      return charges.map((charge: any) => ({
        id: charge.id,
        tenantId: charge.tenantId,
        tenantName: charge.tenantName,
        chargeType: charge.chargeType,
        amountCents: charge.amountCents,
        description: charge.description,
        invoiceId: charge.invoiceId,
        appliedAt: charge.appliedAt,
        createdAt: charge.createdAt
      }));
    } catch (error) {
      console.error('Error fetching all service charges:', error);
      return [];
    }
  }

  
  async getServiceChargeConfigurations(): Promise<ServiceChargeConfiguration[]> {
    try {
      // Clear cache to ensure fresh data
      this.invalidateCache('service-charge-configurations');
      
      const result = await this.makeDefaultRequest('/api/admin/service-charges/configurations', {}, 'service-charge-configurations', this.cacheTTL);
      return result.success ? ((result.data as any)?.configurations || []) : [];
    } catch (error) {
      console.error('Error fetching service charge configurations:', error);
      return [];
    }
  }

  async createInvoiceForServiceCharges(data: CreateServiceChargeInvoiceRequest): Promise<{
    success: boolean;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/service-charges/invoice', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Invalidate cache for this tenant's service charges, stats, and invoices
      if (result.success) {
        this.invalidateCache(`service-charges-${data.tenantId}`);
        this.invalidateCache(`service-charge-stats-${data.tenantId}`);
        this.invalidateCache(`manual-invoices-${data.tenantId}`);
      }
      
      return {
        success: result.success,
        invoiceId: (result.data as any)?.invoiceId,
        error: typeof result.error === 'string' ? result.error : (result.error as any)?.message
      };
    } catch (error) {
      console.error('Error creating invoice for service charges:', error);
      return {
        success: false,
        error: 'Failed to create invoice for service charges'
      };
    }
  }
}

// Export singleton instance
export const manualBillingService = ManualBillingService.getInstance();

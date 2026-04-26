/**
 * Manual Billing Service
 * 
 * Handles manual billing operations for alternative payment methods:
 * - Manual invoice creation
 * - Manual payment method management
 * - Service charge invoicing
 * - Payment status overrides
 */

import { prisma } from '../../prisma';
import { generateInvoiceId, generateBillingMethodId, generateServiceChargeId, generateSubscriptionPaymentId } from '../../lib/id-generator';
import { encryptCredential, decryptCredential } from '../../utils/credential-encryption';
import { audit } from '../../audit';

export interface ManualInvoiceData {
  tenantId: string;
  organizationId?: string;
  amountCents: number;
  description: string;
  paymentInstructions?: string;
  dueDateOverride?: Date;
  adminCreatedBy: string;
  adminEmail?: string;
  reason: string;
}

export interface ManualPaymentMethodData {
  tenantId: string;
  organizationId?: string;
  gatewayType: 'manual' | 'bank' | 'cash' | 'other';
  paymentReference: string;
  adminNotes?: string;
  isDefault: boolean;
  reason: string;
  createdBy: string;
  createdByEmail?: string;
}

export interface ServiceChargeData {
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

export interface ManualPaymentData {
  invoiceId: string;
  paymentReference?: string;
  amountCents?: number;
  paymentDate: Date;
  notes?: string;
  verifiedBy: string;
  verifiedByEmail?: string;
}

export class ManualBillingService {
  /**
   * Create a manual invoice for a tenant
   */
  async createManualInvoice(data: ManualInvoiceData): Promise<{
    success: boolean;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      // Get tenant with organization context
      const tenant = await prisma.tenants.findUnique({
        where: { id: data.tenantId },
        select: { 
          id: true,
          name: true,
          organization_id: true,
          organizations_list: {
            select: { id: true, name: true }
          }
        }
      });

      if (!tenant) {
        return {
          success: false,
          error: 'Tenant not found'
        };
      }

      const organizationId = data.organizationId || tenant.organization_id;
      
      // Generate invoice ID
      const invoiceId = generateInvoiceId(data.tenantId);
      
      // Set due date (default to 30 days from now)
      const dueDate = data.dueDateOverride || new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));

      // Create manual invoice
      await prisma.subscription_invoices.create({
        data: {
          id: invoiceId,
          tenant_id: data.tenantId,
          tier: 'manual', // Manual invoices don't have a tier
          billing_period_start: new Date(),
          billing_period_end: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
          amount_cents: data.amountCents,
          status: 'pending',
          due_date: dueDate,
          manual_payment: true,
          payment_instructions: data.paymentInstructions,
          admin_created_by: data.adminCreatedBy,
          created_at: new Date(),
        }
      });

      // Create audit log
      await audit({
        tenantId: data.tenantId,
        actor: data.adminCreatedBy,
        action: 'manual_invoice.created',
        payload: {
          invoiceId,
          amountCents: data.amountCents,
          description: data.description,
          organizationId,
          reason: data.reason,
          adminEmail: data.adminEmail,
        },
      });

      console.log(`[ManualBilling] Manual invoice created: ${invoiceId} for tenant ${data.tenantId}`);

      return {
        success: true,
        invoiceId
      };

    } catch (error: any) {
      console.error('[ManualBilling] Error creating manual invoice:', error);
      return {
        success: false,
        error: error.message || 'Failed to create manual invoice'
      };
    }
  }

  /**
   * Add a manual payment method for a tenant
   */
  async addManualPaymentMethod(data: ManualPaymentMethodData): Promise<{
    success: boolean;
    paymentMethodId?: string;
    error?: string;
  }> {
    try {
      // Get tenant with organization context
      const tenant = await prisma.tenants.findUnique({
        where: { id: data.tenantId },
        select: { id: true, name: true, organization_id: true }
      });

      if (!tenant) {
        return {
          success: false,
          error: 'Tenant not found'
        };
      }

      const organizationId = data.organizationId || tenant.organization_id;
      const paymentMethodId = generateBillingMethodId(data.tenantId);

      // If this is default, unset other defaults
      if (data.isDefault) {
        await prisma.merchant_billing_gateways.updateMany({
          where: { 
            tenant_id: data.tenantId,
            is_default: true 
          },
          data: { is_default: false }
        });
      }

      // Create manual payment method
      await prisma.merchant_billing_gateways.create({
        data: {
          id: paymentMethodId,
          tenant_id: data.tenantId,
          gateway_type: data.gatewayType,
          payment_method_token: `${data.gatewayType}-${paymentMethodId}`,
          manual_reference: data.paymentReference,
          admin_notes: data.adminNotes,
          is_default: data.isDefault || false,
          is_active: true,
          verified_by: data.createdBy,
          verified_at: new Date(),
          created_at: new Date(),
        }
      });

      // Create audit log
      await audit({
        tenantId: data.tenantId,
        actor: data.createdBy,
        action: 'manual_payment_method.created',
        payload: {
          paymentMethodId,
          paymentReference: data.paymentReference,
          organizationId,
          isDefault: data.isDefault,
          adminEmail: data.createdByEmail,
        },
      });

      console.log(`[ManualBilling] Manual payment method added: ${paymentMethodId} for tenant ${data.tenantId}`);

      return {
        success: true,
        paymentMethodId
      };

    } catch (error: any) {
      console.error('[ManualBilling] Error adding manual payment method:', error);
      return {
        success: false,
        error: error.message || 'Failed to add manual payment method'
      };
    }
  }

  /**
   * Mark an invoice as paid manually
   */
  async markInvoiceAsPaid(data: ManualPaymentData): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get invoice
      const invoice = await prisma.subscription_invoices.findUnique({
        where: { id: data.invoiceId },
        include: {
          tenants: {
            select: { id: true, name: true, organization_id: true }
          }
        }
      });

      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found'
        };
      }

      // Create payment record
      const paymentId = generateSubscriptionPaymentId(data.invoiceId);
      
      await prisma.subscription_payments.create({
        data: {
          id: paymentId,
          invoice_id: data.invoiceId,
          gateway_type: 'manual',
          transaction_id: data.paymentReference || `manual-${paymentId}`,
          amount_cents: data.amountCents || invoice.amount_cents,
          status: 'succeeded',
          failure_reason: null,
          created_at: data.paymentDate,
        }
      });

      // Update invoice status
      await prisma.subscription_invoices.update({
        where: { id: data.invoiceId },
        data: {
          status: 'paid',
          paid_at: data.paymentDate,
        }
      });

      // Create audit log
      await audit({
        tenantId: invoice.tenants.id,
        actor: data.verifiedBy,
        action: 'manual_invoice.paid',
        payload: {
          invoiceId: data.invoiceId,
          amountCents: data.amountCents || invoice.amount_cents,
          paymentReference: data.paymentReference,
          paymentDate: data.paymentDate,
          notes: data.notes,
          verifiedByEmail: data.verifiedByEmail,
        },
      });

      console.log(`[ManualBilling] Invoice marked as paid: ${data.invoiceId}`);

      return {
        success: true
      };

    } catch (error: any) {
      console.error('[ManualBilling] Error marking invoice as paid:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark invoice as paid'
      };
    }
  }

  /**
   * Get manual payment methods for a tenant
   */
  async getManualPaymentMethods(tenantId: string): Promise<Array<{
    id: string;
    gatewayType: string;
    manualReference?: string;
    adminNotes?: string;
    isDefault: boolean;
    isActive: boolean;
    verifiedBy?: string;
    verifiedAt?: Date;
    createdAt: Date;
  }>> {
    try {
      const methods = await prisma.merchant_billing_gateways.findMany({
        where: { 
          tenant_id: tenantId,
          gateway_type: 'manual'
        },
        select: {
          id: true,
          gateway_type: true,
          manual_reference: true,
          admin_notes: true,
          is_default: true,
          is_active: true,
          verified_by: true,
          verified_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' }
      });

      return methods.map(method => ({
        id: method.id,
        gatewayType: method.gateway_type || 'manual',
        manualReference: method.manual_reference || undefined,
        adminNotes: method.admin_notes || undefined,
        isDefault: method.is_default || false,
        isActive: method.is_active || false,
        verifiedBy: method.verified_by || undefined,
        verifiedAt: method.verified_at || undefined,
        createdAt: method.created_at || new Date(),
      }));

    } catch (error: any) {
      console.error('[ManualBilling] Error getting manual payment methods:', error);
      return [];
    }
  }

  /**
   * Get manual invoices for a tenant
   */
  async getManualInvoices(tenantId: string): Promise<Array<{
    id: string;
    amountCents: number;
    description?: string;
    status: string;
    dueDate: Date | null;
    paidAt: Date | null;
    paymentInstructions?: string;
    adminCreatedBy?: string;
    createdAt: Date;
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
      const invoices = await prisma.subscription_invoices.findMany({
        where: { 
          tenant_id: tenantId,
          manual_payment: true
        },
        include: {
          subscription_payments: {
            orderBy: { created_at: 'desc' }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      return invoices.map(invoice => ({
        id: invoice.id,
        amountCents: invoice.amount_cents,
        description: invoice.payment_instructions || undefined,
        status: invoice.status || 'pending',
        dueDate: invoice.due_date,
        paidAt: invoice.paid_at,
        paymentInstructions: invoice.payment_instructions || undefined,
        adminCreatedBy: invoice.admin_created_by || undefined,
        createdAt: invoice.created_at || new Date(),
        payments: invoice.subscription_payments.map(payment => ({
          id: payment.id,
          gatewayType: payment.gateway_type || 'manual',
          transactionId: payment.transaction_id || '',
          amountCents: payment.amount_cents,
          status: payment.status || 'pending',
          createdAt: payment.created_at || new Date()
        }))
      }));

    } catch (error) {
      console.error('Error getting manual invoices:', error);
      throw error;
    }
  }

  /**
   * Get a specific manual invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<{
    id: string;
    amountCents: number;
    description?: string;
    status: string;
    createdAt: Date;
    dueDate?: Date;
    paidAt?: Date;
    tenantId: string;
    tenantName: string;
    tier: string;
    paymentInstructions?: string;
    payments?: Array<{
      id: string;
      gatewayType: string;
      transactionId: string;
      amountCents: number;
      status: string;
      createdAt: Date;
    }>;
  } | null> {
    try {
      const invoice = await prisma.subscription_invoices.findUnique({
        where: { id: invoiceId },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              subscription_tier: true,
            },
          },
          subscription_payments: {
            select: {
              id: true,
              gateway_type: true,
              transaction_id: true,
              amount_cents: true,
              status: true,
              created_at: true,
            },
          },
        },
      });

      if (!invoice) {
        return null;
      }

      return {
        id: invoice.id,
        amountCents: invoice.amount_cents,
        description: invoice.payment_instructions || undefined,
        status: invoice.status || 'unknown',
        createdAt: invoice.created_at || new Date(),
        dueDate: invoice.due_date || undefined,
        paidAt: invoice.paid_at || undefined,
        tenantId: invoice.tenant_id,
        tenantName: invoice.tenants?.name || 'Unknown',
        tier: invoice.tenants?.subscription_tier || 'unknown',
        paymentInstructions: invoice.payment_instructions || undefined,
        payments: invoice.subscription_payments.map(payment => ({
          id: payment.id,
          gatewayType: payment.gateway_type,
          transactionId: payment.transaction_id || 'unknown',
          amountCents: payment.amount_cents,
          status: payment.status || 'unknown',
          createdAt: payment.created_at || new Date(),
        })),
      };
    } catch (error) {
      console.error('Error fetching manual invoice:', error);
      throw new Error('Failed to fetch manual invoice');
    }
  }

  /**
   * Get all manual invoices (admin view)
   */
  async getAllManualInvoices(): Promise<Array<{
    id: string;
    amountCents: number;
    description?: string;
    status: string;
    createdAt: Date;
    dueDate?: Date;
    paidAt?: Date;
    tenantId: string;
    tenantName: string;
    tier: string;
    paymentInstructions?: string;
    payments?: Array<{
      id: string;
      gatewayType: string;
      transactionId: string;
      amountCents: number;
      status: string;
      createdAt: Date;
    }>;
  }>> {
    try {
      const invoices = await prisma.subscription_invoices.findMany({
        where: { 
          manual_payment: true
        },
        include: {
          subscription_payments: {
            orderBy: { created_at: 'desc' }
          },
          tenants: {
            select: {
              id: true,
              name: true,
              subscription_tier: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      return invoices.map(invoice => ({
        id: invoice.id,
        amountCents: invoice.amount_cents,
        description: invoice.payment_instructions || undefined,
        status: invoice.status || 'pending',
        createdAt: invoice.created_at || new Date(),
        dueDate: invoice.due_date || undefined,
        paidAt: invoice.paid_at || undefined,
        tenantId: invoice.tenant_id,
        tenantName: invoice.tenants?.name || 'Unknown',
        tier: invoice.tenants?.subscription_tier || 'unknown',
        paymentInstructions: invoice.payment_instructions || undefined,
        payments: invoice.subscription_payments.map(payment => ({
          id: payment.id,
          gatewayType: payment.gateway_type || 'manual',
          transactionId: payment.transaction_id || 'unknown',
          amountCents: payment.amount_cents,
          status: payment.status || 'unknown',
          createdAt: payment.created_at || new Date()
        }))
      }));
    } catch (error) {
      console.error('Error getting all manual invoices:', error);
      throw error;
    }
  }

  /**
   * Get all manual payment methods (admin view)
   */
  async getAllManualPaymentMethods(): Promise<Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    gatewayType: 'manual' | 'bank' | 'cash' | 'other';
    paymentReference: string;
    adminNotes?: string;
    isDefault: boolean;
    verifiedBy?: string;
    verifiedAt?: Date;
    createdAt: Date;
    updatedAt?: Date;
  }>> {
    try {
      const paymentMethods = await prisma.merchant_billing_gateways.findMany({
        include: {
          tenants_merchant_billing_gateways_tenant_idTotenants: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      return paymentMethods.map(method => ({
        id: method.id,
        tenantId: method.tenant_id,
        tenantName: method.tenants_merchant_billing_gateways_tenant_idTotenants?.name || 'Unknown Tenant',
        gatewayType: (method.gateway_type || 'manual') as 'manual' | 'bank' | 'cash' | 'other',
        paymentReference: method.manual_reference || '',
        adminNotes: method.admin_notes || undefined,
        isDefault: method.is_default || false,
        verifiedBy: method.verified_by || undefined,
        verifiedAt: method.verified_at || undefined,
        createdAt: method.created_at || new Date(),
        updatedAt: method.updated_at || undefined
      }));
    } catch (error) {
      console.error('Error getting all manual payment methods:', error);
      throw error;
    }
  }
}

// Singleton instance
let instance: ManualBillingService | null = null;

export function getManualBillingService(): ManualBillingService {
  if (!instance) {
    instance = new ManualBillingService();
  }
  return instance;
}

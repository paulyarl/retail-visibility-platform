/**
 * Service Charge Service
 * 
 * Handles service charge operations for additional billing:
 * - Setup fees
 * - Service fees
 * - Custom charges
 * - Service charge invoicing
 */

import { prisma } from '../../prisma';
import { generateServiceChargeId, generateInvoiceId, generateSubscriptionPaymentId } from '../../lib/id-generator';
import { getManualBillingService } from './ManualBillingService';
import { audit } from '../../audit';

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

export interface ServiceChargeConfiguration {
  id: string;
  chargeType: 'setup_fee' | 'service_fee' | 'custom';
  name: string;
  description: string;
  defaultAmountCents: number;
  isActive: boolean;
  requiresApproval: boolean;
  createdAt: Date;
}

export class ServiceChargeService {
  /**
   * Add a service charge to a tenant
   */
  async addServiceCharge(data: ServiceChargeData): Promise<{
    success: boolean;
    serviceChargeId?: string;
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
      const serviceChargeId = generateServiceChargeId(data.tenantId);

      // Create service charge record
      const serviceCharge = await prisma.service_charges.create({
        data: {
          id: serviceChargeId,
          tenant_id: data.tenantId,
          organization_id: organizationId || undefined,
          charge_type: data.chargeType,
          amount_cents: data.amountCents,
          description: data.description,
          created_by: data.createdBy,
          created_at: new Date(),
        }
      });

      let invoiceId: string | undefined;

      // Create invoice immediately if requested
      if (data.applyToInvoice) {
        const manualBillingService = getManualBillingService();
        const invoiceResult = await manualBillingService.createManualInvoice({
          tenantId: data.tenantId,
          organizationId: organizationId as string | undefined,
          amountCents: data.amountCents,
          description: `${data.chargeType.replace('_', ' ').toUpperCase()}: ${data.description}`,
          paymentInstructions: `Service charge for ${data.description}`,
          adminCreatedBy: data.createdBy,
          adminEmail: data.createdByEmail,
          reason: data.reason || 'Service charge application',
        });

        if (invoiceResult.success) {
          invoiceId = invoiceResult.invoiceId;

          // Link service charge to invoice
          await prisma.service_charges.update({
            where: { id: serviceChargeId },
            data: { invoice_id: invoiceId }
          });
        }
      }

      // Create audit log
      await audit({
        tenantId: data.tenantId,
        actor: data.createdBy,
        action: 'service_charge.created',
        payload: {
          serviceChargeId,
          chargeType: data.chargeType,
          amountCents: data.amountCents,
          description: data.description,
          organizationId,
          invoiceId,
          reason: data.reason,
          adminEmail: data.createdByEmail,
        },
      });

      console.log(`[ServiceCharge] Service charge added: ${serviceChargeId} for tenant ${data.tenantId}`);

      return {
        success: true,
        serviceChargeId,
        invoiceId
      };

    } catch (error: any) {
      console.error('[ServiceCharge] Error adding service charge:', error);
      return {
        success: false,
        error: error.message || 'Failed to add service charge'
      };
    }
  }

  /**
   * Get service charges for a tenant
   */
  async getServiceCharges(tenantId: string, options?: {
    chargeType?: 'setup_fee' | 'service_fee' | 'custom';
    includeUninvoiced?: boolean;
    includeInvoiced?: boolean;
  }): Promise<Array<{
    id: string;
    chargeType: string;
    amountCents: number;
    description: string;
    invoiceId?: string;
    appliedAt: Date;
    createdBy: string;
  }>> {
    try {
      const where: any = { tenant_id: tenantId };

      if (options?.chargeType) {
        where.charge_type = options.chargeType;
      }

      if (options?.includeUninvoiced && !options?.includeInvoiced) {
        where.invoice_id = null;
      } else if (options?.includeInvoiced && !options?.includeUninvoiced) {
        where.invoice_id = { not: null };
      }

      const charges = await prisma.service_charges.findMany({
        where,
        select: {
          id: true,
          charge_type: true,
          amount_cents: true,
          description: true,
          invoice_id: true,
          applied_at: true,
          created_by: true,
        },
        orderBy: { applied_at: 'desc' }
      });

      return charges.map(charge => ({
        id: charge.id,
        chargeType: charge.charge_type,
        amountCents: charge.amount_cents,
        description: charge.description || '',
        invoiceId: charge.invoice_id || undefined,
        appliedAt: charge.applied_at || new Date(),
        createdBy: charge.created_by || '',
      }));

    } catch (error: any) {
      console.error('[ServiceCharge] Error getting service charges:', error);
      return [];
    }
  }

  /**
   * Create invoice for uninvoiced service charges
   */
  async createInvoiceForServiceCharges(tenantId: string, serviceChargeIds: string[], createdBy: string, createdByEmail?: string): Promise<{
    success: boolean;
    invoiceId?: string;
    error?: string;
  }> {
    try {
      // Get service charges
      const charges = await prisma.service_charges.findMany({
        where: {
          id: { in: serviceChargeIds },
          tenant_id: tenantId,
          invoice_id: null, // Only uninvoiced charges
        }
      });

      if (charges.length === 0) {
        return {
          success: false,
          error: 'No uninvoiced service charges found'
        };
      }

      // Calculate total amount
      const totalAmountCents = charges.reduce((sum, charge) => sum + charge.amount_cents, 0);

      // Create manual invoice
      const manualBillingService = getManualBillingService();
      const invoiceResult = await manualBillingService.createManualInvoice({
        tenantId,
        amountCents: totalAmountCents,
        description: `Service charges (${charges.length} items)`,
        paymentInstructions: 'Payment for multiple service charges',
        adminCreatedBy: createdBy,
        adminEmail: createdByEmail,
        reason: 'Service charge invoicing',
      });

      if (!invoiceResult.success) {
        return {
          success: false,
          error: invoiceResult.error || 'Failed to create invoice'
        };
      }

      // Update service charges with invoice ID
      await prisma.service_charges.updateMany({
        where: { id: { in: serviceChargeIds } },
        data: { invoice_id: invoiceResult.invoiceId }
      });

      // Create audit log
      await audit({
        tenantId,
        actor: createdBy,
        action: 'service_charge.invoiced',
        payload: {
          invoiceId: invoiceResult.invoiceId,
          serviceChargeIds,
          totalAmountCents,
          chargeCount: charges.length,
          adminEmail: createdByEmail,
        },
      });

      console.log(`[ServiceCharge] Invoice created for service charges: ${invoiceResult.invoiceId}`);

      return {
        success: true,
        invoiceId: invoiceResult.invoiceId
      };

    } catch (error: any) {
      console.error('[ServiceCharge] Error creating invoice for service charges:', error);
      return {
        success: false,
        error: error.message || 'Failed to create invoice for service charges'
      };
    }
  }

  /**
   * Get service charge configurations
   */
  async getServiceChargeConfigurations(): Promise<ServiceChargeConfiguration[]> {
    try {
      const configs = await prisma.service_charge_configurations.findMany({
        where: { is_active: true },
        orderBy: { charge_type: 'asc' }
      });

      return configs.map(config => ({
        id: config.id,
        chargeType: config.charge_type as 'setup_fee' | 'service_fee' | 'custom',
        name: config.name,
        description: config.description || '',
        defaultAmountCents: config.default_amount_cents || 0,
        isActive: config.is_active || false,
        requiresApproval: config.requires_approval || false,
        createdAt: config.created_at || new Date(),
      }));

    } catch (error: any) {
      console.error('[ServiceCharge] Error getting service charge configurations:', error);
      return [];
    }
  }

  /**
   * Get service charge statistics for a tenant
   */
  async getServiceChargeStats(tenantId: string): Promise<{
    totalCharges: number;
    totalAmountCents: number;
    uninvoicedCharges: number;
    uninvoicedAmountCents: number;
    chargesByType: Record<string, { count: number; amountCents: number }>;
  }> {
    try {
      const charges = await prisma.service_charges.findMany({
        where: { tenant_id: tenantId },
        select: {
          charge_type: true,
          amount_cents: true,
          invoice_id: true,
        }
      });

      const stats = {
        totalCharges: charges.length,
        totalAmountCents: charges.reduce((sum, charge) => sum + charge.amount_cents, 0),
        uninvoicedCharges: charges.filter(c => !c.invoice_id).length,
        uninvoicedAmountCents: charges.filter(c => !c.invoice_id).reduce((sum, charge) => sum + charge.amount_cents, 0),
        chargesByType: {} as Record<string, { count: number; amountCents: number }>,
      };

      // Group by type
      charges.forEach(charge => {
        const type = charge.charge_type;
        if (!stats.chargesByType[type]) {
          stats.chargesByType[type] = { count: 0, amountCents: 0 };
        }
        stats.chargesByType[type].count++;
        stats.chargesByType[type].amountCents += charge.amount_cents;
      });

      return stats;

    } catch (error: any) {
      console.error('[ServiceCharge] Error getting service charge stats:', error);
      return {
        totalCharges: 0,
        totalAmountCents: 0,
        uninvoicedCharges: 0,
        uninvoicedAmountCents: 0,
        chargesByType: {},
      };
    }
  }

  /**
   * Get all service charges (admin view)
   */
  async getAllServiceCharges(): Promise<Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    chargeType: string;
    amountCents: number;
    description: string;
    invoiceId?: string;
    appliedAt: Date;
    createdAt: Date;
  }>> {
    try {
      const charges = await prisma.service_charges.findMany({
        orderBy: { created_at: 'desc' }
      });

      // Get tenant IDs and fetch tenant names
      const tenantIds = [...new Set(charges.map(c => c.tenant_id))];
      const tenants = await prisma.tenants.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true }
      });

      const tenantMap = new Map(tenants.map(t => [t.id, t.name]));

      return charges.map(charge => ({
        id: charge.id,
        tenantId: charge.tenant_id,
        tenantName: tenantMap.get(charge.tenant_id) || 'Unknown Tenant',
        chargeType: charge.charge_type,
        amountCents: charge.amount_cents,
        description: charge.description || '',
        invoiceId: charge.invoice_id || undefined,
        appliedAt: charge.applied_at || new Date(),
        createdAt: charge.created_at || new Date()
      }));
    } catch (error) {
      console.error('Error getting all service charges:', error);
      throw error;
    }
  }
}

// Singleton instance
let instance: ServiceChargeService | null = null;

export function getServiceChargeService(): ServiceChargeService {
  if (!instance) {
    instance = new ServiceChargeService();
  }
  return instance;
}

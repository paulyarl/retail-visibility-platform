/**
 * Subscription Billing Service
 * 
 * Handles merchant payment methods and subscription billing
 * Supports Stripe, PayPal (future), and manual billing
 */

import { prisma } from '../../prisma';
import { decryptCredential, encryptCredential } from '../../utils/credential-encryption';
import { generateBillingMethodId, generateInvoiceId, generateSubscriptionPaymentId } from '../../lib/id-generator';
import Stripe from 'stripe';

export type BillingGatewayType = 'stripe' | 'paypal' | 'manual';

export interface PaymentMethodData {
  gatewayType: BillingGatewayType;
  paymentMethodToken: string;
  cardLast4?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface BillingPaymentMethod {
  id: string;
  tenantId: string;
  gatewayType: BillingGatewayType;
  paymentMethodToken: string;
  cardLast4?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  paypalEmail?: string;
  paypalAccountId?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface TierPricing {
  id: string;
  tier: string;
  tierKey: string;
  name: string;
  displayName: string;
  description?: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  maxSkus: number;
  maxLocations: number;
  tierType: string;
  features: any;
}

// Raw SQL result type (snake_case from database)
interface TierPricingRow {
  id: string;
  tier_key: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: string | number;
  max_skus: number;
  max_locations: number;
  tier_type: string;
  metadata: any;
}

interface BillingPaymentMethodRow {
  id: string;
  tenant_id: string;
  gateway_type: BillingGatewayType;
  payment_method_token: string | null;
  card_last4: string | null;
  card_brand: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  is_default: boolean | null;
  is_active: boolean | null;
  created_at: Date | null;
}

export class SubscriptionBillingService {
  private stripe: Stripe | null = null;

  constructor() {
    // Initialize Stripe if configured
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16' as any,
      });
    }
  }

  /**
   * Map database row to camelCase interface
   */
  private mapPaymentMethodRow(row: BillingPaymentMethodRow): BillingPaymentMethod {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      gatewayType: row.gateway_type,
      paymentMethodToken: row.payment_method_token || '',
      cardLast4: row.card_last4 || undefined,
      cardBrand: row.card_brand || undefined,
      expiryMonth: row.expiry_month || undefined,
      expiryYear: row.expiry_year || undefined,
      isDefault: row.is_default || false,
      isActive: row.is_active || false,
      createdAt: row.created_at || new Date(),
    };
  }

  // ==================
  // TIER PRICING
  // ==================

  /**
   * Get all tier pricing
   */
  async getTierPricing(): Promise<TierPricing[]> {
    // Use Prisma client directly to avoid JSON issues
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        tier_key: true,
        name: true,
        display_name: true,
        description: true,
        price_monthly: true,
        max_skus: true,
        max_locations: true,
        tier_type: true,
        metadata: true,
      },
    });
    
    return tiers.map(row => {
      // Extract features array from metadata
      const metadata = row.metadata as any || {};
      const featuresList = Array.isArray(metadata.features) 
        ? metadata.features 
        : Array.isArray(metadata) 
          ? metadata 
          : [];
      
      return {
        id: row.id,
        tier: row.tier_key,
        tierKey: row.tier_key,
        name: row.name,
        displayName: row.display_name,
        description: row.description || undefined,
        monthlyPriceCents: Math.round(Number(row.price_monthly) * 100),
        annualPriceCents: Math.round(Number(row.price_monthly) * 100 * 12),
        maxSkus: row.max_skus || 0,
        maxLocations: row.max_locations || 0,
        tierType: row.tier_type,
        features: featuresList,
      };
    });
  }

  /**
   * Get specific tier pricing
   */
  async getTierPricingByTier(tier: string): Promise<TierPricing | null> {
    const row = await prisma.subscription_tiers_list.findFirst({
      where: { tier_key: tier, is_active: true },
      select: {
        id: true,
        tier_key: true,
        name: true,
        display_name: true,
        description: true,
        price_monthly: true,
        max_skus: true,
        max_locations: true,
        tier_type: true,
        metadata: true,
      },
    });
    
    if (!row) return null;
    
    // Extract features array from metadata
    const metadata = row.metadata as any || {};
    const featuresList = Array.isArray(metadata.features) 
      ? metadata.features 
      : Array.isArray(metadata) 
        ? metadata 
        : [];
    
    return {
      id: row.id,
      tier: row.tier_key,
      tierKey: row.tier_key,
      name: row.name,
      displayName: row.display_name,
      description: row.description || undefined,
      monthlyPriceCents: Math.round(Number(row.price_monthly) * 100),
      annualPriceCents: Math.round(Number(row.price_monthly) * 100 * 12),
      maxSkus: row.max_skus || 0,
      maxLocations: row.max_locations || 0,
      tierType: row.tier_type,
      features: featuresList,
    };
  }

  // ==================
  // PAYMENT METHODS
  // ==================

  /**
   * Get all payment methods for a tenant
   */
  async getPaymentMethods(tenantId: string): Promise<BillingPaymentMethod[]> {
    const methods = await prisma.merchant_billing_gateways.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [
        { is_default: 'desc' },
        { created_at: 'desc' }
      ],
    });
    
    return methods.map(row => this.mapPaymentMethodRow({
      id: row.id,
      tenant_id: row.tenant_id,
      gateway_type: row.gateway_type as BillingGatewayType,
      payment_method_token: row.payment_method_token || '',
      card_last4: row.card_last4,
      card_brand: row.card_brand,
      expiry_month: row.expiry_month,
      expiry_year: row.expiry_year,
      is_default: row.is_default || false,
      is_active: row.is_active || false,
      created_at: row.created_at || new Date(),
    }));
  }

  /**
   * Get default payment method for a tenant
   */
  async getDefaultPaymentMethod(tenantId: string): Promise<BillingPaymentMethod | null> {
    const method = await prisma.merchant_billing_gateways.findFirst({
      where: { 
        tenant_id: tenantId, 
        is_default: true, 
        is_active: true 
      },
    });
    
    if (!method) return null;
    
    return this.mapPaymentMethodRow({
      id: method.id,
      tenant_id: method.tenant_id,
      gateway_type: method.gateway_type as BillingGatewayType,
      payment_method_token: method.payment_method_token || '',
      card_last4: method.card_last4,
      card_brand: method.card_brand,
      expiry_month: method.expiry_month,
      expiry_year: method.expiry_year,
      is_default: method.is_default || false,
      is_active: method.is_active || false,
      created_at: method.created_at || new Date(),
    });
  }

  /**
   * Add a payment method for a tenant
   * For Stripe, this attaches a PaymentMethod to the tenant's Stripe customer
   * For PayPal, this stores the billing agreement token
   */
  async addPaymentMethod(
    tenantId: string, 
    gatewayType: 'stripe' | 'paypal',
    paymentMethodToken: string,
    metadata?: {
      cardLast4?: string;
      cardBrand?: string;
      expiryMonth?: number;
      expiryYear?: number;
      paypalEmail?: string;
      paypalAccountId?: string;
    }
  ): Promise<BillingPaymentMethod> {
    // Ensure tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    let cardLast4 = metadata?.cardLast4;
    let cardBrand = metadata?.cardBrand;
    let expiryMonth = metadata?.expiryMonth;
    let expiryYear = metadata?.expiryYear;

    // For Stripe, get or create customer and attach payment method
    if (gatewayType === 'stripe' && this.stripe) {
      const customer = await this.getOrCreateStripeCustomer(tenantId, tenant.name);
      
      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodToken, {
        customer: customer.id,
      });

      // Get payment method details from Stripe
      const pm = await this.stripe.paymentMethods.retrieve(paymentMethodToken);
      
      if (pm.card) {
        cardLast4 = pm.card.last4;
        cardBrand = pm.card.brand;
        expiryMonth = pm.card.exp_month;
        expiryYear = pm.card.exp_year;
      }
    }

    // Check if this is the first payment method (make it default)
    const existingMethods = await this.getPaymentMethods(tenantId);
    const isDefault = existingMethods.length === 0;

    // Insert payment method
    const id = generateBillingMethodId(tenantId);
    
    await prisma.merchant_billing_gateways.create({
      data: {
        id: id,
        tenant_id: tenantId,
        gateway_type: gatewayType,
        payment_method_token: paymentMethodToken,
        card_last4: cardLast4 || null,
        card_brand: cardBrand || null,
        expiry_month: expiryMonth || null,
        expiry_year: expiryYear || null,
        is_default: isDefault,
        is_active: true,
      },
    });

    // Note: PayPal metadata would be stored in a separate table or added as columns
    // For now, we just create the payment method without additional metadata

    // Return the new payment method
    const method = await prisma.merchant_billing_gateways.findUnique({
      where: { id: id },
    });
    
    if (!method) {
      throw new Error('Failed to create payment method');
    }
    
    return this.mapPaymentMethodRow({
      id: method.id,
      tenant_id: method.tenant_id,
      gateway_type: method.gateway_type as BillingGatewayType,
      payment_method_token: method.payment_method_token || '',
      card_last4: method.card_last4,
      card_brand: method.card_brand,
      expiry_month: method.expiry_month,
      expiry_year: method.expiry_year,
      is_default: method.is_default || false,
      is_active: method.is_active || false,
      created_at: method.created_at || new Date(),
    });
  }

  /**
   * Set a payment method as default
   */
  async setDefaultPaymentMethod(tenantId: string, paymentMethodId: string): Promise<void> {
    // Unset current default
    await prisma.merchant_billing_gateways.updateMany({
      where: { tenant_id: tenantId },
      data: { is_default: false },
    });

    // Set new default
    await prisma.merchant_billing_gateways.update({
      where: { id: paymentMethodId, tenant_id: tenantId },
      data: { is_default: true },
    });
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(tenantId: string, paymentMethodId: string): Promise<void> {
    // Get the payment method first
    const method = await prisma.merchant_billing_gateways.findFirst({
      where: { id: paymentMethodId, tenant_id: tenantId },
    });

    if (!method) {
      throw new Error('Payment method not found');
    }

    // For Stripe, detach the payment method
    if (method.gateway_type === 'stripe' && this.stripe) {
      try {
        await this.stripe.paymentMethods.detach(method.payment_method_token!);
      } catch (error: any) {
        // Log but don't fail - the local record is what matters
        console.error('[SubscriptionBilling] Failed to detach Stripe payment method:', error.message);
      }
    }

    // Delete the local record
    await prisma.merchant_billing_gateways.delete({
      where: { id: paymentMethodId },
    });

    // If this was the default, set another as default
    if (method.is_default) {
      const remaining = await this.getPaymentMethods(tenantId);
      if (remaining.length > 0) {
        await this.setDefaultPaymentMethod(tenantId, remaining[0].id);
      }
    }
  }

  // ==================
  // STRIPE HELPERS
  // ==================

  /**
   * Get or create Stripe customer for tenant
   */
  private async getOrCreateStripeCustomer(tenantId: string, tenantName: string): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    // Check if tenant has a Stripe customer ID in metadata
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });

    const metadata = tenant?.metadata as any;
    let customerId = metadata?.stripeCustomerId;

    if (customerId) {
      try {
        const customer = await this.stripe.customers.retrieve(customerId);
        if (customer && !('deleted' in customer)) {
          return customer as Stripe.Customer;
        }
      } catch (error) {
        // Customer doesn't exist, create new one
        console.log('[SubscriptionBilling] Stripe customer not found, creating new one');
      }
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      name: tenantName,
      metadata: {
        tenantId: tenantId,
      },
    });

    // Save customer ID to tenant metadata
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        metadata: {
          ...metadata,
          stripeCustomerId: customer.id,
        },
      },
    });

    return customer;
  }

  // ==================
  // BILLING PREVIEW
  // ==================

  /**
   * Preview subscription change (proration calculation)
   */
  async previewSubscriptionChange(
    tenantId: string,
    newTier: string,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<{
    currentTier: string;
    newTier: string;
    currentPrice: number;
    newPrice: number;
    proratedAmount: number;
    effectiveDate: Date;
    billingCycle: 'monthly' | 'annual';
  }> {
    // Get current tenant
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        billing_cycle_start: true,
        billing_cycle_end: true,
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const currentTier = tenant.subscription_tier || 'starter';
    
    // Get pricing for both tiers
    const [currentPricing, newPricing] = await Promise.all([
      this.getTierPricingByTier(currentTier),
      this.getTierPricingByTier(newTier),
    ]);

    if (!currentPricing || !newPricing) {
      throw new Error('Tier pricing not found');
    }

    const currentPrice = billingCycle === 'monthly' 
      ? currentPricing.monthlyPriceCents 
      : currentPricing.annualPriceCents;
    
    const newPrice = billingCycle === 'monthly' 
      ? newPricing.monthlyPriceCents 
      : newPricing.annualPriceCents;

    // Calculate proration if mid-cycle
    let proratedAmount = 0;
    const now = new Date();

    if (tenant.billing_cycle_start && tenant.billing_cycle_end) {
      const cycleStart = new Date(tenant.billing_cycle_start);
      const cycleEnd = new Date(tenant.billing_cycle_end);
      const totalDays = (cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24);
      const remainingDays = (cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (remainingDays > 0) {
        // Prorate the difference
        const dailyRate = (newPrice - currentPrice) / totalDays;
        proratedAmount = Math.round(dailyRate * remainingDays);
      }
    }

    return {
      currentTier,
      newTier,
      currentPrice,
      newPrice,
      proratedAmount,
      effectiveDate: now,
      billingCycle,
    };
  }

  // ==================
  // SUBSCRIPTION MANAGEMENT
  // ==================

  /**
   * Subscribe tenant to a tier (instant activation)
   */
  async subscribe(
    tenantId: string,
    tier: string,
    paymentMethodId: string,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<{
    success: boolean;
    tier: string;
    status: string;
    activatedAt: Date;
    invoiceId?: string;
    stripeSubscriptionId?: string;
    requiresAction?: boolean;
    clientSecret?: string;
    paypalApprovalUrl?: string;
    paypalSubscriptionId?: string;
    error?: string;
  }> {
    // Get pricing
    const pricing = await this.getTierPricingByTier(tier);
    if (!pricing) {
      throw new Error(`Tier pricing not found: ${tier}`);
    }

    const amount = billingCycle === 'monthly' 
      ? pricing.monthlyPriceCents 
      : pricing.annualPriceCents;

    // Free tier - no payment needed
    if (amount === 0) {
      await this.updateTenantTier(tenantId, tier);
      return {
        success: true,
        tier,
        status: 'active',
        activatedAt: new Date(),
      };
    }

    // Get payment method
    const paymentMethod = await this.getPaymentMethodById(paymentMethodId);
    if (!paymentMethod || paymentMethod.tenantId !== tenantId) {
      return {
        success: false,
        tier: tier,
        status: 'failed',
        activatedAt: new Date(),
        error: 'Payment method not found',
      };
    }

    // Charge via Stripe - Create Subscription for recurring billing
    if (paymentMethod.gatewayType === 'stripe' && this.stripe) {
      try {
        const tenant = await prisma.tenants.findUnique({
          where: { id: tenantId },
          select: { name: true, metadata: true },
        });

        const customer = await this.getOrCreateStripeCustomer(tenantId, tenant?.name || 'Unknown');

        // Attach payment method to customer for recurring charges
        await this.stripe.paymentMethods.attach(
          paymentMethod.paymentMethodToken,
          { customer: customer.id }
        );

        // Set as default payment method for customer
        await this.stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethod.paymentMethodToken,
          },
        });

        // Get or create Stripe Price for this tier
        const priceId = await this.getOrCreateStripePrice(tier, billingCycle, amount);

        // Create Stripe Subscription for automatic recurring billing
        const subscription = await this.stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          payment_settings: {
            payment_method_types: ['card'],
            save_default_payment_method: 'on_subscription',
          },
          expand: ['latest_invoice'],
          metadata: {
            tenantId,
            tier,
            billingCycle,
          },
        });

        // Check if payment succeeded immediately
        const invoice = subscription.latest_invoice as Stripe.Invoice;
        
        if (invoice && invoice.status === 'paid') {
          // Record platform revenue for subscription
          // Full subscription amount is platform revenue (SaaS subscription model)
          const gatewayFeeCents = Math.round(amount * 0.029 + 30); // Approximate Stripe fee
          
          try {
            const { stripeConnectService } = await import('../payments/StripeConnectService');
            const isActive = await stripeConnectService.isRevenueCollectionActive();
            if (isActive) {
              await stripeConnectService.recordRevenueTransaction({
                tenantId,
                transactionType: 'subscription',
                grossAmountCents: amount,
                platformFeeCents: amount, // Full subscription = platform revenue
                gatewayFeeCents,
                netAmountCents: amount - gatewayFeeCents, // Platform keeps all after gateway fees
                stripeTransactionId: subscription.id,
              });
              console.log('[Subscription] Recorded revenue transaction:', amount, 'cents platform revenue');
            }
          } catch (revenueError) {
            console.error('[Subscription] Failed to record revenue transaction:', revenueError);
            // Don't fail the subscription if revenue recording fails
          }

          // Payment succeeded immediately
          const invoiceId = await this.createInvoice(tenantId, tier, amount, subscription.id);
          await this.updateTenantTier(tenantId, tier, subscription.id);
          
          // Send payment success email
          try {
            const { getBillingNotificationService } = await import('./BillingNotificationService');
            await getBillingNotificationService().sendNotification({
              tenantId,
              type: 'payment_success',
              tier,
              amount,
              billingCycle,
              invoiceId,
            });
          } catch (emailError) {
            console.error('[SubscriptionBilling] Failed to send payment success email:', emailError);
          }
          
          return {
            success: true,
            tier,
            status: 'active',
            activatedAt: new Date(),
            invoiceId,
            stripeSubscriptionId: subscription.id,
          };
        } else if (invoice && invoice.status === 'open') {
          // Payment requires action (3D Secure, etc.)
          // Return client secret for frontend to handle
          const paymentIntent = await this.stripe.paymentIntents.retrieve(
            invoice.payment_intent as string
          );
          
          return {
            success: true,
            tier,
            status: 'pending',
            activatedAt: new Date(),
            requiresAction: true,
            clientSecret: paymentIntent.client_secret || undefined,
            stripeSubscriptionId: subscription.id,
          };
        } else {
          // Payment failed
          // Send payment failed email
          try {
            const { getBillingNotificationService } = await import('./BillingNotificationService');
            await getBillingNotificationService().sendNotification({
              tenantId,
              type: 'payment_failed',
              tier,
              amount,
              billingCycle,
              reason: `Invoice status: ${invoice?.status || 'unknown'}`,
            });
          } catch (emailError) {
            console.error('[SubscriptionBilling] Failed to send payment failed email:', emailError);
          }
          
          return {
            success: false,
            tier,
            status: 'failed',
            activatedAt: new Date(),
            error: `Invoice status: ${invoice?.status || 'unknown'}`,
          };
        }
      } catch (error: any) {
        console.error('[SubscriptionBilling] Stripe subscription failed:', error);
        return {
          success: false,
          tier,
          status: 'failed',
          activatedAt: new Date(),
          error: error.message,
        };
      }
    }

    // Charge via PayPal - Create Subscription for recurring billing
    if (paymentMethod.gatewayType === 'paypal') {
      try {
        const { payPalService } = await import('./PayPalService');
        
        // Create PayPal subscription for automatic recurring billing
        const result = await payPalService.createSubscription(
          tenantId,
          tier,
          amount,
          billingCycle
        );

        // Return approval URL for frontend to redirect
        return {
          success: true,
          tier,
          status: 'pending',
          activatedAt: new Date(),
          requiresAction: true,
          paypalApprovalUrl: result.approvalUrl,
          paypalSubscriptionId: result.subscriptionId,
        };
      } catch (error: any) {
        console.error('[SubscriptionBilling] PayPal subscription failed:', error);
        return {
          success: false,
          tier,
          status: 'failed',
          activatedAt: new Date(),
          error: error.message,
        };
      }
    }

    return {
      success: false,
      tier,
      status: 'failed',
      activatedAt: new Date(),
      error: 'Unsupported payment gateway',
    };
  }

  /**
   * Update tenant tier and billing cycle
   */
  async updateTenantTier(
    tenantId: string, 
    tier: string, 
    stripeSubscriptionId?: string,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<void> {
    const now = new Date();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const metadata: any = {};
    if (stripeSubscriptionId) {
      metadata.stripeSubscriptionId = stripeSubscriptionId;
    }

    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_tier: tier,
        subscription_status: 'active',
        status_changed_at: now,
        billing_cycle_start: now,
        billing_cycle_end: cycleEnd,
        ...(Object.keys(metadata).length > 0 && { metadata }),
      },
    });
  }

  /**
   * Get or create Stripe Price for a tier
   * Uses product/price lookup by metadata to avoid duplicates
   */
  async getOrCreateStripePrice(
    tier: string,
    billingCycle: 'monthly' | 'annual',
    amountCents: number
  ): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    // Look for existing product for this tier
    const productName = `VisibleShelf ${tier} tier`;
    const interval = billingCycle === 'monthly' ? 'month' : 'year';
    
    // Find existing product by metadata
    const products = await this.stripe.products.list({
      active: true,
      limit: 100,
    });
    
    let product = products.data.find(p => p.metadata?.tier === tier);
    
    if (!product) {
      // Create new product
      product = await this.stripe.products.create({
        name: productName,
        metadata: {
          tier,
          billingCycle,
        },
      });
    }

    // Find existing price for this product with matching interval
    const prices = await this.stripe.prices.list({
      product: product.id,
      active: true,
    });
    
    const existingPrice = prices.data.find(
      p => p.recurring?.interval === interval && p.unit_amount === amountCents
    );
    
    if (existingPrice) {
      return existingPrice.id;
    }

    // Create new price
    const price = await this.stripe.prices.create({
      product: product.id,
      unit_amount: amountCents,
      currency: 'usd',
      recurring: {
        interval: interval as 'month' | 'year',
      },
      metadata: {
        tier,
        billingCycle,
      },
    });

    return price.id;
  }

  /**
   * Charge a payment method directly (for trial conversion)
   * Returns success/failure without updating tier
   */
  async chargePaymentMethod(
    tenantId: string,
    paymentMethodId: string,
    amountCents: number,
    description: string
  ): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    // Get payment method
    const paymentMethod = await this.getPaymentMethodById(paymentMethodId);
    if (!paymentMethod || paymentMethod.tenantId !== tenantId) {
      return {
        success: false,
        error: 'Payment method not found',
      };
    }

    // Charge via Stripe
    if (paymentMethod.gatewayType === 'stripe' && this.stripe) {
      try {
        const tenant = await prisma.tenants.findUnique({
          where: { id: tenantId },
          select: { name: true },
        });

        const customer = await this.getOrCreateStripeCustomer(tenantId, tenant?.name || 'Unknown');

        // Create payment intent
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: amountCents,
          currency: 'usd',
          customer: customer.id,
          payment_method: paymentMethod.paymentMethodToken,
          confirm: true,
          metadata: {
            tenantId,
            description,
          },
        });

        if (paymentIntent.status === 'succeeded') {
          return {
            success: true,
            transactionId: paymentIntent.id,
          };
        } else {
          return {
            success: false,
            error: `Payment status: ${paymentIntent.status}`,
          };
        }
      } catch (error: any) {
        console.error('[SubscriptionBilling] Stripe charge failed:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }

    // PayPal not supported for direct charges (requires order flow)
    if (paymentMethod.gatewayType === 'paypal') {
      return {
        success: false,
        error: 'PayPal requires order flow, use saved card instead',
      };
    }

    return {
      success: false,
      error: 'Unsupported payment gateway',
    };
  }

  /**
   * Create invoice record
   */
  async createInvoice(
    tenantId: string,
    tier: string,
    amountCents: number,
    transactionId: string
  ): Promise<string> {
    const now = new Date();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const id = generateInvoiceId(tenantId);

    // Create invoice using Prisma
    await prisma.subscription_invoices.create({
      data: {
        id,
        tenant_id: tenantId,
        tier,
        billing_period_start: now,
        billing_period_end: cycleEnd,
        amount_cents: amountCents,
        status: 'paid',
        due_date: now,
        paid_at: now,
        created_at: now,
      },
    });

    // Create payment record
    const paymentId = generateSubscriptionPaymentId(id);
    await prisma.subscription_payments.create({
      data: {
        id: paymentId,
        invoice_id: id,
        gateway_type: 'stripe',
        transaction_id: transactionId,
        amount_cents: amountCents,
        status: 'succeeded',
        created_at: now,
      },
    });

    // Send branded invoice email
    this.sendInvoiceEmail(tenantId, id, tier, amountCents, 'paid', now, now, cycleEnd).catch(error => {
      console.error('[SubscriptionBillingService] Failed to send invoice email:', error);
    });

    return id;
  }

  /**
   * Send branded invoice email notification
   */
  private async sendInvoiceEmail(
    tenantId: string,
    invoiceId: string,
    tier: string,
    amountCents: number,
    status: 'paid' | 'pending' | 'overdue' | 'cancelled',
    billingPeriodStart: Date,
    billingPeriodEnd: Date,
    paymentDate?: Date
  ): Promise<void> {
    try {
      // Get tenant information
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          organization_id: true,
        },
      });

      if (!tenant) {
        console.error(`[SubscriptionBillingService] Tenant not found: ${tenantId}`);
        return;
      }

      // Get tenant owner for email
      const userTenant = await prisma.user_tenants.findFirst({
        where: { 
          tenant_id: tenantId,
          role: 'OWNER'
        },
      } as any);

      if (!userTenant) {
        console.error(`[SubscriptionBillingService] No owner found for tenant: ${tenantId}`);
        return;
      }

      // Get user details separately
      const user = await prisma.users.findUnique({
        where: { id: userTenant.user_id },
        select: {
          email: true,
          name: true,
        },
      } as any);

      if (!user) {
        console.error(`[SubscriptionBillingService] No user found for tenant owner: ${userTenant.user_id}`);
        return;
      }

      // Import and use the InvoiceEmailService
      const { InvoiceEmailService } = await import('../email/InvoiceEmailService');
      const invoiceEmailService = new InvoiceEmailService();

      await invoiceEmailService.sendInvoiceNotification({
        customerEmail: (user as any).email,
        customerName: (user as any).name,
        tenantName: tenant.name,
        invoiceId,
        amount: amountCents,
        currency: 'USD',
        dueDate: billingPeriodEnd,
        status,
        billingPeriodStart,
        billingPeriodEnd,
        tier,
        paymentDate,
        paymentMethod: 'Stripe',
      });

      console.log(`[SubscriptionBillingService] Invoice email sent to ${(user as any).email} for invoice ${invoiceId}`);
    } catch (error) {
      console.error('[SubscriptionBillingService] Error sending invoice email:', error);
      throw error;
    }
  }

  /**
   * Get payment method by ID
   */
  private async getPaymentMethodById(id: string): Promise<BillingPaymentMethod | null> {
    const method = await prisma.merchant_billing_gateways.findUnique({
      where: { id },
    });
    
    if (!method) return null;
    
    return this.mapPaymentMethodRow({
      id: method.id,
      tenant_id: method.tenant_id,
      gateway_type: method.gateway_type as BillingGatewayType,
      payment_method_token: method.payment_method_token || '',
      card_last4: method.card_last4,
      card_brand: method.card_brand,
      expiry_month: method.expiry_month,
      expiry_year: method.expiry_year,
      is_default: method.is_default || false,
      is_active: method.is_active || false,
      created_at: method.created_at || new Date(),
    });
  }

  // ==================
  // INVOICES
  // ==================

  /**
   * Get invoices for a tenant
   */
  async getInvoices(tenantId: string, options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Array<{
    id: string;
    tier: string;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    amountCents: number;
    status: string;
    dueDate: Date | null;
    paidAt: Date | null;
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
    const where: any = { tenant_id: tenantId };
    if (options?.status) {
      where.status = options.status;
    }

    const invoices = await prisma.subscription_invoices.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      include: {
        subscription_payments: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    return invoices.map(inv => ({
      id: inv.id,
      tier: inv.tier,
      billingPeriodStart: inv.billing_period_start,
      billingPeriodEnd: inv.billing_period_end,
      amountCents: inv.amount_cents,
      status: inv.status || 'pending',
      dueDate: inv.due_date,
      paidAt: inv.paid_at,
      createdAt: inv.created_at || new Date(),
      payments: inv.subscription_payments.map(pay => ({
        id: pay.id,
        gatewayType: pay.gateway_type,
        transactionId: pay.transaction_id || '',
        amountCents: pay.amount_cents,
        status: pay.status || 'pending',
        createdAt: pay.created_at || new Date(),
      })),
    }));
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoiceById(invoiceId: string, tenantId: string): Promise<{
    id: string;
    tier: string;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
    amountCents: number;
    status: string;
    dueDate: Date | null;
    paidAt: Date | null;
    createdAt: Date;
    payments: Array<{
      id: string;
      gatewayType: string;
      transactionId: string;
      amountCents: number;
      status: string;
      failureReason: string | null;
      createdAt: Date;
    }>;
  } | null> {
    const invoice = await prisma.subscription_invoices.findFirst({
      where: { id: invoiceId, tenant_id: tenantId },
      include: {
        subscription_payments: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!invoice) return null;

    return {
      id: invoice.id,
      tier: invoice.tier,
      billingPeriodStart: invoice.billing_period_start,
      billingPeriodEnd: invoice.billing_period_end,
      amountCents: invoice.amount_cents,
      status: invoice.status || 'pending',
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      createdAt: invoice.created_at || new Date(),
      payments: invoice.subscription_payments.map(pay => ({
        id: pay.id,
        gatewayType: pay.gateway_type,
        transactionId: pay.transaction_id || '',
        amountCents: pay.amount_cents,
        status: pay.status || 'pending',
        failureReason: pay.failure_reason,
        createdAt: pay.created_at || new Date(),
      })),
    };
  }
}

// Singleton instance
let instance: SubscriptionBillingService | null = null;

export function getSubscriptionBillingService(): SubscriptionBillingService {
  if (!instance) {
    instance = new SubscriptionBillingService();
  }
  return instance;
}

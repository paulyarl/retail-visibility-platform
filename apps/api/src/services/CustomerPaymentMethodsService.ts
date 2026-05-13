/**
 * Customer Payment Methods Service
 * 
 * Manages saved payment methods for customer accounts.
 * Scoped per customer per tenant — a customer may have different cards
 * on different tenants since each tenant has its own Stripe/PayPal account.
 * 
 * Features:
 * - List payment methods (all or filtered by tenant)
 * - Add payment method (Stripe PaymentMethod attach, PayPal billing agreement)
 * - Set default payment method per tenant
 * - Remove payment method (Stripe detach, local delete)
 * - Track usage (last_used_at, usage_count)
 */

import { prisma } from '../prisma';
import { generateCustomerPaymentMethodId } from '../lib/id-generator';
import Stripe from 'stripe';

// ==================
// TYPES
// ==================

export type GatewayType = 'stripe' | 'paypal' | 'square' | 'clover';
export type PaymentMethodType = 'card' | 'paypal' | 'wallet' | 'bank_account';

export interface CustomerPaymentMethod {
  id: string;
  customerId: string;
  tenantId: string;
  gatewayType: GatewayType;
  paymentMethodToken: string | null;
  type: PaymentMethodType;
  cardLast4: string | null;
  cardBrand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  cardFunding: string | null;
  cardCountry: string | null;
  paypalEmail: string | null;
  paypalAccountId: string | null;
  walletType: string | null;
  isDefault: boolean;
  isActive: boolean;
  lastUsedAt: Date | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AddPaymentMethodInput {
  tenantId: string;
  gatewayType: GatewayType;
  paymentMethodToken: string;
  type?: PaymentMethodType;
  cardLast4?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: string;
  paypalEmail?: string;
  paypalAccountId?: string;
  walletType?: string;
}

// Raw DB row type (snake_case)
interface CustomerPaymentMethodRow {
  id: string;
  customer_id: string;
  tenant_id: string;
  gateway_type: string;
  payment_method_token: string | null;
  type: string;
  card_last4: string | null;
  card_brand: string | null;
  expiry_month: number | null;
  expiry_year: number | null;
  card_funding: string | null;
  card_country: string | null;
  paypal_email: string | null;
  paypal_account_id: string | null;
  wallet_type: string | null;
  is_default: boolean;
  is_active: boolean;
  last_used_at: Date | null;
  usage_count: number;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export class CustomerPaymentMethodsService {
  private static instance: CustomerPaymentMethodsService;
  private stripe: Stripe | null = null;

  private constructor() {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2023-10-16' as any,
      });
    }
  }

  static getInstance(): CustomerPaymentMethodsService {
    if (!CustomerPaymentMethodsService.instance) {
      CustomerPaymentMethodsService.instance = new CustomerPaymentMethodsService();
    }
    return CustomerPaymentMethodsService.instance;
  }

  // ==================
  // MAPPING
  // ==================

  private mapRow(row: CustomerPaymentMethodRow): CustomerPaymentMethod {
    return {
      id: row.id,
      customerId: row.customer_id,
      tenantId: row.tenant_id,
      gatewayType: row.gateway_type as GatewayType,
      paymentMethodToken: row.payment_method_token,
      type: row.type as PaymentMethodType,
      cardLast4: row.card_last4,
      cardBrand: row.card_brand,
      expiryMonth: row.expiry_month,
      expiryYear: row.expiry_year,
      cardFunding: row.card_funding,
      cardCountry: row.card_country,
      paypalEmail: row.paypal_email,
      paypalAccountId: row.paypal_account_id,
      walletType: row.wallet_type,
      isDefault: row.is_default,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Mask sensitive data for API responses
   */
  maskForResponse(method: CustomerPaymentMethod) {
    return {
      id: method.id,
      tenantId: method.tenantId,
      gatewayType: method.gatewayType,
      type: method.type,
      cardLast4: method.cardLast4,
      cardBrand: method.cardBrand,
      expiryMonth: method.expiryMonth,
      expiryYear: method.expiryYear,
      cardFunding: method.cardFunding,
      walletType: method.walletType,
      isDefault: method.isDefault,
      isActive: method.isActive,
      lastUsedAt: method.lastUsedAt,
      usageCount: method.usageCount,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    };
  }

  // ==================
  // LIST
  // ==================

  /**
   * Get all active payment methods for a customer
   * Optionally filtered by tenantId
   */
  async getPaymentMethods(customerId: string, tenantId?: string): Promise<CustomerPaymentMethod[]> {
    const where: any = {
      customer_id: customerId,
      is_active: true,
    };
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    const rows = await prisma.customer_payment_methods.findMany({
      where,
      orderBy: [
        { is_default: 'desc' as const },
        { last_used_at: 'desc' as const },
        { created_at: 'desc' as const },
      ],
    });

    return rows.map(row => this.mapRow(row as unknown as CustomerPaymentMethodRow));
  }

  /**
   * Get a single payment method by ID (with ownership check)
   */
  async getPaymentMethod(customerId: string, paymentMethodId: string): Promise<CustomerPaymentMethod | null> {
    const row = await prisma.customer_payment_methods.findFirst({
      where: { id: paymentMethodId, customer_id: customerId, is_active: true },
    });

    if (!row) return null;
    return this.mapRow(row as unknown as CustomerPaymentMethodRow);
  }

  /**
   * Get the default payment method for a customer on a specific tenant
   */
  async getDefaultPaymentMethod(customerId: string, tenantId: string): Promise<CustomerPaymentMethod | null> {
    const row = await prisma.customer_payment_methods.findFirst({
      where: { customer_id: customerId, tenant_id: tenantId, is_default: true, is_active: true },
    });

    if (!row) return null;
    return this.mapRow(row as unknown as CustomerPaymentMethodRow);
  }

  // ==================
  // ADD
  // ==================

  /**
   * Add a payment method for a customer on a specific tenant
   * For Stripe: attaches PaymentMethod to the tenant's Stripe customer, then stores locally
   */
  async addPaymentMethod(customerId: string, input: AddPaymentMethodInput): Promise<CustomerPaymentMethod> {
    // Verify customer exists
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, email: true },
    });
    if (!customer) {
      throw new Error('Customer not found');
    }

    let cardLast4 = input.cardLast4;
    let cardBrand = input.cardBrand;
    let expiryMonth = input.expiryMonth;
    let expiryYear: number | null = input.expiryYear ? parseInt(input.expiryYear) : null;
    let cardFunding: string | null = null;
    let cardCountry: string | null = null;
    let methodType: PaymentMethodType = input.type || 'card';

    // For Stripe: get or create a Stripe customer on the tenant's Stripe account,
    // then attach the PaymentMethod
    if (input.gatewayType === 'stripe' && this.stripe) {
      try {
        // Get or create Stripe customer for this customer+tenant combination
        const stripeCustomer = await this.getOrCreateStripeCustomer(customerId, input.tenantId, customer.email);

        // Attach payment method to Stripe customer
        await this.stripe.paymentMethods.attach(input.paymentMethodToken, {
          customer: stripeCustomer.id,
        });

        // Retrieve payment method details from Stripe
        const pm = await this.stripe.paymentMethods.retrieve(input.paymentMethodToken);

        if (pm.card) {
          cardLast4 = pm.card.last4;
          cardBrand = pm.card.brand;
          expiryMonth = pm.card.exp_month;
          expiryYear = pm.card.exp_year;
          cardFunding = pm.card.funding;
          cardCountry = pm.card.country;
          methodType = 'card';
        } else if (pm.type === 'link') {
          methodType = 'wallet';
        }
      } catch (stripeError: any) {
        console.error('[CustomerPaymentMethods] Stripe error:', stripeError.message);

        if (stripeError.message?.includes('No such PaymentMethod')) {
          throw new Error(
            'Stripe configuration mismatch: Frontend and backend are using different Stripe accounts. ' +
            'Ensure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY are from the same Stripe account.'
          );
        }
        throw stripeError;
      }
    }

    // Check if this is the first payment method for this customer+tenant (make it default)
    const existingMethods = await this.getPaymentMethods(customerId, input.tenantId);
    const isDefault = existingMethods.length === 0;

    // Check for duplicate PayPal accounts
    if (input.gatewayType === 'paypal' && input.paypalAccountId) {
      const existingPayPal = existingMethods.find(
        m => m.gatewayType === 'paypal' && m.paypalAccountId === input.paypalAccountId
      );
      if (existingPayPal) {
        return existingPayPal; // Already registered
      }
    }

    // Create the payment method record
    const id = generateCustomerPaymentMethodId(customerId);

    const row = await prisma.customer_payment_methods.create({
      data: {
        id,
        customer_id: customerId,
        tenant_id: input.tenantId,
        gateway_type: input.gatewayType,
        payment_method_token: input.paymentMethodToken,
        type: methodType,
        card_last4: cardLast4 || null,
        card_brand: cardBrand || null,
        expiry_month: expiryMonth || null,
        expiry_year: expiryYear || null,
        card_funding: cardFunding,
        card_country: cardCountry,
        paypal_email: input.paypalEmail || null,
        paypal_account_id: input.paypalAccountId || null,
        wallet_type: input.walletType || null,
        is_default: isDefault,
        is_active: true,
        usage_count: 0,
        metadata: {},
      },
    });

    return this.mapRow(row as unknown as CustomerPaymentMethodRow);
  }

  // ==================
  // DEFAULT
  // ==================

  /**
   * Set a payment method as default for its tenant scope
   * Unsets any existing default for the same customer+tenant
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    // Get the method to find its tenant_id
    const method = await prisma.customer_payment_methods.findFirst({
      where: { id: paymentMethodId, customer_id: customerId, is_active: true },
    });

    if (!method) {
      throw new Error('Payment method not found');
    }

    // Unset current default for this customer+tenant
    await prisma.customer_payment_methods.updateMany({
      where: {
        customer_id: customerId,
        tenant_id: method.tenant_id,
      },
      data: { is_default: false },
    });

    // Set new default
    await prisma.customer_payment_methods.update({
      where: { id: paymentMethodId },
      data: { is_default: true, updated_at: new Date() },
    });

    // If Stripe, also update the Stripe customer's default
    if (method.gateway_type === 'stripe' && this.stripe && method.payment_method_token) {
      try {
        const stripeCustomer = await this.findStripeCustomer(customerId, method.tenant_id);
        if (stripeCustomer) {
          await this.stripe.customers.update(stripeCustomer.id, {
            invoice_settings: {
              default_payment_method: method.payment_method_token,
            },
          });
        }
      } catch (error: any) {
        console.error('[CustomerPaymentMethods] Failed to update Stripe default:', error.message);
        // Don't fail the operation — local default is what matters
      }
    }
  }

  // ==================
  // REMOVE
  // ==================

  /**
   * Remove (soft-delete) a payment method
   * For Stripe: detaches the PaymentMethod from the Stripe customer
   */
  async removePaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const method = await prisma.customer_payment_methods.findFirst({
      where: { id: paymentMethodId, customer_id: customerId },
    });

    if (!method) {
      throw new Error('Payment method not found');
    }

    // For Stripe: detach the payment method from the customer
    if (method.gateway_type === 'stripe' && this.stripe && method.payment_method_token) {
      try {
        await this.stripe.paymentMethods.detach(method.payment_method_token);
      } catch (error: any) {
        console.error('[CustomerPaymentMethods] Failed to detach Stripe payment method:', error.message);
        // Continue — local record is what matters
      }
    }

    // Soft-delete (set is_active = false)
    await prisma.customer_payment_methods.update({
      where: { id: paymentMethodId },
      data: { is_active: false, updated_at: new Date() },
    });

    // If this was the default, promote another method
    if (method.is_default) {
      const remaining = await this.getPaymentMethods(customerId, method.tenant_id);
      if (remaining.length > 0) {
        await this.setDefaultPaymentMethod(customerId, remaining[0].id);
      }
    }
  }

  // ==================
  // USAGE TRACKING
  // ==================

  /**
   * Record that a payment method was used for a transaction
   * Called by the checkout/order service after successful payment
   */
  async recordUsage(customerId: string, paymentMethodId: string): Promise<void> {
    await prisma.customer_payment_methods.update({
      where: { id: paymentMethodId, customer_id: customerId },
      data: {
        last_used_at: new Date(),
        usage_count: { increment: 1 },
        updated_at: new Date(),
      },
    });
  }

  // ==================
  // SETUP INTENT (PCI-compliant card saving)
  // ==================

  /**
   * Create a Stripe SetupIntent for saving a card without charging it.
   * Returns a client_secret for the frontend to confirm with Stripe.js.
   * 
   * Flow:
   * 1. Frontend calls this endpoint → gets client_secret
   * 2. Frontend uses stripe.confirmSetup({ client_secret, payment_method }) 
   * 3. Frontend calls POST /api/customer-payment-methods with the resulting paymentMethodToken
   */
  async createSetupIntent(customerId: string, tenantId: string): Promise<{
    clientSecret: string;
    stripeCustomerId: string;
  }> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    // Verify customer exists
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: { id: true, email: true },
    });
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get or create Stripe customer for this customer+tenant
    const stripeCustomer = await this.getOrCreateStripeCustomer(customerId, tenantId, customer.email);

    // Create SetupIntent — confirms the payment method is valid without charging
    const setupIntent = await this.stripe.setupIntents.create({
      customer: stripeCustomer.id,
      usage: 'off_session', // Allows using the saved method for future payments without customer present
      metadata: {
        platform_customer_id: customerId,
        tenant_id: tenantId,
      },
    });

    return {
      clientSecret: setupIntent.client_secret!,
      stripeCustomerId: stripeCustomer.id,
    };
  }

  // ==================
  // CHECKOUT INTEGRATION
  // ==================

  /**
   * Get Stripe customer ID and default payment method token for checkout.
   * Used by the checkout flow to charge a saved payment method.
   */
  async getStripeCustomerForCheckout(customerId: string, tenantId: string): Promise<{
    stripeCustomerId: string | null;
    defaultPaymentMethodToken: string | null;
  }> {
    const stripeCustomer = await this.findStripeCustomer(customerId, tenantId);
    if (!stripeCustomer) {
      return { stripeCustomerId: null, defaultPaymentMethodToken: null };
    }

    const defaultMethod = await this.getDefaultPaymentMethod(customerId, tenantId);

    return {
      stripeCustomerId: stripeCustomer.id,
      defaultPaymentMethodToken: defaultMethod?.paymentMethodToken || null,
    };
  }

  /**
   * Get all saved payment method tokens for a customer+tenant (for checkout selection).
   * Returns only the data needed by the Stripe PaymentIntent creation.
   */
  async getPaymentMethodTokensForCheckout(customerId: string, tenantId: string): Promise<Array<{
    id: string;
    token: string;
    isDefault: boolean;
    displayInfo: string;
  }>> {
    const methods = await this.getPaymentMethods(customerId, tenantId);

    return methods.map(m => {
      let displayInfo = '';
      if (m.type === 'card' && m.cardLast4) {
        displayInfo = `${m.cardBrand || 'Card'} •••• ${m.cardLast4}`;
        if (m.expiryMonth && m.expiryYear) {
          displayInfo += ` (${m.expiryMonth}/${m.expiryYear})`;
        }
      } else if (m.type === 'paypal' && m.paypalEmail) {
        displayInfo = `PayPal ${m.paypalEmail}`;
      } else if (m.type === 'wallet' && m.walletType) {
        displayInfo = m.walletType;
      } else {
        displayInfo = m.type;
      }

      return {
        id: m.id,
        token: m.paymentMethodToken || '',
        isDefault: m.isDefault,
        displayInfo,
      };
    });
  }

  // ==================
  // CARD EXPIRY DETECTION
  // ==================

  /**
   * Check for expired or soon-to-expire cards.
   * Returns payment methods that are expired or expiring within the given months window.
   */
  async getExpiringPaymentMethods(customerId: string, monthsAhead: number = 2): Promise<CustomerPaymentMethod[]> {
    const now = new Date();
    const threshold = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);

    const rows = await prisma.customer_payment_methods.findMany({
      where: {
        customer_id: customerId,
        is_active: true,
        type: 'card',
        expiry_year: { not: null },
        expiry_month: { not: null },
      },
    });

    const methods = rows.map(row => this.mapRow(row as unknown as CustomerPaymentMethodRow));

    return methods.filter(m => {
      if (!m.expiryMonth || !m.expiryYear) return false;
      // Card expires at end of the month, so compare against start of next month
      const expiresAt = new Date(m.expiryYear, m.expiryMonth, 1);
      return expiresAt <= threshold;
    });
  }

  // ==================
  // STRIPE HELPERS
  // ==================

  /**
   * Get or create a Stripe customer for this customer+tenant combination
   * Stores the Stripe customer ID in the metadata field
   */
  private async getOrCreateStripeCustomer(
    customerId: string,
    tenantId: string,
    email: string
  ): Promise<Stripe.Customer> {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    // Check if we already have a Stripe customer for this customer+tenant
    const existing = await this.findStripeCustomer(customerId, tenantId);
    if (existing) {
      return existing;
    }

    // Create new Stripe customer
    const stripeCustomer = await this.stripe.customers.create({
      email,
      metadata: {
        platform_customer_id: customerId,
        tenant_id: tenantId,
      },
    });

    // Store the Stripe customer ID in our customer metadata for future lookups
    // We use the customer's metadata JSONB field
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: { metadata: true },
    });

    const metadata = (customer?.metadata as Record<string, any>) || {};
    if (!metadata.stripeCustomers) {
      metadata.stripeCustomers = {};
    }
    metadata.stripeCustomers[tenantId] = stripeCustomer.id;

    await prisma.customers.update({
      where: { id: customerId },
      data: { metadata },
    });

    return stripeCustomer;
  }

  /**
   * Find an existing Stripe customer for this customer+tenant
   */
  private async findStripeCustomer(
    customerId: string,
    tenantId: string
  ): Promise<Stripe.Customer | null> {
    if (!this.stripe) return null;

    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: { metadata: true },
    });

    const metadata = (customer?.metadata as Record<string, any>) || {};
    const stripeCustomerId = metadata?.stripeCustomers?.[tenantId];

    if (!stripeCustomerId) return null;

    try {
      const retrieved = await this.stripe.customers.retrieve(stripeCustomerId);
      // retrieve returns Customer | DeletedCustomer; only return if not deleted
      if (retrieved.deleted) return null;
      return retrieved as Stripe.Customer;
    } catch {
      return null;
    }
  }
}

export default CustomerPaymentMethodsService;

import Stripe from 'stripe';
import {
  PaymentGatewayInterface,
  PaymentMethod,
  PaymentResult,
  RefundResult,
  GatewayCredentials,
} from '../PaymentGatewayInterface';

export class StripeGateway extends PaymentGatewayInterface {
  private stripe: Stripe;

  constructor(credentials: GatewayCredentials, isTestMode: boolean = false) {
    super(credentials, isTestMode);
    
    this.stripe = new Stripe(credentials.apiKey, {
      apiVersion: '2025-10-29.clover',
      typescript: true,
    });
  }

  getGatewayName(): string {
    return 'stripe';
  }

  async authorize(
    amount: number,
    currency: string,
    paymentMethod: PaymentMethod,
    metadata?: Record<string, any>
  ): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount), // Stripe expects amount in cents
        currency: currency.toLowerCase(),
        payment_method: paymentMethod.token,
        capture_method: 'manual', // Authorize only, don't capture
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: metadata || {},
      });

      // Calculate Stripe fee (estimated: 2.9% + 30¢)
      const feeCents = Math.round(amount * 0.029 + 30);
      const netAmountCents = amount - feeCents;

      return {
        success: paymentIntent.status === 'requires_capture',
        transactionId: paymentIntent.id,
        authorizationId: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status === 'requires_capture' ? 'authorized' : 'pending',
        gatewayResponse: paymentIntent,
        gatewayFeeCents: feeCents,
        netAmountCents,
      };
    } catch (error: any) {
      return {
        success: false,
        amount,
        currency,
        status: 'failed',
        gatewayResponse: error,
        error: error.message || 'Authorization failed',
      };
    }
  }

  async capture(
    authorizationId: string,
    amount?: number
  ): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.capture(
        authorizationId,
        amount ? { amount_to_capture: Math.round(amount) } : undefined
      );

      const capturedAmount = paymentIntent.amount_received || paymentIntent.amount;
      const feeCents = Math.round(capturedAmount * 0.029 + 30);
      const netAmountCents = capturedAmount - feeCents;

      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id,
        authorizationId: paymentIntent.id,
        amount: capturedAmount,
        currency: paymentIntent.currency.toUpperCase(),
        status: paymentIntent.status === 'succeeded' ? 'captured' : 'pending',
        gatewayResponse: paymentIntent,
        gatewayFeeCents: feeCents,
        netAmountCents,
      };
    } catch (error: any) {
      return {
        success: false,
        amount: amount || 0,
        currency: 'USD',
        status: 'failed',
        gatewayResponse: error,
        error: error.message || 'Capture failed',
      };
    }
  }

  async charge(
    amount: number,
    currency: string,
    paymentMethod: PaymentMethod,
    metadata?: Record<string, any>
  ): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency: currency.toLowerCase(),
        payment_method: paymentMethod.token,
        capture_method: 'automatic', // Capture immediately
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: metadata || {},
      });

      const feeCents = Math.round(amount * 0.029 + 30);
      const netAmountCents = amount - feeCents;

      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status === 'succeeded' ? 'captured' : 'pending',
        gatewayResponse: paymentIntent,
        gatewayFeeCents: feeCents,
        netAmountCents,
      };
    } catch (error: any) {
      return {
        success: false,
        amount,
        currency,
        status: 'failed',
        gatewayResponse: error,
        error: error.message || 'Charge failed',
      };
    }
  }

  async refund(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: transactionId,
        amount: amount ? Math.round(amount) : undefined,
        reason: reason as Stripe.RefundCreateParams.Reason | undefined,
      });

      return {
        success: refund.status === 'succeeded' || refund.status === 'pending',
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency.toUpperCase(),
        status: refund.status === 'succeeded' ? 'completed' : 'pending',
        gatewayResponse: refund,
      };
    } catch (error: any) {
      return {
        success: false,
        refundId: '',
        amount: amount || 0,
        currency: 'USD',
        status: 'failed',
        gatewayResponse: error,
        error: error.message || 'Refund failed',
      };
    }
  }

  async getStatus(transactionId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);

      const amount = paymentIntent.amount_received || paymentIntent.amount;
      const feeCents = Math.round(amount * 0.029 + 30);
      const netAmountCents = amount - feeCents;

      let status: PaymentResult['status'] = 'pending';
      if (paymentIntent.status === 'succeeded') {
        status = 'captured';
      } else if (paymentIntent.status === 'requires_capture') {
        status = 'authorized';
      } else if (paymentIntent.status === 'canceled') {
        status = 'failed';
      }

      return {
        success: true,
        transactionId: paymentIntent.id,
        authorizationId: paymentIntent.id,
        amount,
        currency: paymentIntent.currency.toUpperCase(),
        status,
        gatewayResponse: paymentIntent,
        gatewayFeeCents: feeCents,
        netAmountCents,
      };
    } catch (error: any) {
      return {
        success: false,
        amount: 0,
        currency: 'USD',
        status: 'failed',
        gatewayResponse: error,
        error: error.message || 'Failed to get status',
      };
    }
  }

  validateWebhook(payload: string | Buffer, signature: string): boolean {
    if (!this.credentials.webhookSecret) {
      console.error('[Stripe] Webhook secret not configured');
      return false;
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.credentials.webhookSecret
      );
      return !!event;
    } catch (error: any) {
      console.error('[Stripe] Webhook validation failed:', error.message);
      return false;
    }
  }

  /**
   * Create a payment method from card details
   */
  async createPaymentMethod(cardDetails: {
    number: string;
    exp_month: number;
    exp_year: number;
    cvc: string;
  }): Promise<{ success: boolean; paymentMethodId?: string; error?: string }> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: 'card',
        card: cardDetails,
      });

      return {
        success: true,
        paymentMethodId: paymentMethod.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create payment method',
      };
    }
  }

  /**
   * Create a customer in Stripe
   */
  async createCustomer(email: string, metadata?: Record<string, any>): Promise<{
    success: boolean;
    customerId?: string;
    error?: string;
  }> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        metadata: metadata || {},
      });

      return {
        success: true,
        customerId: customer.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create customer',
      };
    }
  }
}

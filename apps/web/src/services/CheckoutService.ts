/**
 * Checkout Service
 * 
 * Handles checkout operations including order creation and payment intent generation
 * Uses TenantApiSingleton for authenticated checkout operations
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface ShippingAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CreateOrderRequest {
  tenantId: string;
  customerInfo: CustomerInfo;
  shippingAddress?: ShippingAddress;
  fulfillmentMethod?: string;
  cartItems: any[];
  paymentMethod: string;
}

export interface CreateOrderResponse {
  orderId: string;
  paymentId: string;
  orderNumber?: string;
}

export interface CreatePaymentIntentRequest {
  orderId: string;
  paymentId: string;
  amount: number;
  customerInfo: CustomerInfo;
  cartItems: any[];
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

class CheckoutService extends TenantApiSingleton {
  private static instance: CheckoutService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'checkout-service*',
      'checkout-orders*',
      'checkout-intents*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('checkout-service*');
    await this.invalidateCachePattern('checkout-orders*');
    await this.invalidateCachePattern('checkout-intents*');
  }

  private constructor() {
    super('checkout-service', {
      ttl: 0 // No caching for checkout operations
    });
  }

  public static getInstance(): CheckoutService {
    if (!CheckoutService.instance) {
      CheckoutService.instance = new CheckoutService();
    }
    return CheckoutService.instance;
  }

  /**
   * Create an order and payment record
   * Uses the /api/checkout/create-order endpoint
   */
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse | null> {
    try {
      const result = await this.makeDefaultRequest<CreateOrderResponse>(
        '/api/checkout/create-order',
        {
          method: 'POST',
          body: JSON.stringify(request)
        },
        `checkout-order-${request.tenantId}-${Date.now()}`
      );

      if (!result.success) {
        console.error('[CheckoutService] Failed to create order:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[CheckoutService] Create order error:', error);
      return null;
    }
  }

  /**
   * Create a Stripe payment intent
   * Uses the /api/checkout/stripe/create-payment-intent endpoint
   */
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse | null> {
    try {
      const result = await this.makeDefaultRequest<CreatePaymentIntentResponse>(
        '/api/checkout/stripe/create-payment-intent',
        {
          method: 'POST',
          body: JSON.stringify(request)
        },
        `checkout-intent-${request.orderId}-${Date.now()}`
      );

      if (!result.success) {
        console.error('[CheckoutService] Failed to create payment intent:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[CheckoutService] Create payment intent error:', error);
      return null;
    }
  }

  /**
   * Combined checkout flow - create order and payment intent in sequence
   */
  async initiateCheckout(
    tenantId: string,
    amount: number,
    customerInfo: CustomerInfo,
    cartItems: any[],
    options: {
      shippingAddress?: ShippingAddress;
      fulfillmentMethod?: string;
    } = {}
  ): Promise<{ orderId: string; paymentId: string; clientSecret: string } | null> {
    // Step 1: Create order
    const orderResponse = await this.createOrder({
      tenantId,
      customerInfo,
      shippingAddress: options.shippingAddress,
      fulfillmentMethod: options.fulfillmentMethod,
      cartItems,
      paymentMethod: 'stripe',
    });

    if (!orderResponse) {
      return null;
    }

    // Step 2: Create payment intent
    const intentResponse = await this.createPaymentIntent({
      orderId: orderResponse.orderId,
      paymentId: orderResponse.paymentId,
      amount,
      customerInfo,
      cartItems,
    });

    if (!intentResponse) {
      return null;
    }

    return {
      orderId: orderResponse.orderId,
      paymentId: orderResponse.paymentId,
      clientSecret: intentResponse.clientSecret,
    };
  }
}

// Export singleton instance
export const checkoutService = CheckoutService.getInstance();

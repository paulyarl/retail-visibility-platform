/**
 * Checkout Service
 * 
 * Handles checkout operations including order creation and payment intent generation
 * Uses PublicApiSingleton for public/guest checkout operations (no authentication required)
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

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
  checkoutMode?: 'deposit' | 'full_payment';
}

export interface CreateOrderResponse {
  orderId: string;
  paymentId: string;
  orderNumber?: string;
  paymentAmount?: number;
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

class CheckoutService extends PublicApiSingleton {
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
   * Uses the /api/checkout/orders endpoint
   */
  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse | null> {
    try {
      // Transform request to match API expected format
      const apiRequest = {
        customer: {
          email: request.customerInfo.email,
          name: `${request.customerInfo.firstName} ${request.customerInfo.lastName}`.trim(),
          firstName: request.customerInfo.firstName,
          lastName: request.customerInfo.lastName,
          phone: request.customerInfo.phone,
        },
        items: request.cartItems.map(item => ({
          id: item.id,
          tenantId: item.tenantId,
          sku: item.sku,  
          quantity: item.quantity,
        })),
        shipping_address: request.shippingAddress,
        fulfillment_method: request.fulfillmentMethod,
        payment_method: request.paymentMethod,
        checkout_mode: request.checkoutMode,
      };

      const result = await this.makeDefaultRequest<{
        success: boolean;
        order: {
          id: string;
          order_number: string;
        };
        payment: {
          id: string;
          amount_cents?: number;
        };
      }>(
        '/api/checkout/orders',
        {
          method: 'POST',
          body: JSON.stringify(apiRequest)
        },
        `checkout-order-${request.tenantId}-${Date.now()}`
      );

      if (!result.success) {
        console.error('[CheckoutService] Failed to create order:', result.error);
        return null;
      }

      // Transform API response to match service interface
      const data = result.data;
      if (!data?.order || !data?.payment) {
        console.error('[CheckoutService] Invalid response structure:', data);
        return null;
      }

      return {
        orderId: data.order.id,
        paymentId: data.payment.id,
        orderNumber: data.order.order_number,
        paymentAmount: data.payment.amount_cents,
      };
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
      const result = await this.makeDefaultRequest<{
        success: boolean;
        clientSecret: string;
        paymentIntentId: string;
        platformFee?: number;
      }>(
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

      const data = result.data;
      if (!data?.clientSecret || !data?.paymentIntentId) {
        console.error('[CheckoutService] Invalid payment intent response:', data);
        return null;
      }

      return {
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
      };
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
      checkoutMode?: 'deposit' | 'full_payment';
    } = {}
  ): Promise<{ orderId: string; paymentId: string; clientSecret: string; paymentAmount?: number } | null> {
    // Step 1: Create order
    // console.log('[CheckoutService] initiateCheckout - creating order with data:', {
    //   tenantId,
    //   customerInfo,
    //   shippingAddress: options.shippingAddress,
    //   fulfillmentMethod: options.fulfillmentMethod,
    //   cartItems,
    //   paymentMethod: 'stripe'
    // });
    const orderResponse = await this.createOrder({
      tenantId,
      customerInfo,
      shippingAddress: options.shippingAddress,
      fulfillmentMethod: options.fulfillmentMethod,
      cartItems,
      paymentMethod: 'stripe',
      checkoutMode: options.checkoutMode,
    });

    if (!orderResponse) {
      return null;
    }

    // Step 2: Create payment intent using backend-calculated amount
    const intentResponse = await this.createPaymentIntent({
      orderId: orderResponse.orderId,
      paymentId: orderResponse.paymentId,
      amount: orderResponse.paymentAmount ?? amount,
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
      paymentAmount: orderResponse.paymentAmount,
    };
  }

  /**
   * Confirm a successful Stripe payment
   * Uses the /api/checkout/stripe/confirm-payment endpoint
   */
  async confirmStripePayment(paymentIntentId: string, clientSecret?: string): Promise<{
    orderId: string;
    paymentMethodId?: string;
    cardLast4?: string;
    cardBrand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    funnelNextStep?: {
      funnelId: string;
      stepId: string;
      step: {
        id: string;
        step_type: string;
        offer_item_id: string;
        display_title: string | null;
        display_description: string | null;
        price_cents: number | null;
        discount_cents: number;
        sort_order: number;
      };
    } | null;
  } | null> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        orderId: string;
        paymentMethodId?: string;
        cardLast4?: string;
        cardBrand?: string;
        expiryMonth?: number;
        expiryYear?: number;
        funnelNextStep?: {
          funnelId: string;
          stepId: string;
          step: {
            id: string;
            step_type: string;
            offer_item_id: string;
            display_title: string | null;
            display_description: string | null;
            price_cents: number | null;
            discount_cents: number;
            sort_order: number;
          };
        } | null;
      }>(
        '/api/checkout/stripe/confirm-payment',
        {
          method: 'POST',
          body: JSON.stringify({
            paymentIntentId,
            clientSecret,
          })
        },
        `stripe-confirm-${paymentIntentId}`
      );

      if (!result.success) {
        console.error('[CheckoutService] Failed to confirm payment:', result.error);
        return null;
      }

      return {
        orderId: result.data?.orderId || '',
        paymentMethodId: result.data?.paymentMethodId,
        cardLast4: result.data?.cardLast4,
        cardBrand: result.data?.cardBrand,
        expiryMonth: result.data?.expiryMonth,
        expiryYear: result.data?.expiryYear,
        funnelNextStep: result.data?.funnelNextStep || null,
      };
    } catch (error) {
      console.error('[CheckoutService] Confirm payment error:', error);
      return null;
    }
  }

  /**
   * Get order details by order ID
   * Uses the /api/checkout/orders/:orderId endpoint
   */
  async getOrder(orderId: string): Promise<{
    id: string;
    order_number: string;
    tenant_id: string;
    customer_email?: string;
    customer_phone?: string;
    customer_name?: string;
    total_cents: number;
    order_items?: any[];
    created_at: string;
  } | null> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        order: {
          id: string;
          order_number: string;
          tenant_id: string;
          customer_email?: string;
          customer_phone?: string;
          customer_name?: string;
          total_cents: number;
          order_items?: any[];
          created_at: string;
        };
      }>(
        `/api/checkout/orders/${orderId}`,
        {
          method: 'GET',
        },
        `order-${orderId}`
      );

      if (!result.success || !result.data?.order) {
        console.error('[CheckoutService] Failed to get order:', result.error);
        return null;
      }

      return result.data.order;
    } catch (error) {
      console.error('[CheckoutService] Get order error:', error);
      return null;
    }
  }

  async calculateTax(payload: {
    tenant_id: string;
    subtotal_cents: number;
    shipping_cents: number;
    shipping_address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    line_items: { amountCents: number; reference: string }[];
  }): Promise<number> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; tax?: { tax_cents: number } }>(
        `/api/tax/calculate`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      if (!result.success) return 0;
      if (!result.data?.success) return 0;
      return result.data.tax?.tax_cents || 0;
    } catch {
      return 0;
    }
  }

  async trackCart(payload: {
    tenantId: string;
    cartId: string;
    customerEmail?: string;
    customerName?: string;
    customerId?: string;
    items: any[];
  }): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/cart/track`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
    } catch {
      // Silent fail — tracking is best-effort
    }
  }
}

// Export singleton instance
export const checkoutService = CheckoutService.getInstance();

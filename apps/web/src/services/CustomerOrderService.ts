/**
 * Customer Order Service
 * Handles customer order processing for public pages
 * Uses PublicApiSingleton for automatic caching and API integration
 */

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

export interface CustomerOrder {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  fulfillmentStatus: string;
  fulfillmentMethod: 'pickup' | 'delivery' | 'shipping' | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  itemCount: number;
  items: CustomerOrderItem[];
  createdAt: string;
  paidAt: string;
  trackingNumber?: string;
  shippingAddress: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  payment?: {
    id: string;
    gatewayTransactionId: string;
    method: string;
    amount: number;
    status: string;
  };
  refunds?: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string;
    gatewayRefundId?: string;
    createdAt: string;
    completedAt?: string;
  }>;
  paymentId: string | null;
  gatewayTransactionId: string | null;
  tenantId: string;
  tenantName: string;
  tenantLogo: string | null;
  status: string;
  orderDate: string;
  platformFee: number;
  fulfillmentFee: number;
  shippingProvider?: string;
  customerInfo: {
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
  };
}

export interface CustomerOrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
}

export interface PaymentGateway {
  id: string;
  name: string;
  type: 'paypal' | 'square' | 'stripe';
  isActive: boolean;
  config?: Record<string, any>;
}

export interface OrderRequest {
  tenantId: string;
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  fulfillmentMethod: 'pickup' | 'delivery' | 'shipping';
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  paymentMethod: string;
}

class CustomerOrderService extends PublicApiSingleton {
  private static instance: CustomerOrderService;

  private constructor() {
    super('customer-order-service');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for order data
  }

  static getInstance(): CustomerOrderService {
    if (!CustomerOrderService.instance) {
      CustomerOrderService.instance = new CustomerOrderService();
    }
    return CustomerOrderService.instance;
  }

  /**
   * Get available payment gateways for a tenant
   * Public endpoint for checkout page
   */
  async getPaymentGateways(tenantId: string): Promise<PaymentGateway[]> {
    try {
      const response = await this.makePublicRequest<{
        success: boolean;
        gateways: PaymentGateway[];
      }>(
        `/api/tenants/${tenantId}/payment-gateways/public`,
        {},
        `payment-gateways-${tenantId}`
      );

      return response.gateways || [];
    } catch (error) {
      console.error('[CustomerOrderService] Failed to get payment gateways:', error);
      return [];
    }
  }

  /**
   * Create an order from cart
   * Public endpoint for customer checkout
   */
  async createOrder(orderRequest: OrderRequest): Promise<CustomerOrder | null> {
    try {
      const response = await this.makePublicRequest<{
        success: boolean;
        order: CustomerOrder;
      }>(
        '/api/orders/create',
        {
          method: 'POST',
          body: JSON.stringify(orderRequest)
        },
        `create-order-${orderRequest.tenantId}`
      );

      return response.order || null;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to create order:', error);
      return null;
    }
  }

  /**
   * Get order details for customer
   * Public endpoint for order tracking
   */
  async getOrder(orderId: string, email?: string): Promise<CustomerOrder | null> {
    try {
      const url = email 
        ? `/api/orders/${orderId}?email=${encodeURIComponent(email)}`
        : `/api/orders/${orderId}`;
      
      const response = await this.makePublicRequest<{
        success: boolean;
        order: CustomerOrder;
      }>(url, {}, `order-${orderId}`);

      return response.order || null;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to get order:', error);
      return null;
    }
  }

  /**
   * Get customer's order history
   * Public endpoint for customer orders
   */
  async getCustomerOrders(customerEmail: string, page: number = 1, limit: number = 10): Promise<{
    orders: CustomerOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const response = await this.makePublicRequest<{
        success: boolean;
        orders: CustomerOrder[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>(
        `/api/orders/customer/${encodeURIComponent(customerEmail)}?page=${page}&limit=${limit}`,
        {},
        `customer-orders-${customerEmail}-${page}-${limit}`
      );

      return {
        orders: response.orders || [],
        pagination: response.pagination || {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      };
    } catch (error) {
      console.error('[CustomerOrderService] Failed to get customer orders:', error);
      return {
        orders: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      };
    }
  }

  /**
   * Update order payment status
   * Public endpoint for payment callbacks
   */
  async updatePaymentStatus(orderId: string, paymentData: {
    gatewayTransactionId: string;
    status: string;
    amount: number;
  }): Promise<boolean> {
    try {
      await this.makePublicRequest<void>(
        `/api/orders/${orderId}/payment`,
        {
          method: 'PUT',
          body: JSON.stringify(paymentData)
        },
        `payment-status-${orderId}`
      );

      return true;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to update payment status:', error);
      return false;
    }
  }

  /**
   * Get order downloads
   * Public endpoint for digital product downloads
   */
  async getOrderDownloads(orderId: string): Promise<any> {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/download/orders/${orderId}/downloads`,
        {},
        `order-downloads-${orderId}`
      );

      return response;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to get order downloads:', error);
      return null;
    }
  }

  /**
   * Get payment details by payment ID
   * Public endpoint for order confirmation
   */
  async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      if (!paymentId) {
        throw new Error('Payment ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/api/checkout/payments/${paymentId}`,
        {},
        `payment-details-${paymentId}`
      );

      return response;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to get payment details:', error);
      return null;
    }
  }

  /**
   * Create PayPal order for checkout
   * Public endpoint for PayPal payment processing
   */
  async createPayPalOrder(orderData: {
    orderId: string;
    paymentId: string;
    amount: number;
    customerInfo: any;
    shippingAddress?: any;
    cartItems: any[];
  }): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/checkout/paypal/create-order',
        {
          method: 'POST',
          body: JSON.stringify(orderData)
        },
        `paypal-order-${orderData.orderId}`
      );

      return response;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to create PayPal order:', error);
      return null;
    }
  }

  /**
   * Capture PayPal order payment
   * Public endpoint for PayPal payment completion
   */
  async capturePayPalOrder(orderData: {
    orderId: string;
    paymentId: string;
    paypalOrderId: string;
  }): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/checkout/paypal/capture-order',
        {
          method: 'POST',
          body: JSON.stringify(orderData)
        },
        `paypal-capture-${orderData.orderId}`
      );

      return response;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to capture PayPal order:', error);
      return null;
    }
  }

  /**
   * Create checkout order (general)
   * Public endpoint for checkout order creation
   */
  async createCheckoutOrder(orderData: {
    customerInfo: any;
    cartItems: any[];
    fulfillmentMethod: string;
    shippingAddress?: any;
    paymentMethod: string;
  }): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/checkout/orders',
        {
          method: 'POST',
          body: JSON.stringify(orderData)
        },
        `checkout-order-${orderData.paymentMethod}`
      );

      return response;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to create checkout order:', error);
      return null;
    }
  }

  /**
   * Process Square payment
   * Public endpoint for Square payment processing
   */
  async processSquarePayment(paymentData: {
    orderId: string;
    paymentId: string;
    sourceId: string;
    amount: number;
    customerInfo: any;
    shippingAddress?: any;
    cartItems: any[];
  }): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/checkout/square/process-payment',
        {
          method: 'POST',
          body: JSON.stringify(paymentData)
        },
        `square-payment-${paymentData.orderId}`
      );

      return response;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to process Square payment:', error);
      return null;
    }
  }

  /**
   * Create Square payment charge
   * Public endpoint for Square payment charge creation
   */
  async createSquareCharge(paymentData: {
    orderId: string;
    paymentId: string;
    amount: number;
    sourceId: string;
    customerInfo: any;
    shippingAddress?: any;
    cartItems: any[];
  }): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/checkout/payments/charge',
        {
          method: 'POST',
          body: JSON.stringify(paymentData)
        },
        `square-charge-${paymentData.orderId}`
      );

      return response;
    } catch (error) {
      console.error('[CustomerOrderService] Failed to create Square charge:', error);
      return null;
    }
  }
}

// Export singleton instance
export const customerOrderService = CustomerOrderService.getInstance();

/**
 * Customer Order Service
 * Handles customer order processing for customer pages
 * Uses CustomerApiSingleton for automatic JWT auth and caching
 */

import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';
import { customerAuthService } from './CustomerAuthService';
import { clientLogger } from '@/lib/client-logger';

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
  fulfilledAt?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
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
  cancellationReason?: string;
  // Deposit order fields
  checkoutMode?: 'deposit' | 'full_payment';
  depositCents?: number;
  remainingBalanceCents?: number;
  pickupDeadline?: string | null;
  depositForfeitedAt?: string | null;
  depositPercentage?: number | null;
  statusHistory?: any[];
}

export interface CustomerOrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string | null;
  productType?: 'physical' | 'digital' | 'hybrid' | 'service';
  digitalDeliveryStatus?: string;
  digitalDeliveredAt?: string;
  itemId?: string;
}

export interface CustomerDownload {
  grantId: string;
  orderId: string;
  orderNumber: string | null;
  orderDate: string | null;
  productName: string | null;
  productSku: string | null;
  productImage: string | null;
  accessToken: string;
  downloadCount: number;
  maxDownloads: number | null;
  downloadsRemaining: number | null;
  accessExpiresAt: string | null;
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
  licenseKey: string | null;
  status: string;
  createdAt: string;
}

export interface PaymentGateway {
  id: string;
  name: string;
  type: 'paypal' | 'square' | 'stripe';
  isActive: boolean;
  config?: Record<string, any>;
  // Tier 3 Commitment - tenant tier for deposit checkout mode detection
  tenant_tier?: string;
  // V2 Feature-based commerce mode detection
  commerce_features?: string[];
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

class CustomerOrderService extends CustomerApiSingleton {
  private static instance: CustomerOrderService;

  private constructor() {
    super('customer-order-service');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for order data
  }

  getServiceCachePatterns(): string[] {
    return ['payment-gateways', 'create-order', 'order-', 'customer-orders-', 'checkout-order'];
  }

  async invalidateServiceCaches(customerId?: string): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): CustomerOrderService {
    if (!CustomerOrderService.instance) {
      CustomerOrderService.instance = new CustomerOrderService();
    }
    return CustomerOrderService.instance;
  }

  /**
   * Get available payment gateways for a tenant
   */
  async getPaymentGateways(tenantId: string): Promise<{ gateways: PaymentGateway[]; tenant_tier: string | null; commerce_features: string[] }> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      gateways: PaymentGateway[];
      tenant_tier: string | null;
      commerce_features: string[];
    }>(
      `/api/tenants/${tenantId}/payment-gateways/public`,
      {},
      `payment-gateways-${tenantId}`
    );

    if (!response.success) {
      clientLogger.error('[CustomerOrderService] Failed to get payment gateways:', { detail: response.error });
      return { gateways: [], tenant_tier: null, commerce_features: [] };
    }

    return {
      gateways: response.data?.gateways || [],
      tenant_tier: response.data?.tenant_tier || null,
      commerce_features: response.data?.commerce_features || [],
    };
  }

  /**
   * Create an order from cart
   * Public endpoint for customer checkout
   */
  async createOrder(orderRequest: OrderRequest): Promise<CustomerOrder | null> {
    const response = await this.makeDefaultRequest<{
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

    if (!response.success) {
      clientLogger.error('[CustomerOrderService] Failed to create order:', { detail: response.error });
      return null;
    }

    return response.data?.order || null;
  }

  /**
   * Get order details for customer
   * Public endpoint for order tracking
   */
  async getOrder(orderId: string, email?: string): Promise<CustomerOrder | null> {
    const url = email 
      ? `/api/orders/${orderId}?email=${encodeURIComponent(email)}`
      : `/api/orders/${orderId}`;
    
    const response = await this.makeDefaultRequest<{
      success: boolean;
      order: any;
    }>(url, {}, `order-${orderId}`);

    if (!response.success) {
      clientLogger.error('[CustomerOrderService] Failed to get order:', { detail: response.error });
      return null;
    }

    const o = response.data?.order;
    if (!o) return null;

    return {
      ...o,
      orderStatus: o.orderStatus || o.status,
      orderNumber: o.orderNumber || o.order_number,
      createdAt: o.createdAt || o.orderDate || o.created_at,
      paidAt: o.paidAt || o.paid_at,
      fulfillmentStatus: o.fulfillmentStatus || o.fulfillment_status,
      fulfillmentMethod: o.fulfillmentMethod || o.fulfillment_method,
      customerEmail: o.customerEmail || o.customerInfo?.email || o.customer_email,
      customerName: o.customerName || (o.customerInfo ? `${o.customerInfo.firstName} ${o.customerInfo.lastName}`.trim() : o.customer_name),
      customerPhone: o.customerPhone || o.customerInfo?.phone || o.customer_phone,
      total: (o.total ?? o.total_cents) / 100,
      subtotal: (o.subtotal ?? o.subtotal_cents) / 100,
      shipping: (o.shipping ?? o.shipping_cents ?? o.fulfillmentFee ?? 0) / 100,
      tax: (o.tax ?? o.tax_cents ?? 0) / 100,
      itemCount: o.itemCount ?? o.item_count,
      items: (o.items || o.order_items || []).map((item: any) => ({
        ...item,
        name: item.name || item.inventory_items?.name,
        sku: item.sku || item.inventory_items?.sku,
        imageUrl: item.imageUrl || item.image_url || item.inventory_items?.image_url,
        unitPrice: (item.unitPrice ?? item.unit_price_cents ?? 0) / 100,
        productType: item.productType || item.product_type || item.inventory_items?.product_type || 'physical',
        digitalDeliveryStatus: item.digitalDeliveryStatus || item.digital_delivery_status || undefined,
        digitalDeliveredAt: item.digitalDeliveredAt || item.digital_delivered_at || undefined,
      })),
      shippingAddress: o.shippingAddress || (o.shipping_address_line1 ? {
        addressLine1: o.shipping_address_line1,
        addressLine2: o.shipping_address_line2,
        city: o.shipping_city,
        state: o.shipping_state,
        postalCode: o.shipping_postal_code,
        country: o.shipping_country,
      } : null),
    } as CustomerOrder;
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
    const response = await this.makeDefaultRequest<{
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

    if (!response.success) {
      clientLogger.error('[CustomerOrderService] Failed to get customer orders:', { detail: response.error });
      return {
        orders: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      };
    }

    const rawOrders = response.data?.orders || [];
    return {
      orders: rawOrders.map((o: any) => ({
        ...o,
        orderStatus: o.orderStatus || o.status,
        orderNumber: o.orderNumber || o.order_number,
        createdAt: o.createdAt || o.orderDate || o.created_at,
        paidAt: o.paidAt || o.paid_at,
        fulfillmentStatus: o.fulfillmentStatus || o.fulfillment_status,
        fulfillmentMethod: o.fulfillmentMethod || o.fulfillment_method,
        customerEmail: o.customerEmail || o.customerInfo?.email || o.customer_email,
        customerName: o.customerName || (o.customerInfo ? `${o.customerInfo.firstName} ${o.customerInfo.lastName}`.trim() : o.customer_name),
        customerPhone: o.customerPhone || o.customerInfo?.phone || o.customer_phone,
        total: (o.total ?? o.total_cents) / 100,
        subtotal: (o.subtotal ?? o.subtotal_cents) / 100,
        shipping: (o.shipping ?? o.shipping_cents ?? o.fulfillmentFee ?? 0) / 100,
        tax: (o.tax ?? o.tax_cents ?? 0) / 100,
        itemCount: o.itemCount ?? o.item_count,
        items: (o.items || []).map((item: any) => ({
          ...item,
          name: item.name || item.inventory_items?.name,
          sku: item.sku || item.inventory_items?.sku,
          imageUrl: item.imageUrl || item.image_url || item.inventory_items?.image_url,
          unitPrice: (item.unitPrice ?? item.unit_price_cents ?? 0) / 100,
          productType: item.productType || item.product_type || item.inventory_items?.product_type || 'physical',
          digitalDeliveryStatus: item.digitalDeliveryStatus || item.digital_delivery_status || undefined,
          digitalDeliveredAt: item.digitalDeliveredAt || item.digital_delivered_at || undefined,
          itemId: item.inventory_items?.id || item.itemId,
        })),
        shippingAddress: o.shippingAddress || (o.shipping_address_line1 ? {
          addressLine1: o.shipping_address_line1,
          addressLine2: o.shipping_address_line2,
          city: o.shipping_city,
          state: o.shipping_state,
          postalCode: o.shipping_postal_code,
          country: o.shipping_country,
        } : null),
      })),
      pagination: response.data?.pagination || {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    };
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
      const response = await this.makeDefaultRequest<void>(
        `/api/orders/${orderId}/payment`,
        {
          method: 'PUT',
          body: JSON.stringify(paymentData)
        },
        `payment-status-${orderId}`
      );

      if (!response.success){
          clientLogger.error('[CustomerOrderService] Failed to update payment status:', { detail: response.error });
      return false;
      }

      return true;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to update payment status:', { detail: error });
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

      const response = await this.makeDefaultRequest<any>(
        `/api/download/orders/${orderId}/downloads`,
        {},
        `order-downloads-${orderId}`
      );
      if (!response.success){
          clientLogger.error('[CustomerOrderService] Failed to get order downloads:', { detail: response.error });
      return null;
      }

      return response;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to get order downloads:', { detail: error });
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

      const response = await this.makeDefaultRequest<any>(
        `/api/checkout/payments/${paymentId}`,
        {},
        `payment-details-${paymentId}`
      );
      if (!response.success){
          clientLogger.error('[CustomerOrderService] Failed to get payment details:', { detail: response.error });
      return null;
      }

      return response;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to get payment details:', { detail: error });
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
      const response = await this.makeDefaultRequest<any>(
        '/api/checkout/paypal/create-order',
        {
          method: 'POST',
          body: JSON.stringify(orderData)
        },
        `paypal-order-${orderData.orderId}`
      );
      if (!response.success){
          clientLogger.error('[CustomerOrderService] Failed to create PayPal order:', { detail: response.error });
      return null;
      }

      return response;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to create PayPal order:', { detail: error });
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
      const response = await this.makeDefaultRequest<any>(
        '/api/checkout/paypal/capture-order',
        {
          method: 'POST',
          body: JSON.stringify(orderData)
        },
        `paypal-capture-${orderData.orderId}`
      );
      if (!response.success){
          clientLogger.error('[CustomerOrderService] Failed to capture PayPal order:', { detail: response.error });
      return null;
      }

      return response;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to capture PayPal order:', { detail: error });
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
    checkoutMode?: 'deposit' | 'full_payment';
  }): Promise<any> {
    try {
      // Map frontend format to API expected format
      // console.log('[CustomerOrderService] createCheckoutOrder - orderData:', orderData);
      // Include customer_id if logged in so order is linked to account
      const customer = customerAuthService.getCustomer();
      const apiPayload = {
        customer: {
          email: orderData.customerInfo.email,
          firstName: orderData.customerInfo.firstName,
          lastName: orderData.customerInfo.lastName,
          phone: orderData.customerInfo.phone,
        },
        items: orderData.cartItems.map((item: any) => ({
          id: item.inventoryItemId || item.id,
          sku: item.sku,
          name: item.name,
          tenant_id: item.tenantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        fulfillment_method: orderData.fulfillmentMethod,
        shipping_address: orderData.shippingAddress,
        payment_method: orderData.paymentMethod,
        checkout_mode: orderData.checkoutMode,
        customer_id: customer?.id || undefined,
      };

      const response = await this.makeDefaultRequest<any>(
        '/api/checkout/orders',
        {
          method: 'POST',
          body: JSON.stringify(apiPayload),
        },
        `checkout-order-${orderData.paymentMethod}`
      );
      if (!response.success){
          clientLogger.error('[CustomerOrderService] Failed to create checkout order:', { detail: response.error });
      return null;
      }

      return response;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to create checkout order:', { detail: error });
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
      const response = await this.makeDefaultRequest<any>(
        '/api/checkout/square/process-payment',
        {
          method: 'POST',
          body: JSON.stringify(paymentData)
        },
        `square-payment-${paymentData.orderId}`
      );
      if (!response.success){
          clientLogger.error('[CustomerOrderService] Failed to process Square payment:', { detail: response.error });
      return null;
      }

      return response;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to process Square payment:', { detail: error });
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
      const response = await this.makeDefaultRequest<any>(
        '/api/checkout/payments/charge',
        {
          method: 'POST',
          body: JSON.stringify(paymentData)
        },
        `square-charge-${paymentData.orderId}`
      );
      if (!response.success){
          clientLogger.error('[CustomerOrderService] Failed to create Square charge:', { detail: response.error });
      return null;
      }

      return response;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to create Square charge:', { detail: error });
      return null;
    }
  }

  /**
   * Get buyer orders
   * Public endpoint for order history lookup by email or phone
   */
  async getBuyerOrders(params: {
    email?: string;
    phone?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params.email) searchParams.append('email', params.email);
      if (params.phone) searchParams.append('phone', params.phone);
      if (params.page) searchParams.append('page', params.page.toString());
      if (params.limit) searchParams.append('limit', params.limit.toString());

      const response = await this.makeDefaultRequest<any>(
        `/api/orders/buyer?${searchParams.toString()}`,
        {},
        `buyer-orders-${params.email || 'anonymous'}-${params.phone || 'anonymous'}-${params.page || 1}`
      );

      return response.data;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to get buyer orders:', { detail: error });
      return null;
    }
  }

  /**
   * Get customer's digital downloads
   * Public endpoint for retrieving active digital access grants
   */
  async getCustomerDownloads(email: string): Promise<CustomerDownload[]> {
    try {
      const response = await this.makeDefaultRequest<{
        success: boolean;
        downloads: CustomerDownload[];
        count: number;
      }>(
        `/api/orders/downloads/${encodeURIComponent(email)}`,
        {},
        `customer-downloads-${email}`
      );

      if (!response.success) {
        clientLogger.error('[CustomerOrderService] Failed to get customer downloads:', { detail: response.error });
        return [];
      }

      return response.data?.downloads || [];
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to get customer downloads:', { detail: error });
      return [];
    }
  }

  /**
   * Confirm order fulfillment (pickup, delivery, or shipping)
   * Public endpoint for buyers to confirm they received the order
   */
  async confirmPickup(orderId: string, email?: string, phone?: string): Promise<{ success: boolean; fulfilledAt?: string }> {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      const response = await this.makeDefaultRequest<{ success: boolean; order: { fulfilledAt: string } }>(
        `/api/orders/${orderId}/pickup`,
        {
          method: 'PATCH',
          body: JSON.stringify({ email, phone })
        },
        `pickup-confirm-${orderId}`
      );

      return {
        success: response.success,
        fulfilledAt: response.data?.order?.fulfilledAt
      };
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to confirm fulfillment:', { detail: error });
      return { success: false };
    }
  }

  /**
   * Cancel order
   * Public endpoint for buyers to cancel an order before fulfillment
   */
  async cancelOrder(orderId: string, cancellationReason: string, email?: string, phone?: string): Promise<boolean> {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/orders/${orderId}/cancel`,
        {
          method: 'PATCH',
          body: JSON.stringify({ cancellationReason, email, phone })
        },
        `order-cancel-${orderId}`
      );

      return true;
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to cancel order:', { detail: error });
      return false;
    }
  }

  /**
   * Get service bookings for a specific order
   */
  async getOrderServiceBookings(orderId: string): Promise<ServiceBooking[]> {
    try {
      const response = await this.makeDefaultRequest<{ success: boolean; data: ServiceBooking[] }>(
        `/api/orders/${orderId}/service-bookings`,
        {},
        `order-service-bookings-${orderId}`
      );
      return response.data?.data || [];
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to fetch order service bookings:', { detail: error });
      return [];
    }
  }

  /**
   * Get all service bookings for a customer across all orders
   */
  async getCustomerServiceBookings(email: string): Promise<ServiceBooking[]> {
    try {
      const response = await this.makeDefaultRequest<{ success: boolean; data: ServiceBooking[] }>(
        `/api/orders/customer/${encodeURIComponent(email)}/service-bookings`,
        {},
        `customer-service-bookings-${email}`
      );
      return response.data?.data || [];
    } catch (error) {
      clientLogger.error('[CustomerOrderService] Failed to fetch customer service bookings:', { detail: error });
      return [];
    }
  }
}

export interface ServiceBooking {
  id: string;
  order_id: string;
  order_item_id: string;
  tenant_id: string;
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number;
  provider_id: string | null;
  provider_name: string | null;
  service_location: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Export singleton instance
export const customerOrderService = CustomerOrderService.getInstance();
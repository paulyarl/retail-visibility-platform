/**
 * Tenant Order Service
 * Handles tenant order management for merchants
 * Uses TenantApiSingleton for tenant-specific order operations
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface TenantOrder {
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
  discount?: number;
  total: number;
  itemCount: number;
  items: TenantOrderItem[];
  createdAt: string;
  paidAt: string;
  trackingNumber?: string;
  shippingAddress?: any;
  billingAddress?: any;
  internalNotes?: string;
  notes?: string;
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
  archived?: boolean;
}

export interface TenantOrderItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total?: number;
  imageUrl?: string;
  productId: string;
}

export interface OrderFilters {
  status?: string;
  fulfillmentStatus?: string;
  fulfillmentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  fulfilledOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}

export interface FulfillmentUpdate {
  fulfillmentStatus: string;
  trackingNumber?: string;
  carrier?: string;
  notes?: string;
  cancellationReason?: string;
}

class TenantOrderService extends TenantApiSingleton {
  private static instance: TenantOrderService;

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 10 * 60 * 1000, // 10 minutes cache for order data
      ...cacheOptions
    });
  }

  static getInstance(): TenantOrderService {
    if (!TenantOrderService.instance) {
      TenantOrderService.instance = new TenantOrderService('tenant-order-service');
    }
    return TenantOrderService.instance;
  }

  /**
   * Get orders for a tenant with filtering
   * Authenticated endpoint for merchant dashboard
   */
  async getOrders(tenantId: string, filters: OrderFilters & { page?: number; limit?: number } = {}): Promise<{
    orders: TenantOrder[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const params = new URLSearchParams();
      
      if (filters.page) params.set('page', filters.page.toString());
      if (filters.limit) params.set('limit', filters.limit.toString());
      if (filters.status) params.set('status', filters.status);
      if (filters.fulfillmentStatus) params.set('fulfillmentStatus', filters.fulfillmentStatus);
      if (filters.fulfillmentMethod) params.set('fulfillmentMethod', filters.fulfillmentMethod);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.search) params.set('search', filters.search);

      const queryString = params.toString();
      const endpoint = `/api/tenants/${tenantId}/orders${queryString ? `?${queryString}` : ''}`;
      const cacheKey = `tenant-orders-${tenantId}-${queryString}`;

      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        data: {
          orders: TenantOrder[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        };
      }>(endpoint, {}, cacheKey);

      console.log('[TenantOrderService] API Response:', response);

      return {
        orders: response.data?.data?.orders || [],
        pagination: response.data?.data?.pagination || {
          page: filters.page || 1,
          limit: filters.limit || 10,
          total: 0,
          totalPages: 0
        }
      };
    } catch (error) {
      console.error('[TenantOrderService] Failed to get orders:', error);
      return {
        orders: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    }
  }

  /**
   * Get specific order details for tenant
   * Authenticated endpoint for order management
   */
  async getOrder(tenantId: string, orderId: string): Promise<TenantOrder | null> {
    try {
      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        order: TenantOrder;
      }>(
        `/api/tenants/${tenantId}/orders/${orderId}`,
        {},
        `tenant-order-${tenantId}-${orderId}`
      );

      return response.data?.order || null;
    } catch (error) {
      console.error('[TenantOrderService] Failed to get order:', error);
      return null;
    }
  }

  /**
   * Update order fulfillment status
   * Authenticated endpoint for order fulfillment
   */
  async updateFulfillment(tenantId: string, orderId: string, update: FulfillmentUpdate): Promise<TenantOrder | null> {
    try {
      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        order: TenantOrder;
      }>(
        `/api/tenants/${tenantId}/orders/${orderId}/fulfillment`,
        {
          method: 'PUT',
          body: JSON.stringify(update)
        },
        `fulfillment-update-${tenantId}-${orderId}`
      );

      return response.data?.order || null;
    } catch (error) {
      console.error('[TenantOrderService] Failed to update fulfillment:', error);
      return null;
    }
  }

  /**
   * Archive/unarchive an order
   * Authenticated endpoint for order management
   */
  async archiveOrder(tenantId: string, orderId: string, archived: boolean): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest<void>(
        `/api/tenants/${tenantId}/orders/${orderId}/archive`,
        {
          method: 'PUT',
          body: JSON.stringify({ archived })
        },
        `archive-order-${tenantId}-${orderId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantOrderService] Failed to archive order:', error);
      return false;
    }
  }

  /**
   * Get order statistics for tenant dashboard
   * Authenticated endpoint for analytics
   */
  async getOrderStats(tenantId: string, period?: '7d' | '30d' | '90d' | '1y'): Promise<OrderStats> {
    try {
      const periodParam = period ? `?period=${period}` : '';
      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        stats: OrderStats;
      }>(
        `/api/tenants/${tenantId}/orders/stats${periodParam}`,
        {},
        `order-stats-${tenantId}-${period || 'default'}`
      );

      return response.data?.stats || {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        fulfilledOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0
      };
    } catch (error) {
      console.error('[TenantOrderService] Failed to get order stats:', error);
      return {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        fulfilledOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0
      };
    }
  }

  /**
   * Get fulfillment settings for a tenant
   * Authenticated endpoint for order fulfillment
   */
  async getFulfillmentSettings(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        settings: any;
      }>(
        `/api/tenants/${tenantId}/fulfillment-settings`,
        {},
        `tenant-fulfillment-settings-${tenantId}`,
        this.cacheTTL
      );

      return response?.data?.settings || null;
    } catch (error) {
      console.error('[TenantOrderService] Failed to get fulfillment settings:', error);
      return null;
    }
  }

  /**
   * Update order fulfillment status
   * Authenticated endpoint for order management
   */
  async updateOrderFulfillment(tenantId: string, orderId: string, fulfillmentData: {
    fulfillmentStatus?: string;
    cancellationReason?: string;
    trackingNumber?: string;
    [key: string]: any;
  }): Promise<any> {
    try {
      if (!tenantId || !orderId) {
        throw new Error('Tenant ID and Order ID are required');
      }

      const response = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/orders/${orderId}/fulfillment`,
        {
          method: 'PUT',
          body: JSON.stringify(fulfillmentData)
        },
        `tenant-order-fulfillment-${tenantId}-${orderId}`
      );

      return response;
    } catch (error) {
      console.error('[TenantOrderService] Failed to update order fulfillment:', error);
      return null;
    }
  }

  /**
   * Process refund for an order
   * Authenticated endpoint for refund management
   */
  async processRefund(tenantId: string, orderId: string, refundData: {
    amount: number;
    reason: string;
    items?: Array<{
      orderItemId: string;
      quantity: number;
      refundAmount: number;
    }>;
  }): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest<void>(
        `/api/tenants/${tenantId}/orders/${orderId}/refund`,
        {
          method: 'POST',
          body: JSON.stringify(refundData)
        },
        `refund-${tenantId}-${orderId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantOrderService] Failed to process refund:', error);
      return false;
    }
  }

  /**
   * Export orders to CSV
   * Uses the /api/tenants/:tenantId/orders/export endpoint
   */
  async exportOrders(tenantId: string, filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<string | null> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);

      const endpoint = `/api/tenants/${tenantId}/orders/export${params.toString() ? '?' + params.toString() : ''}`;

      const response = await this.makeAuthenticatedRequest<{
        success: boolean;
        downloadUrl: string;
      }>(endpoint, {}, `export-orders-${tenantId}-${Date.now()}`);

      return response.data?.downloadUrl || null;
    } catch (error) {
      console.error('[TenantOrderService] Failed to export orders:', error);
      return null;
    }
  }

  /**
   * Get buyer orders
   * Public endpoint for order history lookup
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

      return response;
    } catch (error) {
      console.error('[TenantOrderService] Failed to get buyer orders:', error);
      return null;
    }
  }

  /**
   * Confirm order pickup
   * Updates order fulfillment status to picked up
   */
  async confirmPickup(orderId: string): Promise<boolean> {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/orders/${orderId}/pickup`,
        {
          method: 'PATCH',
          body: JSON.stringify({})
        },
        `pickup-confirm-${orderId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantOrderService] Failed to confirm pickup:', error);
      return false;
    }
  }

  /**
   * Cancel order
   * Updates order status to cancelled
   */
  async cancelOrder(orderId: string, cancellationReason: string): Promise<boolean> {
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/orders/${orderId}/cancel`,
        {
          method: 'PATCH',
          body: JSON.stringify({ cancellationReason })
        },
        `order-cancel-${orderId}`
      );

      return true;
    } catch (error) {
      console.error('[TenantOrderService] Failed to cancel order:', error);
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

      return response;
    } catch (error) {
      console.error('[TenantOrderService] Failed to get order downloads:', error);
      return null;
    }
  }
}

// Export singleton instance
export const tenantOrderService = TenantOrderService.getInstance();

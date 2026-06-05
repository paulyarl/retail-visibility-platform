/**
 * Frontend Order Management Service
 * 
 * Provides methods to interact with order management API:
 * - Get orders by location
 * - Location-specific order statistics
 * - Order status updates
 * - Organization-wide order analytics
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface OrderLocationInfo {
  orderId: string;
  orderNumber: string;
  pickupTenantId: string;
  pickupTenantName: string;
  paymentTenantId?: string;
  paymentTenantName?: string;
  isHeroPayment: boolean;
  isMultiLocationOrder: boolean;
  orderStatus: string;
  customerEmail: string;
  customerName: string;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  fulfillmentMethod?: string;
  metadata?: any;
}

export interface LocationOrderStats {
  tenantId: string;
  tenantName: string;
  totalOrders: number;
  pendingOrders: number;
  readyOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  isHeroLocation: boolean;
}

export interface OrganizationOrderStats {
  organizationId: string;
  totalOrders: number;
  totalRevenue: number;
  heroLocationOrders: number;
  directLocationOrders: number;
  locationsStats: LocationOrderStats[];
}

export interface OrdersNeedingAttention {
  pendingOrders: OrderLocationInfo[];
  readyOrders: OrderLocationInfo[];
  overdueOrders: OrderLocationInfo[];
}

export interface DetailedOrder {
  id: string;
  orderNumber: string;
  pickupTenantId: string;
  pickupTenantName: string;
  paymentTenantId?: string;
  paymentTenantName?: string;
  isHeroPayment: boolean;
  isMultiLocationOrder: boolean;
  orderStatus: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  shippingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  billingAddress: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  fulfillmentMethod?: string;
  source?: string;
  notes?: string;
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    depositCents?: number;
    remainingBalance?: number;
    checkoutMode?: string;
    depositPercentage?: number;
  };
  items: any[];
  payments: any[];
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

class OrderManagementService extends PublicApiSingleton {
  private static instance: OrderManagementService;

  static getInstance(): OrderManagementService {
    if (!OrderManagementService.instance) {
      OrderManagementService.instance = new OrderManagementService("order-management-service");
    }
    return OrderManagementService.instance;
  }

 

  /**
   * Get orders for a specific location
   */
  async getOrdersForLocation(
    tenantId: string,
    options: {
      status?: string;
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    orders: OrderLocationInfo[];
    total: number;
    hasMore: boolean;
  }> {
    const params = new URLSearchParams();
    
    if (options.status) params.append('status', options.status);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.startDate) params.append('startDate', options.startDate.toISOString());
    if (options.endDate) params.append('endDate', options.endDate.toISOString());

    const response = await this.makeDefaultRequest<{
      success: boolean;
      orders: OrderLocationInfo[];
      total: number;
      hasMore: boolean;
    }>(`/order-management/location/${tenantId}/orders?${params.toString()}`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get orders';
      throw new Error(errorMessage);
    }

    return {
      orders: response.data?.orders||[] as any,
      total: response.data?.total||0,
      hasMore: response.data?.hasMore||false,
    };
  }

  /**
   * Get order statistics for a specific location
   */
  async getLocationOrderStats(tenantId: string): Promise<LocationOrderStats> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      stats: LocationOrderStats;
    }>(`/order-management/location/${tenantId}/stats`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get location stats';
      throw new Error(errorMessage);
    }

    return response.data?.stats;
  }

  /**
   * Get orders needing attention at a location
   */
  async getLocationOrdersNeedingAttention(tenantId: string): Promise<OrdersNeedingAttention> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      pendingOrders: OrderLocationInfo[];
      readyOrders: OrderLocationInfo[];
      overdueOrders: OrderLocationInfo[];
    }>(`/order-management/location/${tenantId}/attention`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get attention orders';
      throw new Error(errorMessage);
    }

    return {
      pendingOrders: response.data?.pendingOrders||[] as any,
      readyOrders: response.data?.readyOrders||[] as any,
      overdueOrders: response.data?.overdueOrders||[] as any,
    };
  }

  /**
   * Get order statistics for an entire organization
   */
  async getOrganizationOrderStats(organizationId: string): Promise<OrganizationOrderStats> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      stats: OrganizationOrderStats;
    }>(`/order-management/organization/${organizationId}/stats`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get organization stats';
      throw new Error(errorMessage);
    }

    return response.data?.stats;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: string,
    notes?: string
  ): Promise<OrderLocationInfo> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      order: OrderLocationInfo;
    }>(`/order-management/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to update order status';
      throw new Error(errorMessage);
    }

    return response.data?.order;
  }

  /**
   * Get detailed order information
   */
  async getOrderDetails(orderId: string): Promise<DetailedOrder> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      order: DetailedOrder;
    }>(`/order-management/orders/${orderId}`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get order details';
      throw new Error(errorMessage);
    }

    return response.data?.order;
  }

  /**
   * Format currency for display
   */
  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get status color for order status
   */
  getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      'pending': 'warning',
      'confirmed': 'info',
      'processing': 'primary',
      'ready_for_pickup': 'success',
      'completed': 'success',
      'cancelled': 'danger',
      'refunded': 'secondary',
    };
    return statusColors[status] || 'default';
  }

  /**
   * Get status display text
   */
  getStatusText(status: string): string {
    const statusTexts: Record<string, string> = {
      'pending': 'Pending',
      'confirmed': 'Confirmed',
      'processing': 'Processing',
      'ready_for_pickup': 'Ready for Pickup',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
      'refunded': 'Refunded',
    };
    return statusTexts[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Check if order needs attention
   */
  needsAttention(order: OrderLocationInfo): {
    needsAttention: boolean;
    reason?: string;
    priority: 'low' | 'medium' | 'high';
  } {
    const now = new Date();
    const createdAt = new Date(order.createdAt);
    const updatedAt = new Date(order.updatedAt);

    // High priority: Ready for pickup over 24 hours
    if (order.orderStatus === 'ready_for_pickup') {
      const hoursSinceReady = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceReady > 24) {
        return {
          needsAttention: true,
          reason: 'Order ready for pickup over 24 hours',
          priority: 'high'
        };
      }
      return {
        needsAttention: true,
        reason: 'Order ready for pickup',
        priority: 'medium'
      };
    }

    // Medium priority: Pending over 2 hours
    if (order.orderStatus === 'pending') {
      const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreated > 2) {
        return {
          needsAttention: true,
          reason: 'Order pending over 2 hours',
          priority: 'medium'
        };
      }
    }

    return { needsAttention: false, priority: 'low' };
  }
}

export default OrderManagementService;

/**
 * Order Management Service
 * 
 * Handles multi-location order operations:
 * - Track orders by pickup location
 * - Location-specific order status updates
 * - Cross-location order routing and management
 * - Hero location payment processing coordination
 */

import { prisma } from '../prisma';
import { HeroLocationService } from './HeroLocationService';
import CrmAlertService from './CrmAlertService';
import { order_status } from '@prisma/client';

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
  createdAt: Date;
  updatedAt: Date;
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

export class OrderManagementService {
  private static instance: OrderManagementService;

  static getInstance(): OrderManagementService {
    if (!OrderManagementService.instance) {
      OrderManagementService.instance = new OrderManagementService();
    }
    return OrderManagementService.instance;
  }

  /**
   * Get orders for a specific location (pickup tenant)
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
  ): Promise<{ orders: OrderLocationInfo[]; total: number }> {
    const {
      status,
      limit = 50,
      offset = 0,
      startDate,
      endDate,
    } = options;

    const whereClause: any = {
      OR: [
        { tenant_id: tenantId }, // Direct orders for this location
        { 
          metadata: {
            path: ['pickup_tenant_id'],
            equals: tenantId
          }
        } // Multi-location orders with this as pickup
      ]
    };

    if (status) {
      whereClause.order_status = status;
    }

    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at.gte = startDate;
      if (endDate) whereClause.created_at.lte = endDate;
    }

    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where: whereClause,
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.orders.count({ where: whereClause })
    ]);

    const orderLocationInfos: OrderLocationInfo[] = orders.map(order => {
      const metadata = order.metadata as any || {};
      const isMultiLocation = metadata.is_multi_location_order;
      const isHeroPayment = metadata.is_hero_payment;
      
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        pickupTenantId: isMultiLocation ? metadata.pickup_tenant_id : order.tenant_id,
        pickupTenantName: isMultiLocation ? 
          (metadata.pickup_tenant_name || order.tenants?.name || 'Unknown') :
          (order.tenants?.name || 'Unknown'),
        paymentTenantId: isHeroPayment ? metadata.payment_tenant_id : order.tenant_id,
        paymentTenantName: isHeroPayment ? 
          (metadata.payment_tenant_name || order.tenants?.name || 'Unknown') :
          (order.tenants?.name || 'Unknown'),
        isHeroPayment: !!isHeroPayment,
        isMultiLocationOrder: !!isMultiLocation,
        orderStatus: order.order_status,
        customerEmail: order.customer_email,
        customerName: order.customer_name || '',
        totalCents: order.total_cents,
        createdAt: order.created_at,
        updatedAt: order.updated_at || order.created_at,
        fulfillmentMethod: metadata.fulfillment_method,
        metadata: order.metadata,
      };
    });

    return { orders: orderLocationInfos, total };
  }

  /**
   * Get order statistics for a specific location
   */
  async getLocationOrderStats(tenantId: string): Promise<LocationOrderStats> {
    const whereClause = {
      OR: [
        { tenant_id: tenantId },
        { 
          metadata: {
            path: ['pickup_tenant_id'],
            equals: tenantId
          }
        }
      ]
    };

    const [
      totalOrders,
      pendingOrders,
      readyOrders,
      completedOrders,
      cancelledOrders,
      revenueResult
    ] = await Promise.all([
      prisma.orders.count({ where: whereClause }),
      prisma.orders.count({ 
        where: { ...whereClause, order_status: order_status.confirmed }
      }),
      prisma.orders.count({ 
        where: { ...whereClause, order_status: order_status.processing }
      }),
      prisma.orders.count({ 
        where: { ...whereClause, order_status: order_status.delivered }
      }),
      prisma.orders.count({ 
        where: { ...whereClause, order_status: order_status.cancelled }
      }),
      prisma.orders.aggregate({
        where: whereClause,
        _sum: { total_cents: true },
        _avg: { total_cents: true }
      })
    ]);

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { name: true }
    });

    const heroLocationService = HeroLocationService.getInstance();
    const isHeroLocation = await heroLocationService.isHeroLocation(tenantId);

    return {
      tenantId,
      tenantName: tenant?.name || 'Unknown',
      totalOrders,
      pendingOrders,
      readyOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue: revenueResult._sum.total_cents || 0,
      averageOrderValue: revenueResult._avg.total_cents || 0,
      isHeroLocation,
    };
  }

  /**
   * Get order statistics for an entire organization
   */
  async getOrganizationOrderStats(organizationId: string): Promise<OrganizationOrderStats> {
    // Get all tenants in the organization
    const organization = await prisma.organizations_list.findUnique({
      where: { id: organizationId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!organization || !organization.tenants.length) {
      throw new Error('Organization not found or has no tenants');
    }

    // Get stats for each location
    const locationsStats = await Promise.all(
      organization.tenants.map(tenant => this.getLocationOrderStats(tenant.id))
    );

    // Calculate organization-wide stats
    const totalOrders = locationsStats.reduce((sum, stat) => sum + stat.totalOrders, 0);
    const totalRevenue = locationsStats.reduce((sum, stat) => sum + stat.totalRevenue, 0);
    const heroLocationOrders = locationsStats
      .filter(stat => stat.isHeroLocation)
      .reduce((sum, stat) => sum + stat.totalOrders, 0);
    const directLocationOrders = totalOrders - heroLocationOrders;

    return {
      organizationId,
      totalOrders,
      totalRevenue,
      heroLocationOrders,
      directLocationOrders,
      locationsStats,
    };
  }

  /**
   * Update order status with location-specific logic
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: string,
    updatedBy: string,
    notes?: string
  ): Promise<OrderLocationInfo> {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const metadata = order.metadata as any || {};
    const isMultiLocation = metadata.is_multi_location_order;
    const isHeroPayment = metadata.is_hero_payment;

    // Update the order
    const updatedOrder = await prisma.orders.update({
      where: { id: orderId },
      data: {
        order_status: newStatus as order_status,
        updated_at: new Date(),
        metadata: {
          ...metadata,
          status_updated_by: updatedBy,
          status_updated_at: new Date(),
          status_notes: notes,
        }
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // Create CRM alert for status change (fire-and-forget)
    CrmAlertService.getInstance().createOrderAlert({
      tenantId: updatedOrder.tenant_id,
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.order_number,
      eventType: newStatus,
      customerName: updatedOrder.customer_name || undefined,
      amount: updatedOrder.total_cents,
    }).catch(err => console.error('[OrderManagement] Failed to create CRM alert:', err));

    return {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.order_number,
      pickupTenantId: isMultiLocation ? metadata.pickup_tenant_id : updatedOrder.tenant_id,
      pickupTenantName: isMultiLocation ? 
        (metadata.pickup_tenant_name || updatedOrder.tenants?.name || 'Unknown') :
        (updatedOrder.tenants?.name || 'Unknown'),
      paymentTenantId: isHeroPayment ? metadata.payment_tenant_id : updatedOrder.tenant_id,
      paymentTenantName: isHeroPayment ? 
        (metadata.payment_tenant_name || updatedOrder.tenants?.name || 'Unknown') :
        (updatedOrder.tenants?.name || 'Unknown'),
      isHeroPayment: !!isHeroPayment,
      isMultiLocationOrder: !!isMultiLocation,
      orderStatus: updatedOrder.order_status,
      customerEmail: updatedOrder.customer_email,
      customerName: updatedOrder.customer_name || '',
      totalCents: updatedOrder.total_cents,
      createdAt: updatedOrder.created_at,
      updatedAt: updatedOrder.updated_at || updatedOrder.created_at,
      fulfillmentMethod: metadata.fulfillment_method,
      metadata: updatedOrder.metadata,
    };
  }

  /**
   * Get orders that need attention at a location
   */
  async getLocationOrdersNeedingAttention(tenantId: string): Promise<{
    pendingOrders: OrderLocationInfo[];
    readyOrders: OrderLocationInfo[];
    overdueOrders: OrderLocationInfo[];
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const whereClause = {
      OR: [
        { tenant_id: tenantId },
        { 
          metadata: {
            path: ['pickup_tenant_id'],
            equals: tenantId
          }
        }
      ]
    };

    const [pendingOrders, readyOrders, overdueOrders] = await Promise.all([
      // Orders pending for more than 2 hours
      prisma.orders.findMany({
        where: {
          ...whereClause,
          order_status: order_status.confirmed,
          created_at: {
            lt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
          }
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { created_at: 'asc' },
        take: 10
      }),
      // Orders ready for pickup
      prisma.orders.findMany({
        where: {
          ...whereClause,
          order_status: order_status.processing
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { updated_at: 'asc' },
        take: 20
      }),
      // Orders ready for more than 24 hours
      prisma.orders.findMany({
        where: {
          ...whereClause,
          order_status: order_status.processing,
          updated_at: {
            lt: oneDayAgo
          }
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: { updated_at: 'asc' },
        take: 10
      })
    ]);

    const formatOrder = (order: any): OrderLocationInfo => {
      const metadata = order.metadata as any || {};
      const isMultiLocation = metadata.is_multi_location_order;
      const isHeroPayment = metadata.is_hero_payment;
      
      return {
        orderId: order.id,
        orderNumber: order.order_number,
        pickupTenantId: isMultiLocation ? metadata.pickup_tenant_id : order.tenant_id,
        pickupTenantName: isMultiLocation ? 
          (metadata.pickup_tenant_name || order.tenants?.name || 'Unknown') :
          (order.tenants?.name || 'Unknown'),
        paymentTenantId: isHeroPayment ? metadata.payment_tenant_id : order.tenant_id,
        paymentTenantName: isHeroPayment ? 
          (metadata.payment_tenant_name || order.tenants?.name || 'Unknown') :
          (order.tenants?.name || 'Unknown'),
        isHeroPayment: !!isHeroPayment,
        isMultiLocationOrder: !!isMultiLocation,
        orderStatus: order.order_status,
        customerEmail: order.customer_email,
        customerName: order.customer_name || '',
        totalCents: order.total_cents,
        createdAt: order.created_at,
        updatedAt: order.updated_at || order.created_at,
        fulfillmentMethod: metadata.fulfillment_method,
        metadata: order.metadata,
      };
    };

    return {
      pendingOrders: pendingOrders.map(formatOrder),
      readyOrders: readyOrders.map(formatOrder),
      overdueOrders: overdueOrders.map(formatOrder),
    };
  }
}

export default OrderManagementService;

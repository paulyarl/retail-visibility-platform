/**
 * Fulfillment Service
 * 
 * Handles multi-location fulfillment coordination:
 * - Pickup scheduling and time slot management
 * - Customer notifications for order status updates
 * - Fulfillment coordination between locations
 * - Hero location fulfillment workflows
 */

import { prisma } from '../prisma';
import { 
  generateTimeSlotId,
  generateScheduleId,
  generateNotificationId
} from '../lib/id-generator';

import { HeroLocationService } from './HeroLocationService';
import { OrderManagementService } from './OrderManagementService';
import { CustomerService } from './CustomerService';

export interface PickupTimeSlot {
  id: string;
  tenantId: string;
  date: Date;
  startTime: string;
  endTime: string;
  maxOrders: number;
  currentOrders: number;
  isActive: boolean;
  fulfillmentMethod: 'pickup' | 'delivery';
}

export interface FulfillmentSchedule {
  orderId: string;
  tenantId: string;
  scheduledDate: Date;
  scheduledTime: string;
  fulfillmentMethod: 'pickup' | 'delivery';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderStatus: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FulfillmentNotification {
  id: string;
  orderId: string;
  tenantId: string;
  customerId: string;
  type: 'order_confirmed' | 'ready_for_pickup' | 'pickup_reminder' | 'order_completed' | 'order_cancelled';
  channel: 'email' | 'sms' | 'push';
  status: 'pending' | 'sent' | 'failed';
  content: string;
  scheduledAt?: Date;
  sentAt?: Date;
  error?: string;
  metadata?: any;
}

export interface LocationFulfillmentStats {
  tenantId: string;
  tenantName: string;
  todayOrders: number;
  scheduledPickups: number;
  readyForPickup: number;
  completedToday: number;
  averageFulfillmentTime: number; // in minutes
  upcomingTimeSlots: PickupTimeSlot[];
  isHeroLocation: boolean;
}

export class FulfillmentService {
  private static instance: FulfillmentService;

  static getInstance(): FulfillmentService {
    if (!FulfillmentService.instance) {
      FulfillmentService.instance = new FulfillmentService();
    }
    return FulfillmentService.instance;
  }

  /**
   * Create pickup time slots for a location
   */
  async createTimeSlots(tenantId: string, timeSlots: Omit<PickupTimeSlot, 'id' | 'currentOrders'>[]): Promise<PickupTimeSlot[]> {
    // Create time slots
    const createdSlots = await Promise.all(
      timeSlots.map(async (slot) => {
        const createdSlot = await prisma.fulfillment_time_slots.create({
          data: {
            id: generateTimeSlotId(tenantId),
            tenant_id: tenantId,
            date: slot.date,
            start_time: new Date(`1970-01-01T${slot.startTime}:00.000Z`),
            end_time: new Date(`1970-01-01T${slot.endTime}:00.000Z`),
            max_orders: slot.maxOrders,
            is_active: slot.isActive,
            fulfillment_method: slot.fulfillmentMethod,
          },
        });
        return createdSlot;
      })
    );

    return createdSlots.map(slot => ({
      id: slot.id,
      tenantId: slot.tenant_id,
      date: slot.date,
      startTime: slot.start_time.toTimeString().slice(0, 5),
      endTime: slot.end_time.toTimeString().slice(0, 5),
      maxOrders: slot.max_orders,
      currentOrders: 0, // Will be calculated dynamically
      isActive: slot.is_active,
      fulfillmentMethod: slot.fulfillment_method as 'pickup' | 'delivery',
    }));
  }

  /**
   * Get available time slots for a location
   */
  async getAvailableTimeSlots(
    tenantId: string, 
    date: Date,
    fulfillmentMethod: 'pickup' | 'delivery' = 'pickup'
  ): Promise<PickupTimeSlot[]> {
    const slots = await prisma.fulfillment_time_slots.findMany({
      where: {
        tenant_id: tenantId,
        date: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
        fulfillment_method: fulfillmentMethod,
        is_active: true,
      },
      orderBy: { start_time: 'asc' },
    });

    // Get current order count for each slot
    const slotsWithCounts = await Promise.all(
      slots.map(async (slot) => {
        const currentOrders = await prisma.fulfillment_schedules.count({
          where: {
            time_slot_id: slot.id,
            scheduled_date: slot.date,
          },
        });

        return {
          id: slot.id,
          tenantId: slot.tenant_id,
          date: slot.date,
          startTime: slot.start_time.toTimeString().slice(0, 5),
          endTime: slot.end_time.toTimeString().slice(0, 5),
          maxOrders: slot.max_orders,
          currentOrders,
          isActive: slot.is_active,
          fulfillmentMethod: slot.fulfillment_method as 'pickup' | 'delivery',
        };
      })
    );

    return slotsWithCounts.filter(slot => slot.currentOrders < slot.maxOrders);
  }

  /**
   * Schedule order fulfillment
   */
  async scheduleFulfillment(
    orderId: string,
    tenantId: string,
    scheduledDate: Date,
    scheduledTime: string,
    fulfillmentMethod: 'pickup' | 'delivery' = 'pickup',
    notes?: string
  ): Promise<FulfillmentSchedule> {
    // Find the appropriate time slot
    const timeSlot = await prisma.fulfillment_time_slots.findFirst({
      where: {
        tenant_id: tenantId,
        date: scheduledDate,
        start_time: new Date(`1970-01-01T${scheduledTime}:00.000Z`),
        fulfillment_method: fulfillmentMethod,
        is_active: true,
      },
    });

    if (!timeSlot) {
      throw new Error('Time slot not available');
    }

    // Check if slot is full
    const currentOrders = await prisma.fulfillment_schedules.count({
      where: {
        time_slot_id: timeSlot.id,
        scheduled_date: scheduledDate,
      },
    });

    if (currentOrders >= timeSlot.max_orders) {
      throw new Error('Time slot is full');
    }

    // Get order details
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      select: {
        customer_name: true,
        customer_email: true,
        customer_phone: true,
        order_status: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Create or update fulfillment schedule
    const schedule = await prisma.fulfillment_schedules.upsert({
      where: {
        order_id: orderId,
      },
      update: {
        tenant_id: tenantId,
        scheduled_date: scheduledDate,
        scheduled_time: new Date(`1970-01-01T${scheduledTime}:00.000Z`),
        fulfillment_method: fulfillmentMethod,
        time_slot_id: timeSlot.id,
        notes,
        updated_at: new Date(),
      },
      create: {
        id: generateScheduleId(tenantId),
        order_id: orderId,
        tenant_id: tenantId,
        scheduled_date: scheduledDate,
        scheduled_time: new Date(`1970-01-01T${scheduledTime}:00.000Z`),
        fulfillment_method: fulfillmentMethod,
        time_slot_id: timeSlot.id,
        customer_name: order.customer_name || '',
        customer_email: order.customer_email || '',
        customer_phone: order.customer_phone || undefined,
        order_status: order.order_status,
        notes,
      },
    });

    return {
      orderId: schedule.order_id,
      tenantId: schedule.tenant_id,
      scheduledDate: schedule.scheduled_date,
      scheduledTime: schedule.scheduled_time.toTimeString().slice(0, 5),
      fulfillmentMethod: schedule.fulfillment_method as 'pickup' | 'delivery',
      customerName: schedule.customer_name,
      customerEmail: schedule.customer_email,
      customerPhone: schedule.customer_phone || undefined,
      orderStatus: schedule.order_status,
      notes: schedule.notes || undefined,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
    };
  }

  /**
   * Get fulfillment schedules for a location
   */
  async getLocationSchedules(
    tenantId: string,
    options: {
      date?: Date;
      fulfillmentMethod?: 'pickup' | 'delivery';
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ schedules: FulfillmentSchedule[]; total: number }> {
    const {
      date,
      fulfillmentMethod,
      status,
      limit = 50,
      offset = 0,
    } = options;

    const whereClause: any = { tenant_id: tenantId };

    if (date) {
      whereClause.scheduled_date = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    if (fulfillmentMethod) {
      whereClause.fulfillment_method = fulfillmentMethod;
    }

    if (status) {
      whereClause.order_status = status;
    }

    const [schedules, total] = await Promise.all([
      prisma.fulfillment_schedules.findMany({
        where: whereClause,
        orderBy: [
          { scheduled_date: 'asc' },
          { scheduled_time: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.fulfillment_schedules.count({ where: whereClause }),
    ]);

    return {
      schedules: schedules.map(schedule => ({
        orderId: schedule.order_id,
        tenantId: schedule.tenant_id,
        scheduledDate: schedule.scheduled_date,
        scheduledTime: schedule.scheduled_time.toTimeString().slice(0, 5),
        fulfillmentMethod: schedule.fulfillment_method as 'pickup' | 'delivery',
        customerName: schedule.customer_name,
        customerEmail: schedule.customer_email,
        customerPhone: schedule.customer_phone || undefined,
        orderStatus: schedule.order_status,
        notes: schedule.notes || undefined,
        createdAt: schedule.created_at,
        updatedAt: schedule.updated_at,
      })),
      total,
    };
  }

  /**
   * Create fulfillment notification
   */
  async createNotification(
    orderId: string,
    tenantId: string,
    customerId: string,
    type: 'order_confirmed' | 'ready_for_pickup' | 'pickup_reminder' | 'order_completed' | 'order_cancelled',
    channel: 'email' | 'sms' | 'push',
    content: string,
    scheduledAt?: Date,
    metadata?: any
  ): Promise<FulfillmentNotification> {
    // Create notification
    const notification = await prisma.fulfillment_notifications.create({
      data: {
        id: generateNotificationId(tenantId),
        order_id: orderId,
        tenant_id: tenantId,
        customer_id: customerId,
        notification_type: type,
        channel,
        status: 'pending',
        content: content,
        scheduled_at: scheduledAt,
        metadata: metadata || {},
      },
    });

    return {
      id: notification.id,
      orderId: notification.order_id,
      tenantId: notification.tenant_id,
      customerId: notification.customer_id,
      type: notification.notification_type as 'order_confirmed' | 'ready_for_pickup' | 'pickup_reminder' | 'order_completed' | 'order_cancelled',
      channel: notification.channel as 'email' | 'sms' | 'push',
      status: notification.status as 'pending' | 'sent' | 'failed',
      content: notification.content,
      scheduledAt: notification.scheduled_at || undefined,
      sentAt: notification.sent_at || undefined,
      error: notification.error || undefined,
      metadata: notification.metadata,
    };
  }

  /**
   * Send notifications for order status changes
   */
  async sendOrderStatusNotifications(orderId: string, newStatus: string): Promise<void> {
    // Get order and fulfillment schedule
    const [order, schedule] = await Promise.all([
      prisma.orders.findUnique({
        where: { id: orderId },
        select: {
          customer_id: true,
          customer_email: true,
          customer_phone: true,
          customer_name: true,
        },
      }),
      prisma.fulfillment_schedules.findUnique({
        where: { order_id: orderId },
        select: {
          tenant_id: true,
          scheduled_date: true,
          scheduled_time: true,
          fulfillment_method: true,
        },
      }),
    ]);

    if (!order || !schedule) {
      return;
    }

    let notificationType: FulfillmentNotification['type'] | null = null;
    let content = '';

    switch (newStatus) {
      case 'confirmed':
        notificationType = 'order_confirmed';
        content = `Your order has been confirmed! Scheduled for ${schedule.fulfillment_method} on ${schedule.scheduled_date.toLocaleDateString()} at ${schedule.scheduled_time}.`;
        break;
      
      case 'delivered':
        notificationType = 'ready_for_pickup';
        content = `Your order is ready for ${schedule.fulfillment_method}! Your scheduled time is ${schedule.scheduled_date.toLocaleDateString()} at ${schedule.scheduled_time}.`;
        break;
      
      case 'completed':
        notificationType = 'order_completed';
        content = `Your order has been completed. Thank you for your business!`;
        break;
      
      case 'cancelled':
        notificationType = 'order_cancelled';
        content = `Your order has been cancelled. Please contact us if you have any questions.`;
        break;
    }

    if (notificationType && order.customer_id) {
      // Send email notification
      await this.createNotification(
        orderId,
        schedule.tenant_id,
        order.customer_id,
        notificationType,
        'email',
        content
      );

      // Send SMS if phone number available
      if (order.customer_phone) {
        await this.createNotification(
          orderId,
          schedule.tenant_id,
          order.customer_id,
          notificationType,
          'sms',
          content
        );
      }
    }
  }

  /**
   * Get location fulfillment statistics
   */
  async getLocationFulfillmentStats(tenantId: string): Promise<LocationFulfillmentStats> {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const todayEnd = new Date(today.setHours(23, 59, 59, 999));

    const [
      todayOrders,
      scheduledPickups,
      readyForPickup,
      completedToday,
      upcomingTimeSlots,
      tenant
    ] = await Promise.all([
      // Today's orders
      prisma.fulfillment_schedules.count({
        where: {
          tenant_id: tenantId,
          scheduled_date: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
      // Scheduled pickups for today
      prisma.fulfillment_schedules.count({
        where: {
          tenant_id: tenantId,
          scheduled_date: {
            gte: todayStart,
            lte: todayEnd,
          },
          order_status: 'delivered',
        },
      }),
      // Ready for pickup
      prisma.fulfillment_schedules.count({
        where: {
          tenant_id: tenantId,
          order_status: 'delivered',
          scheduled_date: {
            gte: todayStart,
          },
        },
      }),
      // Completed today
      prisma.fulfillment_schedules.count({
        where: {
          tenant_id: tenantId,
          order_status: 'completed',
          updated_at: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
      // Upcoming time slots
      prisma.fulfillment_time_slots.findMany({
        where: {
          tenant_id: tenantId,
          date: {
            gte: todayStart,
          },
          is_active: true,
        },
        orderBy: { date: 'asc' },
        take: 10,
      }),
      // Tenant info
      prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
    ]);

    // Calculate average fulfillment time
    const fulfillmentTimes = await prisma.fulfillment_schedules.findMany({
      where: {
        tenant_id: tenantId,
        order_status: 'completed',
        created_at: {
          gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        created_at: true,
        updated_at: true,
      },
    });

    const averageFulfillmentTime = fulfillmentTimes.length > 0
      ? fulfillmentTimes.reduce((sum, schedule) => {
          const time = schedule.updated_at.getTime() - schedule.created_at.getTime();
          return sum + time;
        }, 0) / fulfillmentTimes.length / (1000 * 60) // Convert to minutes
      : 0;

    const heroLocationService = HeroLocationService.getInstance();
    const isHeroLocation = await heroLocationService.isHeroLocation(tenantId);

    return {
      tenantId,
      tenantName: tenant?.name || 'Unknown',
      todayOrders,
      scheduledPickups,
      readyForPickup,
      completedToday,
      averageFulfillmentTime,
      upcomingTimeSlots: upcomingTimeSlots.map(slot => ({
        id: slot.id,
        tenantId: slot.tenant_id,
        date: slot.date,
        startTime: slot.start_time.toTimeString().slice(0, 5),
        endTime: slot.end_time.toTimeString().slice(0, 5),
        maxOrders: slot.max_orders,
        currentOrders: 0, // Would need to calculate this
        isActive: slot.is_active,
        fulfillmentMethod: slot.fulfillment_method as 'pickup' | 'delivery',
      })),
      isHeroLocation,
    };
  }

  /**
   * Update fulfillment schedule status
   */
  async updateScheduleStatus(
    orderId: string,
    newStatus: string,
    notes?: string
  ): Promise<FulfillmentSchedule> {
    const schedule = await prisma.fulfillment_schedules.update({
      where: { order_id: orderId },
      data: {
        order_status: newStatus,
        notes: notes || undefined,
        updated_at: new Date(),
      },
    });

    // Send notifications for status change
    await this.sendOrderStatusNotifications(orderId, newStatus);

    return {
      orderId: schedule.order_id,
      tenantId: schedule.tenant_id,
      scheduledDate: schedule.scheduled_date,
      scheduledTime: schedule.scheduled_time.toTimeString().slice(0, 5),
      fulfillmentMethod: schedule.fulfillment_method as 'pickup' | 'delivery',
      customerName: schedule.customer_name,
      customerEmail: schedule.customer_email,
      customerPhone: schedule.customer_phone || undefined,
      orderStatus: schedule.order_status,
      notes: schedule.notes || undefined,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
    };
  }
}

export default FulfillmentService;

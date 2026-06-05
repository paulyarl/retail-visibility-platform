/**
 * Frontend Fulfillment Service
 * 
 * Provides methods to interact with fulfillment coordination API:
 * - Time slot management
 * - Pickup scheduling
 * - Fulfillment notifications
 * - Location fulfillment statistics
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface PickupTimeSlot {
  id: string;
  tenantId: string;
  date: string;
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
  scheduledDate: string;
  scheduledTime: string;
  fulfillmentMethod: 'pickup' | 'delivery';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  orderStatus: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  scheduledAt?: string;
  sentAt?: string;
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
  averageFulfillmentTime: number;
  upcomingTimeSlots: PickupTimeSlot[];
  isHeroLocation: boolean;
}

class FulfillmentService extends PublicApiSingleton {
  private static instance: FulfillmentService;

  static getInstance(): FulfillmentService {
    if (!FulfillmentService.instance) {
      FulfillmentService.instance = new FulfillmentService("fulfillment-notification");
    }
    return FulfillmentService.instance;
  }

  /**
   * Create time slots for a location
   */
  async createTimeSlots(
    tenantId: string,
    timeSlots: Omit<PickupTimeSlot, 'id' | 'currentOrders'>[]
  ): Promise<PickupTimeSlot[]> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      timeSlots: PickupTimeSlot[];
    }>(`/fulfillment/time-slots/${tenantId}`, {
      method: 'POST',
      body: JSON.stringify({ timeSlots }),
    });

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to create time slots';
      throw new Error(errorMessage);
    }

    return response.data?.timeSlots;
  }

  /**
   * Get available time slots for a location
   */
  async getAvailableTimeSlots(
    tenantId: string,
    date?: Date,
    fulfillmentMethod: 'pickup' | 'delivery' = 'pickup'
  ): Promise<PickupTimeSlot[]> {
    const params = new URLSearchParams();
    
    if (date) params.append('date', date.toISOString());
    params.append('fulfillmentMethod', fulfillmentMethod);

    const response = await this.makeDefaultRequest<{
      success: boolean;
      timeSlots: PickupTimeSlot[];
    }>(`/fulfillment/time-slots/${tenantId}?${params.toString()}`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get time slots';
      throw new Error(errorMessage);
    }

    return response.data?.timeSlots;
  }

  /**
   * Schedule order fulfillment
   */
  async scheduleFulfillment(
    orderId: string,
    scheduledDate: Date,
    scheduledTime: string,
    fulfillmentMethod: 'pickup' | 'delivery' = 'pickup',
    notes?: string
  ): Promise<FulfillmentSchedule> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      schedule: FulfillmentSchedule;
    }>(`/fulfillment/schedule/${orderId}`, {
      method: 'POST',
      body: JSON.stringify({
        scheduledDate: scheduledDate.toISOString(),
        scheduledTime,
        fulfillmentMethod,
        notes,
      }),
    });

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to schedule fulfillment';
      throw new Error(errorMessage);
    }

    return response.data?.schedule;
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
  ): Promise<{
    schedules: FulfillmentSchedule[];
    total: number;
  }> {
    const params = new URLSearchParams();
    
    if (options.date) params.append('date', options.date.toISOString());
    if (options.fulfillmentMethod) params.append('fulfillmentMethod', options.fulfillmentMethod);
    if (options.status) params.append('status', options.status);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const response = await this.makeDefaultRequest<{
      success: boolean;
      schedules: FulfillmentSchedule[];
      total: number;
    }>(`/fulfillment/schedules/${tenantId}?${params.toString()}`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get schedules';
      throw new Error(errorMessage);
    }

    return {
      schedules: response.data?.schedules,
      total: response.data?.total,
    };
  }

  /**
   * Create fulfillment notification
   */
  async createNotification(
    orderId: string,
    customerId: string,
    type: 'order_confirmed' | 'ready_for_pickup' | 'pickup_reminder' | 'order_completed' | 'order_cancelled',
    channel: 'email' | 'sms' | 'push',
    content: string,
    scheduledAt?: Date
  ): Promise<FulfillmentNotification> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      notification: FulfillmentNotification;
    }>(`/fulfillment/notifications`, {
      method: 'POST',
      body: JSON.stringify({
        orderId,
        customerId,
        type,
        channel,
        content,
        scheduledAt: scheduledAt?.toISOString(),
      }),
    });

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to create notification';
      throw new Error(errorMessage);
    }

    return response.data?.notification;
  }

  /**
   * Get location fulfillment statistics
   */
  async getLocationFulfillmentStats(tenantId: string): Promise<LocationFulfillmentStats> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      stats: LocationFulfillmentStats;
    }>(`/fulfillment/stats/${tenantId}`);

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to get fulfillment stats';
      throw new Error(errorMessage);
    }

    return response.data?.stats;
  }

  /**
   * Update fulfillment schedule status
   */
  async updateScheduleStatus(
    orderId: string,
    status: string,
    notes?: string
  ): Promise<FulfillmentSchedule> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      schedule: FulfillmentSchedule;
    }>(`/fulfillment/schedule/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });

    if (!response.success) {
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : response.error?.message || 'Failed to update schedule status';
      throw new Error(errorMessage);
    }

    return response.data?.schedule;
  }

  /**
   * Format time for display
   */
  formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format date and time for display
   */
  formatDateTime(dateString: string, time: string): string {
    return `${this.formatDate(dateString)} at ${this.formatTime(time)}`;
  }

  /**
   * Get fulfillment method display text
   */
  getFulfillmentMethodText(method: 'pickup' | 'delivery'): string {
    return method === 'pickup' ? 'Pickup' : 'Delivery';
  }

  /**
   * Get notification type display text
   */
  getNotificationTypeText(type: FulfillmentNotification['type']): string {
    const typeTexts: Record<FulfillmentNotification['type'], string> = {
      'order_confirmed': 'Order Confirmed',
      'ready_for_pickup': 'Ready for Pickup',
      'pickup_reminder': 'Pickup Reminder',
      'order_completed': 'Order Completed',
      'order_cancelled': 'Order Cancelled',
    };
    return typeTexts[type];
  }

  /**
   * Get notification channel display text
   */
  getNotificationChannelText(channel: FulfillmentNotification['channel']): string {
    const channelTexts: Record<FulfillmentNotification['channel'], string> = {
      'email': 'Email',
      'sms': 'SMS',
      'push': 'Push Notification',
    };
    return channelTexts[channel];
  }

  /**
   * Check if time slot is available
   */
  isTimeSlotAvailable(timeSlot: PickupTimeSlot): boolean {
    return timeSlot.isActive && timeSlot.currentOrders < timeSlot.maxOrders;
  }

  /**
   * Get time slot availability percentage
   */
  getTimeSlotAvailability(timeSlot: PickupTimeSlot): number {
    if (!timeSlot.isActive || timeSlot.maxOrders === 0) return 0;
    return Math.round((timeSlot.currentOrders / timeSlot.maxOrders) * 100);
  }

  /**
   * Get time slot availability color
   */
  getTimeSlotAvailabilityColor(timeSlot: PickupTimeSlot): 'green' | 'yellow' | 'red' | 'gray' {
    if (!timeSlot.isActive) return 'gray';
    
    const percentage = this.getTimeSlotAvailability(timeSlot);
    if (percentage < 50) return 'green';
    if (percentage < 80) return 'yellow';
    return 'red';
  }

  /**
   * Generate default time slots for a day
   */
  generateDefaultTimeSlots(date: Date, fulfillmentMethod: 'pickup' | 'delivery' = 'pickup'): Omit<PickupTimeSlot, 'id' | 'currentOrders'>[] {
    const slots: Omit<PickupTimeSlot, 'id' | 'currentOrders'>[] = [];
    
    // Generate slots from 9 AM to 6 PM with 30-minute intervals
    for (let hour = 9; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const endTime = minute === 30 
          ? `${(hour + 1).toString().padStart(2, '0')}:00`
          : `${hour.toString().padStart(2, '0')}:30`;
        
        slots.push({
          tenantId: '', // Will be set by caller
          date: date.toISOString(),
          startTime,
          endTime,
          maxOrders: 4, // Default capacity
          isActive: true,
          fulfillmentMethod,
        });
      }
    }
    
    return slots;
  }
}

export default FulfillmentService;

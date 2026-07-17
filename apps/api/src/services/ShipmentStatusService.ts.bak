/**
 * Shipment Status Service
 *
 * Manages shipment status transitions, validation, and fulfillment sync.
 * Tracks status history in the shipments.tracking_events JSON column.
 */

import { prisma } from '../prisma';
import { getOrderNotificationService } from './OrderNotificationService';

// Prisma $Enums.shipment_status values
export type ShipmentStatus =
  | 'pending'
  | 'label_created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled';

interface ShipmentStatusTransition {
  from: ShipmentStatus;
  to: ShipmentStatus;
  timestampField: 'shipped_at' | 'in_transit_at' | 'out_for_delivery_at' | 'delivered_at' | 'failed_delivery_at' | 'returned_at' | 'updated_at';
}

// Valid status transitions
const VALID_TRANSITIONS: ShipmentStatusTransition[] = [
  { from: 'pending', to: 'label_created', timestampField: 'updated_at' },
  { from: 'label_created', to: 'picked_up', timestampField: 'updated_at' },
  { from: 'picked_up', to: 'in_transit', timestampField: 'shipped_at' },
  { from: 'in_transit', to: 'out_for_delivery', timestampField: 'out_for_delivery_at' },
  { from: 'out_for_delivery', to: 'delivered', timestampField: 'delivered_at' },
  { from: 'in_transit', to: 'failed_delivery', timestampField: 'failed_delivery_at' },
  { from: 'out_for_delivery', to: 'failed_delivery', timestampField: 'failed_delivery_at' },
  { from: 'failed_delivery', to: 'in_transit', timestampField: 'in_transit_at' },
  { from: 'in_transit', to: 'returned', timestampField: 'returned_at' },
  { from: 'delivered', to: 'returned', timestampField: 'returned_at' },
  { from: 'pending', to: 'cancelled', timestampField: 'updated_at' },
  { from: 'label_created', to: 'cancelled', timestampField: 'updated_at' },
  { from: 'picked_up', to: 'cancelled', timestampField: 'updated_at' },
];

// Terminal statuses — no further transitions expected (except returned from delivered)
const TERMINAL_STATUSES: ShipmentStatus[] = ['delivered', 'cancelled'];

interface TrackingEvent {
  status: ShipmentStatus;
  timestamp: string;
  location?: string;
  description?: string;
  source?: 'manual' | 'carrier_api';
}

interface TransitionShipmentStatusInput {
  shipmentId: string;
  newStatus: ShipmentStatus;
  location?: string;
  description?: string;
  source?: 'manual' | 'carrier_api';
  changedBy?: string;
}

class ShipmentStatusService {
  /**
   * Validate if a status transition is allowed
   */
  isValidTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
    if (from === to) return true; // No-op is always valid

    // Allow transitions from terminal statuses to returned
    if (to === 'returned' && from !== 'cancelled') return true;

    // Allow retry from failed_delivery back to in_transit
    if (from === 'failed_delivery' && to === 'in_transit') return true;

    return VALID_TRANSITIONS.some(
      (t) => t.from === from && t.to === to
    );
  }

  /**
   * Transition a shipment to a new status
   */
  async transitionShipmentStatus(input: TransitionShipmentStatusInput): Promise<{
    success: boolean;
    shipment?: any;
    error?: string;
  }> {
    const { shipmentId, newStatus, location, description, source = 'manual', changedBy } = input;

    try {
      const shipment = await prisma.shipments.findUnique({
        where: { id: shipmentId },
        include: { orders: true },
      });

      if (!shipment) {
        return { success: false, error: 'shipment_not_found' };
      }

      const currentStatus = shipment.shipment_status as ShipmentStatus;

      if (!this.isValidTransition(currentStatus, newStatus)) {
        return {
          success: false,
          error: `invalid_transition: ${currentStatus} -> ${newStatus}`,
        };
      }

      // Build tracking event
      const event: TrackingEvent = {
        status: newStatus,
        timestamp: new Date().toISOString(),
        ...(location && { location }),
        ...(description && { description }),
        source,
      };

      // Append to tracking_events
      const existingEvents = (shipment.tracking_events as any) || [];
      const updatedEvents = [...existingEvents, event];

      // Determine timestamp field
      const transitionDef = VALID_TRANSITIONS.find(
        (t) => t.from === currentStatus && t.to === newStatus
      );

      const updateData: any = {
        shipment_status: newStatus,
        tracking_events: updatedEvents,
        updated_at: new Date(),
      };

      // Set the appropriate timestamp field if this is a forward transition
      if (transitionDef && transitionDef.timestampField !== 'updated_at') {
        updateData[transitionDef.timestampField] = new Date();
      }

      const updatedShipment = await prisma.shipments.update({
        where: { id: shipmentId },
        data: updateData,
      });

      // Sync fulfillment status if needed
      await this.syncFulfillmentStatus(shipment.order_id);

      // Fire notification for certain statuses
      await this.maybeFireNotification(shipment, newStatus, location, description);

      return { success: true, shipment: updatedShipment };
    } catch (error) {
      console.error('[ShipmentStatusService] Error transitioning status:', error);
      return { success: false, error: 'transition_failed' };
    }
  }

  /**
   * Sync order fulfillment_status based on shipment statuses
   * - All shipments delivered → fulfilled
   * - Any shipment failed/returned → processing (if currently fulfilled)
   * - Any shipment in transit → processing (if unfulfilled)
   */
  async syncFulfillmentStatus(orderId: string): Promise<void> {
    try {
      const shipments = await prisma.shipments.findMany({
        where: { order_id: orderId },
      });

      if (shipments.length === 0) return;

      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        select: { fulfillment_status: true },
      });

      if (!order) return;

      const statuses = shipments.map((s) => s.shipment_status as ShipmentStatus);

      // All delivered → fulfilled
      const allDelivered = statuses.every((s) => s === 'delivered');

      // Any active (not cancelled, not returned)
      const anyActive = statuses.some(
        (s) => !['cancelled', 'returned'].includes(s)
      );

      // Any failed
      const anyFailed = statuses.some((s) => s === 'failed_delivery');

      let targetStatus: string | null = null;

      if (allDelivered) {
        targetStatus = 'fulfilled';
      } else if (anyFailed && order.fulfillment_status === 'fulfilled') {
        targetStatus = 'processing';
      } else if (anyActive && order.fulfillment_status === 'unfulfilled') {
        targetStatus = 'processing';
      }

      if (targetStatus && targetStatus !== order.fulfillment_status) {
        await prisma.orders.update({
          where: { id: orderId },
          data: { fulfillment_status: targetStatus as any },
        });

        console.log(
          `[ShipmentStatusService] Synced order ${orderId} fulfillment_status to ${targetStatus}`
        );
      }
    } catch (error) {
      console.error('[ShipmentStatusService] Error syncing fulfillment status:', error);
    }
  }

  /**
   * Get shipment timeline (ordered tracking events)
   */
  async getShipmentTimeline(shipmentId: string): Promise<TrackingEvent[]> {
    const shipment = await prisma.shipments.findUnique({
      where: { id: shipmentId },
      select: { tracking_events: true, shipment_status: true, created_at: true },
    });

    if (!shipment) return [];

    const events = ((shipment.tracking_events as any) || []) as TrackingEvent[];

    // Add the current status as the most recent event if not already present
    const now = new Date().toISOString();
    const hasCurrentStatus = events.some((e) => e.status === shipment.shipment_status);

    if (!hasCurrentStatus) {
      events.push({
        status: shipment.shipment_status as ShipmentStatus,
        timestamp: now,
        description: 'Current status',
      });
    }

    // Sort by timestamp ascending (oldest first)
    return events.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Fire notification for shipment status changes when relevant
   */
  private async maybeFireNotification(
    shipment: any,
    newStatus: ShipmentStatus,
    location?: string,
    description?: string
  ): Promise<void> {
    try {
      const order = await prisma.orders.findUnique({
        where: { id: shipment.order_id },
        select: {
          id: true,
          order_number: true,
          customer_email: true,
          customer_name: true,
          total_cents: true,
          tenant_id: true,
          metadata: true,
        },
      });

      if (!order || !order.customer_email) return;

      const fulfillmentMethod = (order.metadata as any)?.fulfillment_method;
      if (fulfillmentMethod !== 'shipping') return;

      const notificationService = getOrderNotificationService();

      switch (newStatus) {
        case 'out_for_delivery':
          notificationService.notifyOrderOutForDelivery({
            tenantId: order.tenant_id,
            orderId: order.id,
            orderNumber: order.order_number || undefined,
            customerEmail: order.customer_email,
            customerName: order.customer_name || undefined,
            amount: order.total_cents,
            trackingNumber: shipment.tracking_number || undefined,
            carrier: shipment.carrier || undefined,
            trackingUrl: shipment.tracking_url || undefined,
            estimatedDelivery: shipment.estimated_delivery_date
              ? new Date(shipment.estimated_delivery_date).toLocaleDateString()
              : undefined,
          }).catch(err => console.error('[ShipmentStatusService] Failed to send out-for-delivery notification:', err));
          break;
        case 'delivered':
          notificationService.notifyOrderDelivered({
            tenantId: order.tenant_id,
            orderId: order.id,
            orderNumber: order.order_number || undefined,
            customerEmail: order.customer_email,
            customerName: order.customer_name || undefined,
            amount: order.total_cents,
            trackingNumber: shipment.tracking_number || undefined,
            carrier: shipment.carrier || undefined,
            trackingUrl: shipment.tracking_url || undefined,
          }).catch(err => console.error('[ShipmentStatusService] Failed to send delivered notification:', err));
          break;
        case 'failed_delivery':
          // Future: failed delivery notification
          break;
        case 'returned':
          // Future: returned notification
          break;
      }
    } catch (error) {
      console.error('[ShipmentStatusService] Error firing notification:', error);
    }
  }
}

// Singleton instance
let instance: ShipmentStatusService | null = null;

export function getShipmentStatusService(): ShipmentStatusService {
  if (!instance) {
    instance = new ShipmentStatusService();
  }
  return instance;
}

export { ShipmentStatusService };
export type { TrackingEvent, TransitionShipmentStatusInput };

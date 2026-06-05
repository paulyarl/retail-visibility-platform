/**
 * Realtime Service
 * Handles real-time notifications for digital product access
 */

import { digitalFulfillmentService } from './digital-assets/DigitalFulfillmentService';

export interface CustomerNotification {
  type: 'digital-access-granted' | 'download-complete' | 'access-expiring' | 'access-revoked';
  data: Record<string, any>;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: string;
  data: Record<string, any>;
  timestamp: Date;
}

class RealtimeService {
  private connectedClients: Map<string, Set<any>> = new Map();

  /**
   * Register a WebSocket client for a customer
   */
  registerClient(customerId: string, socket: any): void {
    if (!this.connectedClients.has(customerId)) {
      this.connectedClients.set(customerId, new Set());
    }
    this.connectedClients.get(customerId)!.add(socket);
    console.log('[RealtimeService] Client registered for customer:', customerId);
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(customerId: string, socket: any): void {
    const clients = this.connectedClients.get(customerId);
    if (clients) {
      clients.delete(socket);
      if (clients.size === 0) {
        this.connectedClients.delete(customerId);
      }
    }
    console.log('[RealtimeService] Client unregistered for customer:', customerId);
  }

  /**
   * Send real-time notification to a customer
   */
  async notifyCustomer(customerId: string, notification: CustomerNotification): Promise<void> {
    const message: WebSocketMessage = {
      type: notification.type,
      data: notification.data,
      timestamp: notification.timestamp,
    };

    await this.sendWebSocketMessage(customerId, message);
  }

  /**
   * Send WebSocket message to all connected clients for a customer
   */
  private async sendWebSocketMessage(customerId: string, message: WebSocketMessage): Promise<void> {
    const clients = this.connectedClients.get(customerId);
    
    if (!clients || clients.size === 0) {
      console.log('[RealtimeService] No connected clients for customer:', customerId);
      return;
    }

    const messageStr = JSON.stringify(message);
    
    for (const client of clients) {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(messageStr);
        }
      } catch (error) {
        console.error('[RealtimeService] Failed to send message to client:', error);
      }
    }

    console.log('[RealtimeService] Message sent to', clients.size, 'clients for customer:', customerId);
  }

  /**
   * Handle payment success - notify customer of digital access
   */
  async handlePaymentSuccess(order: {
    id: string;
    customer_id?: string | null;
    customer_email: string;
    items: Array<{
      id: string;
      product_type: string;
    }>;
  }): Promise<void> {
    const digitalItems = order.items.filter(
      item => item.product_type === 'digital' || item.product_type === 'hybrid'
    );

    if (digitalItems.length === 0) {
      return;
    }

    // If customer has connected clients, send real-time notification
    if (order.customer_id) {
      await this.notifyCustomer(order.customer_id, {
        type: 'digital-access-granted',
        data: {
          orderId: order.id,
          itemCount: digitalItems.length,
          immediateAccess: true,
          message: `Your ${digitalItems.length} digital product${digitalItems.length > 1 ? 's' : ''} ${digitalItems.length > 1 ? 'are' : 'is'} ready for download!`,
        },
        timestamp: new Date(),
      });
    }

    console.log('[RealtimeService] Payment success handled for order:', order.id);
  }

  /**
   * Notify customer of download completion
   */
  async notifyDownloadComplete(customerId: string, data: {
    productName: string;
    accessToken: string;
    downloadsRemaining: number | null;
  }): Promise<void> {
    await this.notifyCustomer(customerId, {
      type: 'download-complete',
      data: {
        ...data,
        message: `Download complete for "${data.productName}"`,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Notify customer of expiring access
   */
  async notifyAccessExpiring(customerId: string, data: {
    productName: string;
    accessToken: string;
    daysUntilExpiration: number;
  }): Promise<void> {
    await this.notifyCustomer(customerId, {
      type: 'access-expiring',
      data: {
        ...data,
        message: `Access to "${data.productName}" expires in ${data.daysUntilExpiration} day${data.daysUntilExpiration !== 1 ? 's' : ''}`,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Notify customer of access revocation
   */
  async notifyAccessRevoked(customerId: string, data: {
    productName: string;
    reason: string;
  }): Promise<void> {
    await this.notifyCustomer(customerId, {
      type: 'access-revoked',
      data: {
        ...data,
        message: `Access to "${data.productName}" has been revoked: ${data.reason}`,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Get connected client count for a customer
   */
  getConnectedClientCount(customerId: string): number {
    return this.connectedClients.get(customerId)?.size || 0;
  }

  /**
   * Get total connected clients
   */
  getTotalConnectedClients(): number {
    let total = 0;
    for (const clients of this.connectedClients.values()) {
      total += clients.size;
    }
    return total;
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();
export default realtimeService;

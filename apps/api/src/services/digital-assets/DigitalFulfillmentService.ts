/**
 * Digital Fulfillment Service
 * Handles automatic fulfillment of digital products after payment
 */

import { prisma } from '../../prisma';
import { digitalAccessService } from './DigitalAccessService';
import { digitalDownloadEmailService } from '../email/DigitalDownloadEmailService';

export interface FulfillmentResult {
  success: boolean;
  accessGrants: Array<{
    orderItemId: string;
    productName: string;
    accessToken: string;
    downloadUrl: string;
  }>;
  errors: Array<{
    orderItemId: string;
    error: string;
  }>;
}

export class DigitalFulfillmentService {
  /**
   * Fulfill digital products for an order after successful payment
   */
  async fulfillOrder(orderId: string, baseUrl: string): Promise<FulfillmentResult> {
    console.log('[DigitalFulfillment] Processing order:', orderId);

    const result: FulfillmentResult = {
      success: true,
      accessGrants: [],
      errors: [],
    };

    try {
      // Get order with items
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: {
          order_items: {
            include: {
              inventory_items: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // Process each order item
      for (const orderItem of order.order_items) {
        const item = orderItem.inventory_items;
        
        if (!item) {
          console.warn('[DigitalFulfillment] No inventory item for order item:', orderItem.id);
          continue;
        }

        const productType = (item as any).product_type;

        // Only process digital and hybrid products
        if (productType !== 'digital' && productType !== 'hybrid') {
          continue;
        }

        console.log('[DigitalFulfillment] Processing digital product:', {
          orderItemId: orderItem.id,
          productName: item.name,
          productType,
        });

        try {
          // Create access grant
          const grant = await digitalAccessService.createAccessGrant({
            orderId: order.id,
            orderItemId: orderItem.id,
            inventoryItemId: item.id,
            customerEmail: order.customer_email,
            downloadLimit: (item as any).download_limit,
            accessDurationDays: (item as any).access_duration_days,
          });

          // Update order item status
          await prisma.order_items.update({
            where: { id: orderItem.id },
            data: {
              digital_delivery_status: 'delivered',
              digital_delivered_at: new Date(),
            },
          });

          // Generate download URL
          const downloadUrl = `${baseUrl}/api/download/${grant.accessToken}`;

          result.accessGrants.push({
            orderItemId: orderItem.id,
            productName: item.name || 'Digital Product',
            accessToken: grant.accessToken,
            downloadUrl,
          });

          console.log('[DigitalFulfillment] Access grant created:', {
            orderItemId: orderItem.id,
            accessToken: grant.accessToken.substring(0, 8) + '...',
          });

        } catch (error: any) {
          console.error('[DigitalFulfillment] Failed to create access grant:', error);
          
          result.errors.push({
            orderItemId: orderItem.id,
            error: error.message,
          });

          // Update order item with failed status
          await prisma.order_items.update({
            where: { id: orderItem.id },
            data: {
              digital_delivery_status: 'failed',
            },
          });
        }
      }

      // Mark overall success as false if any errors occurred
      if (result.errors.length > 0) {
        result.success = false;
      }

      console.log('[DigitalFulfillment] Order fulfillment complete:', {
        orderId,
        grantsCreated: result.accessGrants.length,
        errors: result.errors.length,
      });

      // Send email notification if any grants were created
      if (result.accessGrants.length > 0) {
        try {
          await this.sendDownloadEmail(order, result.accessGrants);
        } catch (emailError) {
          console.error('[DigitalFulfillment] Failed to send email:', emailError);
          // Don't fail fulfillment if email fails
        }
      }

      return result;

    } catch (error: any) {
      console.error('[DigitalFulfillment] Order fulfillment failed:', error);
      throw error;
    }
  }

  /**
   * Check if an order contains digital products
   */
  async hasDigitalProducts(orderId: string): Promise<boolean> {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        order_items: {
          include: {
            inventory_items: true,
          },
        },
      },
    });

    if (!order) return false;

    return order.order_items.some(item => {
      const productType = (item.inventory_items as any)?.product_type;
      return productType === 'digital' || productType === 'hybrid';
    });
  }

  /**
   * Get digital products from an order
   */
  async getDigitalProducts(orderId: string) {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        order_items: {
          include: {
            inventory_items: true,
          },
        },
      },
    });

    if (!order) return [];

    return order.order_items
      .filter(item => {
        const productType = (item.inventory_items as any)?.product_type;
        return productType === 'digital' || productType === 'hybrid';
      })
      .map(item => ({
        orderItemId: item.id,
        productName: item.inventory_items?.name || 'Digital Product',
        productType: (item.inventory_items as any)?.product_type,
        deliveryMethod: (item.inventory_items as any)?.digital_delivery_method,
        deliveryStatus: (item as any).digital_delivery_status,
        deliveredAt: (item as any).digital_delivered_at,
      }));
  }

  /**
   * Retry failed digital fulfillment
   */
  async retryFulfillment(orderId: string, baseUrl: string): Promise<FulfillmentResult> {
    console.log('[DigitalFulfillment] Retrying fulfillment for order:', orderId);

    // Get failed order items
    const failedItems = await prisma.order_items.findMany({
      where: {
        order_id: orderId,
        digital_delivery_status: 'failed',
      },
      include: {
        inventory_items: true,
      },
    });

    if (failedItems.length === 0) {
      console.log('[DigitalFulfillment] No failed items to retry');
      return {
        success: true,
        accessGrants: [],
        errors: [],
      };
    }

    // Reset status to pending
    await prisma.order_items.updateMany({
      where: {
        id: { in: failedItems.map(item => item.id) },
      },
      data: {
        digital_delivery_status: 'pending',
      },
    });

    // Retry fulfillment
    return this.fulfillOrder(orderId, baseUrl);
  }

  /**
   * Send download email to customer
   */
  private async sendDownloadEmail(order: any, accessGrants: FulfillmentResult['accessGrants']): Promise<void> {
    console.log('[DigitalFulfillment] Preparing download email for order:', order.id);

    // Get download details for each grant
    const downloads = await Promise.all(
      accessGrants.map(async (grant) => {
        const accessGrant = await prisma.digital_access_grants.findFirst({
          where: { access_token: grant.accessToken },
        });

        const item = await prisma.inventory_items.findUnique({
          where: { id: accessGrant?.inventory_item_id },
        });

        const assets = (item?.digital_assets as any[]) || [];
        const asset = assets[0];

        return {
          productName: grant.productName,
          downloadUrl: grant.downloadUrl,
          accessDurationDays: accessGrant?.expires_at 
            ? Math.ceil((accessGrant.expires_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null,
          downloadLimit: accessGrant?.download_limit || null,
          downloadsRemaining: accessGrant?.download_limit 
            ? accessGrant.download_limit - (accessGrant.download_count || 0)
            : null,
          fileSize: asset?.file_size_bytes,
          expiresAt: accessGrant?.expires_at,
        };
      })
    );

    // Send email
    await digitalDownloadEmailService.sendDownloadReceipt({
      customerEmail: order.customer_email,
      customerName: order.customer_name || 'Customer',
      orderId: order.id,
      orderNumber: order.order_number,
      orderTotal: order.total_cents,
      downloads,
    });

    console.log('[DigitalFulfillment] Download email sent to:', order.customer_email);
  }
}

// Export singleton instance
export const digitalFulfillmentService = new DigitalFulfillmentService();

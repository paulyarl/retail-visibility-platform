/**
 * Customer Notification Preferences Routes
 * 
 * Public endpoints for customer notification management:
 * - Get notification preferences
 * - Update notification preferences
 * 
 * Session management uses JWT tokens or httpOnly cookies (customer_session_id)
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { logger } from '../logger';

const router = Router();
const customerTokenService = CustomerTokenService.getInstance();

// Helper to extract customer ID from token or cookie
const getCustomerId = (req: Request): string | null => {
  const token = CustomerTokenService.extractBearerToken(req);
  if (token) {
    const payload = customerTokenService.verifyAccessToken(token);
    if (payload) return payload.customerId;
  }
  return req.cookies?.customer_session_id || null;
};

interface NotificationPreferences {
  // Order notifications
  orderUpdates: boolean;
  shippingUpdates: boolean;
  
  // Engagement notifications (hearts, reviews, lists)
  heartUpdates: boolean;
  reviewReminders: boolean;
  reviewResponses: boolean;
  listUpdates: boolean;
  listReminders: boolean;
  
  // Marketing notifications
  promotionalEmails: boolean;
  recommendedProducts: boolean;
  priceDropAlerts: boolean;
  backInStock: boolean;
  
  // SMS settings
  smsEnabled: boolean;
  smsPhone?: string;
}

/**
 * GET /api/customer-notifications/preferences
 * 
 * Get customer notification preferences
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authenticated',
      });
    }

    // Check if preferences exist
    let preferences = await prisma.customer_notification_preferences.findUnique({
      where: { customer_id: customerId },
    });

    // Create default preferences if not found
    if (!preferences) {
      preferences = await prisma.customer_notification_preferences.create({
        data: {
          customer_id: customerId,
          order_updates: true,
          shipping_updates: true,
          heart_updates: true,
          review_reminders: true,
          review_responses: true,
          list_updates: true,
          list_reminders: true,
          promotional_emails: false,
          recommended_products: true,
          price_drop_alerts: true,
          back_in_stock: true,
          sms_enabled: false,
          sms_phone: null,
        },
      });
    }

    res.json({
      success: true,
      preferences: {
        // Order notifications
        orderUpdates: preferences.order_updates,
        shippingUpdates: preferences.shipping_updates,
        
        // Engagement notifications
        heartUpdates: preferences.heart_updates,
        reviewReminders: preferences.review_reminders,
        reviewResponses: preferences.review_responses,
        listUpdates: preferences.list_updates,
        listReminders: preferences.list_reminders,
        
        // Marketing notifications
        promotionalEmails: preferences.promotional_emails,
        recommendedProducts: preferences.recommended_products,
        priceDropAlerts: preferences.price_drop_alerts,
        backInStock: preferences.back_in_stock,
        
        // SMS settings
        smsEnabled: preferences.sms_enabled,
        smsPhone: preferences.sms_phone,
      },
    });
  } catch (error: any) {
    logger.error('[CustomerNotifications API] Get preferences error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to get notification preferences',
    });
  }
});

/**
 * PUT /api/customer-notifications/preferences
 * 
 * Update customer notification preferences
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authenticated',
      });
    }

    const {
      orderUpdates,
      shippingUpdates,
      heartUpdates,
      reviewReminders,
      reviewResponses,
      listUpdates,
      listReminders,
      promotionalEmails,
      recommendedProducts,
      priceDropAlerts,
      backInStock,
      smsEnabled,
      smsPhone,
    } = req.body as NotificationPreferences;

    // Upsert preferences
    const preferences = await prisma.customer_notification_preferences.upsert({
      where: { customer_id: customerId },
      update: {
        // Order notifications
        order_updates: orderUpdates,
        shipping_updates: shippingUpdates,
        
        // Engagement notifications
        heart_updates: heartUpdates,
        review_reminders: reviewReminders,
        review_responses: reviewResponses,
        list_updates: listUpdates,
        list_reminders: listReminders,
        
        // Marketing notifications
        promotional_emails: promotionalEmails,
        recommended_products: recommendedProducts,
        price_drop_alerts: priceDropAlerts,
        back_in_stock: backInStock,
        
        // SMS settings
        sms_enabled: smsEnabled,
        sms_phone: smsPhone || null,
        updated_at: new Date(),
      },
      create: {
        customer_id: customerId,
        order_updates: orderUpdates ?? true,
        shipping_updates: shippingUpdates ?? true,
        heart_updates: heartUpdates ?? true,
        review_reminders: reviewReminders ?? true,
        review_responses: reviewResponses ?? true,
        list_updates: listUpdates ?? true,
        list_reminders: listReminders ?? true,
        promotional_emails: promotionalEmails ?? false,
        recommended_products: recommendedProducts ?? true,
        price_drop_alerts: priceDropAlerts ?? true,
        back_in_stock: backInStock ?? true,
        sms_enabled: smsEnabled ?? false,
        sms_phone: smsPhone || null,
      },
    });

    res.json({
      success: true,
      preferences: {
        // Order notifications
        orderUpdates: preferences.order_updates,
        shippingUpdates: preferences.shipping_updates,
        
        // Engagement notifications
        heartUpdates: preferences.heart_updates,
        reviewReminders: preferences.review_reminders,
        reviewResponses: preferences.review_responses,
        listUpdates: preferences.list_updates,
        listReminders: preferences.list_reminders,
        
        // Marketing notifications
        promotionalEmails: preferences.promotional_emails,
        recommendedProducts: preferences.recommended_products,
        priceDropAlerts: preferences.price_drop_alerts,
        backInStock: preferences.back_in_stock,
        
        // SMS settings
        smsEnabled: preferences.sms_enabled,
        smsPhone: preferences.sms_phone,
      },
      message: 'Notification preferences updated successfully',
    });
  } catch (error: any) {
    logger.error('[CustomerNotifications API] Update preferences error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to update notification preferences',
    });
  }
});

export default router;

import { prisma } from '../prisma';

export interface EmailDeliveryStatus {
  id: string;
  messageId: string;
  provider: string;
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
  recipient: string;
  subject: string;
  sentAt: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  webhookData?: any;
}

export interface TrackEmailParams {
  messageId: string;
  provider: string;
  recipient: string;
  subject: string;
  status?: 'pending' | 'sent';
}

export class EmailTrackingService {
  /**
   * Track a new email delivery
   */
  async trackEmail(params: TrackEmailParams): Promise<string> {
    try {
      const tracking = await prisma.email_delivery_tracking.create({
        data: {
          id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message_id: params.messageId,
          provider: params.provider,
          status: params.status || 'sent',
          recipient: params.recipient,
          subject: params.subject,
          sent_at: new Date(),
        },
      });

      return tracking.id;
    } catch (error) {
      console.error('[Email Tracking] Failed to track email:', error);
      // Don't fail email sending if tracking fails
      return `fallback_${Date.now()}`;
    }
  }

  /**
   * Update email delivery status
   */
  async updateStatus(
    messageId: string,
    status: 'delivered' | 'bounced' | 'failed',
    webhookData?: any,
    errorMessage?: string
  ): Promise<void> {
    try {
      await prisma.email_delivery_tracking.updateMany({
        where: { message_id: messageId },
        data: {
          status,
          delivered_at: status === 'delivered' ? new Date() : undefined,
          error_message: errorMessage,
          webhook_data: webhookData,
          updated_at: new Date(),
        },
      });
    } catch (error) {
      console.error('[Email Tracking] Failed to update status:', error);
    }
  }

  /**
   * Get delivery status for an email
   */
  async getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus | null> {
    try {
      const tracking = await prisma.email_delivery_tracking.findFirst({
        where: { message_id: messageId },
      });

      if (!tracking) return null;

      return {
        id: tracking.id,
        messageId: tracking.message_id,
        provider: tracking.provider,
        status: tracking.status as any,
        recipient: tracking.recipient,
        subject: tracking.subject,
        sentAt: tracking.sent_at,
        deliveredAt: tracking.delivered_at || undefined,
        errorMessage: tracking.error_message || undefined,
        webhookData: tracking.webhook_data,
      };
    } catch (error) {
      console.error('[Email Tracking] Failed to get status:', error);
      return null;
    }
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(timeframe: 'day' | 'week' | 'month' = 'day') {
    try {
      const since = new Date();
      switch (timeframe) {
        case 'day':
          since.setDate(since.getDate() - 1);
          break;
        case 'week':
          since.setDate(since.getDate() - 7);
          break;
        case 'month':
          since.setMonth(since.getMonth() - 1);
          break;
      }

      const stats = await prisma.email_delivery_tracking.groupBy({
        by: ['status', 'provider'],
        where: {
          sent_at: { gte: since },
        },
        _count: true,
      });

      return stats.reduce((acc, stat) => {
        if (!acc[stat.provider]) {
          acc[stat.provider] = {};
        }
        acc[stat.provider][stat.status] = stat._count;
        return acc;
      }, {} as Record<string, Record<string, number>>);
    } catch (error) {
      console.error('[Email Tracking] Failed to get stats:', error);
      return {};
    }
  }
}

export const emailTrackingService = new EmailTrackingService();

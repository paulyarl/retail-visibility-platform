import express from 'express';
import { emailService } from '../services/email-service';
import { emailTrackingService } from '../services/email-tracking.service';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

/**
 * GET /api/email/providers
 * Get status of all email providers
 */
router.get('/providers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = await emailService.getProviderStatus();
    res.json({
      success: true,
      providers: status,
    });
  } catch (error) {
    console.error('[Email Management] Failed to get provider status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get provider status',
    });
  }
});

/**
 * POST /api/email/providers/switch
 * Switch primary email provider
 */
router.post('/providers/switch', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider name is required',
      });
    }

    const success = await emailService.switchProvider(provider);
    
    if (success) {
      res.json({
        success: true,
        message: `Switched to ${provider} provider`,
        provider,
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to switch to ${provider} provider`,
      });
    }
  } catch (error) {
    console.error('[Email Management] Failed to switch provider:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to switch provider',
    });
  }
});

/**
 * POST /api/email/providers/test
 * Test all configured email providers
 */
router.post('/providers/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        error: 'Test email address is required',
      });
    }

    const results = await emailService.testAllProviders(testEmail);
    
    res.json({
      success: true,
      results,
      testEmail,
    });
  } catch (error) {
    console.error('[Email Management] Failed to test providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test providers',
    });
  }
});

/**
 * GET /api/email/tracking/:messageId
 * Get delivery status for a specific email
 */
router.get('/tracking/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const status = await emailTrackingService.getDeliveryStatus(messageId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Email tracking not found',
      });
    }

    res.json({
      success: true,
      tracking: status,
    });
  } catch (error) {
    console.error('[Email Management] Failed to get tracking status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tracking status',
    });
  }
});

/**
 * GET /api/email/stats
 * Get email delivery statistics
 */
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { timeframe = 'day' } = req.query;
    const stats = await emailTrackingService.getDeliveryStats(timeframe as 'day' | 'week' | 'month');
    
    res.json({
      success: true,
      stats,
      timeframe,
    });
  } catch (error) {
    console.error('[Email Management] Failed to get stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get delivery statistics',
    });
  }
});

/**
 * POST /api/email/webhook/sendgrid
 * SendGrid webhook for delivery tracking
 */
router.post('/webhook/sendgrid', async (req, res) => {
  try {
    const events = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    for (const event of events) {
      const { sg_message_id, event: eventType, reason } = event;
      
      if (!sg_message_id) continue;

      let status: 'delivered' | 'bounced' | 'failed';
      switch (eventType) {
        case 'delivered':
          status = 'delivered';
          break;
        case 'bounce':
        case 'blocked':
          status = 'bounced';
          break;
        case 'dropped':
        case 'spamreport':
        case 'unsubscribe':
          status = 'failed';
          break;
        default:
          continue; // Skip unknown events
      }

      await emailTrackingService.updateStatus(
        sg_message_id,
        status,
        event,
        reason
      );
    }

    res.status(200).json({ received: events.length });
  } catch (error) {
    console.error('[Email Webhook] SendGrid webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/email/webhook/ses
 * AWS SES webhook for delivery tracking
 */
router.post('/webhook/ses', async (req, res) => {
  try {
    const { Type, Message } = req.body;
    
    if (Type === 'SubscriptionConfirmation') {
      // Handle SNS subscription confirmation
      console.log('[Email Webhook] SES subscription confirmation received');
      return res.status(200).json({ message: 'Subscription confirmed' });
    }

    if (Type !== 'Notification') {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    const message = JSON.parse(Message);
    const { notificationType, mail } = message;
    
    if (!mail?.messageId) {
      return res.status(400).json({ error: 'Missing message ID' });
    }

    let status: 'delivered' | 'bounced' | 'failed';
    switch (notificationType) {
      case 'Delivery':
        status = 'delivered';
        break;
      case 'Bounce':
        status = 'bounced';
        break;
      case 'Complaint':
        status = 'failed';
        break;
      default:
        return res.status(200).json({ message: 'Event ignored' });
    }

    await emailTrackingService.updateStatus(
      mail.messageId,
      status,
      message,
      message.bounce?.bounceSubType || message.complaint?.complaintFeedbackType
    );

    res.status(200).json({ message: 'Webhook processed' });
  } catch (error) {
    console.error('[Email Webhook] SES webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;

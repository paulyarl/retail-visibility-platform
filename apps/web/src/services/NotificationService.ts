/**
 * Notification Service
 * Handles notification rules, channels, and delivery
 */

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  type: 'payment' | 'invoice' | 'trial' | 'subscription' | 'system';
  enabled: boolean;
  status: 'active' | 'error' | 'paused';
  trigger: string;
  conditions: Record<string, any>;
  channels: NotificationChannel[];
  template: string;
  successRate: number;
  lastSent?: string;
  nextSend?: string;
  sentCount: number;
  errorCount: number;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'sms' | 'push' | 'webhook' | 'slack';
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  lastUsed?: string;
}

export interface NotificationDelivery {
  id: string;
  ruleId: string;
  channel: string;
  recipient: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
  content: string;
}

export interface NotificationMetrics {
  totalRules: number;
  activeRules: number;
  totalDeliveries: number;
  successRate: number;
  errorCount: number;
  lastDelivery?: string;
}

class NotificationService {
  private static instance: NotificationService;
  private rules: Map<string, NotificationRule> = new Map();
  private channels: Map<string, NotificationChannel[]> = new Map();
  private deliveries: Map<string, NotificationDelivery[]> = new Map();

  private constructor() {
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private initializeDefaultRules(): void {
    const defaultRules: NotificationRule[] = [
      {
        id: 'payment-success-email',
        name: 'Payment Success Email',
        description: 'Send email confirmation when payment succeeds',
        type: 'payment',
        enabled: true,
        status: 'active',
        trigger: 'payment.success',
        conditions: { amount: { min: 0 } },
        channels: [
          {
            id: 'email-primary',
            type: 'email',
            name: 'Primary Email',
            enabled: true,
            config: { template: 'payment-success' }
          }
        ],
        template: 'payment-success-email',
        successRate: 98,
        lastSent: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        nextSend: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        sentCount: 45,
        errorCount: 1
      },
      {
        id: 'payment-failure-sms',
        name: 'Payment Failure SMS',
        description: 'Send SMS alert when payment fails',
        type: 'payment',
        enabled: true,
        status: 'active',
        trigger: 'payment.failed',
        conditions: { retryAttempts: { min: 1 } },
        channels: [
          {
            id: 'sms-alerts',
            type: 'sms',
            name: 'SMS Alerts',
            enabled: true,
            config: { template: 'payment-failure' }
          }
        ],
        template: 'payment-failure-sms',
        successRate: 92,
        lastSent: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        nextSend: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        sentCount: 12,
        errorCount: 1
      },
      {
        id: 'invoice-due-reminder',
        name: 'Invoice Due Reminder',
        description: 'Send reminder before invoice due date',
        type: 'invoice',
        enabled: true,
        status: 'active',
        trigger: 'invoice.due_soon',
        conditions: { daysBeforeDue: 3 },
        channels: [
          {
            id: 'email-reminders',
            type: 'email',
            name: 'Email Reminders',
            enabled: true,
            config: { template: 'invoice-due' }
          }
        ],
        template: 'invoice-due-reminder',
        successRate: 95,
        lastSent: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        nextSend: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        sentCount: 8,
        errorCount: 0
      },
      {
        id: 'trial-expiry-push',
        name: 'Trial Expiry Push',
        description: 'Send push notification before trial expires',
        type: 'trial',
        enabled: true,
        status: 'active',
        trigger: 'trial.expiring',
        conditions: { daysBeforeExpiry: 7 },
        channels: [
          {
            id: 'push-notifications',
            type: 'push',
            name: 'Push Notifications',
            enabled: true,
            config: { template: 'trial-expiry' }
          }
        ],
        template: 'trial-expiry-push',
        successRate: 88,
        lastSent: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        nextSend: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        sentCount: 3,
        errorCount: 0
      },
      {
        id: 'subscription-upgrade-webhook',
        name: 'Subscription Upgrade Webhook',
        description: 'Send webhook when subscription is upgraded',
        type: 'subscription',
        enabled: false,
        status: 'paused',
        trigger: 'subscription.upgraded',
        conditions: { tier: 'professional' },
        channels: [
          {
            id: 'webhook-integration',
            type: 'webhook',
            name: 'Webhook Integration',
            enabled: true,
            config: { url: 'https://api.example.com/webhooks/subscription' }
          }
        ],
        template: 'subscription-upgrade-webhook',
        successRate: 0,
        sentCount: 0,
        errorCount: 0
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
      this.deliveries.set(rule.id, []);
    });
  }

  private initializeDefaultChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'email-primary',
        type: 'email',
        name: 'Primary Email',
        enabled: true,
        config: { 
          smtp: 'smtp.gmail.com',
          from: 'noreply@platform.com',
          template: 'default'
        }
      },
      {
        id: 'sms-alerts',
        type: 'sms',
        name: 'SMS Alerts',
        enabled: true,
        config: { 
          provider: 'twilio',
          from: '+1234567890'
        }
      },
      {
        id: 'push-notifications',
        type: 'push',
        name: 'Push Notifications',
        enabled: true,
        config: { 
          service: 'fcm',
          key: 'push-service-key'
        }
      },
      {
        id: 'webhook-integration',
        type: 'webhook',
        name: 'Webhook Integration',
        enabled: true,
        config: { 
          url: 'https://api.example.com/webhooks',
          method: 'POST'
        }
      },
      {
        id: 'slack-channel',
        type: 'slack',
        name: 'Slack Channel',
        enabled: true,
        config: { 
          webhook: 'https://hooks.slack.com/services/...',
          channel: '#billing-alerts'
        }
      }
    ];

    this.channels.set('default', defaultChannels);
  }

  async getNotificationRules(): Promise<NotificationRule[]> {
    return Array.from(this.rules.values());
  }

  async getNotificationRule(id: string): Promise<NotificationRule | null> {
    return this.rules.get(id) || null;
  }

  async createNotificationRule(rule: Omit<NotificationRule, 'id' | 'sentCount' | 'errorCount'>): Promise<NotificationRule> {
    const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newRule: NotificationRule = {
      ...rule,
      id,
      sentCount: 0,
      errorCount: 0
    };

    this.rules.set(id, newRule);
    this.deliveries.set(id, []);
    return newRule;
  }

  async updateNotificationRule(id: string, updates: Partial<NotificationRule>): Promise<NotificationRule | null> {
    const rule = this.rules.get(id);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates } as NotificationRule;
    this.rules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteNotificationRule(id: string): Promise<boolean> {
    const deleted = this.rules.delete(id);
    if (deleted) {
      this.deliveries.delete(id);
    }
    return deleted;
  }

  async toggleNotificationRule(id: string): Promise<NotificationRule | null> {
    const rule = this.rules.get(id);
    if (!rule) return null;

    const updatedRule = {
      ...rule,
      enabled: !rule.enabled,
      status: (!rule.enabled ? 'active' : 'paused') as 'active' | 'error' | 'paused'
    } as NotificationRule;

    this.rules.set(id, updatedRule);
    return updatedRule;
  }

  async testNotificationRule(id: string): Promise<NotificationDelivery> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Notification rule ${id} not found`);
    }

    const delivery: NotificationDelivery = {
      id: `delivery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: id,
      channel: rule.channels[0]?.type || 'email',
      recipient: 'test@example.com',
      status: 'sent',
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      content: `Test notification for ${rule.name}`
    };

    // Store delivery
    const deliveries = this.deliveries.get(id) || [];
    deliveries.push(delivery);
    this.deliveries.set(id, deliveries);

    // Update rule metrics
    const updatedRule = { ...rule };
    updatedRule.sentCount += 1;
    updatedRule.lastSent = delivery.sentAt;
    updatedRule.successRate = updatedRule.sentCount > 0 
      ? ((updatedRule.sentCount - updatedRule.errorCount) / updatedRule.sentCount) * 100
      : 100;
    
    this.rules.set(id, updatedRule);
    
    return delivery;
  }

  async getNotificationDeliveries(ruleId: string, limit: number = 10): Promise<NotificationDelivery[]> {
    const deliveries = this.deliveries.get(ruleId) || [];
    return deliveries
      .sort((a, b) => new Date(b.sentAt || '').getTime() - new Date(a.sentAt || '').getTime())
      .slice(0, limit);
  }

  async getNotificationMetrics(): Promise<NotificationMetrics> {
    const rules = Array.from(this.rules.values());
    const totalDeliveries = Array.from(this.deliveries.values())
      .reduce((total, deliveries) => total + deliveries.length, 0);
    const totalErrors = rules.reduce((total, rule) => total + rule.errorCount, 0);
    const successRate = totalDeliveries > 0 ? ((totalDeliveries - totalErrors) / totalDeliveries) * 100 : 0;

    return {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.enabled && r.status === 'active').length,
      totalDeliveries,
      successRate,
      errorCount: totalErrors,
      lastDelivery: rules
        .filter(r => r.lastSent)
        .sort((a, b) => new Date(b.lastSent!).getTime() - new Date(a.lastSent!).getTime())[0]?.lastSent
    };
  }

  async getNotificationChannels(): Promise<NotificationChannel[]> {
    return this.channels.get('default') || [];
  }

  async createNotificationChannel(channel: Omit<NotificationChannel, 'id'>): Promise<NotificationChannel> {
    const id = `channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newChannel: NotificationChannel = { ...channel, id };
    
    const channels = this.channels.get('default') || [];
    channels.push(newChannel);
    this.channels.set('default', channels);
    
    return newChannel;
  }

  async updateNotificationChannel(id: string, updates: Partial<NotificationChannel>): Promise<NotificationChannel | null> {
    const channels = this.channels.get('default') || [];
    const index = channels.findIndex(c => c.id === id);
    if (index === -1) return null;

    const updatedChannel = { ...channels[index], ...updates };
    channels[index] = updatedChannel;
    this.channels.set('default', channels);
    
    return updatedChannel;
  }

  async deleteNotificationChannel(id: string): Promise<boolean> {
    const channels = this.channels.get('default') || [];
    const index = channels.findIndex(c => c.id === id);
    if (index === -1) return false;

    channels.splice(index, 1);
    this.channels.set('default', channels);
    
    return true;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

// React hook for notifications
import { useState, useEffect } from 'react';

export function useNotifications() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [metrics, setMetrics] = useState<NotificationMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const [rulesData, channelsData, metricsData] = await Promise.all([
        notificationService.getNotificationRules(),
        notificationService.getNotificationChannels(),
        notificationService.getNotificationMetrics()
      ]);
      setRules(rulesData);
      setChannels(channelsData);
      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const createRule = async (rule: Omit<NotificationRule, 'id' | 'sentCount' | 'errorCount'>) => {
    try {
      await notificationService.createNotificationRule(rule);
      await loadNotifications(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create notification rule');
    }
  };

  const updateRule = async (id: string, updates: Partial<NotificationRule>) => {
    try {
      await notificationService.updateNotificationRule(id, updates);
      await loadNotifications(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update notification rule');
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await notificationService.deleteNotificationRule(id);
      await loadNotifications(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete notification rule');
    }
  };

  const toggleRule = async (id: string) => {
    try {
      await notificationService.toggleNotificationRule(id);
      await loadNotifications(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to toggle notification rule');
    }
  };

  const testRule = async (id: string) => {
    try {
      const delivery = await notificationService.testNotificationRule(id);
      await loadNotifications(); // Refresh data
      return delivery;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to test notification rule');
    }
  };

  const createChannel = async (channel: Omit<NotificationChannel, 'id'>) => {
    try {
      await notificationService.createNotificationChannel(channel);
      await loadNotifications(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create notification channel');
    }
  };

  const updateChannel = async (id: string, updates: Partial<NotificationChannel>) => {
    try {
      await notificationService.updateNotificationChannel(id, updates);
      await loadNotifications(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update notification channel');
    }
  };

  const deleteChannel = async (id: string) => {
    try {
      await notificationService.deleteNotificationChannel(id);
      await loadNotifications(); // Refresh data
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete notification channel');
    }
  };

  return {
    rules,
    channels,
    metrics,
    loading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    testRule,
    createChannel,
    updateChannel,
    deleteChannel,
    refreshNotifications: loadNotifications
  };
}

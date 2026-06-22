/**
 * Bot Channel Steering Service
 *
 * Detects when the bot cannot answer and steers the user toward the best
 * available human channel based on the tenant's CRM capabilities.
 *
 * Channels evaluated (in priority order):
 * - customer_ticket: tenant allows customers to create support tickets
 * - anonymous_inquiry: tenant accepts anonymous inquiries
 * - help_desk: platform-wide help desk inquiry (always available fallback)
 */

import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { logger } from '../logger';

export type SteeringChannelType = 'customer_ticket' | 'anonymous_inquiry' | 'help_desk';

export interface SteeringChannel {
  type: SteeringChannelType;
  label: string;
  enabled: boolean;
  // Public relative URL the widget can open (or use as form action)
  actionUrl: string;
  // Short description shown alongside the button
  description: string;
}

export interface SteeringResult {
  reply: string;
  channels: SteeringChannel[];
}

class BotChannelSteeringService {
  private static instance: BotChannelSteeringService;

  private constructor() {}

  static getInstance(): BotChannelSteeringService {
    if (!BotChannelSteeringService.instance) {
      BotChannelSteeringService.instance = new BotChannelSteeringService();
    }
    return BotChannelSteeringService.instance;
  }

  /**
   * Resolve which CRM-based channels are available for a tenant and build a
   * contextual steering message that directs the user to the best option.
   */
  async resolveChannels(tenantId: string): Promise<SteeringChannel[]> {
    const channels: SteeringChannel[] = [];

    try {
      const caps = await resolveEffectiveCapabilities(tenantId);
      const crm = caps?.effective.crm;

      if (crm?.enabled) {
        if (crm.customer_tickets_enabled) {
          channels.push({
            type: 'customer_ticket',
            label: 'Create a Support Ticket',
            enabled: true,
            actionUrl: '/account/support/new',
            description: 'Open a ticket and track its status. Requires a customer account.',
          });
        }

        const inquiryEnabled =
          crm.inquiry_product_enabled ||
          crm.inquiry_storefront_enabled ||
          crm.inquiry_directory_enabled ||
          crm.allowed_inquiry_types.includes('crm_inquiry_anonymous');

        if (inquiryEnabled) {
          channels.push({
            type: 'anonymous_inquiry',
            label: 'Send an Inquiry',
            enabled: true,
            actionUrl: `/tenant/${tenantId}`,
            description: 'Send a message without needing an account. Someone will follow up.',
          });
        }
      }

      // Platform help desk is always available as a final safety net
      channels.push({
        type: 'help_desk',
        label: 'Contact Platform Help Desk',
        enabled: true,
        actionUrl: '/support',
        description: 'Reach platform support for technical issues.',
      });
    } catch (error) {
      logger.warn('[BotChannelSteeringService] Failed to resolve CRM capabilities', undefined, {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });

      // If capability resolution fails, still offer the platform help desk
      channels.push({
        type: 'help_desk',
        label: 'Contact Platform Help Desk',
        enabled: true,
        actionUrl: '/support',
        description: 'Reach platform support for technical issues.',
      });
    }

    return channels;
  }

  /**
   * Build a natural steering message that mentions the available channels.
   */
  buildSteeringMessage(botName: string, channels: SteeringChannel[]): string {
    const enabled = channels.filter(c => c.enabled);

    if (enabled.length === 0) {
      return `I'm not able to answer that right now. Please try again later.`;
    }

    if (enabled.length === 1) {
      return `I'm not able to answer that right now. You can ${enabled[0].description.toLowerCase()}`;
    }

    const main = enabled[0];
    const alternatives = enabled.slice(1);
    const altText = alternatives.map(c => c.label.toLowerCase()).join(' or ');

    return `I'm not able to answer that right now. ${main.description} You can also ${altText} if you prefer.`;
  }

  /**
   * High-level helper: resolve channels and produce a steering result.
   */
  async steer(tenantId: string, botName: string): Promise<SteeringResult> {
    const channels = await this.resolveChannels(tenantId);
    const reply = this.buildSteeringMessage(botName, channels);
    return { reply, channels };
  }
}

export default BotChannelSteeringService;

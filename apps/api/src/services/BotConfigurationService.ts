/**
 * Bot Configuration Service
 *
 * CRUD for per-tenant bot configuration.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface BotConfig {
  id: string;
  tenantId: string;
  botName: string;
  tone: string;
  responseLength: string;
  fallbackMessage: string;
  greeting: string;
  widgetPosition: string;
  widgetColor: string;
  widgetOffsetX: number;
  widgetOffsetY: number;
  widgetFont: string;
  widgetAvatarUrl: string | null;
  autoOpen: boolean;
  autoOpenDelay: number;
  afterHoursEnabled: boolean;
  afterHoursMessage: string | null;
  businessHoursSource: string;
  preChatEnabled: boolean;
  preChatEmail: boolean;
  preChatPhone: boolean;
  preChatOrder: boolean;
  status: string;
  escalationEnabled: boolean;
  escalationMessage: string | null;
}

function toConfig(row: any): BotConfig {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    botName: row.bot_name,
    tone: row.tone,
    responseLength: row.response_length,
    fallbackMessage: row.fallback_message,
    greeting: row.greeting,
    widgetPosition: row.widget_position,
    widgetColor: row.widget_color,
    widgetOffsetX: row.widget_offset_x,
    widgetOffsetY: row.widget_offset_y,
    widgetFont: row.widget_font,
    widgetAvatarUrl: row.widget_avatar_url,
    autoOpen: row.auto_open,
    autoOpenDelay: row.auto_open_delay,
    afterHoursEnabled: row.after_hours_enabled,
    afterHoursMessage: row.after_hours_message,
    businessHoursSource: row.business_hours_source,
    preChatEnabled: row.pre_chat_enabled,
    preChatEmail: row.pre_chat_email,
    preChatPhone: row.pre_chat_phone,
    preChatOrder: row.pre_chat_order,
    status: row.status,
    escalationEnabled: row.escalation_enabled,
    escalationMessage: row.escalation_message,
  };
}

export class BotConfigurationService {
  private static instance: BotConfigurationService;

  static getInstance(): BotConfigurationService {
    if (!BotConfigurationService.instance) {
      BotConfigurationService.instance = new BotConfigurationService();
    }
    return BotConfigurationService.instance;
  }

  async getOrCreate(tenantId: string): Promise<BotConfig> {
    let config = await prisma.bot_configurations.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!config) {
      config = await prisma.bot_configurations.create({
        data: { tenant_id: tenantId },
      });
      logger.info('[BotConfigurationService] Created default config', undefined, { tenantId });
    }

    return toConfig(config);
  }

  async update(tenantId: string, data: Partial<BotConfig>): Promise<BotConfig> {
    const updateData: Record<string, any> = {};
    if (data.botName !== undefined) updateData.bot_name = data.botName;
    if (data.tone !== undefined) updateData.tone = data.tone;
    if (data.responseLength !== undefined) updateData.response_length = data.responseLength;
    if (data.fallbackMessage !== undefined) updateData.fallback_message = data.fallbackMessage;
    if (data.greeting !== undefined) updateData.greeting = data.greeting;
    if (data.widgetPosition !== undefined) updateData.widget_position = data.widgetPosition;
    if (data.widgetColor !== undefined) updateData.widget_color = data.widgetColor;
    if (data.widgetOffsetX !== undefined) updateData.widget_offset_x = data.widgetOffsetX;
    if (data.widgetOffsetY !== undefined) updateData.widget_offset_y = data.widgetOffsetY;
    if (data.widgetFont !== undefined) updateData.widget_font = data.widgetFont;
    if (data.widgetAvatarUrl !== undefined) updateData.widget_avatar_url = data.widgetAvatarUrl;
    if (data.autoOpen !== undefined) updateData.auto_open = data.autoOpen;
    if (data.autoOpenDelay !== undefined) updateData.auto_open_delay = data.autoOpenDelay;
    if (data.afterHoursEnabled !== undefined) updateData.after_hours_enabled = data.afterHoursEnabled;
    if (data.afterHoursMessage !== undefined) updateData.after_hours_message = data.afterHoursMessage;
    if (data.businessHoursSource !== undefined) updateData.business_hours_source = data.businessHoursSource;
    if (data.preChatEnabled !== undefined) updateData.pre_chat_enabled = data.preChatEnabled;
    if (data.preChatEmail !== undefined) updateData.pre_chat_email = data.preChatEmail;
    if (data.preChatPhone !== undefined) updateData.pre_chat_phone = data.preChatPhone;
    if (data.preChatOrder !== undefined) updateData.pre_chat_order = data.preChatOrder;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.escalationEnabled !== undefined) updateData.escalation_enabled = data.escalationEnabled;
    if (data.escalationMessage !== undefined) updateData.escalation_message = data.escalationMessage;
    updateData.updated_at = new Date();

    const config = await prisma.bot_configurations.update({
      where: { tenant_id: tenantId },
      data: updateData,
    });

    return toConfig(config);
  }

  async getPublicConfig(tenantId: string) {
    const config = await this.getOrCreate(tenantId);

    // Load platform logo as default avatar fallback
    let platformLogoUrl: string | null = null;
    try {
      const platformSettings = await prisma.platform_settings_list.findUnique({
        where: { id: 1 },
      });
      platformLogoUrl = platformSettings?.logo_url || null;
    } catch {
      // Non-critical fallback
    }

    return {
      botName: config.botName,
      greeting: config.greeting,
      widgetPosition: config.widgetPosition,
      widgetColor: config.widgetColor,
      widgetOffsetX: config.widgetOffsetX,
      widgetOffsetY: config.widgetOffsetY,
      widgetFont: config.widgetFont,
      widgetAvatarUrl: config.widgetAvatarUrl,
      platformLogoUrl,
      autoOpen: config.autoOpen,
      autoOpenDelay: config.autoOpenDelay,
      afterHoursEnabled: config.afterHoursEnabled,
      afterHoursMessage: config.afterHoursMessage,
      preChatEnabled: config.preChatEnabled,
      preChatEmail: config.preChatEmail,
      preChatPhone: config.preChatPhone,
      preChatOrder: config.preChatOrder,
      status: config.status,
    };
  }

  /**
   * Get a context-aware greeting based on page context and business hours.
   * - product: "Have a question about this product?"
   * - category: "Looking for something in this category?"
   * - storefront: default greeting
   * - after-hours: after-hours message if enabled
   */
  getContextualGreeting(config: BotConfig, pageContext?: string | null, isOpen?: boolean, contextEntityName?: string | null): string {
    if (config.afterHoursEnabled && isOpen === false && config.afterHoursMessage) {
      return config.afterHoursMessage;
    }

    const ctx = (pageContext || '').toLowerCase();
    if (ctx === 'product') {
      if (contextEntityName) {
        return `Hi! Have a question about ${contextEntityName}? I'm here to help.`;
      }
      return `Hi! Have a question about this product? I'm here to help.`;
    }
    if (ctx === 'category') {
      if (contextEntityName) {
        return `Hi! Looking for something in ${contextEntityName}? Ask me anything.`;
      }
      return `Hi! Looking for something in this category? Ask me anything.`;
    }

    return config.greeting;
  }
}

export default BotConfigurationService;

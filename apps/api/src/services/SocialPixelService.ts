/**
 * Social Pixel Service
 * Phase 2C: Social Pixels & Conversion Tracking
 *
 * Manages per-tenant Meta Pixel and TikTok Pixel configuration.
 * Supports both client-side pixel injection and server-side Conversions API / Events API.
 */

import { prisma } from '../prisma';
import { generateSocialPixelId } from '../lib/id-generator';
import { logger } from '../logger';
import crypto from 'crypto';

export interface PixelConfig {
  metaPixelId: string | null;
  metaAccessToken: string | null;
  tiktokPixelId: string | null;
  tiktokAccessToken: string | null;
}

export interface PublicPixelConfig {
  metaPixelId: string | null;
  tiktokPixelId: string | null;
}

class SocialPixelService {
  /**
   * Get full pixel config for a tenant (includes access tokens — server-side only)
   */
  async getPixelConfig(tenantId: string): Promise<PixelConfig | null> {
    try {
      const record = await prisma.tenant_social_pixels.findUnique({
        where: { tenant_id: tenantId },
      });

      if (!record) return null;

      return {
        metaPixelId: record.meta_pixel_id,
        metaAccessToken: record.meta_access_token,
        tiktokPixelId: record.tiktok_pixel_id,
        tiktokAccessToken: record.tiktok_access_token,
      };
    } catch (error) {
      logger.error('SocialPixel: Error getting config', undefined, { tenantId, error: String(error) });
      return null;
    }
  }

  /**
   * Get public pixel config (no tokens — safe for client-side)
   */
  async getPublicPixelConfig(tenantId: string): Promise<PublicPixelConfig | null> {
    try {
      const record = await prisma.tenant_social_pixels.findUnique({
        where: { tenant_id: tenantId },
        select: {
          meta_pixel_id: true,
          tiktok_pixel_id: true,
        },
      });

      if (!record) return null;

      return {
        metaPixelId: record.meta_pixel_id,
        tiktokPixelId: record.tiktok_pixel_id,
      };
    } catch (error) {
      logger.error('SocialPixel: Error getting public config', undefined, { tenantId, error: String(error) });
      return null;
    }
  }

  /**
   * Upsert pixel config for a tenant
   */
  async upsertPixelConfig(
    tenantId: string,
    config: Partial<PixelConfig>
  ): Promise<PixelConfig | null> {
    try {
      const existing = await prisma.tenant_social_pixels.findUnique({
        where: { tenant_id: tenantId },
      });

      if (existing) {
        const updated = await prisma.tenant_social_pixels.update({
          where: { tenant_id: tenantId },
          data: {
            meta_pixel_id: config.metaPixelId !== undefined ? config.metaPixelId : existing.meta_pixel_id,
            meta_access_token: config.metaAccessToken !== undefined ? config.metaAccessToken : existing.meta_access_token,
            tiktok_pixel_id: config.tiktokPixelId !== undefined ? config.tiktokPixelId : existing.tiktok_pixel_id,
            tiktok_access_token: config.tiktokAccessToken !== undefined ? config.tiktokAccessToken : existing.tiktok_access_token,
            updated_at: new Date(),
          },
        });

        return {
          metaPixelId: updated.meta_pixel_id,
          metaAccessToken: updated.meta_access_token,
          tiktokPixelId: updated.tiktok_pixel_id,
          tiktokAccessToken: updated.tiktok_access_token,
        };
      } else {
        const id = generateSocialPixelId(tenantId);
        const created = await prisma.tenant_social_pixels.create({
          data: {
            id,
            tenant_id: tenantId,
            meta_pixel_id: config.metaPixelId || null,
            meta_access_token: config.metaAccessToken || null,
            tiktok_pixel_id: config.tiktokPixelId || null,
            tiktok_access_token: config.tiktokAccessToken || null,
          },
        });

        return {
          metaPixelId: created.meta_pixel_id,
          metaAccessToken: created.meta_access_token,
          tiktokPixelId: created.tiktok_pixel_id,
          tiktokAccessToken: created.tiktok_access_token,
        };
      }
    } catch (error) {
      logger.error('SocialPixel: Error upserting config', undefined, { tenantId, error: String(error) });
      return null;
    }
  }

  /**
   * Send server-side Purchase event to Meta Conversions API
   */
  async sendMetaConversionEvent(
    tenantId: string,
    event: {
      eventName: string;
      eventId?: string;
      value: number;
      currency: string;
      email?: string;
      phone?: string;
      userAgent?: string;
      url?: string;
    }
  ): Promise<boolean> {
    try {
      const config = await this.getPixelConfig(tenantId);
      if (!config?.metaPixelId || !config?.metaAccessToken) {
        return false;
      }

      const eventData = {
        data: [
          {
            event_name: event.eventName,
            event_id: event.eventId,
            value: event.value,
            currency: event.currency,
            user_data: {
              em: event.email ? hashValue(event.email) : undefined,
              ph: event.phone ? hashValue(event.phone) : undefined,
              client_ip_address: undefined,
              client_user_agent: event.userAgent,
            },
            action_source: 'website',
            event_source_url: event.url,
          },
        ],
      };

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${config.metaPixelId}/events?access_token=${config.metaAccessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('SocialPixel: Meta Conversions API error', undefined, { tenantId, error: errorText });
        return false;
      }

      logger.info('SocialPixel: Meta conversion event sent', undefined, { tenantId, eventName: event.eventName });
      return true;
    } catch (error) {
      logger.error('SocialPixel: Meta conversion error', undefined, { tenantId, error: String(error) });
      return false;
    }
  }

  /**
   * Send server-side Purchase event to TikTok Events API
   */
  async sendTikTokConversionEvent(
    tenantId: string,
    event: {
      eventName: string;
      eventId?: string;
      value: number;
      currency: string;
      email?: string;
      phone?: string;
      userAgent?: string;
      url?: string;
    }
  ): Promise<boolean> {
    try {
      const config = await this.getPixelConfig(tenantId);
      if (!config?.tiktokPixelId || !config?.tiktokAccessToken) {
        return false;
      }

      const eventData = {
        pixel_code: config.tiktokPixelId,
        event: event.eventName,
        event_id: event.eventId,
        value: event.value,
        currency: event.currency,
        context: {
          user: {
            email: event.email ? hashValue(event.email) : undefined,
            phone_number: event.phone ? hashValue(event.phone) : undefined,
            user_agent: event.userAgent,
          },
          page: {
            url: event.url,
          },
        },
      };

      const response = await fetch(
        `https://business-api.tiktok.com/open_api/v1.3/event/track/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Token': config.tiktokAccessToken,
          },
          body: JSON.stringify(eventData),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('SocialPixel: TikTok Events API error', undefined, { tenantId, error: errorText });
        return false;
      }

      logger.info('SocialPixel: TikTok conversion event sent', undefined, { tenantId, eventName: event.eventName });
      return true;
    } catch (error) {
      logger.error('SocialPixel: TikTok conversion error', undefined, { tenantId, error: String(error) });
      return false;
    }
  }
}

/**
 * SHA-256 hash a value for Conversions API user data (PII hashing)
 */
function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export const socialPixelService = new SocialPixelService();

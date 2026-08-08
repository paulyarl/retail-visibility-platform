/**
 * Gallery Analytics Service
 *
 * Tracks engagement events for diagnostic gallery tokens, aggregates them
 * into per-token per-day rollups, and provides query methods for the admin
 * analytics dashboard.
 *
 * Pattern: singleton extends BaseService (mirrors QrAnalyticsService).
 * Design doc: docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md §12 Sprint 4
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import { prisma } from '../prisma';
import { generateGalleryEventId, generateGalleryAnalyticsId } from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';
import { audit } from '../audit';
import type { RequestCtx } from '../context';
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────

export type GalleryEventType =
  | 'gallery_opened'
  | 'screenshot_viewed'
  | 'carousel_next'
  | 'carousel_prev'
  | 'cta_clicked'
  | 'cta_hovered'
  | 'session_heartbeat'
  | 'session_end';

export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown';

export interface GalleryEventInput {
  tokenId: string;
  campaignId: string;
  siblingCampaignId?: string;
  tenantId?: string;
  sessionId?: string;
  eventType: GalleryEventType;
  screenshotIndex?: number;
  screenshotId?: string;
  dwellMs?: number;
  clientWidth?: number;
  clientHeight?: number;
  referrer?: string;
  userAgent?: string;
  ip?: string;
}

export interface TrackEventContext {
  userAgent?: string;
  ip?: string;
  referrer?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

const ALLOWED_EVENT_TYPES: GalleryEventType[] = [
  'gallery_opened',
  'screenshot_viewed',
  'carousel_next',
  'carousel_prev',
  'cta_clicked',
  'cta_hovered',
  'session_heartbeat',
  'session_end',
];

function parseDeviceType(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = unifiedConfig.galleryIpHashSalt;
  if (!salt) return null; // graceful degradation — no salt, no hash
  return crypto.createHash('sha256').update(`${ip}${salt}`).digest('hex');
}

// ─── In-memory rate limiter (60 events/min per IP) ──────────────────────

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_EVENTS = 60;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_EVENTS;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

// ─── Service ────────────────────────────────────────────────────────────

export class GalleryAnalyticsService extends BaseService {
  private static instance: GalleryAnalyticsService;

  private constructor() {
    super();
  }

  static getInstance(): GalleryAnalyticsService {
    if (!GalleryAnalyticsService.instance) {
      GalleryAnalyticsService.instance = new GalleryAnalyticsService();
    }
    return GalleryAnalyticsService.instance;
  }

  // ====================
  // EVENT TRACKING
  // ====================

  /**
   * Track a single engagement event. Fire-and-forget — catches errors and
   * logs them, never throws (G12). Analytics must never block UX.
   *
   * On `gallery_opened` when token.viewed_at is null, stamps viewed_at and
   * logs an audit event (G24 — operator sees it in the analytics activity feed).
   */
  async trackEvent(input: GalleryEventInput, ctx?: RequestCtx): Promise<void> {
    try {
      const deviceType = parseDeviceType(input.userAgent);
      const ipHash = hashIp(input.ip);

      const event = await prisma.mkt_gallery_events.create({
        data: {
          id: generateGalleryEventId(),
          tenant_id: input.tenantId || 'platform',
          token_id: input.tokenId,
          campaign_id: input.campaignId,
          sibling_campaign_id: input.siblingCampaignId || null,
          session_id: input.sessionId || null,
          event_type: input.eventType,
          screenshot_index: input.screenshotIndex ?? null,
          screenshot_id: input.screenshotId ?? null,
          dwell_ms: input.dwellMs ?? null,
          client_width: input.clientWidth ?? null,
          client_height: input.clientHeight ?? null,
          referrer: input.referrer || null,
          user_agent: input.userAgent || null,
          ip_hash: ipHash,
          device_type: deviceType,
        } as any,
      });

      // First-view side effects (G24)
      if (input.eventType === 'gallery_opened') {
        await this.handleFirstView(input.tokenId, input.campaignId, ctx);
      }

      logger.info('Gallery event tracked', ctx, {
        eventId: event.id,
        eventType: input.eventType,
        tokenId: input.tokenId,
        campaignId: input.campaignId,
      });
    } catch (error) {
      // Fire-and-forget — log but don't throw
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Gallery event tracking failed (fire-and-forget)', ctx, { error: msg, eventType: input.eventType, tokenId: input.tokenId });
    }
  }

  /**
   * Track multiple events in a batch. Uses createMany in a transaction.
   * Fire-and-forget — catches errors and logs them, never throws.
   */
  async trackEvents(inputs: GalleryEventInput[], ctx?: RequestCtx): Promise<number> {
    let tracked = 0;
    try {
      const records = inputs.map((input) => {
        const deviceType = parseDeviceType(input.userAgent);
        const ipHash = hashIp(input.ip);
        return {
          id: generateGalleryEventId(),
          tenant_id: input.tenantId || 'platform',
          token_id: input.tokenId,
          campaign_id: input.campaignId,
          session_id: input.sessionId || null,
          event_type: input.eventType,
          screenshot_index: input.screenshotIndex ?? null,
          screenshot_id: input.screenshotId ?? null,
          dwell_ms: input.dwellMs ?? null,
          client_width: input.clientWidth ?? null,
          client_height: input.clientHeight ?? null,
          referrer: input.referrer || null,
          user_agent: input.userAgent || null,
          ip_hash: ipHash,
          device_type: deviceType,
        };
      });

      await prisma.mkt_gallery_events.createMany({ data: records });
      tracked = records.length;

      // Handle first-view for any gallery_opened events in the batch
      for (const input of inputs) {
        if (input.eventType === 'gallery_opened') {
          await this.handleFirstView(input.tokenId, input.campaignId, ctx);
        }
      }

      logger.info('Gallery batch events tracked', ctx, { count: tracked, campaignId: inputs[0]?.campaignId });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Gallery batch tracking failed (fire-and-forget)', ctx, { error: msg, count: inputs.length });
    }
    return tracked;
  }

  /**
   * First-view side effects (G24):
   * 1. Stamp viewed_at on token if null
   * 2. Log audit event (visible in admin analytics activity feed)
   */
  private async handleFirstView(tokenId: string, campaignId: string, ctx?: RequestCtx): Promise<void> {
    try {
      const token = await prisma.mkt_deliverable_preview_tokens.findUnique({
        where: { id: tokenId },
        select: { id: true, viewed_at: true, mkt_campaigns_list: { select: { business_name: true } } },
      });
      if (!token || token.viewed_at) return;

      await prisma.mkt_deliverable_preview_tokens.update({
        where: { id: tokenId },
        data: { viewed_at: new Date() },
      });

      // Audit log — operator sees this in the analytics activity feed
      await audit({
        tenantId: 'platform',
        actor: null,
        actorType: 'customer',
        action: 'update',
        payload: {
          entity_type: 'other',
          action_detail: 'gallery_first_view',
          token_id: tokenId,
          campaign_id: campaignId,
          business_name: token.mkt_campaigns_list?.business_name ?? null,
        },
      });
    } catch (error) {
      // Fire-and-forget — don't fail the trackEvent call
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Gallery first-view side effect failed', ctx, { error: msg, tokenId, campaignId });
    }
  }

  // ====================
  // QUERY METHODS
  // ====================

  /**
   * Get per-token analytics summary.
   */
  async getTokenAnalytics(tokenId: string, ctx?: RequestCtx): Promise<any> {
    try {
      const events = await prisma.mkt_gallery_events.findMany({
        where: { token_id: tokenId },
        orderBy: { created_at: 'desc' },
      });

      const opens = events.filter((e) => e.event_type === 'gallery_opened').length;
      const sessions = new Set(events.filter((e) => e.session_id).map((e) => e.session_id)).size;
      const screenshotViews = events.filter((e) => e.event_type === 'screenshot_viewed').length;
      const carouselNavs = events.filter((e) => e.event_type === 'carousel_next' || e.event_type === 'carousel_prev').length;
      const ctaClicks = events.filter((e) => e.event_type === 'cta_clicked').length;
      const ctaHovers = events.filter((e) => e.event_type === 'cta_hovered').length;

      // avg_session_duration: MAX(dwell_ms) per session, then average (G27)
      const sessionMaxDwell = new Map<string, number>();
      for (const e of events) {
        if (e.session_id && e.dwell_ms != null) {
          const current = sessionMaxDwell.get(e.session_id) ?? 0;
          if (e.dwell_ms > current) {
            sessionMaxDwell.set(e.session_id, e.dwell_ms);
          }
        }
      }
      const avgSessionDuration = sessionMaxDwell.size > 0
        ? Math.round([...sessionMaxDwell.values()].reduce((a, b) => a + b, 0) / sessionMaxDwell.size)
        : 0;

      const mobileViews = events.filter((e) => e.device_type === 'mobile').length;
      const desktopViews = events.filter((e) => e.device_type === 'desktop').length;
      const tabletViews = events.filter((e) => e.device_type === 'tablet').length;

      return {
        tokenId,
        totalEvents: events.length,
        totalOpens: opens,
        uniqueSessions: sessions,
        totalScreenshotViews: screenshotViews,
        totalCarouselNavs: carouselNavs,
        ctaClicks,
        ctaHovers,
        avgSessionDurationMs: avgSessionDuration,
        mobileViews,
        desktopViews,
        tabletViews,
      };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get per-campaign analytics — aggregate across all tokens for a campaign.
   */
  async getCampaignAnalytics(campaignId: string, ctx?: RequestCtx): Promise<any> {
    try {
      const tokens = await prisma.mkt_deliverable_preview_tokens.findMany({
        where: { campaign_id: campaignId, token_type: 'diagnostic_gallery' },
        select: { id: true, gallery_archetype: true, created_at: true, viewed_at: true, converted_at: true, expires_at: true },
      });

      const tokenAnalytics = await Promise.all(
        tokens.map(async (t) => ({
          tokenId: t.id,
          archetype: t.gallery_archetype,
          createdAt: t.created_at,
          viewedAt: t.viewed_at,
          convertedAt: t.converted_at,
          expiresAt: t.expires_at,
          ...(await this.getTokenAnalytics(t.id, ctx)),
        }))
      );

      // Aggregate totals
      const totalOpens = tokenAnalytics.reduce((sum, t) => sum + t.totalOpens, 0);
      const uniqueSessions = tokenAnalytics.reduce((sum, t) => sum + t.uniqueSessions, 0);
      const ctaClicks = tokenAnalytics.reduce((sum, t) => sum + t.ctaClicks, 0);
      const viewedTokens = tokens.filter((t) => t.viewed_at !== null).length;

      return {
        campaignId,
        totalTokens: tokens.length,
        viewedTokens,
        totalOpens,
        uniqueSessions,
        ctaClicks,
        ctaCtr: uniqueSessions > 0 ? Math.round((ctaClicks / uniqueSessions) * 100) : 0,
        perToken: tokenAnalytics,
      };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get cross-campaign dashboard analytics with byArchetype breakdown.
   */
  async getDashboardAnalytics(filters?: { daysBack?: number }, ctx?: RequestCtx): Promise<any> {
    try {
      const daysBack = filters?.daysBack ?? 30;
      const since = new Date();
      since.setDate(since.getDate() - daysBack);

      // Get all gallery tokens in the period
      const tokens = await prisma.mkt_deliverable_preview_tokens.findMany({
        where: {
          token_type: 'diagnostic_gallery',
          created_at: { gte: since },
        },
        select: {
          id: true,
          campaign_id: true,
          gallery_archetype: true,
          created_at: true,
          viewed_at: true,
          converted_at: true,
        },
      });

      // Aggregate by archetype
      const archetypeMap = new Map<string, { tokens: number; viewed: number; converted: number }>();
      for (const t of tokens) {
        const archetype = t.gallery_archetype || 'unknown';
        const entry = archetypeMap.get(archetype) ?? { tokens: 0, viewed: 0, converted: 0 };
        entry.tokens++;
        if (t.viewed_at) entry.viewed++;
        if (t.converted_at) entry.converted++;
        archetypeMap.set(archetype, entry);
      }

      const byArchetype = [...archetypeMap.entries()].map(([archetype, stats]) => ({
        archetype,
        totalTokens: stats.tokens,
        viewedTokens: stats.viewed,
        convertedTokens: stats.converted,
        viewRate: stats.tokens > 0 ? Math.round((stats.viewed / stats.tokens) * 100) : 0,
        conversionRate: stats.viewed > 0 ? Math.round((stats.converted / stats.viewed) * 100) : 0,
      }));

      // Overall funnel
      const totalTokens = tokens.length;
      const viewedTokens = tokens.filter((t) => t.viewed_at).length;
      const convertedTokens = tokens.filter((t) => t.converted_at).length;

      // Total events in period
      const totalEvents = await prisma.mkt_gallery_events.count({
        where: { created_at: { gte: since } },
      });

      return {
        period: { daysBack, since },
        funnel: {
          totalTokens,
          viewedTokens,
          convertedTokens,
          viewRate: totalTokens > 0 ? Math.round((viewedTokens / totalTokens) * 100) : 0,
          conversionRate: viewedTokens > 0 ? Math.round((convertedTokens / viewedTokens) * 100) : 0,
        },
        totalEvents,
        byArchetype,
      };
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  /**
   * Get recent events for a token — live activity feed.
   */
  async getRecentEvents(tokenId: string, limit: number = 20, ctx?: RequestCtx): Promise<any[]> {
    try {
      const events = await prisma.mkt_gallery_events.findMany({
        where: { token_id: tokenId },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: {
          id: true,
          event_type: true,
          session_id: true,
          screenshot_index: true,
          dwell_ms: true,
          device_type: true,
          created_at: true,
        },
      });
      return events;
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }

  // ====================
  // AGGREGATION (called by Sprint 7 job)
  // ====================

  /**
   * Aggregate raw events into mkt_gallery_analytics rollup rows.
   * Groups by (token_id, campaign_id, period_start) — NOT tenant (G28).
   * Uses MAX(dwell_ms) per session for avg_session_duration (G27).
   *
   * This method is called by the gallery-analytics-sync job (Sprint 7).
   * It upserts into mkt_gallery_analytics.
   */
  async aggregateAnalytics(daysBack: number = 30, ctx?: RequestCtx): Promise<number> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - daysBack);
      since.setHours(0, 0, 0, 0);

      // Get distinct (token_id, campaign_id, date) combinations
      const events = await prisma.mkt_gallery_events.findMany({
        where: { created_at: { gte: since } },
        orderBy: { created_at: 'asc' },
      });

      // Group by token_id + date
      const groups = new Map<string, any>();
      for (const e of events) {
        const dateKey = (e.created_at ?? new Date()).toISOString().slice(0, 10); // YYYY-MM-DD
        const groupKey = `${e.token_id}|${dateKey}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            token_id: e.token_id,
            campaign_id: e.campaign_id,
            tenant_id: e.tenant_id,
            period_start: new Date(dateKey),
            events: [],
          });
        }
        groups.get(groupKey).events.push(e);
      }

      let upserted = 0;
      for (const [, group] of groups) {
        const evs = group.events;
        const opens = evs.filter((e: any) => e.event_type === 'gallery_opened').length;
        const sessions = new Set(evs.filter((e: any) => e.session_id).map((e: any) => e.session_id)).size;
        const screenshotViews = evs.filter((e: any) => e.event_type === 'screenshot_viewed').length;
        const carouselNavs = evs.filter((e: any) => e.event_type === 'carousel_next' || e.event_type === 'carousel_prev').length;
        const ctaClicks = evs.filter((e: any) => e.event_type === 'cta_clicked').length;
        const ctaHovers = evs.filter((e: any) => e.event_type === 'cta_hovered').length;

        // avg_session_duration: MAX(dwell_ms) per session, then average (G27)
        const sessionMaxDwell = new Map<string, number>();
        for (const e of evs) {
          if (e.session_id && e.dwell_ms != null) {
            const current = sessionMaxDwell.get(e.session_id) ?? 0;
            if (e.dwell_ms > current) {
              sessionMaxDwell.set(e.session_id, e.dwell_ms);
            }
          }
        }
        const avgSessionDuration = sessionMaxDwell.size > 0
          ? Math.round([...sessionMaxDwell.values()].reduce((a, b) => a + b, 0) / sessionMaxDwell.size)
          : 0;

        // avg_screenshots_viewed: unique screenshot_index values
        const uniqueScreenshots = new Set(evs.filter((e: any) => e.screenshot_index != null).map((e: any) => e.screenshot_index)).size;

        const mobileViews = evs.filter((e: any) => e.device_type === 'mobile').length;
        const desktopViews = evs.filter((e: any) => e.device_type === 'desktop').length;
        const tabletViews = evs.filter((e: any) => e.device_type === 'tablet').length;

        // Upsert into mkt_gallery_analytics
        await prisma.mkt_gallery_analytics.upsert({
          where: {
            token_id_period_start_period_type: {
              token_id: group.token_id,
              period_start: group.period_start,
              period_type: 'day',
            },
          },
          update: {
            total_opens: opens,
            unique_sessions: sessions,
            total_screenshot_views: screenshotViews,
            total_carousel_navs: carouselNavs,
            cta_clicks: ctaClicks,
            cta_hovers: ctaHovers,
            avg_session_duration_ms: avgSessionDuration,
            avg_screenshots_viewed: uniqueScreenshots,
            mobile_views: mobileViews,
            desktop_views: desktopViews,
            tablet_views: tabletViews,
            updated_at: new Date(),
          },
          create: {
            id: generateGalleryAnalyticsId(),
            tenant_id: group.tenant_id || 'platform',
            token_id: group.token_id,
            campaign_id: group.campaign_id,
            period_start: group.period_start,
            period_type: 'day',
            total_opens: opens,
            unique_sessions: sessions,
            total_screenshot_views: screenshotViews,
            total_carousel_navs: carouselNavs,
            cta_clicks: ctaClicks,
            cta_hovers: ctaHovers,
            avg_session_duration_ms: avgSessionDuration,
            avg_screenshots_viewed: uniqueScreenshots,
            mobile_views: mobileViews,
            desktop_views: desktopViews,
            tablet_views: tabletViews,
          },
        });
        upserted++;
      }

      logger.info('Gallery analytics aggregated', ctx, { upserted, daysBack });
      return upserted;
    } catch (error) {
      throw this.handleError(error, ctx);
    }
  }
}

export default GalleryAnalyticsService.getInstance();

// Export helpers for route use
export { ALLOWED_EVENT_TYPES, checkRateLimit, parseDeviceType, hashIp };

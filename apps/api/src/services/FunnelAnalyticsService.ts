/**
 * Funnel Analytics Service
 *
 * Tracks funnel lifecycle events (viewed, accepted, declined, etc.) and
 * aggregates them into dashboard summaries, step conversion reports, and
 * time series data.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateFunnelEventId } from '../lib/id-generator';

export interface TrackFunnelEventInput {
  tenantId: string;
  funnelId: string;
  stepId?: string;
  eventType: string;
  orderId?: string;
  sessionId?: string;
  customerId?: string;
  revenueCents?: number;
  metadata?: Record<string, any>;
}

export interface FunnelDashboardSummary {
  funnel_id: string;
  funnel_name: string;
  total_views: number;
  total_accepts: number;
  total_declines: number;
  conversion_rate: number;
  revenue_cents: number;
  avg_order_lift_cents: number;
}

export interface StepConversion {
  step_id: string;
  step_type: string;
  views: number;
  accepts: number;
  declines: number;
  conversion_rate: number;
  revenue_cents: number;
}

export interface TimeSeriesPoint {
  date: string;
  views: number;
  accepts: number;
  declines: number;
  revenue_cents: number;
}

class FunnelAnalyticsService extends BaseService {
  private static instance: FunnelAnalyticsService;

  private constructor() {
    super();
  }

  static getInstance(): FunnelAnalyticsService {
    if (!FunnelAnalyticsService.instance) {
      FunnelAnalyticsService.instance = new FunnelAnalyticsService();
    }
    return FunnelAnalyticsService.instance;
  }

  async trackFunnelEvent(input: TrackFunnelEventInput): Promise<void> {
    try {
      await prisma.funnel_events.create({
        data: {
          id: generateFunnelEventId(input.tenantId),
          tenant_id: input.tenantId,
          funnel_id: input.funnelId,
          step_id: input.stepId ?? null,
          event_type: input.eventType,
          order_id: input.orderId ?? null,
          session_id: input.sessionId ?? null,
          customer_id: input.customerId ?? null,
          revenue_cents: input.revenueCents ?? 0,
          metadata: input.metadata ?? {},
        },
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  async trackFunnelEvents(inputs: TrackFunnelEventInput[]): Promise<void> {
    if (inputs.length === 0) return;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.funnel_events.createMany({
          data: inputs.map((input) => ({
            id: generateFunnelEventId(input.tenantId),
            tenant_id: input.tenantId,
            funnel_id: input.funnelId,
            step_id: input.stepId ?? null,
            event_type: input.eventType,
            order_id: input.orderId ?? null,
            session_id: input.sessionId ?? null,
            customer_id: input.customerId ?? null,
            revenue_cents: input.revenueCents ?? 0,
            metadata: input.metadata ?? {},
          })),
        });
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  async getDashboard(tenantId: string, funnelId?: string): Promise<FunnelDashboardSummary[]> {
    try {
      const where: any = { tenant_id: tenantId };
      if (funnelId) where.funnel_id = funnelId;

      const funnels = await prisma.tenant_sales_funnels.findMany({
        where,
        include: { tenant_funnel_steps: true },
      });

      const funnelIds = funnels.map((f) => f.id);

      const events = await prisma.funnel_events.groupBy({
        by: ['funnel_id', 'event_type'],
        where: { tenant_id: tenantId, funnel_id: { in: funnelIds } },
        _sum: { revenue_cents: true },
        _count: { id: true },
      });

      const byFunnel = new Map<string, { views: number; accepts: number; declines: number; revenue: number }>();
      for (const ev of events) {
        const agg = byFunnel.get(ev.funnel_id) || { views: 0, accepts: 0, declines: 0, revenue: 0 };
        if (ev.event_type === 'viewed') agg.views += ev._count.id;
        if (ev.event_type === 'accepted') agg.accepts += ev._count.id;
        if (ev.event_type === 'declined') agg.declines += ev._count.id;
        agg.revenue += Number(ev._sum.revenue_cents || 0);
        byFunnel.set(ev.funnel_id, agg);
      }

      return funnels.map((f) => {
        const agg = byFunnel.get(f.id) || { views: 0, accepts: 0, declines: 0, revenue: 0 };
        const totalResponses = agg.accepts + agg.declines;
        return {
          funnel_id: f.id,
          funnel_name: f.name,
          total_views: agg.views,
          total_accepts: agg.accepts,
          total_declines: agg.declines,
          conversion_rate: totalResponses > 0 ? agg.accepts / totalResponses : 0,
          revenue_cents: agg.revenue,
          avg_order_lift_cents: totalResponses > 0 ? Math.round(agg.revenue / totalResponses) : 0,
        };
      });
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  async getStepConversion(tenantId: string, funnelId: string): Promise<StepConversion[]> {
    try {
      const events = await prisma.funnel_events.groupBy({
        by: ['step_id', 'event_type'],
        where: { tenant_id: tenantId, funnel_id: funnelId },
        _sum: { revenue_cents: true },
        _count: { id: true },
      });

      const steps = await prisma.tenant_funnel_steps.findMany({
        where: { funnel_id: funnelId, tenant_id: tenantId },
        orderBy: { sort_order: 'asc' },
      });

      const byStep = new Map<string, { views: number; accepts: number; declines: number; revenue: number }>();
      for (const ev of events) {
        if (!ev.step_id) continue;
        const agg = byStep.get(ev.step_id) || { views: 0, accepts: 0, declines: 0, revenue: 0 };
        if (ev.event_type === 'viewed') agg.views += ev._count.id;
        if (ev.event_type === 'accepted') agg.accepts += ev._count.id;
        if (ev.event_type === 'declined') agg.declines += ev._count.id;
        agg.revenue += Number(ev._sum.revenue_cents || 0);
        byStep.set(ev.step_id, agg);
      }

      return steps.map((s) => {
        const agg = byStep.get(s.id) || { views: 0, accepts: 0, declines: 0, revenue: 0 };
        const totalResponses = agg.accepts + agg.declines;
        return {
          step_id: s.id,
          step_type: s.step_type,
          views: agg.views,
          accepts: agg.accepts,
          declines: agg.declines,
          conversion_rate: totalResponses > 0 ? agg.accepts / totalResponses : 0,
          revenue_cents: agg.revenue,
        };
      });
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  async getTimeSeries(
    tenantId: string,
    funnelId?: string,
    days = 30
  ): Promise<TimeSeriesPoint[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const where: any = {
        tenant_id: tenantId,
        created_at: { gte: startDate },
      };
      if (funnelId) where.funnel_id = funnelId;

      // Prisma groupBy does not support date truncation directly; use raw query.
      const result = await prisma.$queryRawUnsafe<
        Array<{ date: string; views: number; accepts: number; declines: number; revenue: number }>
      >(
        `
        SELECT
          DATE_TRUNC('day', created_at)::date AS date,
          COUNT(*) FILTER (WHERE event_type = 'viewed') AS views,
          COUNT(*) FILTER (WHERE event_type = 'accepted') AS accepts,
          COUNT(*) FILTER (WHERE event_type = 'declined') AS declines,
          COALESCE(SUM(revenue_cents) FILTER (WHERE event_type = 'accepted'), 0) AS revenue
        FROM funnel_events
        WHERE tenant_id = $1
          AND created_at >= $2
          ${funnelId ? 'AND funnel_id = $3' : ''}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date ASC
        `,
        tenantId,
        startDate,
        ...(funnelId ? [funnelId] : [])
      );

      return result.map((row) => ({
        date: row.date,
        views: Number(row.views),
        accepts: Number(row.accepts),
        declines: Number(row.declines),
        revenue_cents: Number(row.revenue),
      }));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }
}

export default FunnelAnalyticsService;

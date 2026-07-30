/**
 * MarketingScorecardService — Daily scorecard CRUD + aggregation
 *
 * Manages daily scorecard entries tracking operator productivity metrics
 * (previews built/shown, packages paid/delivered, revenue, retainers).
 *
 * Pattern: singleton extends BaseService
 * Design doc: docs/LocalBiz/local_marketing_ops_gap_analysis_and_optimized_plan.md
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import { generateScorecardId } from '../lib/id-generator';

export interface ScorecardInput {
  userId: string;
  date: Date;
  categoryFocus?: string;
  neighborhoodFocus?: string;
  previewsBuilt?: number;
  previewsShown?: number;
  packagesPaid?: number;
  packagesDelivered?: number;
  revenueCollectedCents?: number;
  retainersPitched?: number;
  retainersWon?: number;
  notes?: string;
}

export class MarketingScorecardService extends BaseService {
  private static instance: MarketingScorecardService;

  private constructor() {
    super();
  }

  static getInstance(): MarketingScorecardService {
    if (!MarketingScorecardService.instance) {
      MarketingScorecardService.instance = new MarketingScorecardService();
    }
    return MarketingScorecardService.instance;
  }

  async upsertScorecard(input: ScorecardInput, ctx?: RequestCtx): Promise<any> {
    const id = generateScorecardId();
    try {
      const existing = await this.prisma.mkt_scorecards_list.findFirst({
        where: { user_id: input.userId, date: input.date },
      });

      if (existing) {
        const data: any = {};
        if (input.categoryFocus !== undefined) data.category_focus = input.categoryFocus;
        if (input.neighborhoodFocus !== undefined) data.neighborhood_focus = input.neighborhoodFocus;
        if (input.previewsBuilt !== undefined) data.previews_built = input.previewsBuilt;
        if (input.previewsShown !== undefined) data.previews_shown = input.previewsShown;
        if (input.packagesPaid !== undefined) data.packages_paid = input.packagesPaid;
        if (input.packagesDelivered !== undefined) data.packages_delivered = input.packagesDelivered;
        if (input.revenueCollectedCents !== undefined) data.revenue_collected_cents = input.revenueCollectedCents;
        if (input.retainersPitched !== undefined) data.retainers_pitched = input.retainersPitched;
        if (input.retainersWon !== undefined) data.retainers_won = input.retainersWon;
        if (input.notes !== undefined) data.notes = input.notes;

        return await this.prisma.mkt_scorecards_list.update({ where: { id: existing.id }, data });
      }

      return await this.prisma.mkt_scorecards_list.create({
        data: {
          id,
          user_id: input.userId,
          date: input.date,
          category_focus: input.categoryFocus || null,
          neighborhood_focus: input.neighborhoodFocus || null,
          previews_built: input.previewsBuilt || 0,
          previews_shown: input.previewsShown || 0,
          packages_paid: input.packagesPaid || 0,
          packages_delivered: input.packagesDelivered || 0,
          revenue_collected_cents: input.revenueCollectedCents || 0,
          retainers_pitched: input.retainersPitched || 0,
          retainers_won: input.retainersWon || 0,
          notes: input.notes || null,
        },
      });
    } catch (error) {
      logger.error('Failed to upsert scorecard', ctx, { error: (error as Error).message, userId: input.userId, date: input.date });
      throw this.handleError(error, ctx);
    }
  }

  async getScorecard(userId: string, date: Date, ctx?: RequestCtx): Promise<any | null> {
    try {
      return await this.prisma.mkt_scorecards_list.findFirst({
        where: { user_id: userId, date },
      });
    } catch (error) {
      logger.error('Failed to get scorecard', ctx, { error: (error as Error).message, userId, date });
      throw this.handleError(error, ctx);
    }
  }

  async listScorecards(filters: { userId?: string; startDate?: Date; endDate?: Date } = {}, ctx?: RequestCtx): Promise<any[]> {
    const where: any = {};
    if (filters.userId) where.user_id = filters.userId;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }
    try {
      return await this.prisma.mkt_scorecards_list.findMany({
        where,
        orderBy: { date: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to list scorecards', ctx, { error: (error as Error).message });
      throw this.handleError(error, ctx);
    }
  }

  async deleteScorecard(id: string, ctx?: RequestCtx): Promise<void> {
    try {
      await this.prisma.mkt_scorecards_list.delete({ where: { id } });
      logger.info('Scorecard deleted', ctx, { scorecardId: id });
    } catch (error) {
      logger.error('Failed to delete scorecard', ctx, { error: (error as Error).message, scorecardId: id });
      throw this.handleError(error, ctx);
    }
  }
}

export default MarketingScorecardService.getInstance();

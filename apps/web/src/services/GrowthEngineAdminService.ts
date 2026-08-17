/**
 * GrowthEngineAdminService — admin service for growth engine analytics.
 * Extends AdminApiSingleton (requires platform admin auth).
 */
import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface FunnelStage {
  label: string;
  count: number;
  conversionFromPrevious: number | null;
  conversionFromFirst: number;
}

export interface NicheBreakdown {
  category: string;
  prospects: number;
  seeds: number;
  published: number;
  claimed: number;
  upgraded: number;
  claimRate: number;
  upgradeRate: number;
  bestCity: string | null;
  worstCity: string | null;
}

export interface CityBreakdown {
  city: string;
  niches: number;
  prospects: number;
  seeds: number;
  published: number;
  claimed: number;
  upgraded: number;
  claimRate: number;
  upgradeRate: number;
  bestNiche: string | null;
}

export interface TimeSeriesPoint {
  date: string;
  seedsCreated: number;
  seedsPublished: number;
  seedsClaimed: number;
  seedsUpgraded: number;
}

export interface Recommendation {
  type: 'expand_niche' | 'expand_city' | 'deprioritize_niche' | 'high_demand';
  title: string;
  description: string;
  category?: string;
  city?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DemandSignal {
  type: 'zero_result' | 'underserved' | 'lead_gen';
  category: string | null;
  city: string | null;
  searchCount: number;
  listingCount: number;
  description: string;
}

export interface NextSeekTarget {
  category: string;
  city: string;
  score: number;
  zeroResultSearches: number;
  leadGenSubmissions: number;
  underservedSearches: number;
  currentListings: number;
  reason: string;
}

class GrowthEngineAdminService extends AdminApiSingleton {
  private static instance: GrowthEngineAdminService;
  private constructor() { super('growth-engine-admin'); }
  static getInstance() {
    if (!GrowthEngineAdminService.instance) GrowthEngineAdminService.instance = new GrowthEngineAdminService();
    return GrowthEngineAdminService.instance;
  }

  async getFunnel(dateRange?: { startDate?: string; endDate?: string }): Promise<{ stages: FunnelStage[]; raw: any }> {
    const qs = new URLSearchParams();
    if (dateRange?.startDate) qs.set('startDate', dateRange.startDate);
    if (dateRange?.endDate) qs.set('endDate', dateRange.endDate);
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/growth-engine/funnel?${qs.toString()}`,
      { method: 'GET' },
      undefined, 0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  async getByNiche(dateRange?: { startDate?: string; endDate?: string }): Promise<NicheBreakdown[]> {
    const qs = new URLSearchParams();
    if (dateRange?.startDate) qs.set('startDate', dateRange.startDate);
    if (dateRange?.endDate) qs.set('endDate', dateRange.endDate);
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/growth-engine/by-niche?${qs.toString()}`,
      { method: 'GET' },
      undefined, 0,
    );
    const data = result.data?.data ?? result.data;
    return data?.niches ?? [];
  }

  async getByCity(dateRange?: { startDate?: string; endDate?: string }): Promise<CityBreakdown[]> {
    const qs = new URLSearchParams();
    if (dateRange?.startDate) qs.set('startDate', dateRange.startDate);
    if (dateRange?.endDate) qs.set('endDate', dateRange.endDate);
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/growth-engine/by-city?${qs.toString()}`,
      { method: 'GET' },
      undefined, 0,
    );
    const data = result.data?.data ?? result.data;
    return data?.cities ?? [];
  }

  async getTimeSeries(dateRange?: { startDate?: string; endDate?: string }, granularity?: 'week' | 'month'): Promise<TimeSeriesPoint[]> {
    const qs = new URLSearchParams();
    if (dateRange?.startDate) qs.set('startDate', dateRange.startDate);
    if (dateRange?.endDate) qs.set('endDate', dateRange.endDate);
    if (granularity) qs.set('granularity', granularity);
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/growth-engine/time-series?${qs.toString()}`,
      { method: 'GET' },
      undefined, 0,
    );
    const data = result.data?.data ?? result.data;
    return data?.series ?? [];
  }

  async getRecommendations(): Promise<Recommendation[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/growth-engine/recommendations`,
      { method: 'GET' },
      undefined, 0,
    );
    const data = result.data?.data ?? result.data;
    return data?.recommendations ?? [];
  }

  async getDemandSignals(dateRange?: { startDate?: string; endDate?: string }): Promise<DemandSignal[]> {
    const qs = new URLSearchParams();
    if (dateRange?.startDate) qs.set('startDate', dateRange.startDate);
    if (dateRange?.endDate) qs.set('endDate', dateRange.endDate);
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/growth-engine/demand-signals?${qs.toString()}`,
      { method: 'GET' },
      undefined, 0,
    );
    const data = result.data?.data ?? result.data;
    return data?.signals ?? [];
  }

  async getNextSeekTargets(): Promise<NextSeekTarget[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/growth-engine/next-seek-targets`,
      { method: 'GET' },
      undefined, 0,
    );
    const data = result.data?.data ?? result.data;
    return data?.targets ?? [];
  }
}

const growthEngineAdminService = GrowthEngineAdminService.getInstance();
export default growthEngineAdminService;

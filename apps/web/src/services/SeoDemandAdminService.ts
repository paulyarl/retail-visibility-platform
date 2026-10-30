/**
 * SeoDemandAdminService — Search Console demand signals (data-driven seeding).
 * Extends AdminApiSingleton (requires platform admin auth).
 * Base URL: /api/admin/seo-demand
 */
import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

const BASE_URL = '/api/admin/seo-demand';

export type SeoDemandRoute =
  | 'pitch_now' | 'audit_triage' | 'seed_signal' | 'in_queue' | 'claimed_client'
  | 'seek_batch' | 'category' | 'market' | 'brand';

export interface SeoQuerySignal {
  query_norm: string;
  sample_query: string;
  intent: string;
  route: SeoDemandRoute | null;
  match_kind: 'listing' | 'campaign' | 'prospect' | 'unmatched' | 'brand' | null;
  match_id: string | null;
  match_name: string | null;
  match_confidence: number | null;
  seed_id: string | null;
  campaign_id: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  top_page: string | null;
  impressions_7d: number;
  impressions_28d: number;
  impressions_90d: number;
  clicks_28d: number;
  position_28d: number | null;
  first_seen: string | null;
  last_seen: string | null;
  review_status: 'open' | 'confirmed' | 'rejected' | 'queued';
  reviewed_at: string | null;
  queued_prospect_id: string | null;
  seed_status: string | null;
  campaign_stage: string | null;
}

export interface SeoDemandGap {
  category: string;
  city: string | null;
  state: string | null;
  impressions: number;
  queries: number;
  store_signals: number;
  position: number | null;
  top_queries: string[];
  seeds: number;
  published: number;
  gap_score: number;
}

export interface SeoDemandMarket {
  city: string;
  state: string;
  impressions: number;
  clicks: number;
  queries: number;
  store_signals: number;
  seed_signals: number;
  categories: number;
  position: number | null;
  seeds: number;
  published: number;
}

export interface SeoDemandSummary {
  routes: Array<{ route: string; queries: number; impressions_28d: number; open: number }>;
  ingest: { last_date: string | null; last_fetched: string | null; page_impressions_28d: number; page_clicks_28d: number };
}

export interface Paged<T> { rows: T[]; total: number; page: number; pageSize: number }

export type QueueSignalResult =
  | { kind: 'created' | 'already_queued'; prospectId: string }
  | { kind: 'campaign_exists'; campaignId: string };

class SeoDemandAdminService extends AdminApiSingleton {
  private static instance: SeoDemandAdminService;
  private constructor() { super('seo-demand-admin'); }
  static getInstance() {
    if (!SeoDemandAdminService.instance) SeoDemandAdminService.instance = new SeoDemandAdminService();
    return SeoDemandAdminService.instance;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const qs = new URLSearchParams(params || {}).toString();
    const result = await this.makeDefaultRequest<any>(`${BASE_URL}${path}${qs ? `?${qs}` : ''}`, { method: 'GET' }, undefined, 0);
    return (result.data?.data ?? result.data) as T;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const result = await this.makeDefaultRequest<any>(`${BASE_URL}${path}`, { method: 'POST', body: JSON.stringify(body ?? {}) });
    if (!result.success) throw new Error(typeof result.error === 'string' ? result.error : 'request_failed');
    return (result.data?.data ?? result.data) as T;
  }

  getSummary() { return this.get<SeoDemandSummary>('/summary'); }
  listSignals(params: Record<string, string>) { return this.get<Paged<SeoQuerySignal>>('/signals', params); }
  listGaps(params: Record<string, string>) { return this.get<Paged<SeoDemandGap>>('/gaps', params); }
  listMarkets(params: Record<string, string>) { return this.get<Paged<SeoDemandMarket>>('/markets', params); }
  reviewSignal(queryNorm: string, status: 'confirmed' | 'rejected' | 'open') {
    return this.post<any>('/signals/review', { queryNorm, status });
  }
  queueSignal(queryNorm: string) { return this.post<QueueSignalResult>('/signals/queue', { queryNorm }); }
  classify() { return this.post<{ classified: number }>('/classify', {}); }
  ingest() { return this.post<any>('/ingest', {}); }
}

const seoDemandAdminService = SeoDemandAdminService.getInstance();
export default seoDemandAdminService;

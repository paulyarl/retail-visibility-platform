/**
 * DirectorySuggestionAdminService — admin queue for public directory suggestions.
 *
 * Extends AdminApiSingleton.
 *
 * Wraps:
 *   - GET  /api/admin/directory-presence/suggestions
 *   - GET  /api/admin/directory-presence/suggestions/:id
 *   - POST /api/admin/directory-presence/suggestions/:id/status
 *   - GET  /api/admin/directory-presence/suggestions/analytics
 */
import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface SuggestionRecord {
  id: string;
  businessName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  phone: string | null;
  primaryCategory: string | null;
  submitterEmail: string | null;
  submitterIp: string | null;
  submitterComment: string | null;
  sourcePage: string | null;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'duplicate';
  reviewedBy: string | null;
  reviewedAt: string | null;
  seedId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestionListResult {
  suggestions: SuggestionRecord[];
  total: number;
}

export interface SuggestionAnalytics {
  suggestions: {
    total: number;
    byStatus: Record<string, number>;
    bySourcePage: { sourcePage: string | null; count: number }[];
    byDay: { day: string; count: number }[];
  };
  ownerSubmissions: {
    total: number;
    byStatus: Record<string, number>;
    byDay: { day: string; count: number }[];
  };
}

export class DirectorySuggestionAdminService extends AdminApiSingleton {
  private static instance: DirectorySuggestionAdminService;

  private constructor() {
    super('directory-suggestion-admin');
  }

  public static getInstance(): DirectorySuggestionAdminService {
    if (!DirectorySuggestionAdminService.instance) {
      DirectorySuggestionAdminService.instance = new DirectorySuggestionAdminService();
    }
    return DirectorySuggestionAdminService.instance;
  }

  /** GET /api/admin/directory-presence/suggestions */
  async listSuggestions(filters?: {
    status?: string;
    city?: string;
    state?: string;
    primaryCategory?: string;
    limit?: number;
    offset?: number;
  }): Promise<SuggestionListResult> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.city) params.set('city', filters.city);
    if (filters?.state) params.set('state', filters.state);
    if (filters?.primaryCategory) params.set('primaryCategory', filters.primaryCategory);
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
    const qs = params.toString();

    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/suggestions${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return (data as SuggestionListResult) ?? { suggestions: [], total: 0 };
  }

  /** GET /api/admin/directory-presence/suggestions/:id */
  async getSuggestion(id: string): Promise<SuggestionRecord | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/suggestions/${encodeURIComponent(id)}`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return null;
    const data = result.data?.data ?? result.data;
    return (data as any)?.suggestion ?? null;
  }

  /** POST /api/admin/directory-presence/suggestions/:id/status */
  async updateStatus(
    id: string,
    status: SuggestionRecord['status'],
    seedId?: string,
  ): Promise<{ success: boolean; error?: string; suggestion?: SuggestionRecord }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/suggestions/${encodeURIComponent(id)}/status`,
      { method: 'POST', body: JSON.stringify({ status, seedId }) },
      undefined,
      0,
    );
    const error = typeof result.error === 'string' ? result.error : result.error?.message;
    const data = result.data?.data ?? result.data;
    return { success: result.success, error, suggestion: data?.suggestion };
  }

  /** GET /api/admin/directory-presence/suggestions/analytics */
  async getAnalytics(): Promise<SuggestionAnalytics | null> {
    const result = await this.makeDefaultRequest<any>(
      '/api/admin/directory-presence/suggestions/analytics',
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return null;
    const data = result.data?.data ?? result.data;
    return (data as SuggestionAnalytics) ?? null;
  }
}

export default DirectorySuggestionAdminService.getInstance();

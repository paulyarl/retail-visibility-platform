/**
 * DirectoryEnrichmentPublicService — token-gated self-serve enrichment form.
 *
 * Extends PublicApiSingleton (no auth — the token is the gate).
 *
 * Wraps:
 *   GET  /api/public/directory/enrich/:token          — resolve token → context + definition
 *   POST /api/public/directory/enrich/:token/submit   — submit enrichment form
 *   POST /api/public/directory/enrich/:token/attachments — upload photos
 *   POST /api/public/directory/lead-gen               — "Get listed" CTA
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface EnrichmentContext {
  seedId: string;
  tenantId: string;
  slug: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
}

export interface IntakeDefinition {
  intake_kind: string;
  label: string;
  description?: string;
  form_schema: any[];
  field_mappings: any[];
  owner_copy: any;
  niche_overrides?: Record<string, any>;
}

export interface ResolveEnrichmentResult {
  expired?: boolean;
  context?: EnrichmentContext;
  definition?: IntakeDefinition;
}

export interface EnrichmentSubmitResult {
  success: boolean;
  seedId?: string;
  tenantId?: string;
  businessName?: string;
  slug?: string;
  error?: string;
  details?: any;
}

export class DirectoryEnrichmentPublicService extends PublicApiSingleton {
  private static instance: DirectoryEnrichmentPublicService;

  private constructor() {
    super('directory-enrichment-public', { ttl: 0 });
  }

  public static getInstance(): DirectoryEnrichmentPublicService {
    if (!DirectoryEnrichmentPublicService.instance) {
      DirectoryEnrichmentPublicService.instance = new DirectoryEnrichmentPublicService();
    }
    return DirectoryEnrichmentPublicService.instance;
  }

  /** GET /api/public/directory/enrich/:token */
  async resolveToken(token: string): Promise<ResolveEnrichmentResult | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/enrich/${encodeURIComponent(token)}`,
        { method: 'GET' },
        undefined,
        0,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      return data as ResolveEnrichmentResult;
    } catch {
      return null;
    }
  }

  /** POST /api/public/directory/enrich/:token/submit */
  async submitEnrichment(
    token: string,
    payload: {
      ownerEmail?: string;
      ownerPhone?: string;
      evidencePayload: Record<string, any>;
      attachmentIds?: string[];
    },
  ): Promise<EnrichmentSubmitResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/enrich/${encodeURIComponent(token)}/submit`,
        { method: 'POST', body: JSON.stringify(payload) },
        undefined,
        0,
      );
      if (!result.success) {
        const error = typeof result.error === 'string' ? result.error : 'unknown';
        return { success: false, error };
      }
      const data = result.data?.data ?? result.data;
      return (data as any) ?? { success: false, error: 'unknown' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'unknown' };
    }
  }

  /** POST /api/public/directory/lead-gen */
  async submitLeadGen(input: {
    businessName: string;
    category?: string;
    city?: string;
    state?: string;
    phone?: string;
    email?: string;
    note?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/lead-gen`,
        { method: 'POST', body: JSON.stringify(input) },
        undefined,
        0,
      );
      if (!result.success) {
        const error = typeof result.error === 'string' ? result.error : 'unknown';
        return { success: false, error };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'unknown' };
    }
  }
}

const directoryEnrichmentPublicService = DirectoryEnrichmentPublicService.getInstance();
export default directoryEnrichmentPublicService;

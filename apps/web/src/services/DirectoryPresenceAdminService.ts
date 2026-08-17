/**
 * DirectoryPresenceAdminService — admin service for managing directory
 * presence seeds. Extends AdminApiSingleton (requires platform admin auth).
 *
 * Wraps:
 *   - GET    /api/admin/directory-presence/presence-seeds
 *   - GET    /api/admin/directory-presence/presence-seeds/:id
 *   - POST   /api/admin/directory-presence/presence-seeds
 *   - POST   /api/admin/directory-presence/presence-seeds/:id/publish
 *   - POST   /api/admin/directory-presence/presence-seeds/:id/invite
 *   - PATCH  /api/admin/directory-presence/presence-seeds/:id/fields
 *   - PATCH  /api/admin/directory-presence/presence-seeds/:id/status
 *   - POST   /api/admin/directory-presence/presence-seeds/:id/tokens/:tokenId/revoke
 */
import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface DirectoryPresenceSeedSummary {
  id: string;
  tenantId: string;
  listingId: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  status: string;
  identityConfidence: string;
  categoryFit: string;
  seedBatch: string;
  snapEbtReported: boolean;
  snapEbtAsOf: string | null;
  snapEbtSource: string | null;
  snapEbtSourceName: string | null;
  hasClaimToken: boolean;
  claimTokenExpiresAt: string | null;
  createdAt: string;
  publishedAt: string | null;
  invitedAt: string | null;
  claimedAt: string | null;
}

export interface DirectoryPresenceSeedDetail {
  seed: any;
  listing: any;
  provenance: Array<{
    id: string;
    fieldKey: string;
    value: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    accessedAt: string | null;
    confidence: string;
    showOnPublic: boolean;
  }>;
  claimTokens: Array<{
    id: string;
    token: string;
    expiresAt: string;
    consumedAt: string | null;
    consumedBy: string | null;
    createdAt: string;
  }>;
}

export interface CreateSeedRequest {
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string;
  website?: string;
  primaryCategory: string;
  secondaryCategories?: string[];
  latitude?: number;
  longitude?: number;
  snapEbtReported?: boolean;
  snapEbtAsOf?: string;
  snapEbtSource?: string;
  snapEbtSourceName?: string;
  seedBatch: string;
  identityConfidence: 'high' | 'medium';
  categoryFit: 'verified' | 'probable';
  notes?: string;
  provenance?: Array<{
    fieldKey: string;
    value?: string;
    sourceName?: string;
    sourceUrl?: string;
    accessedAt?: string;
    confidence?: 'high' | 'medium' | 'low';
    showOnPublic?: boolean;
  }>;
}

export interface InviteResult {
  token: string;
  expiresAt: string;
}

export class DirectoryPresenceAdminService extends AdminApiSingleton {
  private static instance: DirectoryPresenceAdminService;

  private constructor() {
    super('directory-presence-admin');
  }

  public static getInstance(): DirectoryPresenceAdminService {
    if (!DirectoryPresenceAdminService.instance) {
      DirectoryPresenceAdminService.instance = new DirectoryPresenceAdminService();
    }
    return DirectoryPresenceAdminService.instance;
  }

  async listSeeds(filters?: {
    seedBatch?: string;
    status?: string;
    city?: string;
    state?: string;
    category?: string;
    identityConfidence?: string;
    categoryFit?: string;
    hasClaimToken?: string;
  }): Promise<DirectoryPresenceSeedSummary[]> {
    const params = new URLSearchParams();
    if (filters?.seedBatch) params.set('seedBatch', filters.seedBatch);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.city) params.set('city', filters.city);
    if (filters?.state) params.set('state', filters.state);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.identityConfidence) params.set('identityConfidence', filters.identityConfidence);
    if (filters?.categoryFit) params.set('categoryFit', filters.categoryFit);
    if (filters?.hasClaimToken) params.set('hasClaimToken', filters.hasClaimToken);
    const qs = params.toString();
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return [];
    const data = result.data?.data ?? result.data;
    return (data as any)?.seeds ?? [];
  }

  async getSeed(id: string): Promise<DirectoryPresenceSeedDetail | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return null;
    const data = result.data?.data ?? result.data;
    return (data as any) ?? null;
  }

  async createSeed(input: CreateSeedRequest): Promise<DirectoryPresenceSeedSummary> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds`,
      { method: 'POST', body: JSON.stringify(input) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return (data as any)?.seed;
  }

  async publishSeed(id: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}/publish`,
      { method: 'POST', body: JSON.stringify({}) },
      undefined,
      0,
    );
  }

  async inviteSeed(id: string, expiresInDays?: number): Promise<InviteResult> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}/invite`,
      { method: 'POST', body: JSON.stringify({ expiresInDays }) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return { token: (data as any)?.token, expiresAt: (data as any)?.expiresAt };
  }

  async updateFields(
    id: string,
    fields: {
      snapEbtReported?: boolean;
      snapEbtAsOf?: string | null;
      snapEbtSource?: string | null;
      snapEbtSourceName?: string | null;
      phone?: string;
      website?: string;
      businessHours?: any;
      primaryCategory?: string | null;
      secondaryCategories?: string[];
    },
    provenanceUpdates?: Array<{
      fieldKey: string;
      value?: string;
      sourceName?: string;
      sourceUrl?: string;
      accessedAt?: string;
      confidence?: 'high' | 'medium' | 'low';
      showOnPublic?: boolean;
    }>
  ): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}/fields`,
      { method: 'PATCH', body: JSON.stringify({ ...fields, provenanceUpdates }) },
      undefined,
      0,
    );
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      undefined,
      0,
    );
  }

  async revokeToken(id: string, tokenId: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}/tokens/${encodeURIComponent(tokenId)}/revoke`,
      { method: 'POST', body: JSON.stringify({}) },
      undefined,
      0,
    );
  }

  /** PATCH /api/admin/directory-presence/presence-seeds/:id/outreach */
  async updateOutreach(
    id: string,
    input: {
      status: string;
      notes?: string | null;
      ownerName?: string | null;
      ownerEmail?: string | null;
      ownerPhone?: string | null;
    },
  ): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}/outreach`,
      { method: 'PATCH', body: JSON.stringify(input) },
      undefined,
      0,
    );
  }

  /** POST /api/admin/directory-presence/presence-seeds/:id/enrichment-token */
  async generateEnrichmentToken(
    id: string,
  ): Promise<{ token: string; tokenId: string; expiresAt: string }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}/enrichment-token`,
      { method: 'POST', body: JSON.stringify({}) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data as { token: string; tokenId: string; expiresAt: string };
  }
}

const directoryPresenceAdminService = DirectoryPresenceAdminService.getInstance();
export default directoryPresenceAdminService;

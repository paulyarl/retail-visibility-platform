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

  /** POST /api/admin/directory-presence/presence-seeds/batch-create */
  async batchCreateSeeds(
    queueEntryIds: string[],
    seedBatch: string,
  ): Promise<{
    created: string[];
    skipped: Array<{ queueEntryId: string; reason: string }>;
    failed: Array<{ queueEntryId: string; error: string }>;
  }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/batch-create`,
      { method: 'POST', body: JSON.stringify({ queueEntryIds, seedBatch }) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  /** POST /api/admin/directory-presence/presence-seeds/batch-publish */
  async batchPublishSeeds(
    seedIds: string[],
  ): Promise<{
    published: string[];
    skipped: Array<{ seedId: string; reason: string }>;
    failed: Array<{ seedId: string; error: string }>;
  }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/batch-publish`,
      { method: 'POST', body: JSON.stringify({ seedIds }) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  /** POST /api/admin/directory-presence/presence-seeds/batch-invite */
  async batchInviteSeeds(
    seedIds: string[],
    expiresInDays?: number,
  ): Promise<{
    invited: Array<{ seedId: string; token: string }>;
    skipped: Array<{ seedId: string; reason: string }>;
    failed: Array<{ seedId: string; error: string }>;
  }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/batch-invite`,
      { method: 'POST', body: JSON.stringify({ seedIds, expiresInDays }) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  /** GET /api/admin/directory-presence/seek-batches */
  async listSeekBatches(status?: string): Promise<any[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/seek-batches${status ? `?status=${encodeURIComponent(status)}` : ''}`,
      { method: 'GET' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data?.batches ?? [];
  }

  /** GET /api/admin/directory-presence/seek-batches/:id */
  async getSeekBatch(id: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/seek-batches/${encodeURIComponent(id)}`,
      { method: 'GET' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data?.batch ?? null;
  }

  /** POST /api/admin/directory-presence/seek-batches */
  async createSeekBatch(input: {
    profileId: string;
    profileVersion?: number;
    nicheCategory: string;
    intelligenceFocus?: string;
    cities: string[];
    state?: string;
    /** Queue-based entries: one tightly-coupled (profile, city, category, focus) tuple per entry.
     *  When provided, entries are the source of truth — one campaign per entry at launch time. */
    entries?: Array<{
      profileId: string;
      profileVersion?: number;
      nicheCategory: string;
      city: string;
      state?: string;
      intelligenceFocus?: string;
    }>;
  }): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/seek-batches`,
      { method: 'POST', body: JSON.stringify(input) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data?.batch ?? null;
  }

  /** POST /api/admin/directory-presence/seek-batches/:id/launch */
  async launchSeekBatch(id: string): Promise<{ campaignIds: string[] }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/seek-batches/${encodeURIComponent(id)}/launch`,
      { method: 'POST', body: JSON.stringify({}) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  /** GET /api/admin/directory-presence/seed-batches */
  async listSeedBatches(seedBatch?: string): Promise<any[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/seed-batches${seedBatch ? `?seedBatch=${encodeURIComponent(seedBatch)}` : ''}`,
      { method: 'GET' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data?.batches ?? [];
  }

  // ============================
  // Seed ↔ Campaign links (Migration 230)
  // ============================

  /** GET /api/admin/directory-presence/presence-seeds/:id/campaign-links */
  async listCampaignLinks(seedId: string): Promise<DirectorySeedCampaignLink[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/campaign-links`,
      { method: 'GET' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return (data as any)?.links ?? [];
  }

  /** GET /api/admin/directory-presence/presence-seeds/:id/campaign-candidates?query= */
  async findCampaignCandidates(
    seedId: string,
    query?: string,
    limit?: number,
  ): Promise<DirectoryCampaignCandidate[]> {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/campaign-candidates${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return (data as any)?.campaigns ?? [];
  }

  /** GET /api/admin/directory-presence/presence-seeds/:id/campaign-links/:campaignId/diff */
  async getCampaignDiff(
    seedId: string,
    campaignId: string,
  ): Promise<DirectoryCampaignDiffEntry[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/campaign-links/${encodeURIComponent(campaignId)}/diff`,
      { method: 'GET' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return (data as any)?.diff ?? [];
  }

  /** POST /api/admin/directory-presence/presence-seeds/:id/campaign-links */
  async linkCampaign(
    seedId: string,
    campaignId: string,
    role: 'primary' | 'sibling' | 'recovery' = 'primary',
  ): Promise<{
    link: DirectorySeedCampaignLink;
    autoProjected: boolean;
    napMatch: any;
  }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/campaign-links`,
      { method: 'POST', body: JSON.stringify({ campaignId, role }) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  /** DELETE /api/admin/directory-presence/presence-seeds/:id/campaign-links/:campaignId */
  async unlinkCampaign(seedId: string, campaignId: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/campaign-links/${encodeURIComponent(campaignId)}`,
      { method: 'DELETE' },
      undefined,
      0,
    );
  }

  /** POST /api/admin/directory-presence/presence-seeds/:id/campaign-links/:campaignId/sync */
  async syncFromCampaign(
    seedId: string,
    campaignId: string,
    fields: string[],
  ): Promise<{ projected: string[]; skipped: string[] }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/campaign-links/${encodeURIComponent(campaignId)}/sync`,
      { method: 'POST', body: JSON.stringify({ fields }) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  // ============================
  // Claim Requests (Migration 246)
  // ============================

  /** GET /api/admin/directory-presence/claim-requests?status= */
  async listClaimRequests(status?: string): Promise<DirectoryClaimRequest[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/claim-requests${qs}`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return [];
    const data = result.data?.data ?? result.data;
    return (data as any)?.requests ?? [];
  }

  /** POST /api/admin/directory-presence/claim-requests/:id/approve */
  async approveClaimRequest(id: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/claim-requests/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify({}) },
      undefined,
      0,
    );
    return { success: result.success, error: result.error };
  }

  /** POST /api/admin/directory-presence/claim-requests/:id/reject */
  async rejectClaimRequest(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/claim-requests/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      undefined,
      0,
    );
    return { success: result.success, error: result.error };
  }
}

export interface DirectorySeedCampaignLink {
  id: string;
  seedId: string;
  campaignId: string;
  tenantId: string;
  linkRole: 'primary' | 'sibling' | 'recovery';
  napMatchConfidence: 'high' | 'medium' | 'low' | 'none';
  napMatchSummary: any | null;
  lastSyncedAt: string | null;
  lastSyncFields: string[];
  createdAt: string;
  updatedAt: string;
  campaign?: {
    id: string;
    displayId: string | null;
    businessName: string | null;
    category: string;
    city: string;
    state: string | null;
    stage: string;
    campaignCategory: string;
  };
}

export interface DirectoryCampaignCandidate {
  id: string;
  displayId: string | null;
  businessName: string | null;
  category: string;
  city: string;
  state: string | null;
  stage: string;
  campaignCategory: string;
  alreadyLinked: boolean;
}

export interface DirectoryCampaignDiffEntry {
  field: string;
  campaignValue: any;
  seedValue: any;
  changed: boolean;
}

// ============================
// Claim Requests (operator approval flow — Migration 246)
// ============================

export interface DirectoryClaimRequest {
  id: string;
  seedId: string;
  tenantId: string;
  tokenId: string;
  customerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  businessName: string;
  category: string;
  address: string;
  city: string;
  state: string;
}

const directoryPresenceAdminService = DirectoryPresenceAdminService.getInstance();
export default directoryPresenceAdminService;

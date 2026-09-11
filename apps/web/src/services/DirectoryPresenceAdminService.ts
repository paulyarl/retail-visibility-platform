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
 *   - DELETE /api/admin/directory-presence/presence-seeds/:id
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
  outreachState?: string;
  outreachStateEnteredAt?: string | null;
  outreachScheduledAt?: string | null;
  /** Owner-typed category labels awaiting operator accept/reject
   *  (migration 274 — see the seed detail's Owner Verification section). */
  pendingOwnerProposals?: number;
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
  attributes?: DirectoryListingAttribute[];
  seedBatch: string;
  identityConfidence: 'high' | 'medium';
  categoryFit: 'verified' | 'probable';
  notes?: string;
  slug?: string;
  businessHours?: any;
  /** SEO enrichment fields (prefilled from the campaign seo-preview). */
  description?: string;
  keywords?: string[];
  sameAs?: string[];
  seoEnrichment?: any;
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

/** A sourced attribute chip stored on the listing (migration 267). */
export interface DirectoryListingAttribute {
  key: string;
  label: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  asOf?: string;
}

/** SEO packet composed from a campaign's business_analysis audit (SeedSeoComposer). */
export interface SeedSeoPreview {
  hasAudit: boolean;
  businessName: string;
  metaTitle: string;
  description: string;
  keywords: string[];
  secondaryCategories: string[];
  sameAs: string[];
  schemaTypeHint: string | null;
  seoEnrichment: Record<string, unknown> | null;
}

/** A predefined attribute chip from the category-aware picker (migration 268). */
export interface DirectoryAttributeDefinition {
  attributeKey: string;
  label: string;
  groupKey: string;
  defaultSourcePlatform?: string | null;
  sortOrder: number;
}

/** An attribute suggestion mined from intelligence audits (scan/audit-sourced). */
export interface DirectoryAttributeSuggestion {
  key: string;
  label: string;
  sourcePlatform?: string | null;
  sourceUrl?: string | null;
  asOf?: string | null;
  origin: string;
  matchedDefinitionKey: string | null;
}

/** An advisory attribute recommendation from a business audit's
 *  recommended_attributes — NOT a sourced observation (no evidence). */
export interface DirectoryAttributeRecommendation {
  key: string;
  label: string;
  platform?: string | null;
  basis?: string | null;
  rationale?: string | null;
  currentState?: string | null;
  matchedDefinitionKey: string | null;
}

/** A full attribute-definition row (management view — includes id + active flag). */
export interface DirectoryAttributeDefinitionRow extends DirectoryAttributeDefinition {
  id: string;
  appliesToCategories: string[] | null;
  isActive: boolean;
}

// ============================
// Seed Funnel Analytics (W3 UI — spec §6, §10)
// ============================

export interface CohortFunnelMetrics {
  seeds: number;
  contactable: number;
  invited: number;
  claimed: number;
  claimed30d: number;
  napVerified: number;
  ownerCorrected: number;
  converted: number;
  retention90d: number;
  paid: number;
  touches: number;
  cacEstimate: number | null;
  inviteScans: number;
  inviteScanRate: number | null;
  inviteScansMail: number;
  inviteScansWalkin: number;
  inviteScansSocial: number;
  inviteScanRateMail: number | null;
  inviteScanRateWalkin: number | null;
  inviteScanRateSocial: number | null;
}

export interface ConversionScoreBreakdown {
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  converted: number;
  threshold: number;
}

export interface GateResult {
  gate: string;
  description: string;
  value: number | null;
  threshold: number;
  pass: boolean | null;
}

export type CohortGrade = 'directional' | 'decision_grade';

export interface ScalingReadiness {
  citiesPassing: string[];
  categoriesPassing: string[];
  ruleMet: boolean;
  note: string;
}

export interface PotentialDuplicateSeed {
  seedIds: string[];
  matchKey: 'phone' | 'address_city';
  names: string[];
}

export interface CohortFunnelReport {
  cohortKey: string;
  campaignId?: string | null;
  displayId?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  focus?: string | null;
  metrics: CohortFunnelMetrics;
  gates: GateResult[];
  grade: CohortGrade;
  deferredGates: Array<{ gate: string; reason: string }>;
  conversionScoreBreakdown?: ConversionScoreBreakdown;
  medianDaysToClaim?: number | null;
  scalingReadiness?: ScalingReadiness;
}

export interface CategoryRollup {
  category: string;
  metrics: CohortFunnelMetrics;
  gates: GateResult[];
  grade: CohortGrade;
  conversionScoreBreakdown: ConversionScoreBreakdown;
}

export interface CohortFunnelResponse {
  generatedAt: string;
  filters: Record<string, unknown>;
  cohorts: CohortFunnelReport[];
  combined: CohortFunnelReport;
  categoryRollups: CategoryRollup[];
  medianDaysToClaim: number | null;
  scalingReadiness: ScalingReadiness;
  potentialDuplicateSeeds: PotentialDuplicateSeed[];
  duplicateSeedCount: number;
}

export interface OutreachTouch {
  id: string;
  seedId: string;
  channel: string;
  outcome: string | null;
  notes: string | null;
  operatorId: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface ClaimInviteQrKitMeta {
  seedId: string;
  token: string;
  qrUrl: string;
  qrUrlWalkin: string;
  qrUrlSocial: string;
  claimUrl: string;
  businessName: string;
  addressLines: string[];
  expiresAt: string | null;
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
    outreachState?: string;
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
    if (filters?.outreachState) params.set('outreachState', filters.outreachState);
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

  /** GET /api/admin/directory-presence/attribute-definitions?category=<name> — picker view (active, category-scoped) */
  async listAttributeDefinitions(category?: string): Promise<DirectoryAttributeDefinition[]> {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    const qs = params.toString();
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/attribute-definitions${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return [];
    const data = result.data?.data ?? result.data;
    return (data as any)?.definitions ?? [];
  }

  /** GET /api/admin/directory-presence/attribute-definitions?all=true — management view */
  async listAllAttributeDefinitions(): Promise<DirectoryAttributeDefinitionRow[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/attribute-definitions?all=true`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return [];
    const data = result.data?.data ?? result.data;
    return (data as any)?.definitions ?? [];
  }

  /** POST /api/admin/directory-presence/attribute-definitions — create/reactivate a preset */
  async createAttributeDefinition(input: {
    attributeKey: string;
    label: string;
    groupKey: string;
    appliesToCategories?: string[] | null;
    defaultSourcePlatform?: string | null;
    sortOrder?: number;
  }): Promise<DirectoryAttributeDefinitionRow | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/attribute-definitions`,
      { method: 'POST', body: JSON.stringify(input) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return (data as any)?.definition ?? null;
  }

  /** PATCH /api/admin/directory-presence/attribute-definitions/:id */
  async updateAttributeDefinition(
    id: string,
    fields: {
      label?: string;
      groupKey?: string;
      appliesToCategories?: string[] | null;
      defaultSourcePlatform?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/attribute-definitions/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(fields) },
      undefined,
      0,
    );
  }

  /** DELETE /api/admin/directory-presence/attribute-definitions/:id */
  async deleteAttributeDefinition(id: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/attribute-definitions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      undefined,
      0,
    );
  }

  /** GET /api/admin/directory-presence/presence-seeds/:id/attribute-suggestions */
  async listAttributeSuggestions(seedId: string): Promise<{
    suggestions: DirectoryAttributeSuggestion[];
    recommendations: DirectoryAttributeRecommendation[];
  }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/attribute-suggestions`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return { suggestions: [], recommendations: [] };
    const data = result.data?.data ?? result.data;
    return {
      suggestions: (data as any)?.suggestions ?? [],
      recommendations: (data as any)?.recommendations ?? [],
    };
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

  /**
   * GET /api/admin/directory-presence/presence-seeds/seo-preview?campaignId=<id>
   * — SEO packet (description, keywords, same_as, secondary categories, meta
   * title) composed from the campaign's latest business_analysis audit. Used
   * by the Create Seed form to prefill its SEO Enrichment section when the
   * operator loads a campaign prospect.
   */
  async getSeoPreview(campaignId: string): Promise<SeedSeoPreview | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/seo-preview?campaignId=${encodeURIComponent(campaignId)}`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return null;
    const data = result.data?.data ?? result.data;
    return (data as any) ?? null;
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

  // ============================
  // Funnel analytics (W3 UI)
  // ============================

  /** GET /api/admin/directory-presence/presence-seeds/funnel/cohorts */
  async getCohortFunnel(filters?: {
    campaignIds?: string[];
    category?: string;
    city?: string;
    state?: string;
    focus?: string;
  }): Promise<CohortFunnelResponse | null> {
    const params = new URLSearchParams();
    if (filters?.campaignIds?.length) params.set('campaignIds', filters.campaignIds.join(','));
    if (filters?.category) params.set('category', filters.category);
    if (filters?.city) params.set('city', filters.city);
    if (filters?.state) params.set('state', filters.state);
    if (filters?.focus) params.set('focus', filters.focus);
    const qs = params.toString();
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/funnel/cohorts${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return null;
    const data = result.data?.data ?? result.data;
    // The endpoint spreads the report at the top level: { success, cohorts, combined, ... }
    return (data as any) ?? null;
  }

  // ============================
  // Outreach touches (W1)
  // ============================

  /** POST /api/admin/directory-presence/presence-seeds/:id/touches */
  async addOutreachTouch(
    seedId: string,
    input: {
      channel: 'call' | 'email' | 'sms' | 'mail' | 'form' | 'referral' | 'visit' | 'other';
      outcome?:
        | 'connected' | 'no_response' | 'no_answer' | 'no_reply' | 'voicemail'
        | 'bad_number' | 'bounce' | 'unread' | 'read_no_reply' | 'form_submitted'
        | 'referral_asked' | 'claimed' | 'not_interested';
      notes?: string;
      occurredAt?: string;
    },
  ): Promise<{ touchId: string } | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/touches`,
      { method: 'POST', body: JSON.stringify(input) },
      undefined,
      0,
    );
    if (!result.success) return null;
    const data = result.data?.data ?? result.data;
    return { touchId: (data as any)?.touchId };
  }

  /** GET /api/admin/directory-presence/presence-seeds/:id/touches */
  async listOutreachTouches(seedId: string): Promise<OutreachTouch[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/touches`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return [];
    const data = result.data?.data ?? result.data;
    return (data as any)?.touches ?? [];
  }

  // ============================
  // Claim-invite QR kit (W10)
  // ============================

  /** GET /api/admin/directory-presence/presence-seeds/:id/qr-kit */
  async getClaimInviteQrKit(seedId: string): Promise<ClaimInviteQrKitMeta | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/qr-kit`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return null;
    const data = result.data?.data ?? result.data;
    return (data as any) ?? null;
  }

  /** GET /api/admin/directory-presence/presence-seeds/:id/qr-kit/png — returns a Blob.
   *  variant selects the tracked URL surface (claim_invite / _walkin / _social). */
  async downloadClaimInvitePng(
    seedId: string,
    variant: 'mail' | 'walkin' | 'social' = 'mail',
  ): Promise<Blob | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/qr-kit/png${variant === 'mail' ? '' : `?variant=${variant}`}`,
      { method: 'GET' },
      undefined,
      0,
      { responseType: 'blob' as any },
    );
    if (!result.success) return null;
    return (result.data as unknown as Blob) ?? null;
  }

  /** GET /api/admin/directory-presence/presence-seeds/:id/qr-kit/postcard — returns a Blob.
   *  variant selects the tracked URL + printed badge for that channel. */
  async downloadClaimInvitePostcard(
    seedId: string,
    variant: 'mail' | 'walkin' | 'social' = 'mail',
  ): Promise<Blob | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/qr-kit/postcard${variant === 'mail' ? '' : `?variant=${variant}`}`,
      { method: 'GET' },
      undefined,
      0,
      { responseType: 'blob' as any },
    );
    if (!result.success) return null;
    return (result.data as unknown as Blob) ?? null;
  }

  async updateFields(
    id: string,
    fields: {
      snapEbtReported?: boolean;
      snapEbtAsOf?: string | null;
      snapEbtSource?: string | null;
      snapEbtSourceName?: string | null;
      attributes?: DirectoryListingAttribute[] | null;
      phone?: string;
      website?: string;
      businessHours?: any;
      description?: string | null;
      primaryCategory?: string | null;
      secondaryCategories?: string[];
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      slug?: string | null;
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

  /** POST /api/admin/directory-presence/presence-seeds/:id/proposed-categories/decision
   *  Operator accept/reject of an owner-proposed category (migration 274). */
  async decideProposedCategory(
    id: string,
    label: string,
    decision: 'accepted' | 'rejected',
  ): Promise<{ label: string; role: string; status: string }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}/proposed-categories/decision`,
      { method: 'POST', body: JSON.stringify({ label, decision }) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  /** DELETE /api/admin/directory-presence/presence-seeds/:id — permanently delete a seed and its tenant.
   *  Returns the backend verdict: { deleted: true } or { deleted: false, reason } (e.g. 'seed_already_claimed'). */
  async deleteSeed(id: string): Promise<{ deleted: boolean; reason?: string }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data ?? { deleted: true };
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

  /** POST /api/admin/directory-presence/presence-seeds/proving-ground-seed
   *  (Migration 262, spec §4.4) — seed + publish + link + claim-token +
   *  queue.seed_id stamp; rows stay 'queued'. */
  async provingGroundSeed(
    queueEntryIds: string[],
    seedBatch: string,
  ): Promise<{
    created: Array<{ queueEntryId: string; seedId: string; claimToken: string | null }>;
    skipped: Array<{ queueEntryId: string; reason: string }>;
    failed: Array<{ queueEntryId: string; error: string }>;
  }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/proving-ground-seed`,
      { method: 'POST', body: JSON.stringify({ queueEntryIds, seedBatch }) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data;
  }

  /** POST /api/admin/directory-presence/presence-seeds/dedup-verdicts
   *  (Migration 262, spec §4.9) — record a group verdict; same_entity merges
   *  identity into mergeInto. */
  async recordDedupVerdict(input: {
    seedIds: string[];
    matchKey: 'phone' | 'address_city';
    verdict: 'same_entity' | 'distinct';
    mergeInto?: string;
    rationale?: string;
  }): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/dedup-verdicts`,
      { method: 'POST', body: JSON.stringify(input) },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data?.verdict ?? data;
  }

  /** GET /api/admin/directory-presence/presence-seeds/dedup-verdicts */
  async listDedupVerdicts(): Promise<any[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/dedup-verdicts`,
      { method: 'GET' },
      undefined,
      0,
    );
    const data = result.data?.data ?? result.data;
    return data?.verdicts ?? [];
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

  /** POST /api/admin/directory-presence/presence-seeds/from-campaign/:campaignId */
  async createSeedFromCampaign(
    campaignId: string,
    publish = true,
  ): Promise<{ seedId: string; listingId: string; tenantId: string; slug: string; publicUrl: string; created: boolean; seoEnriched: boolean }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/from-campaign/${encodeURIComponent(campaignId)}`,
      { method: 'POST', body: JSON.stringify({ publish }) },
      undefined,
      0,
    );
    if (!result.success) {
      const err = result.error as any;
      const message = typeof err === 'string' ? err : err?.message;
      throw new Error(message || 'Failed to create seed from campaign');
    }
    const data = result.data?.data ?? result.data;
    return data as { seedId: string; listingId: string; tenantId: string; slug: string; publicUrl: string; created: boolean; seoEnriched: boolean };
  }

  /** POST /api/admin/directory-presence/presence-seeds/:id/spawn-campaign
   *  Spawn a business-scope marketing campaign from the seed's NAP and link
   *  it. Returns the created campaign + link + NAP match result. */
  async spawnCampaignFromSeed(
    seedId: string,
    input: {
      category?: string;
      notes?: string;
      linkRole?: 'primary' | 'sibling' | 'recovery';
    },
  ): Promise<{
    campaign: any;
    link: DirectorySeedCampaignLink;
    autoProjected: boolean;
    napMatch: any;
  }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/spawn-campaign`,
      { method: 'POST', body: JSON.stringify(input) },
      undefined,
      0,
    );
    if (!result.success) {
      const err = result.error as any;
      const message = typeof err === 'string' ? err : err?.message || err?.error;
      throw new Error(message || 'Failed to spawn campaign from seed');
    }
    const data = result.data?.data ?? result.data;
    return data as { campaign: any; link: DirectorySeedCampaignLink; autoProjected: boolean; napMatch: any };
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
    const error = typeof result.error === 'string' ? result.error : result.error?.message;
    return { success: result.success, error };
  }

  /** POST /api/admin/directory-presence/claim-requests/:id/reject */
  async rejectClaimRequest(id: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/claim-requests/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      undefined,
      0,
    );
    const error = typeof result.error === 'string' ? result.error : result.error?.message;
    return { success: result.success, error };
  }

  /** POST /api/admin/directory-presence/claim-requests/:id/link-customer */
  async linkCustomerToClaimRequest(id: string, customerId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/claim-requests/${encodeURIComponent(id)}/link-customer`,
      { method: 'POST', body: JSON.stringify({ customerId }) },
      undefined,
      0,
    );
    const error = typeof result.error === 'string' ? result.error : result.error?.message;
    return { success: result.success, error };
  }

  /** POST /api/admin/directory-presence/claim-requests/:id/verify — save verification worksheet */
  async saveVerification(
    id: string,
    method: string,
    notes?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/claim-requests/${encodeURIComponent(id)}/verify`,
      { method: 'POST', body: JSON.stringify({ method, notes }) },
      undefined,
      0,
    );
    const error = typeof result.error === 'string' ? result.error : result.error?.message;
    return { success: result.success, error };
  }

  /** GET /api/admin/directory-presence/claim-requests/:id/attachments — list proof attachments */
  async listClaimAttachments(
    requestId: string,
  ): Promise<Array<{ id: string; fileName: string; fileType: string; fileSize: number; uploadedAt: string }>> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/claim-requests/${encodeURIComponent(requestId)}/attachments`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return [];
    const data = result.data?.data ?? result.data;
    return Array.isArray(data) ? data : [];
  }

  // ============================
  // Category Market Enrichment (spec §6.3)
  // ============================

  /** POST /api/admin/directory/category-enrichment/markets */
  async enrichMarket(input: { category: string; city: string; state: string }): Promise<EnrichMarketResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/admin/directory/category-enrichment/markets',
      { method: 'POST', body: JSON.stringify(input) },
      undefined,
      0,
    );
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errorMessage || 'enrich_market_failed');
    }
    const data = result.data?.data ?? result.data;
    return data?.result as EnrichMarketResult;
  }

  /** GET /api/admin/directory/category-enrichment/markets (first match) */
  async getMarket(filters: {
    category: string;
    city: string;
    state: string;
  }): Promise<EnrichedMarket | null> {
    const markets = await this.listMarkets(filters);
    return markets[0] ?? null;
  }

  /** GET /api/admin/directory/category-enrichment/markets */
  async listMarkets(filters?: {
    category?: string;
    city?: string;
    state?: string;
  }): Promise<EnrichedMarket[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.city) params.set('city', filters.city);
    if (filters?.state) params.set('state', filters.state);
    const qs = params.toString();
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory/category-enrichment/markets${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) return [];
    const data = result.data?.data ?? result.data;
    return (data?.markets ?? []) as EnrichedMarket[];
  }

  /** PATCH /api/admin/directory/category-enrichment/markets/:categoryKey/:city/:state */
  async overrideMarket(
    categoryKey: string,
    city: string,
    state: string,
    input: {
      operator_override_description?: string;
      operator_override_meta_title?: string;
      operator_override_keywords?: string[];
      reset_description?: boolean;
      reset_meta_title?: boolean;
      reset_keywords?: boolean;
    },
  ): Promise<EnrichedMarket> {
    const encodedKey = encodeURIComponent(categoryKey);
    const encodedCity = encodeURIComponent(city);
    const encodedState = encodeURIComponent(state);
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory/category-enrichment/markets/${encodedKey}/${encodedCity}/${encodedState}`,
      { method: 'PATCH', body: JSON.stringify(input) },
      undefined,
      0,
    );
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errorMessage || 'override_market_failed');
    }
    const data = result.data?.data ?? result.data;
    return data?.result as EnrichedMarket;
  }

  /** GET /api/admin/directory/listings/:tenantId/seo */
  async getTenantSeoState(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory/listings/${encodeURIComponent(tenantId)}/seo`,
      { method: 'GET' },
      undefined,
      0,
    );
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errorMessage || 'get_tenant_seo_failed');
    }
    const data = result.data?.data ?? result.data;
    return data?.state ?? data;
  }

  /** PATCH /api/admin/directory/listings/:tenantId/seo */
  async overrideTenantSeo(
    tenantId: string,
    input: {
      seo_description?: string;
      seo_keywords?: string[];
      reset_description?: boolean;
      reset_keywords?: boolean;
    },
  ): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory/listings/${encodeURIComponent(tenantId)}/seo`,
      { method: 'PATCH', body: JSON.stringify(input) },
      undefined,
      0,
    );
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errorMessage || 'override_tenant_seo_failed');
    }
    const data = result.data?.data ?? result.data;
    return data?.state ?? data;
  }

  /** POST /api/admin/directory-presence/presence-seeds/:id/compose */
  async getSeedComposed(seedId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/compose`,
      { method: 'POST' },
      undefined,
      0,
    );
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errorMessage || 'compose_seed_failed');
    }
    const data = result.data?.data ?? result.data;
    return data?.result ?? data;
  }

  /** POST /api/admin/directory-presence/presence-seeds/:id/reset */
  async resetSeedOverride(seedId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/admin/directory-presence/presence-seeds/${encodeURIComponent(seedId)}/reset`,
      { method: 'POST' },
      undefined,
      0,
    );
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errorMessage || 'reset_seed_failed');
    }
    const data = result.data?.data ?? result.data;
    return data?.result ?? data;
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
  claimantFirstName: string | null;
  claimantMiddleName: string | null;
  claimantLastName: string | null;
  claimantPhone: string | null;
  claimantBusinessAddress: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  verificationMethod: string | null;
  verificationNotes: string | null;
  verificationCompletedAt: string | null;
  verificationCompletedBy: string | null;
  businessName: string;
  category: string;
  address: string;
  businessPhone: string | null;
  city: string;
  state: string;
  attachmentCount: number;
}

// ============================
// Category Market Enrichment (spec §6.3)
// ============================

export interface EnrichedMarket {
  id: string;
  categoryKey: string;
  categoryName: string;
  city: string;
  state: string;
  effective: {
    metaTitle: string;
    description: string;
    keywords: string[];
    secondaryCategories: string[];
    schemaTypeHint: string | null;
    synonyms: string[];
  };
  composed: {
    metaTitle: string;
    description: string;
    keywords: string[];
    secondaryCategories: string[];
    schemaTypeHint: string | null;
  };
  override: {
    description: string | null;
    metaTitle: string | null;
    keywords: string[] | null;
  };
  enrichedAt: string;
  enrichedBy: string | null;
  triggerSource: string;
  overrideBy: string | null;
  overrideAt: string | null;
  intelligenceProfileId: string | null;
  goldStandardProfileId: string | null;
  composerVersion: number;
}

export interface EnrichMarketResult {
  marketKey: { categoryKey: string; city: string; state: string };
  categoryEnrichmentId: string | null;
  listingsEnriched: number;
  listingsSkipped: number;
  skipReasons: Record<string, number>;
}

const directoryPresenceAdminService = DirectoryPresenceAdminService.getInstance();
export default directoryPresenceAdminService;

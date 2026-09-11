/**
 * DirectorySuggestionService — public suggestion queue for missing directory businesses.
 *
 * Phase 1 (public suggestions):
 *   - Accept public submissions with rate limiting and honeypot bot detection.
 *   - Deduplicate against existing directory listings and presence seeds.
 *   - Provide admin list/get/update-status for the operator review queue.
 *
 * Suggestions are never published directly; an operator must convert an
 * approved suggestion into a directory_presence_seed.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateDirectoryPresenceSuggestionId } from '../lib/id-generator';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import CrmTicketService from './CrmTicketService';
import CrmTicketMessageService from './CrmTicketMessageService';
import DirectoryPresenceSeedService, { CreateSeedInput } from './DirectoryPresenceSeedService';
import { z } from 'zod';

export const suggestionInputSchema = z.object({
  businessName: z.string().min(1).max(255),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  phone: z.string().max(40).optional(),
  primaryCategory: z.string().max(120).optional(),
  submitterEmail: z.string().email().max(255).optional().or(z.literal('')),
  submitterComment: z.string().max(1000).optional(),
  // "OK to contact me about this" — false/absent = fire-and-forget; the
  // operator should not treat the submitter email as an outreach route.
  contactConsent: z.boolean().optional(),
  sourcePage: z.string().max(500).optional(),
  honeyPot: z.string().optional(),
});

export type SuggestionInput = z.infer<typeof suggestionInputSchema>;

/**
 * Render a raw sourcePage URL as "url (surface)" for operator contexts.
 * The CTAs pass the full referring URL; the path prefix identifies which
 * intake surface it came from.
 */
export function describeSourcePage(sourcePage?: string | null): string {
  const url = sourcePage?.trim();
  if (!url) return 'unknown';
  const path = url.replace(/^https?:\/\/[^/]+/i, '');
  let surface = 'other';
  if (path.startsWith('/place/')) surface = 'place entry';
  else if (path.includes('/location/')) surface = 'location page';
  else if (path.includes('/category/') || path.includes('/city/')) surface = 'category/city page';
  else if (path.startsWith('/directory/suggest') || path.startsWith('/directory/add-business')) surface = 'direct form';
  else if (path.startsWith('/directory')) surface = 'directory';
  return `${url} (${surface})`;
}

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
  /** Submitter opted in to being contacted about the suggestion. */
  contactConsent?: boolean;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  seedId: string | null;
  // Prospect-queue back-link (queue entry's business_snapshot->>'suggestion_id').
  queueEntryId?: string | null;
  queueEntryStatus?: string | null;
  queueCampaignId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DuplicateMatch {
  id: string;
  businessName: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  isPublished: boolean;
  seedStatus: string | null;
}

interface ListFilters {
  status?: string;
  city?: string;
  state?: string;
  primaryCategory?: string;
  limit?: number;
  offset?: number;
}

class DirectorySuggestionService {
  /**
   * Submit a public suggestion. Performs honeypot, rate, and duplicate checks.
   * Returns the created suggestion or the duplicate match that blocked it.
   */
  async createSuggestion(input: SuggestionInput, submitterIp?: string): Promise<{
    suggestion?: SuggestionRecord;
    duplicate?: DuplicateMatch;
    error?: string;
    statusCode: number;
  }> {
    // Honeypot: if the hidden field is filled, treat as bot
    if (input.honeyPot && input.honeyPot.trim().length > 0) {
      return { error: 'suspected_bot', statusCode: 400 };
    }

    const normalizedEmail = input.submitterEmail?.trim().toLowerCase() || null;
    const normalizedIp = this.normalizeIp(submitterIp);

    // Rate limits: 5 per hour per IP, 3 per hour per email
    const rateCheck = await this.checkRateLimits({ email: normalizedEmail, ip: normalizedIp });
    if (rateCheck.exceeded) {
      return { error: 'rate_limit_exceeded', statusCode: 429 };
    }

    // Deduplicate only when city/state are provided (otherwise too fuzzy)
    if (input.city && input.state) {
      const duplicate = await this.findDuplicate(input.businessName, input.city, input.state);
      if (duplicate) {
        return { duplicate, statusCode: 409 };
      }
    }

    const id = generateDirectoryPresenceSuggestionId();

    const result = await prisma.$queryRaw<SuggestionRecord[]>`
      INSERT INTO directory_presence_suggestions (
        id, business_name, address, city, state, zip_code, phone,
        primary_category, submitter_email, submitter_ip, submitter_comment, source_page,
        contact_consent, status, created_at, updated_at
      ) VALUES (
        ${id},
        ${input.businessName.trim()},
        ${input.address?.trim() || null},
        ${input.city?.trim() || null},
        ${input.state?.trim() || null},
        ${input.zipCode?.trim() || null},
        ${input.phone?.trim() || null},
        ${input.primaryCategory?.trim() || null},
        ${normalizedEmail},
        ${normalizedIp},
        ${input.submitterComment?.trim() || null},
        ${input.sourcePage?.trim() || null},
        ${input.contactConsent === true},
        'submitted',
        NOW(),
        NOW()
      )
      RETURNING
        id, business_name as "businessName", address, city, state, zip_code as "zipCode",
        phone, primary_category as "primaryCategory", submitter_email as "submitterEmail",
        submitter_ip as "submitterIp", submitter_comment as "submitterComment",
        source_page as "sourcePage", contact_consent as "contactConsent", status,
        reviewed_by as "reviewedBy", reviewed_at as "reviewedAt",
        seed_id as "seedId", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const suggestion = result[0];

    logger.info('[DirectorySuggestionService] Public suggestion submitted', undefined, {
      suggestionId: id,
      businessName: input.businessName,
      city: input.city,
      state: input.state,
      sourcePage: input.sourcePage,
    });

    await this.notifyNewSuggestion(suggestion);

    return { suggestion, statusCode: 201 };
  }

  /**
   * File a Requests-Hub ticket for the operator (Requests Hub SOP —
   * public-surface intake → platform-scope crm_support_tickets, see
   * AGENTS.md). Non-fatal: the suggestion row is already persisted.
   */
  private async notifyNewSuggestion(suggestion: SuggestionRecord): Promise<void> {
    try {
      const location = [suggestion.city, suggestion.state].filter(Boolean).join(', ');
      const ticket = await CrmTicketService.getInstance().create({
        tenant_id: PLATFORM_SCOPE,
        title: `Directory suggestion: ${suggestion.businessName}${location ? ` (${location})` : ''}`,
        description: `A visitor suggested a missing business for the directory.

Business: ${suggestion.businessName}
Address: ${[suggestion.address, location, suggestion.zipCode].filter(Boolean).join(', ') || '—'}
Phone: ${suggestion.phone || '—'}
Category: ${suggestion.primaryCategory || '—'}
Submitter email: ${suggestion.submitterEmail || '—'}
OK to contact submitter: ${suggestion.contactConsent ? 'YES' : 'no — fire-and-forget'}
Comment: ${suggestion.submitterComment || '—'}
Source: ${describeSourcePage(suggestion.sourcePage)}

Review at Settings → Directory → Suggestions.`,
        priority: 'medium',
        category: 'directory_suggestion',
        inquiry_id: suggestion.id,
      });

      await CrmTicketMessageService.getInstance().create({
        ticket_id: ticket.id,
        author_id: 'system',
        author_type: 'platform',
        author_name: 'Directory Intake',
        content_blocks: {
          version: '1',
          blocks: [
            { type: 'paragraph', text: `${suggestion.businessName}${location ? ` (${location})` : ''} was suggested for the directory.` },
            { type: 'button', label: 'Review in Suggestions queue', url: '/settings/admin/directory/suggestions', variant: 'primary' },
          ],
        },
      });
    } catch (err) {
      logger.error('[DirectorySuggestionService] CRM ticket create failed (non-fatal)', undefined, {
        error: (err as Error).message,
        suggestionId: suggestion.id,
      });
    }
  }

  /**
   * Resolve the suggestion's intake ticket once an operator decides
   * (approve / under_review / rejected / duplicate) — keeps the Requests
   * Hub self-cleaning.
   */
  private async resolveIntakeTicket(suggestionId: string): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE crm_support_tickets
        SET status = 'resolved', resolved_at = now(), updated_at = now()
        WHERE tenant_id = ${PLATFORM_SCOPE}
          AND inquiry_id = ${suggestionId}
          AND category = 'directory_suggestion'
          AND status IN ('open', 'in_progress', 'waiting')
      `;
    } catch (err) {
      logger.error('[DirectorySuggestionService] CRM ticket resolve failed (non-fatal)', undefined, {
        error: (err as Error).message,
        suggestionId,
      });
    }
  }

  /**
   * List suggestions for the admin queue with optional filters and pagination.
   */
  async listSuggestions(filters: ListFilters = {}): Promise<{
    suggestions: SuggestionRecord[];
    total: number;
  }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (filters.status) {
      conditions.push(`s.status = $${paramIdx++}`);
      params.push(filters.status);
    }
    if (filters.city) {
      conditions.push(`s.city ILIKE $${paramIdx++}`);
      params.push(`%${filters.city}%`);
    }
    if (filters.state) {
      conditions.push(`s.state ILIKE $${paramIdx++}`);
      params.push(`%${filters.state}%`);
    }
    if (filters.primaryCategory) {
      conditions.push(`s.primary_category ILIKE $${paramIdx++}`);
      params.push(`%${filters.primaryCategory}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countQuery = `SELECT COUNT(*) as total FROM directory_presence_suggestions s ${whereClause}`;
    const limit = Math.min(100, Math.max(1, filters.limit || 50));
    const offset = Math.max(0, filters.offset || 0);
    const countResult = await prisma.$queryRawUnsafe<{ total: number }[]>(countQuery, ...params);
    const total = parseInt(String(countResult[0]?.total || 0), 10);

    // Lateral join surfaces the prospect-queue entry a suggestion was parked
    // in (business_snapshot->>'suggestion_id' back-link) so the queue row can
    // render "in queue (status)" instead of offering Queue/Verify again.
    const dataQuery = `
      SELECT
        s.id, s.business_name as "businessName", s.address, s.city, s.state, s.zip_code as "zipCode",
        s.phone, s.primary_category as "primaryCategory", s.submitter_email as "submitterEmail",
        s.submitter_ip as "submitterIp", s.submitter_comment as "submitterComment",
        s.source_page as "sourcePage", s.contact_consent as "contactConsent", s.status,
        s.reviewed_by as "reviewedBy",
        s.reviewed_at as "reviewedAt", s.seed_id as "seedId", s.created_at as "createdAt", s.updated_at as "updatedAt",
        q.id as "queueEntryId", q.status as "queueEntryStatus", q.processed_campaign_id as "queueCampaignId"
      FROM directory_presence_suggestions s
      LEFT JOIN LATERAL (
        SELECT id, status, processed_campaign_id, created_at FROM mkt_prospect_queue q
        WHERE q.business_snapshot->>'suggestion_id' = s.id
        ORDER BY q.created_at DESC
        LIMIT 1
      ) q ON true
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(limit, offset);

    const suggestions = await prisma.$queryRawUnsafe<SuggestionRecord[]>(dataQuery, ...params);

    return { suggestions, total };
  }

  /**
   * Get a single suggestion by ID.
   */
  async getSuggestion(id: string): Promise<SuggestionRecord | null> {
    const result = await prisma.$queryRaw<SuggestionRecord[]>`
      SELECT
        id, business_name as "businessName", address, city, state, zip_code as "zipCode",
        phone, primary_category as "primaryCategory", submitter_email as "submitterEmail",
        submitter_ip as "submitterIp", submitter_comment as "submitterComment",
        source_page as "sourcePage", contact_consent as "contactConsent", status, reviewed_by as "reviewedBy",
        reviewed_at as "reviewedAt", seed_id as "seedId", created_at as "createdAt", updated_at as "updatedAt"
      FROM directory_presence_suggestions
      WHERE id = ${id}
      LIMIT 1
    `;
    return result[0] || null;
  }

  /**
   * Approve a public suggestion: convert it into a published directory seed,
   * mint a claim token, and email the submitter the claim link.
   */
  async approve(
    id: string,
    actorId: string,
  ): Promise<{ suggestion: SuggestionRecord; seed: any; token: string; expiresAt: Date; claimUrl: string } | null> {
    const suggestion = await this.getSuggestion(id);
    if (!suggestion) return null;

    const seedInput: CreateSeedInput = {
      businessName: suggestion.businessName.trim(),
      address: suggestion.address?.trim() || '',
      city: suggestion.city?.trim() || '',
      state: suggestion.state?.trim() || '',
      zipCode: suggestion.zipCode?.trim() || undefined,
      phone: suggestion.phone?.trim() || undefined,
      primaryCategory: suggestion.primaryCategory?.trim() || 'Local Business',
      seedBatch: 'public_suggestion',
      identityConfidence: 'medium',
      categoryFit: 'probable',
      notes: suggestion.submitterComment?.trim() || undefined,
      ownerEmail: suggestion.submitterEmail?.trim().toLowerCase() || undefined,
      listingOrigin: 'public_suggestion',
      publicDisclaimer: 'Suggested by a visitor. Owner may claim and verify this listing.',
      provenance: this.buildProvenance(suggestion),
    };

    const seed = await DirectoryPresenceSeedService.createSeed(seedInput, {
      actorType: 'user',
      actorId,
    });

    const { token, expiresAt, claimUrl } = await DirectoryPresenceSeedService.approveAndInvite(seed.id, {
      actorType: 'user',
      actorId,
    });

    await prisma.$executeRaw`
      UPDATE directory_presence_suggestions
      SET
        status = 'approved',
        reviewed_by = ${actorId},
        reviewed_at = NOW(),
        seed_id = ${seed.id},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    // Lineage: if this suggestion was parked in the prospect queue, stamp the
    // queue entry with the minted seed so the funnel reads suggestion → queue
    // → campaign → seed.
    await prisma.$executeRaw`
      UPDATE mkt_prospect_queue
      SET seed_id = ${seed.id}, updated_at = now()
      WHERE business_snapshot->>'suggestion_id' = ${id}
        AND seed_id IS NULL
    `;

    await this.resolveIntakeTicket(id);

    logger.info('[DirectorySuggestionService] Approved and invited', undefined, {
      suggestionId: id,
      seedId: seed.id,
      token,
    });

    const updated = await this.getSuggestion(id);
    return updated ? { suggestion: updated, seed, token, expiresAt, claimUrl } : null;
  }

  /**
   * Admin analytics for public suggestions and owner submissions.
   * Aggregates counts by status, source page, and day without PII.
   */
  async getAnalytics(): Promise<{
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
  }> {
    const totalSuggestions = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM directory_presence_suggestions
    `;
    const statusSuggestions = await prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT status, COUNT(*)::int AS count
      FROM directory_presence_suggestions
      GROUP BY status
    `;
    const sourceSuggestions = await prisma.$queryRaw<{ source_page: string | null; count: number }[]>`
      SELECT source_page, COUNT(*)::int AS count
      FROM directory_presence_suggestions
      GROUP BY source_page
      ORDER BY count DESC
      LIMIT 10
    `;
    const daySuggestions = await prisma.$queryRaw<{ day: string; count: number }[]>`
      SELECT DATE(created_at) AS day, COUNT(*)::int AS count
      FROM directory_presence_suggestions
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day
    `;

    const totalOwners = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM directory_presence_seeds WHERE seed_batch = 'owner-submitted'
    `;
    const statusOwners = await prisma.$queryRaw<{ status: string; count: number }[]>`
      SELECT status, COUNT(*)::int AS count
      FROM directory_presence_seeds
      WHERE seed_batch = 'owner-submitted'
      GROUP BY status
    `;
    const dayOwners = await prisma.$queryRaw<{ day: string; count: number }[]>`
      SELECT DATE(created_at) AS day, COUNT(*)::int AS count
      FROM directory_presence_seeds
      WHERE seed_batch = 'owner-submitted' AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day
    `;

    return {
      suggestions: {
        total: totalSuggestions[0]?.total || 0,
        byStatus: statusSuggestions.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {}),
        bySourcePage: sourceSuggestions.map((r) => ({ sourcePage: r.source_page, count: r.count })),
        byDay: daySuggestions.map((r) => ({ day: r.day, count: r.count })),
      },
      ownerSubmissions: {
        total: totalOwners[0]?.total || 0,
        byStatus: statusOwners.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {}),
        byDay: dayOwners.map((r) => ({ day: r.day, count: r.count })),
      },
    };
  }

  private buildProvenance(suggestion: SuggestionRecord): CreateSeedInput['provenance'] {
    const submittedAt = new Date();
    return [
      { fieldKey: 'name', value: suggestion.businessName.trim(), sourceName: 'public_suggestion', accessedAt: submittedAt, confidence: 'medium' as const, showOnPublic: false },
      { fieldKey: 'address', value: suggestion.address?.trim() || undefined, sourceName: 'public_suggestion', accessedAt: submittedAt, confidence: 'medium' as const, showOnPublic: false },
      { fieldKey: 'phone', value: suggestion.phone?.trim() || undefined, sourceName: 'public_suggestion', accessedAt: submittedAt, confidence: 'medium' as const, showOnPublic: false },
      { fieldKey: 'primary_category', value: suggestion.primaryCategory?.trim() || undefined, sourceName: 'public_suggestion', accessedAt: submittedAt, confidence: 'medium' as const, showOnPublic: false },
    ];
  }

  /**
   * Update the status of a suggestion (operator review action).
   * Allowed status values: submitted, under_review, approved, rejected, duplicate.
   * Note: use approve() to convert an approved suggestion into a seed.
   */
  async updateStatus(
    id: string,
    status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'duplicate',
    actorId: string,
    seedId?: string,
  ): Promise<SuggestionRecord | null> {
    const result = await prisma.$queryRaw<SuggestionRecord[]>`
      UPDATE directory_presence_suggestions
      SET
        status = ${status},
        reviewed_by = ${actorId},
        reviewed_at = NOW(),
        seed_id = ${seedId || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id, business_name as "businessName", address, city, state, zip_code as "zipCode",
        phone, primary_category as "primaryCategory", submitter_email as "submitterEmail",
        submitter_ip as "submitterIp", submitter_comment as "submitterComment",
        source_page as "sourcePage", contact_consent as "contactConsent", status, reviewed_by as "reviewedBy",
        reviewed_at as "reviewedAt", seed_id as "seedId", created_at as "createdAt", updated_at as "updatedAt"
    `;
    // Any status other than 'submitted' is an operator decision.
    if (status !== 'submitted') await this.resolveIntakeTicket(id);
    return result[0] || null;
  }

  /**
   * Check for an existing directory listing or presence seed with the same
   * business name in the same city/state. Returns the first matching public listing.
   */
  private async findDuplicate(
    businessName: string,
    city: string,
    state: string,
  ): Promise<DuplicateMatch | null> {
    const result = await prisma.$queryRaw<DuplicateMatch[]>`
      SELECT
        dll.id,
        dll.business_name as "businessName",
        dll.slug,
        dll.city,
        dll.state,
        dll.is_published as "isPublished",
        dps.status as "seedStatus"
      FROM directory_listings_list dll
      LEFT JOIN directory_presence_seeds dps ON dps.listing_id = dll.id
      WHERE LOWER(dll.business_name) = LOWER(${businessName.trim()})
        AND (
          LOWER(dll.city) = LOWER(${city.trim()})
          OR LOWER(dps.city) = LOWER(${city.trim()})
        )
        AND (
          LOWER(dll.state) = LOWER(${state.trim()})
          OR LOWER(dps.state) = LOWER(${state.trim()})
        )
      LIMIT 1
    `;

    return result[0] || null;
  }

  /**
   * Enforce rate limits: 5 submissions per hour per IP, 3 per hour per email.
   */
  private async checkRateLimits({
    email,
    ip,
  }: {
    email: string | null;
    ip: string | null;
  }): Promise<{ exceeded: boolean; reason?: string }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (email) {
      conditions.push(`(submitter_email = $${paramIdx++} AND created_at > NOW() - INTERVAL '1 hour')`);
      params.push(email);
    }
    if (ip) {
      conditions.push(`(submitter_ip = $${paramIdx++} AND created_at > NOW() - INTERVAL '1 hour')`);
      params.push(ip);
    }

    if (conditions.length === 0) {
      return { exceeded: false };
    }

    const query = `
      SELECT
        COUNT(*) FILTER (WHERE ${conditions.join(' OR ')}) AS total,
        COUNT(*) FILTER (WHERE submitter_email = $${paramIdx} AND created_at > NOW() - INTERVAL '1 hour') AS email_count
      FROM directory_presence_suggestions
    `;
    if (email) params.push(email);

    const result = await prisma.$queryRawUnsafe<{
      total: number;
      email_count: number;
    }[]>(query, ...params);

    const row = result[0];
    const ipCount = (parseInt(String(row?.total || 0), 10) || 0) - (parseInt(String(row?.email_count || 0), 10) || 0);
    const emailCount = parseInt(String(row?.email_count || 0), 10) || 0;

    if (emailCount >= 3) return { exceeded: true, reason: 'email_rate_limit' };
    if (ipCount >= 5) return { exceeded: true, reason: 'ip_rate_limit' };

    return { exceeded: false };
  }

  private normalizeIp(ip?: string): string | null {
    if (!ip) return null;
    const cleaned = ip.split(',')[0].trim();
    return cleaned.length <= 64 ? cleaned : null;
  }
}

export default new DirectorySuggestionService();

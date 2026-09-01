/**
 * DirectoryOwnerSubmissionService — owner-driven "Add my business" submissions.
 *
 * Creates a directory_presence_seed in 'draft' status from an owner's own input.
 * The listing is not published until an operator reviews and publishes it.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import DirectoryPresenceSeedService, { CreateSeedInput } from './DirectoryPresenceSeedService';
import { z } from 'zod';

export const ownerSubmissionInputSchema = z.object({
  businessName: z.string().min(1).max(255),
  address: z.string().min(1).max(255),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  zipCode: z.string().max(20).optional(),
  phone: z.string().max(40).optional(),
  primaryCategory: z.string().min(1).max(120),
  website: z.string().url().max(255).optional().or(z.literal('')),
  ownerName: z.string().min(1).max(255),
  ownerEmail: z.string().email().max(255),
  ownerPhone: z.string().max(40).optional(),
  submitterComment: z.string().max(1000).optional(),
  sourcePage: z.string().max(500).optional(),
  honeyPot: z.string().optional(),
});

export type OwnerSubmissionInput = z.infer<typeof ownerSubmissionInputSchema>;

export interface DuplicateMatch {
  id: string;
  businessName: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  isPublished: boolean;
  seedStatus: string | null;
}

interface OwnerSubmissionContext {
  actorType: 'customer' | 'user' | 'system';
  actorId: string;
  ip?: string;
  userAgent?: string;
}

class DirectoryOwnerSubmissionService {
  /**
   * Submit a business as its owner. Creates a directory_presence_seed in draft
   * status. Returns the created seed summary, or the existing match if duplicate.
   */
  async submit(
    input: OwnerSubmissionInput,
    ctx: OwnerSubmissionContext,
  ): Promise<{
    seed?: any;
    duplicate?: DuplicateMatch;
    error?: string;
    statusCode: number;
  }> {
    if (input.honeyPot && input.honeyPot.trim().length > 0) {
      return { error: 'suspected_bot', statusCode: 400 };
    }

    const duplicate = await this.findDuplicate(input.businessName, input.city, input.state);
    if (duplicate) {
      return { duplicate, statusCode: 409 };
    }

    const seedInput: CreateSeedInput = {
      businessName: input.businessName.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      zipCode: input.zipCode?.trim(),
      phone: input.phone?.trim(),
      website: input.website?.trim() || undefined,
      primaryCategory: input.primaryCategory.trim(),
      seedBatch: 'owner-submitted',
      identityConfidence: 'medium',
      categoryFit: 'probable',
      notes: input.submitterComment?.trim() || undefined,
      ownerName: input.ownerName.trim(),
      ownerEmail: input.ownerEmail.trim().toLowerCase(),
      ownerPhone: input.ownerPhone?.trim(),
      listingOrigin: 'owner_submitted',
      publicDisclaimer: 'Submitted by the owner. Pending review before publishing.',
      provenance: this.buildProvenance(input),
    };

    const seed = await DirectoryPresenceSeedService.createSeed(seedInput, {
      actorType: ctx.actorType,
      actorId: ctx.actorId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    logger.info('[DirectoryOwnerSubmissionService] Owner submitted business', undefined, {
      seedId: seed.id,
      tenantId: seed.tenantId,
      businessName: input.businessName,
      ownerEmail: input.ownerEmail,
    });

    return { seed, statusCode: 201 };
  }

  private buildProvenance(input: OwnerSubmissionInput): CreateSeedInput['provenance'] {
    const submittedAt = new Date();
    const base = [
      { fieldKey: 'name', value: input.businessName.trim(), sourceName: 'owner_submission', confidence: 'high' as const, showOnPublic: false },
      { fieldKey: 'address', value: input.address.trim(), sourceName: 'owner_submission', confidence: 'high' as const, showOnPublic: false },
      { fieldKey: 'phone', value: input.phone?.trim(), sourceName: 'owner_submission', confidence: 'high' as const, showOnPublic: false },
      { fieldKey: 'primary_category', value: input.primaryCategory.trim(), sourceName: 'owner_submission', confidence: 'high' as const, showOnPublic: false },
    ];

    return base.map((p) => ({
      fieldKey: p.fieldKey,
      value: p.value,
      sourceName: p.sourceName,
      accessedAt: submittedAt,
      confidence: p.confidence,
      showOnPublic: p.showOnPublic,
    }));
  }

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
        AND LOWER(dll.city) = LOWER(${city.trim()})
        AND LOWER(dll.state) = LOWER(${state.trim()})
      LIMIT 1
    `;

    return result[0] || null;
  }
}

export default new DirectoryOwnerSubmissionService();

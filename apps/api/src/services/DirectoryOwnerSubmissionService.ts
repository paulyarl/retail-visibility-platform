/**
 * DirectoryOwnerSubmissionService — owner-driven "Add my business" submissions.
 *
 * Creates a directory_presence_seed in 'draft' status from an owner's own input.
 * If the submitter is not authenticated as a customer, a verification token is
 * sent to the owner email and the seed is created only after they confirm.
 *
 * If the submitter is authenticated as a customer, the seed is created immediately
 * (customer account substitutes for email verification).
 */

import { randomBytes } from 'crypto';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { emailService } from './email-service';
import DirectoryPresenceSeedService, { CreateSeedInput } from './DirectoryPresenceSeedService';
import { generateDirectoryPresenceSubmissionVerificationId } from '../lib/id-generator';
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

export interface SubmissionContext {
  actorType: 'customer' | 'user';
  actorId: string;
  ip?: string;
  userAgent?: string;
}

interface OwnerSubmissionResult {
  seed?: any;
  pending?: any;
  duplicate?: DuplicateMatch;
  error?: string;
  statusCode: number;
}

class DirectoryOwnerSubmissionService {
  /**
   * Submit a business as its owner. Authenticated customers get an immediate
   * draft seed; anonymous owners receive an email verification token first.
   */
  async submit(input: OwnerSubmissionInput, ctx: SubmissionContext): Promise<OwnerSubmissionResult> {
    if (input.honeyPot && input.honeyPot.trim().length > 0) {
      return { error: 'suspected_bot', statusCode: 400 };
    }

    const duplicate = await this.findDuplicate(input.businessName, input.city, input.state);
    if (duplicate) {
      return { duplicate, statusCode: 409 };
    }

    const seedInput = this.buildSeedInput(input);

    // Authenticated customer: create seed immediately
    if (ctx.actorType === 'customer') {
      const seed = await DirectoryPresenceSeedService.createSeed(seedInput, {
        actorType: 'customer',
        actorId: ctx.actorId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      logger.info('[DirectoryOwnerSubmissionService] Customer submitted business', undefined, {
        seedId: seed.id,
        businessName: input.businessName,
        customerId: ctx.actorId,
      });
      return { seed, statusCode: 201 };
    }

    // Anonymous owner: create a verification token and send email
    const verification = await this.createVerification(input, seedInput, ctx);
    await this.sendVerificationEmail(input.ownerEmail.trim().toLowerCase(), verification.token, input.businessName);

    logger.info('[DirectoryOwnerSubmissionService] Anonymous owner submission pending verification', undefined, {
      verificationId: verification.id,
      businessName: input.businessName,
      ownerEmail: input.ownerEmail,
    });

    return { pending: verification, statusCode: 202 };
  }

  /**
   * Confirm an owner submission by token. Creates the directory_presence_seed
   * and marks the verification as consumed.
   */
  async verifyToken(token: string): Promise<OwnerSubmissionResult> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, submitter_email, business_name, payload, verified, expires_at
      FROM directory_presence_submission_verifications
      WHERE token = ${token}
      LIMIT 1
    `;

    if (!rows[0]) {
      return { error: 'token_not_found', statusCode: 404 };
    }

    const v = rows[0];
    if (v.verified) {
      return { error: 'token_already_verified', statusCode: 410 };
    }

    const now = new Date();
    const expiresAt = new Date(v.expires_at);
    if (expiresAt < now) {
      return { error: 'token_expired', statusCode: 410 };
    }

    const seedInput: CreateSeedInput = v.payload;
    const seed = await DirectoryPresenceSeedService.createSeed(seedInput, {
      actorType: 'user',
      actorId: 'anonymous',
      ip: undefined,
      userAgent: undefined,
    });

    await prisma.$executeRaw`
      UPDATE directory_presence_submission_verifications
      SET verified = TRUE, verified_at = now(), updated_at = now()
      WHERE id = ${v.id}
    `;

    logger.info('[DirectoryOwnerSubmissionService] Verified owner submission', undefined, {
      verificationId: v.id,
      seedId: seed.id,
      businessName: v.business_name,
    });

    return { seed, statusCode: 201 };
  }

  private buildSeedInput(input: OwnerSubmissionInput): CreateSeedInput {
    return {
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

  private async createVerification(
    input: OwnerSubmissionInput,
    seedInput: CreateSeedInput,
    ctx: SubmissionContext,
  ) {
    const id = generateDirectoryPresenceSubmissionVerificationId();
    const token = randomBytes(32).toString('hex');
    const email = input.ownerEmail.trim().toLowerCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await prisma.$executeRaw`
      INSERT INTO directory_presence_submission_verifications (
        id, token, submitter_email, business_name, payload,
        verified, expires_at, created_at, updated_at
      ) VALUES (
        ${id},
        ${token},
        ${email},
        ${input.businessName.trim()},
        ${JSON.stringify(seedInput)}::jsonb,
        FALSE,
        ${expiresAt}::timestamptz,
        now(),
        now()
      )
    `;

    return { id, token, email, businessName: input.businessName };
  }

  private async sendVerificationEmail(to: string, token: string, businessName: string) {
    const baseUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/directory/add-business/verify?token=${encodeURIComponent(token)}`;

    const html = `
      <h1>Verify your business submission</h1>
      <p>You submitted <strong>${businessName}</strong> to be added to the directory.</p>
      <p>Click the link below to confirm your email and submit the listing for review:</p>
      <p><a href="${verifyUrl}" style="padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; display: inline-block;">Confirm my submission</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p><code>${verifyUrl}</code></p>
      <p>This link expires in 24 hours.</p>
    `;

    const text = `Verify your submission for ${businessName}: ${verifyUrl} (expires in 24 hours)`;

    try {
      await emailService.sendEmail({
        to,
        subject: 'Confirm your business submission',
        html,
        text,
      });
    } catch (error) {
      logger.error('[DirectoryOwnerSubmissionService] Failed to send verification email:', undefined, {
        error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
        to,
        token,
      });
      throw new Error('failed_to_send_verification_email');
    }
  }
}

export default new DirectoryOwnerSubmissionService();

/**
 * Zod validators for the Profile Repair intake portal (Track B — escalated).
 *
 * Profile Repair Integration P2.
 * Used by the public route layer to validate evidence payload submission.
 */

import { z } from 'zod';

// ====================
// EVIDENCE PAYLOAD
// ====================

/**
 * Structured evidence collected from the owner for escalated profile repair
 * cases (suspensions, hijacks, duplicates, ownership disputes).
 *
 * Fields are conditionally required based on issue_type — see
 * `profileRepairIntakeSchema` below for the full validation.
 */
export const evidencePayloadSchema = z.object({
  // Business license / utility bill attachment refs (required for all escalated types)
  proof_of_location: z.array(z.string()).min(1, 'At least one proof-of-location document is required'),

  // Storefront signage / vehicle photos (required for hijack/duplicate/ownership_dispute)
  storefront_photos: z.array(z.string()).optional().default([]),

  // Original GBP profile ID or URL (required for suspension/hijack/duplicate)
  google_profile_id: z.string().optional().nullable(),

  // Suspension notice details (required for suspension)
  suspension_notice_details: z.object({
    date: z.string().optional().nullable(),
    quoted_reason: z.string().optional().nullable(),
  }).optional().nullable(),

  // Duplicate listing URL (required for duplicate_listing / hijacked_listing)
  duplicate_listing_url: z.string().optional().nullable(),
});

export type EvidencePayload = z.infer<typeof evidencePayloadSchema>;

// ====================
// SUBMIT PROFILE REPAIR INTAKE
// ====================

export const profileRepairIntakeSubmitSchema = z.object({
  token: z.string().min(1, 'token is required'),
  ownerStatement: z.string().min(20, 'Owner statement must be at least 20 characters'),
  ownerEmail: z.string().email('A valid email address is required so we can deliver your appeal'),
  ownerPhone: z.string().optional().nullable(),
  proposedResolution: z.string().optional().default(''),
  issueType: z.enum([
    'suspension',
    'duplicate_listing',
    'hijacked_listing',
    'ownership_dispute',
    'address_verification_block',
  ]),
  evidencePayload: evidencePayloadSchema,
  attachmentIds: z.array(z.string()).optional().default([]),
});

export type ProfileRepairIntakeSubmitInput = z.infer<typeof profileRepairIntakeSubmitSchema>;

// ====================
// ISSUE-TYPE-SPECIFIC VALIDATION
// ====================

/**
 * Validates issue-type-specific evidence requirements beyond the base schema.
 * Returns a map of field → error message for missing required evidence.
 */
export function validateEvidenceForIssueType(
  issueType: string,
  evidence: EvidencePayload,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (issueType === 'suspension') {
    if (!evidence.suspension_notice_details?.date && !evidence.suspension_notice_details?.quoted_reason) {
      errors.suspension_notice_details = 'Suspension notice date and/or quoted reason is required for suspension appeals';
    }
    if (!evidence.google_profile_id) {
      errors.google_profile_id = 'The original Google profile ID or URL is required for suspension appeals';
    }
  }

  if (issueType === 'duplicate_listing' || issueType === 'hijacked_listing') {
    if (!evidence.duplicate_listing_url) {
      errors.duplicate_listing_url = `The ${issueType === 'duplicate_listing' ? 'duplicate' : 'hijacked'} listing URL is required`;
    }
    if (!evidence.google_profile_id) {
      errors.google_profile_id = 'The original Google profile ID or URL is required';
    }
    if (!evidence.storefront_photos || evidence.storefront_photos.length === 0) {
      errors.storefront_photos = 'Storefront photos are required to prove ownership';
    }
  }

  if (issueType === 'ownership_dispute') {
    if (!evidence.storefront_photos || evidence.storefront_photos.length === 0) {
      errors.storefront_photos = 'Storefront photos are required to prove ownership';
    }
  }

  if (issueType === 'address_verification_block') {
    if (!evidence.google_profile_id) {
      errors.google_profile_id = 'The Google profile ID or URL is required';
    }
  }

  return errors;
}

/**
 * Zod validators for the Recovery Management intake portal.
 *
 * Sprint 2 — Recovery Management Engine.
 * Used by both the public route layer and DisputeIntakeService.
 */

import { z } from 'zod';
import { unifiedConfig } from '../config/unifiedConfig';

// ====================
// SUBMIT INTAKE
// ====================

export const intakeSubmitSchema = z.object({
  token: z.string().min(1, 'token is required'),
  ownerStatement: z.string().min(20, 'Owner statement must be at least 20 characters'),
  ownerEmail: z.string().email('A valid email address is required so we can deliver your resolution'),
  ownerPhone: z.string().optional().nullable(),
  proposedResolution: z.string().min(1, 'Proposed resolution is required'),
  serviceDate: z.coerce.date().optional().nullable(),
  statusFlag: z
    .enum([
      'REFUND_OFFERED',
      'FULL_REFUND',
      'PARTIAL_REFUND',
      'CONTRACT_ENFORCED',
      'SERVICES_RESCHEDULED',
      'RESCHEDULED',
      'OTHER',
    ])
    .optional()
    .nullable(),
  attachmentIds: z.array(z.string()).optional().default([]),
});

export type IntakeSubmitInput = z.infer<typeof intakeSubmitSchema>;

// ====================
// REISSUE LINK
// ====================

export const reissueSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  intakeKind: z.string().optional().default('dispute'),
});

export type ReissueInput = z.infer<typeof reissueSchema>;

// ====================
// ATTACHMENT VALIDATION
// ====================

/**
 * Validates a single uploaded file's metadata against the recovery
 * attachment policy (mime allowlist + size cap from unifiedConfig).
 * Called by the route handler after multer parses the multipart upload.
 */
export function validateAttachment(file: { mimetype: string; size: number; originalname: string }): {
  valid: boolean;
  error?: string;
} {
  const allowedMimes = unifiedConfig.recoveryAllowedAttachmentMimes;
  const maxBytes = unifiedConfig.recoveryMaxAttachmentBytes;

  if (!allowedMimes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimes.join(', ')}`,
    };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the ${(maxBytes / 1024 / 1024).toFixed(0)}MB limit`,
    };
  }
  return { valid: true };
}

/**
 * Maps a MIME type to the short file_type stored in mkt_dispute_attachments.
 */
export function mimeToFileType(mimetype: string): string {
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/jpeg') return 'jpeg';
  return 'unknown';
}

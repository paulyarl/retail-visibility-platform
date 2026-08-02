/**
 * Recovery Intake Public Routes (Recovery Engine Sprint 2)
 *
 * Public, token-gated endpoints for the Recovery Management dispute intake
 * portal. No auth required — the access_token IS the trust boundary, mirring
 * mkt_deliverable_preview_tokens / marketing-ops-public.ts.
 *
 * Routes:
 *   GET  /api/public/recovery/intake               — resolve token → context header
 *   POST /api/public/recovery/intake/submit        — validate + persist + transition
 *   POST /api/public/recovery/intake/reissue       — request new link
 *   POST /api/public/recovery/intake/attachments   — upload (multipart)
 *   GET  /api/public/recovery/intake/attachments/:id — token-scoped download
 *
 * Never log the raw token param. Errors go through logger.error (Sentry
 * transport is on the logger, not imported directly in handlers).
 */

import express from 'express';
import multer from 'multer';
import { logger } from '../logger';
import { asyncErrorWrapper } from '../middleware/errorHandler';
import disputeIntakeService from '../services/DisputeIntakeService';
import {
  intakeSubmitSchema,
  reissueSchema,
  validateAttachment,
} from '../validators/recovery-intake.schema';
import {
  profileRepairIntakeSubmitSchema,
  validateEvidenceForIssueType,
} from '../validators/profile-repair-intake.schema';
import { unifiedConfig } from '../config/unifiedConfig';

const router = express.Router();

// Multipart upload config — memory storage, size cap from unifiedConfig.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: unifiedConfig.recoveryMaxAttachmentBytes },
});

// ====================
// GET /api/public/recovery/intake — resolve token → context
// ====================

router.get(
  '/public/recovery/intake',
  asyncErrorWrapper(async (req, res) => {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    const result = await disputeIntakeService.resolveIntake(token, req.ctx);

    if (result === null) {
      return res.status(404).json({ success: false, error: 'Invalid token' });
    }

    if ('expired' in result && result.expired) {
      return res.json({ success: true, data: { expired: true } });
    }

    return res.json({ success: true, data: result });
  }),
);

// ====================
// POST /api/public/recovery/intake/submit
// ====================

router.post(
  '/public/recovery/intake/submit',
  asyncErrorWrapper(async (req, res) => {
    // Dispatch on intake_kind: profile_repair intakes have a different
    // schema (evidence payload + issue type) vs dispute intakes.
    const token = req.body?.token as string;
    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    // Resolve the intake to determine the kind. We don't expose the full
    // context here — just need the kind to pick the right schema.
    let intakeKind: 'dispute' | 'profile_repair' = 'dispute';
    try {
      const resolved = await disputeIntakeService.resolveIntake(token, req.ctx);
      if (resolved && 'intakeKind' in resolved && resolved.intakeKind) {
        intakeKind = resolved.intakeKind;
      }
    } catch {
      // If resolve fails, fall through to the dispute schema which will
      // produce a clearer token-invalid error.
    }

    if (intakeKind === 'profile_repair') {
      const parsed = profileRepairIntakeSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: 'invalid_payload',
          details: parsed.error.flatten(),
        });
      }

      // Issue-type-specific evidence validation
      const evidenceErrors = validateEvidenceForIssueType(parsed.data.issueType, parsed.data.evidencePayload);
      if (Object.keys(evidenceErrors).length > 0) {
        return res.status(400).json({
          success: false,
          error: 'missing_evidence',
          details: evidenceErrors,
        });
      }

      try {
        const result = await disputeIntakeService.submitProfileRepairIntake(parsed.data, req.ctx);
        return res.json({ success: true, data: result });
      } catch (error) {
        const msg = (error as Error).message;
        if (msg.includes('expired') || msg.includes('Invalid')) {
          return res.status(400).json({ success: false, error: msg });
        }
        logger.error('[recovery-intake-public] POST /submit (profile_repair) error', req.ctx, { error: msg });
        return res.status(500).json({ success: false, error: 'Failed to submit profile repair intake' });
      }
    }

    // Default: dispute intake
    const parsed = intakeSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await disputeIntakeService.submitIntake(parsed.data, req.ctx);
      return res.json({ success: true, data: result });
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('expired') || msg.includes('Invalid')) {
        return res.status(400).json({ success: false, error: msg });
      }
      logger.error('[recovery-intake-public] POST /submit error', req.ctx, { error: msg });
      return res.status(500).json({ success: false, error: 'Failed to submit intake' });
    }
  }),
);

// ====================
// POST /api/public/recovery/intake/reissue
// ====================

router.post(
  '/public/recovery/intake/reissue',
  asyncErrorWrapper(async (req, res) => {
    const parsed = reissueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await disputeIntakeService.reissueLink(parsed.data.campaignId, req.ctx);
      return res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[recovery-intake-public] POST /reissue error', req.ctx, {
        error: (error as Error).message,
      });
      return res.status(500).json({ success: false, error: 'Failed to reissue link' });
    }
  }),
);

// ====================
// POST /api/public/recovery/intake/attachments — multipart upload
// ====================

router.post(
  '/public/recovery/intake/attachments',
  upload.single('file'),
  asyncErrorWrapper(async (req, res) => {
    const token = req.body.token as string;
    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Validate mime + size (multer already enforces size, but double-check mime)
    const validation = validateAttachment({
      mimetype: req.file.mimetype,
      size: req.file.size,
      originalname: req.file.originalname,
    });
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    try {
      const result = await disputeIntakeService.uploadAttachment(
        token,
        {
          buffer: req.file.buffer,
          mimetype: req.file.mimetype,
          size: req.file.size,
          originalname: req.file.originalname,
        },
        req.ctx,
      );
      return res.json({ success: true, data: result });
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('expired') || msg.includes('Invalid') || msg.includes('after submission')) {
        return res.status(400).json({ success: false, error: msg });
      }
      logger.error('[recovery-intake-public] POST /attachments error', req.ctx, { error: msg });
      return res.status(500).json({ success: false, error: 'Failed to upload attachment' });
    }
  }),
);

// ====================
// GET /api/public/recovery/intake/attachments/:id — token-scoped download
// ====================

router.get(
  '/public/recovery/intake/attachments/:id',
  asyncErrorWrapper(async (req, res) => {
    const token = req.query.token as string;
    const attachmentId = req.params.id;
    if (!token) {
      return res.status(400).json({ success: false, error: 'token is required' });
    }

    const result = await disputeIntakeService.downloadAttachment(token, attachmentId, req.ctx);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Attachment not found or token invalid' });
    }

    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpeg: 'image/jpeg',
    };
    const contentType = contentTypeMap[result.fileType] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
    return res.send(result.buffer);
  }),
);

export default router;

/**
 * Seed Report Public Routes
 *
 *   GET /api/public/marketing/seed/:seedId/report         — full published report (§13.1)
 *   GET /api/public/marketing/seed/:seedId/report/pdf     — published report PDF
 *   GET /api/public/marketing/seed/:seedId/report/preview — free report preview
 *
 * Returns the latest published report DTO for a seed, in a compact
 * preview-friendly shape. Only published (lint-passed) reports are
 * served — unpublished versions remain operator-internal.
 *
 * The preview endpoint returns a subset of the full report DTO:
 * business identity, source summary, identity reconciliation,
 * intelligence signals, and claim summary — enough to show the
 * "how we found you" story without exposing the full evidence trail.
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md §13.1
 */

import { Router, Request, Response } from 'express';
import { SeedIntelligenceReportService } from '../services/intelligence/SeedIntelligenceReportService';
import { prisma } from '../prisma';
import { logger } from '../logger';

const router = Router();
const reportService = SeedIntelligenceReportService.getInstance();
const PUBLIC_REPORT_STATUSES = new Set(['provisional', 'complete', 'claimed']);

function isPubliclyEligibleReport(report: { status: string }): boolean {
  return PUBLIC_REPORT_STATUSES.has(report.status);
}

function canExposeClaimCta(report: { next_actions?: { cta_eligible?: boolean } }): boolean {
  return report.next_actions?.cta_eligible === true;
}

/**
 * Resolve the active claim token + short code for a seed (pre-claim CTA/QR).
 */
async function resolveClaimToken(seedId: string): Promise<{ token: string | null; shortCode: string | null }> {
  const claimRows = await prisma.$queryRaw<any[]>`
    SELECT token, short_code
    FROM directory_claim_tokens
    WHERE seed_id = ${seedId}
      AND consumed_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return {
    token: claimRows[0]?.token ?? null,
    shortCode: claimRows[0]?.short_code ?? null,
  };
}

/**
 * GET /api/public/marketing/seed/:seedId/report
 *
 * Returns the latest published report DTO in full (§13.1). The report was
 * linted before publication, so the DTO itself is public-safe; we attach
 * the active claim token so the caller can render the claim CTA/QR.
 * 404 if no published report exists.
 */
router.get('/marketing/seed/:seedId/report', async (req: Request, res: Response) => {
  const { seedId } = req.params;

  try {
    const report = await reportService.getLatestPublishedReport(seedId);
    if (!report || !isPubliclyEligibleReport(report)) {
      return res.status(404).json({ error: 'no_published_report' });
    }

    const claim = canExposeClaimCta(report)
      ? await resolveClaimToken(seedId)
      : { token: null, shortCode: null };

    res.json({
      success: true,
      data: {
        ...report,
        claim_token: claim.token,
        claim_short_code: claim.shortCode,
      },
    });
  } catch (error: any) {
    logger.error('[GET /api/public/marketing/seed/:seedId/report] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /api/public/marketing/seed/:seedId/report/pdf
 *
 * Renders the latest published report as a PDF download. Pre-claim reports
 * embed the claim QR; post-claim reports omit it.
 */
router.get('/marketing/seed/:seedId/report/pdf', async (req: Request, res: Response) => {
  const { seedId } = req.params;

  try {
    const { generateSeedReportPdf } = await import(
      '../services/intelligence/SeedReportPdfService.js'
    );
    const { pdfBuffer, filename } = await generateSeedReportPdf({ seedId });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    if (error?.message?.includes('No published report')) {
      return res.status(404).json({ error: 'no_published_report' });
    }
    logger.error('[GET /api/public/marketing/seed/:seedId/report/pdf] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /api/public/marketing/seed/:seedId/report/preview
 *
 * Returns the latest published report for a seed in a preview-friendly
 * shape. 404 if no published report exists.
 */
router.get('/marketing/seed/:seedId/report/preview', async (req: Request, res: Response) => {
  const { seedId } = req.params;

  try {
    const report = await reportService.getLatestPublishedReport(seedId);
    if (!report || !isPubliclyEligibleReport(report)) {
      return res.status(404).json({ error: 'no_published_report' });
    }

    // Resolve the active claim token only when the report's eligibility gate
    // allows a public claim CTA.
    const { token: claimToken, shortCode: claimShortCode } = canExposeClaimCta(report)
      ? await resolveClaimToken(seedId)
      : { token: null, shortCode: null };

    // Preview shape — subset of the full DTO for public consumption.
    // Strips internal fields (source observation IDs, lint findings,
    // unresolved details) that are operator-only.
    const preview = {
      report_id: report.report_id,
      seed_id: report.seed_id,
      version: report.version,
      status: report.status,
      generated_at: report.generated_at,
      claim_token: claimToken,
      claim_short_code: claimShortCode,
      business_identity: {
        business_name: report.business_identity.business_name,
        address: report.business_identity.address,
        phone: report.business_identity.phone,
        city: report.business_identity.city,
        state: report.business_identity.state,
        website: report.business_identity.website,
      },
      source_summary: {
        sources_checked_count: report.source_summary.sources_checked_count,
        sources_with_evidence_count: report.source_summary.sources_with_evidence_count,
        source_types: report.source_summary.source_types,
        name_variants_count: report.source_summary.name_variants_count,
        address_variants_count: report.source_summary.address_variants_count,
      },
      identity_reconciliation: {
        canonical_candidate: report.identity_reconciliation.canonical_candidate,
        identity_confidence: report.identity_reconciliation.identity_confidence,
      },
      market_classification: {
        category: report.market_classification.category,
        subcategory: report.market_classification.subcategory,
        category_fit: report.market_classification.category_fit,
        location_status: report.market_classification.location_status,
      },
      intelligence_signals: {
        signals: report.intelligence_signals.signals.map((s) => ({
          code: s.code,
          label: s.label,
          basis: s.basis,
        })),
      },
      claim_summary: {
        claim_status: report.claim_summary.claim_status,
        claim_benefits: report.claim_summary.claim_benefits,
      },
      next_actions: {
        primary_cta: report.next_actions.primary_cta,
        cta_eligible: report.next_actions.cta_eligible,
        cta_disabled_reason: report.next_actions.cta_disabled_reason,
      },
    };

    res.json({ success: true, data: preview });
  } catch (error: any) {
    logger.error('[GET /api/public/marketing/seed/:seedId/report/preview] Error:', undefined, {
      error: { name: error?.name || 'Error', message: error?.message || String(error) },
    });
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;

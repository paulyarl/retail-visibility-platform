/**
 * Outreach link/QR variables — the single resolver for tracked seed links.
 *
 * Spec: docs/LocalBiz/QR_OUTREACH_PIPELINE_INTEGRATION_SPEC.md §5.1
 *
 * Every script / pitch / template merge context that wants to reference the
 * report, the claim link, or a tracked QR short URL resolves through here, so
 * the URLs can never drift between surfaces (the /directory/claim vs
 * /place/claim split in G7 came from three hand-rolled copies).
 *
 * Sources:
 *   - Claim kit  — ClaimInviteQrKitService (/place/claim + /q|/qw|/qs|/qe)
 *   - Report kit — SeedReportDeliveryService (/seed-report + /r|/rt|/re|/rs|/rp)
 *
 * Best-effort: an unresolvable key is simply absent from the returned map, so
 * the caller's merge keeps the {{placeholder}} visible (never fabricated).
 */

import { prisma } from '../../prisma';
import { unifiedConfig } from '../../config/unifiedConfig';
// Type-only — ClaimInviteQrKitService evaluates unifiedConfig.get() at module
// load, so it is imported lazily inside the resolvers to keep this module's
// import graph light (and mock-friendly).
import type { ClaimInviteQrKit } from '../ClaimInviteQrKitService';

export type OutreachLinkVars = Record<string, string>;

function webBase(): string {
  return (unifiedConfig.frontendUrl || unifiedConfig.webUrl || '').replace(/\/+$/, '');
}

/** Latest seed linked to a campaign (directory_seed_campaign_links), or null. */
export async function resolveCampaignSeedId(campaignId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT seed_id FROM directory_seed_campaign_links
      WHERE campaign_id = ${campaignId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0]?.seed_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Token-only claim URL fallback — used when the claim kit cannot resolve
 * (e.g. a seed without a listing row). Always the canonical /place/claim path.
 */
async function claimUrlFromToken(seedId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT token FROM directory_claim_tokens
      WHERE seed_id = ${seedId}
        AND consumed_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const token = rows[0]?.token;
    if (!token) return null;
    return `${webBase()}/place/claim/${token}`;
  } catch {
    return null;
  }
}

/**
 * Canonical claim URL for a seed. Prefers the claim kit (which resolves
 * /place/claim and back-fills a short code); falls back to the token lookup.
 */
export async function resolveClaimUrlForSeed(seedId: string): Promise<string | null> {
  try {
    const { getClaimInviteKitMeta } = await import('../ClaimInviteQrKitService');
    const kit = await getClaimInviteKitMeta(seedId);
    if (kit?.claimUrl) return kit.claimUrl;
  } catch {
    // Fall through to the direct token lookup
  }
  return claimUrlFromToken(seedId);
}

/** Canonical claim URL for a campaign's linked seed, or null. */
export async function resolveClaimUrlForCampaign(campaignId: string): Promise<string | null> {
  const seedId = await resolveCampaignSeedId(campaignId);
  if (!seedId) return null;
  return resolveClaimUrlForSeed(seedId);
}

/**
 * W4 — intake link vars for a campaign (Profile Repair Fulfillment Sprint).
 *
 *   intake_url        — canonical /recovery/intake?token=… long URL
 *   intake_short_url  — tracked /i/{code} URL (SMS/email/QR-friendly)
 *
 * Resolution order for multi-intake campaigns: the unsubmitted
 * profile_repair_access intake first (the DFY access link is what outreach
 * sends), then any other unsubmitted intake, then the most recent intake.
 * Absent when the campaign has no intake rows — callers merge the map so
 * {{intake_short_url}} stays a visible placeholder rather than fabricating.
 */
export async function resolveIntakeLinkVarsForCampaign(campaignId: string): Promise<OutreachLinkVars> {
  const vars: OutreachLinkVars = {};
  try {
    const rows = await prisma.mkt_dispute_intake.findMany({
      where: { campaign_id: campaignId },
      select: { access_token: true, short_code: true, intake_kind: true, submitted_at: true },
      orderBy: { created_at: 'desc' },
    });
    if (rows.length === 0) return vars;

    const pick =
      rows.find((r) => r.intake_kind === 'profile_repair_access' && !r.submitted_at) ??
      rows.find((r) => !r.submitted_at && r.short_code) ??
      rows[0];

    const base = webBase();
    if (!base) return vars;
    vars.intake_url = `${base}/recovery/intake?token=${encodeURIComponent(pick.access_token)}`;
    if (pick.short_code) {
      vars.intake_short_url = `${base}/i/${pick.short_code}`;
    }
  } catch {
    // Lookup failure — leave keys absent
  }
  return vars;
}

/**
 * Resolve the full tracked-link variable set for a seed:
 *   report_url, claim_url, claim_short_url,
 *   qr_url_mail, qr_url_walkin, qr_url_claim_social, qr_url_claim_email,
 *   qr_url_report_phone, qr_url_report_email, qr_url_report_social,
 *   qr_url_report_in_person, qr_url_report_text
 *
 * report_url is always available for a seed (the preview page handles the
 * no-report case); the claim/report keys appear only when the corresponding
 * kit resolves.
 */
export async function buildOutreachLinkVars(seedId: string | null): Promise<OutreachLinkVars> {
  const vars: OutreachLinkVars = {};
  if (!seedId) return vars;

  const base = webBase();
  if (base) vars.report_url = `${base}/seed-report/${seedId}`;

  let claimKit: ClaimInviteQrKit | null = null;
  try {
    const { getClaimInviteKitMeta } = await import('../ClaimInviteQrKitService');
    claimKit = await getClaimInviteKitMeta(seedId);
  } catch {
    // No active claim token / lookup failure — fall through to the token lookup
  }

  if (claimKit?.claimUrl) {
    vars.claim_url = claimKit.claimUrl;
    if (claimKit.shortClaimUrl) vars.claim_short_url = claimKit.shortClaimUrl;
    vars.qr_url_mail = claimKit.qrUrl;
    vars.qr_url_walkin = claimKit.qrUrlWalkin;
    vars.qr_url_claim_social = claimKit.qrUrlSocial;
    vars.qr_url_claim_email = claimKit.qrUrlEmail;
  } else {
    const fallback = await claimUrlFromToken(seedId);
    if (fallback) vars.claim_url = fallback;
  }

  try {
    const { default: reportDelivery } = await import('../intelligence/SeedReportDeliveryService');
    const reportKit = await reportDelivery.getReportKitMeta(seedId);
    if (reportKit) {
      vars.qr_url_report_phone = reportKit.qrUrlPhone;
      vars.qr_url_report_email = reportKit.qrUrlEmail;
      vars.qr_url_report_social = reportKit.qrUrlSocial;
      vars.qr_url_report_in_person = reportKit.qrUrlInPerson;
      vars.qr_url_report_text = reportKit.qrUrlText;
    }
  } catch {
    // No published report / lookup failure — leave the report QR keys absent
  }

  return vars;
}

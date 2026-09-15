/**
 * SeedReportDeliveryService — Report Delivery + QR Tracking (Phase 5)
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md
 *   §13.5  Claim-flow handoff (report CTA → claim token)
 *   §13.6  Report delivery by outreach channel
 *   §10.9  Claim invitation CTA
 *
 * Generates QR codes and tracked short URLs for delivering the seed
 * intelligence report to a business. The QR encodes a tracked redirect URL
 * that records a `qr_scan_events` row before redirecting to the report
 * preview page.
 *
 * Delivery channel surfaces (mirrors the claim_invite_* pattern):
 *   - report_delivery_phone    — phone follow-up (operator sends link)
 *   - report_delivery_email    — email introduction + claim link
 *   - report_delivery_social   — DM/social-shared link
 *   - report_delivery_in_person — printed card QR for walk-in delivery
 *
 * The report preview page (on the web app) shows the report and embeds the
 * claim CTA. The QR does NOT encode the claim page directly — it encodes
 * the report preview so the scan is recorded as a report view before the
 * owner decides to claim.
 *
 * Pattern: mirrors ClaimInviteQrKitService.ts — singleton, QRCode.toBuffer,
 * resolves claim token + report from the substrate.
 */

import QRCode from 'qrcode';
import { BaseService } from '../BaseService';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { unifiedConfig } from '../../config/unifiedConfig';
import { loadPlatformBranding } from '../marketing/MarketingReceiptPdfService';
import { SeedIntelligenceReportService } from './SeedIntelligenceReportService';
import type { SeedIntelligenceReport } from '../../validators/seed-report-dto.schema';

// Public-facing base URL the QR encodes. Same pattern as
// ClaimInviteQrKitService.QR_BASE_URL.
const QR_BASE_URL = (
  unifiedConfig.frontendUrl ||
  unifiedConfig.webUrl ||
  unifiedConfig.get('API_URL') ||
  unifiedConfig.get('API_BASE_URL') ||
  unifiedConfig.get('NEXT_PUBLIC_API_URL') ||
  unifiedConfig.get('NEXT_PUBLIC_API_BASE_URL') ||
  'https://app.visibleshelf.com'
)
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '');

// Human-facing report links live on the web app.
const WEB_BASE_URL = (
  unifiedConfig.frontendUrl ||
  unifiedConfig.webUrl ||
  'https://app.visibleshelf.com'
).replace(/\/+$/, '');

const DEFAULT_QR_SIZE = 512;

// ─── Types ────────────────────────────────────────────────────────────────

export type ReportDeliveryChannel = 'phone' | 'email' | 'social' | 'in_person' | 'text';

export interface ReportDeliveryKit {
  seedId: string;
  reportVersion: number;
  reportStatus: string;
  token: string;
  shortCode: string | null;
  /** Tracked redirect URLs — the QR encodes these. */
  qrUrlPhone: string;
  qrUrlEmail: string;
  qrUrlSocial: string;
  qrUrlInPerson: string;
  qrUrlText: string;
  /** Report preview page URL (no tracking). */
  reportPreviewUrl: string;
  /** Claim page URL (fallback). */
  claimUrl: string;
  businessName: string;
  expiresAt: Date | null;
}

export interface GeneratedReportQrPng {
  pngBuffer: Buffer;
  filename: string;
  channel: ReportDeliveryChannel;
  qrUrl: string;
}

export interface ReportDeliveryEvent {
  seedId: string;
  channel: ReportDeliveryChannel;
  reportVersion: number;
  claimToken: string;
  shortCode: string | null;
  qrUrl: string;
  deliveredAt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────

export class SeedReportDeliveryService extends BaseService {
  private static instance: SeedReportDeliveryService;
  private reportService: SeedIntelligenceReportService;

  private constructor() {
    super();
    this.reportService = SeedIntelligenceReportService.getInstance();
  }

  static getInstance(): SeedReportDeliveryService {
    if (!SeedReportDeliveryService.instance) {
      SeedReportDeliveryService.instance = new SeedReportDeliveryService();
    }
    return SeedReportDeliveryService.instance;
  }

  // ─── Resolve report + claim token for delivery ─────────────────────────

  /**
   * Resolve the latest published report + active claim token for a seed.
   * Returns null if no published report or no active claim token exists.
   *
   * The claim token is required because the report preview page embeds the
   * claim CTA. If no active token exists, the report can still be shown but
   * the claim CTA will be a recoverable path (§13.5 rule 3).
   */
  async resolveReportDeliveryKit(seedId: string, ctx?: RequestCtx): Promise<ReportDeliveryKit | null> {
    // Get the latest published report
    const report = await this.reportService.getLatestPublishedReport(seedId, ctx);
    if (!report) return null;

    // Get the active claim token (reuse the same resolution logic as
    // ClaimInviteQrKitService.resolveClaimInviteKit)
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        dct.id AS token_id,
        dct.token,
        dct.short_code,
        dct.expires_at,
        dl.business_name
      FROM directory_claim_tokens dct
      JOIN directory_presence_seeds dps ON dps.id = dct.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dct.seed_id = ${seedId}
        AND dct.consumed_at IS NULL
        AND (dct.expires_at IS NULL OR dct.expires_at > now())
      ORDER BY dct.created_at DESC
      LIMIT 1
    `;

    if (!rows[0] || !rows[0].token) {
      // No active claim token — report can still be delivered but the
      // claim CTA will show a recoverable path instead of a claim link.
      logger.warn('SeedReportDeliveryService: no active claim token for seed', ctx, { seedId });
      return {
        seedId,
        reportVersion: report.version,
        reportStatus: report.status,
        token: '',
        shortCode: null,
        qrUrlPhone: `${WEB_BASE_URL}/seed-report/${seedId}`,
        qrUrlEmail: `${WEB_BASE_URL}/seed-report/${seedId}`,
        qrUrlSocial: `${WEB_BASE_URL}/seed-report/${seedId}`,
        qrUrlInPerson: `${WEB_BASE_URL}/seed-report/${seedId}`,
        qrUrlText: `${WEB_BASE_URL}/seed-report/${seedId}`,
        reportPreviewUrl: `${WEB_BASE_URL}/seed-report/${seedId}`,
        claimUrl: `${WEB_BASE_URL}/seed-report/${seedId}`,
        businessName: 'Business Owner',
        expiresAt: null,
      };
    }

    const row = rows[0];
    const token = row.token;
    const shortCode = row.short_code ?? null;

    // Report preview page URL — the QR redirects here after tracking the scan.
    // The page shows the report and embeds the claim CTA.
    const reportPreviewUrl = `${WEB_BASE_URL}/seed-report/${seedId}`;

    // Claim page URL — the report page links to this for the CTA.
    const claimUrl = `${WEB_BASE_URL}/place/claim/${token}`;

    // Tracked redirect URLs per channel. The QR encodes these — they hit
    // the redirect that records the scan, then redirect to reportPreviewUrl.
    //
    // Short-code variants (Next.js redirect pages, same pattern as /q/, /qw/,
    // /qs/, /qe/ claim invite short URLs):
    //   /r/{shortCode}   — in-person/print (default)
    //   /rt/{shortCode}  — text
    //   /re/{shortCode}  — email
    //   /rs/{shortCode}  — social
    //   /rp/{shortCode}  — phone
    // These pages resolve the short code, record the scan event with the
    // matching surface, then redirect to /seed-report/{seedId}.
    //
    // Seed-id fallback (API direct): /api/public/r/seed/{seedId}/{channel}
    const qrBase = shortCode
      ? `${WEB_BASE_URL}`
      : `${QR_BASE_URL}/api/public/r/seed/${seedId}`;

    const qrUrlPhone = shortCode
      ? `${WEB_BASE_URL}/rp/${shortCode}`
      : `${qrBase}/phone`;
    const qrUrlEmail = shortCode
      ? `${WEB_BASE_URL}/re/${shortCode}`
      : `${qrBase}/email`;
    const qrUrlSocial = shortCode
      ? `${WEB_BASE_URL}/rs/${shortCode}`
      : `${qrBase}/social`;
    const qrUrlInPerson = shortCode
      ? `${WEB_BASE_URL}/r/${shortCode}`
      : `${qrBase}/in_person`;
    const qrUrlText = shortCode
      ? `${WEB_BASE_URL}/rt/${shortCode}`
      : `${qrBase}/text`;

    return {
      seedId,
      reportVersion: report.version,
      reportStatus: report.status,
      token,
      shortCode,
      qrUrlPhone,
      qrUrlEmail,
      qrUrlSocial,
      qrUrlInPerson,
      qrUrlText,
      reportPreviewUrl,
      claimUrl,
      businessName: row.business_name || 'Business Owner',
      expiresAt: row.expires_at,
    };
  }

  // ─── QR code generation ────────────────────────────────────────────────

  /**
   * Generate a PNG QR code for a specific delivery channel.
   * The QR encodes the tracked redirect URL for that channel.
   */
  async generateReportQrPng(
    seedId: string,
    channel: ReportDeliveryChannel = 'in_person',
    ctx?: RequestCtx,
  ): Promise<GeneratedReportQrPng> {
    const kit = await this.resolveReportDeliveryKit(seedId, ctx);
    if (!kit) throw new Error('no_published_report');

    const qrUrl = this.qrUrlForChannel(kit, channel);
    const pngBuffer = await QRCode.toBuffer(qrUrl, {
      width: DEFAULT_QR_SIZE,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return {
      pngBuffer,
      filename: `report-qr-${kit.seedId}-${channel}.png`,
      channel,
      qrUrl,
    };
  }

  /**
   * Generate QR PNGs for all delivery channels at once.
   * Useful for the operator to download a set of QR codes for different
   * delivery methods.
   */
  async generateAllReportQrPngs(
    seedId: string,
    ctx?: RequestCtx,
  ): Promise<GeneratedReportQrPng[]> {
    const channels: ReportDeliveryChannel[] = ['phone', 'email', 'social', 'in_person', 'text'];
    const results: GeneratedReportQrPng[] = [];

    for (const channel of channels) {
      try {
        const png = await this.generateReportQrPng(seedId, channel, ctx);
        results.push(png);
      } catch (err: any) {
        logger.warn('SeedReportDeliveryService: QR generation failed for channel', ctx, {
          channel,
          error: err.message,
        });
      }
    }

    return results;
  }

  // ─── Short URL helpers ────────────────────────────────────────────────

  /**
   * Get the tracked redirect URL for a delivery channel.
   * Used by the operator to copy a short link for email/social/phone delivery.
   */
  getTrackedUrlForChannel(kit: ReportDeliveryKit, channel: ReportDeliveryChannel): string {
    return this.qrUrlForChannel(kit, channel);
  }

  /**
   * Get the report preview URL (untracked, for direct sharing).
   */
  getReportPreviewUrl(kit: ReportDeliveryKit): string {
    return kit.reportPreviewUrl;
  }

  /**
   * Get the claim URL (for the report page's claim CTA).
   */
  getClaimUrl(kit: ReportDeliveryKit): string {
    return kit.claimUrl;
  }

  // ─── Delivery event recording ──────────────────────────────────────────

  /**
   * Record a report delivery event to directory_seed_outreach_touches.
   * This creates a seed-level outreach record so the cadence service
   * (ProvingGroundCadenceService) can see the delivery in its touch counts.
   *
   * The event is also tracked via qr_scan_events when the recipient scans
   * the QR — this method records the *send* side of the delivery.
   */
  async recordDeliveryEvent(
    kit: ReportDeliveryKit,
    channel: ReportDeliveryChannel,
    operatorId: string | null,
    ctx?: RequestCtx,
  ): Promise<void> {
    const channelLabels: Record<ReportDeliveryChannel, string> = {
      phone: 'phone',
      email: 'email',
      social: 'social',
      in_person: 'in_person',
      text: 'text',
    };

    try {
      await this.prisma.$executeRaw`
        INSERT INTO directory_seed_outreach_touches (
          id, seed_id, tenant_id, channel, outcome, notes, operator_id, occurred_at, created_at
        ) VALUES (
          ${`sot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`},
          ${kit.seedId},
          (SELECT tenant_id FROM directory_presence_seeds WHERE id = ${kit.seedId}),
          ${channelLabels[channel]},
          'report_delivered',
          ${`Report v${kit.reportVersion} delivered via ${channel}. QR: ${this.qrUrlForChannel(kit, channel)}`},
          ${operatorId},
          now(),
          now()
        )
      `;

      this.logOperation('SeedReportDeliveryService.recordDeliveryEvent', {
        seedId: kit.seedId,
        channel,
        reportVersion: kit.reportVersion,
      });
    } catch (err: any) {
      logger.error('SeedReportDeliveryService: recordDeliveryEvent failed', ctx, {
        error: err.message,
        seedId: kit.seedId,
        channel,
      });
      // Best-effort — don't fail the delivery if the touch log fails
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────

  /**
   * Pick the tracked QR URL for a delivery channel.
   */
  private qrUrlForChannel(kit: ReportDeliveryKit, channel: ReportDeliveryChannel): string {
    switch (channel) {
      case 'phone': return kit.qrUrlPhone;
      case 'email': return kit.qrUrlEmail;
      case 'social': return kit.qrUrlSocial;
      case 'in_person': return kit.qrUrlInPerson;
      case 'text': return kit.qrUrlText;
    }
  }

  // ─── Postcard PDF generation (QR designer pattern) ─────────────────────

  /**
   * Generate a 4x6" postcard PDF for the report delivery QR.
   * Replicates the ClaimInviteQrKitService postcard layout with
   * report-delivery copy. Accepts qrDataUrlOverride so the admin QR
   * designer (ReportQrDesignerModal) can ship a client-rendered styled QR
   * into the same layout.
   */
  async generateReportPostcard(
    seedId: string,
    channel: ReportDeliveryChannel = 'in_person',
    qrDataUrlOverride?: string,
    ctx?: RequestCtx,
  ): Promise<{ pdfBuffer: Buffer; filename: string }> {
    const kit = await this.resolveReportDeliveryKit(seedId, ctx);
    if (!kit) throw new Error('no_published_report');

    const qrUrl = this.qrUrlForChannel(kit, channel);

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'in', format: [4, 6] });
    const pageWidth = 4;
    const pageHeight = 6;
    const margin = 0.25;
    const branding = await loadPlatformBranding();

    // ── Header: platform name (logo if loadable) ──────────────────────────
    let logoWidth = 0;
    const logoHeight = 0.3;
    if (branding.logoUrl) {
      try {
        const logoResponse = await fetch(branding.logoUrl);
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          const logoBase64 = Buffer.from(logoBuffer).toString('base64');
          const contentType = logoResponse.headers.get('content-type') || 'image/png';
          const logoDataUri = `data:${contentType};base64,${logoBase64}`;
          const imgProps = doc.getImageProperties(logoDataUri);
          const aspectRatio = imgProps.width / imgProps.height;
          logoWidth = logoHeight * aspectRatio;
          doc.addImage(logoDataUri, 'PNG', margin, margin, logoWidth, logoHeight);
        }
      } catch {
        // Continue without logo
      }
    }

    doc.setFontSize(14);
    doc.setTextColor(branding.primaryColor);
    const brandX = logoWidth > 0 ? margin + logoWidth + 0.05 : margin;
    doc.setFont('helvetica', 'bold');
    doc.text(branding.platformName, brandX, margin + logoHeight / 2 + 0.04);

    // ── Headline ──────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    const headline = 'Your Free Business Report';
    const headlineLines = doc.splitTextToSize(headline, pageWidth - 2 * margin);
    let yPos = margin + logoHeight + 0.35;
    doc.text(headlineLines, pageWidth / 2, yPos, { align: 'center' });
    yPos += headlineLines.length * 0.22 + 0.12;

    // ── Body ──────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    const body = `We researched the public signals associated with ${kit.businessName} and assembled them into a free business seed. Scan the code below to view your report and claim your listing.`;
    const bodyLines = doc.splitTextToSize(body, pageWidth - 2 * margin);
    doc.text(bodyLines, pageWidth / 2, yPos, { align: 'center' });
    yPos += bodyLines.length * 0.16 + 0.3;

    // ── QR code ───────────────────────────────────────────────────────────
    const qrSize = 1.4;
    const qrX = (pageWidth - qrSize) / 2;
    const qrDataUrl = qrDataUrlOverride ?? await QRCode.toDataURL(qrUrl, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'H',
    });
    doc.addImage(qrDataUrl, 'PNG', qrX, yPos, qrSize, qrSize);
    yPos += qrSize + 0.08;

    // ── CTA label ─────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(branding.primaryColor);
    doc.text('Scan to view your report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 0.22;

    // ── Mailing address block (bottom right) ──────────────────────────────
    const addressLines: string[] = [kit.businessName];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    for (let i = 0; i < addressLines.length; i++) {
      doc.text(addressLines[i], pageWidth - margin, pageHeight - 0.15 - i * 0.16, { align: 'right' });
    }

    // ── Return address (bottom left) ──────────────────────────────────────
    const returnLines = [branding.platformName];
    if (branding.contactEmail) returnLines.push(branding.contactEmail);
    if (branding.contactWebsite) returnLines.push(branding.contactWebsite);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    for (let i = 0; i < returnLines.length; i++) {
      doc.text(returnLines[i], margin, pageHeight - 0.15 - i * 0.12);
    }

    // ── Channel badge (top right, subtle) ─────────────────────────────────
    const channelBadges: Record<ReportDeliveryChannel, string> = {
      phone: 'Report Delivery — Phone',
      email: 'Report Delivery — Email',
      social: 'Report Delivery — Social',
      in_person: 'Report Delivery — In Person',
      text: 'Report Delivery — Text',
    };
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(channelBadges[channel], pageWidth - margin, margin + 0.05, { align: 'right' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const safeName = kit.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const filename = `report-postcard-${safeName}-${channel}.pdf`;

    this.logOperation('SeedReportDeliveryService.generateReportPostcard', { seedId, channel, qrUrl });
    return { pdfBuffer, filename };
  }

  // ─── Kit metadata for the QR designer modal ────────────────────────────

  /**
   * Get the report delivery kit metadata (for JSON responses / designer
   * modal preview). Returns null if no published report exists.
   */
  async getReportKitMeta(seedId: string, ctx?: RequestCtx): Promise<ReportDeliveryKit | null> {
    return this.resolveReportDeliveryKit(seedId, ctx);
  }
}

export default SeedReportDeliveryService.getInstance();

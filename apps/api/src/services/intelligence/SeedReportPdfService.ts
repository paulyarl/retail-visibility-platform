/**
 * SeedReportPdfService — Seed Intelligence Report PDF renderer (spec §14.2).
 *
 * Reuses the jsPDF pattern from MarketIntelReportPdfService. Generates a
 * multi-section PDF from the published SeedIntelligenceReport DTO:
 *
 *   1. Business Identity
 *   2. How We Found You (sources)
 *   3. Identity Reconciliation
 *   4. Market Classification
 *   5. Category Fit
 *   6. Platform Presence
 *   7. Intelligence Signals
 *   8. Verification Activity
 *   9. Claim Summary
 *  10. Next Actions
 *
 * Input: seed_id + published report version (or latest published).
 * Output: PDF buffer.
 */
import { prisma } from '../../prisma';
import { loadPlatformBranding } from '../marketing/MarketingReceiptPdfService';
import { unifiedConfig } from '../../config/unifiedConfig';
import type { SeedIntelligenceReport, ReportFact } from '../../validators/seed-report-dto.schema';

export interface SeedReportPdfInput {
  seedId: string;
  /** Specific version to render. Defaults to latest published. */
  version?: number;
}

export interface GeneratedSeedReportPdf {
  pdfBuffer: Buffer;
  filename: string;
  reportVersion: number;
  reportStatus: string;
}

const PUBLIC_REPORT_STATUSES = new Set(['provisional', 'complete', 'claimed']);

/**
 * Generate a Seed Intelligence Report PDF.
 *
 * Usage:
 *   const { pdfBuffer, filename } = await generateSeedReportPdf({ seedId });
 *   res.setHeader('Content-Type', 'application/pdf');
 *   res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
 *   res.send(pdfBuffer);
 */
export async function generateSeedReportPdf(
  input: SeedReportPdfInput,
): Promise<GeneratedSeedReportPdf> {
  const { seedId, version } = input;

  const report = await loadReportVersion(seedId, version);
  if (!report || !PUBLIC_REPORT_STATUSES.has(report.status)) {
    throw new Error('No published report found for this seed');
  }

  // Resolve claim token for the embedded claim QR only when the report's
  // eligibility gate allows a public claim CTA.
  const claimToken = report.next_actions?.cta_eligible
    ? await resolveClaimToken(seedId)
    : null;
  const isClaimed = report.claim_summary?.claim_status === 'claimed';

  const branding = await loadPlatformBranding();
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  // ── Helpers ────────────────────────────────────────────────────────────

  const ensureSpace = (needed: number) => {
    if (yPos + needed > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }
  };

  const sectionHeading = (num: number, title: string) => {
    ensureSpace(20);
    yPos += 6;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(branding.primaryColor);
    doc.text(`${num}. ${title}`, margin, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
  };

  const bodyText = (text: string, indent = 0) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - indent);
    for (const line of lines) {
      ensureSpace(6);
      doc.text(line, margin + indent, yPos);
      yPos += 5;
    }
  };

  const bullet = (text: string, indent = 0) => {
    ensureSpace(6);
    doc.text(`• ${text}`, margin + indent, yPos);
    yPos += 5;
  };

  const factLine = (label: string, fact: ReportFact | undefined, indent = 0) => {
    if (!fact || fact.value === null || fact.value === undefined) return;
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`${label}:`, margin + indent, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const valStr = String(fact.value);
    const labelWidth = doc.getTextWidth(`${label}: `);
    const valLines = doc.splitTextToSize(valStr, pageWidth - 2 * margin - indent - labelWidth - 5);
    doc.text(valLines[0], margin + indent + labelWidth + 2, yPos);
    yPos += 5;
    for (let i = 1; i < valLines.length; i++) {
      ensureSpace(6);
      doc.text(valLines[i], margin + indent + labelWidth + 2, yPos);
      yPos += 5;
    }
    if (fact.state && fact.state !== 'confirmed') {
      ensureSpace(5);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`  [${fact.state}]`, margin + indent + labelWidth + 2, yPos);
      yPos += 4;
      doc.setFontSize(10);
    }
  };

  const strFactLine = (label: string, value: string | null | undefined, indent = 0) => {
    if (!value) return;
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text(`${label}:`, margin + indent, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const labelWidth = doc.getTextWidth(`${label}: `);
    const valLines = doc.splitTextToSize(value, pageWidth - 2 * margin - indent - labelWidth - 5);
    doc.text(valLines[0], margin + indent + labelWidth + 2, yPos);
    yPos += 5;
    for (let i = 1; i < valLines.length; i++) {
      ensureSpace(6);
      doc.text(valLines[i], margin + indent + labelWidth + 2, yPos);
      yPos += 5;
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // HEADER
  // ════════════════════════════════════════════════════════════════════════

  let logoWidth = 0;
  const logoHeight = 15;
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
        doc.addImage(logoDataUri, 'PNG', margin, yPos - 5, logoWidth, logoHeight);
        yPos += 12;
      }
    } catch {
      // Continue without logo
    }
  }

  doc.setFontSize(20);
  doc.setTextColor(branding.primaryColor);
  const textX = logoWidth > 0 ? margin + logoWidth + 5 : margin;
  doc.text(branding.platformName, textX, yPos);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Seed Intelligence Report', pageWidth - margin, 20, { align: 'right' });

  // Business name + version + date
  yPos = 38;
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  const businessName =
    (report.business_identity?.business_name?.value as string) ?? report.seed_id;
  doc.text(businessName, margin, yPos);
  yPos += 6;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Report v${report.version} • ${report.status} • Generated ${new Date(report.generated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    margin,
    yPos,
  );

  // Divider
  yPos += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ════════════════════════════════════════════════════════════════════════
  // INTRODUCTION (spec §10.1 — narrative hook, no unsupported claims)
  // ════════════════════════════════════════════════════════════════════════

  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const introText =
    'Visibility is part of how customers discover, evaluate, and choose a business. ' +
    'Customers encounter businesses across search, maps, directories, social platforms, ' +
    'local sources, and category-specific marketplaces — and those sources may not all ' +
    'represent the business the same way. We researched the public signals associated ' +
    'with this business and assembled them into a free business listing. This report shows ' +
    'what we found, where it came from, what appears consistent, and what still needs ' +
    'confirmation. The goal is to make the available intelligence visible, start a ' +
    'useful conversation, and give the business the opportunity to verify and claim ' +
    'the record that represents it.';
  const introLines = doc.splitTextToSize(introText, pageWidth - 2 * margin);
  doc.text(introLines, margin, yPos);
  yPos += introLines.length * 4 + 4;

  // ════════════════════════════════════════════════════════════════════════
  // NARRATIVE — Tier-C-safe audit narrative + market summary (§4.7)
  // ════════════════════════════════════════════════════════════════════════

  const narrative = report.narrative;
  if (
    narrative &&
    (narrative.public_narrative ||
      narrative.market_summary ||
      narrative.metro_context ||
      (narrative.notable_areas?.length ?? 0) > 0)
  ) {
    ensureSpace(20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(branding.primaryColor);
    doc.text('About this business', margin, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    if (narrative.public_narrative) {
      bodyText(narrative.public_narrative);
      yPos += 2;
    }
    if (narrative.market_summary) {
      bodyText(narrative.market_summary);
      yPos += 2;
    }
    if (narrative.metro_context) {
      bodyText(narrative.metro_context);
      yPos += 2;
    }
    if (narrative.notable_areas && narrative.notable_areas.length > 0) {
      bodyText(`Notable areas in this market: ${narrative.notable_areas.join(', ')}`);
      yPos += 2;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. BUSINESS IDENTITY
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(1, 'Business Identity');
  const bi = report.business_identity;
  if (bi) {
    factLine('Name', bi.business_name);
    factLine('Address', bi.address);
    factLine('City', bi.city);
    factLine('State', bi.state);
    factLine('Phone', bi.phone);
    factLine('Website', bi.website);
    factLine('Owner', bi.owner_name);
    factLine('Ownership', bi.ownership_type);
  } else {
    bodyText('Business identity not yet resolved.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. HOW WE FOUND YOU (Source Summary)
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(2, 'How We Found You');
  const ss = report.source_summary;
  if (ss) {
    bodyText(
      `We checked ${ss.sources_checked_count} source${ss.sources_checked_count !== 1 ? 's' : ''} and found ` +
        `${ss.identity_signals_count} observation${ss.identity_signals_count !== 1 ? 's' : ''}.`,
    );
    if (ss.source_types.length > 0) {
      yPos += 2;
      for (const src of ss.source_types) {
        bullet(`${src.label ?? src.source_name ?? src.source_type}: ${src.observation_count} observation${src.observation_count !== 1 ? 's' : ''}`);
      }
    }
    if (ss.name_variants_count > 1 || ss.address_variants_count > 1) {
      yPos += 2;
      bodyText(
        `Variants found: ${ss.name_variants_count} name${ss.name_variants_count !== 1 ? 's' : ''}, ` +
          `${ss.address_variants_count} address${ss.address_variants_count !== 1 ? 'es' : ''}.`,
      );
    }
    if (ss.unresolved_count > 0) {
      bodyText(`${ss.unresolved_count} field${ss.unresolved_count !== 1 ? 's' : ''} unresolved.`);
    }
    // Discovery attribution (§7.4) — why this business surfaced in
    // emerging-lane research. The catalog label is the business-facing
    // reason text; basis adds the causal detail. reason_key stays in the
    // DTO as provenance and never renders raw (last resort is humanized).
    if (ss.discovery_attribution && ss.discovery_attribution.length > 0) {
      yPos += 2;
      bodyText('Why this business appeared in our research:');
      for (const attr of ss.discovery_attribution) {
        const head = attr.label ?? attr.basis ?? humanizeKey(attr.reason_key);
        bullet(attr.label && attr.basis ? `${head} — ${attr.basis}` : head);
      }
    }
    // Report limitation language (spec §15.3)
    yPos += 2;
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    const limitation =
      'This report reflects information available in the sources checked on the generation date. ' +
      '"Not found during discovery" means the information was not located in those sources — ' +
      'it does not mean the information does not exist.';
    const limLines = doc.splitTextToSize(limitation, pageWidth - 2 * margin);
    doc.text(limLines, margin, yPos);
    yPos += limLines.length * 3.5 + 2;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
  } else {
    bodyText('Source summary not available.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. IDENTITY RECONCILIATION
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(3, 'Identity Reconciliation');
  const ir = report.identity_reconciliation;
  if (ir) {
    if (ir.canonical_candidate) {
      bodyText(`Canonical identity: ${ir.canonical_candidate.business_name ?? 'N/A'}`);
      bullet(`Confidence: ${ir.canonical_candidate.identity_confidence}`);
      if (ir.canonical_candidate.source_observation_ids?.length) {
        bullet(`Sources: ${ir.canonical_candidate.source_observation_ids.join(', ')}`);
      }
    }
    if (ir.alternate_names.length > 0) {
      yPos += 2;
      bodyText('Alternate names:');
      for (const name of ir.alternate_names) {
        bullet(name);
      }
    }
    if (ir.alternate_addresses.length > 0) {
      yPos += 2;
      bodyText('Alternate addresses:');
      for (const addr of ir.alternate_addresses) {
        bullet(addr);
      }
    }
    if (ir.conflicts.length > 0) {
      yPos += 2;
      bodyText('Conflicts detected:');
      for (const c of ir.conflicts) {
        bullet(`${c.field}: ${c.values.map((v) => v.value).join(' vs. ')}`);
      }
    }
    bullet(`Identity confidence: ${ir.identity_confidence}`);
  } else {
    bodyText('Identity reconciliation not available.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. MARKET CLASSIFICATION
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(4, 'Market Classification');
  const mc = report.market_classification;
  if (mc) {
    strFactLine('Category', mc.category);
    strFactLine('Subcategory', mc.subcategory);
    strFactLine('Category Fit', mc.category_fit);
    strFactLine('Location', mc.location_status);
    strFactLine('Ownership', mc.ownership_type);
    if (mc.category_profile_context) {
      bodyText(mc.category_profile_context);
    }
    if (mc.operational_signals.length > 0) {
      yPos += 2;
      bodyText('Operational signals:');
      for (const s of mc.operational_signals) {
        bullet(s);
      }
    }
    if (mc.recommended_categories && mc.recommended_categories.length > 0) {
      yPos += 2;
      bodyText('Other shelves this business could appear on:');
      for (const c of mc.recommended_categories) {
        bullet(`${c.category}${c.confidence ? ` (${c.confidence} confidence)` : ''}`);
      }
    }
  } else {
    bodyText('Market classification not available.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. CATEGORY FIT
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(5, 'Category Fit');
  const cf = report.category_fit;
  if (cf) {
    strFactLine('Category', cf.category);
    strFactLine('Subcategory', cf.subcategory);
    strFactLine('Fit', cf.category_fit);
    if (cf.basis.length > 0) {
      yPos += 2;
      bodyText('Basis:');
      for (const b of cf.basis) {
        bullet(b);
      }
    }
  } else {
    bodyText('Category fit assessment not available.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. PLATFORM PRESENCE
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(6, 'Platform Presence');
  const pp = report.platform_presence;
  if (pp && pp.platforms.length > 0) {
    for (const p of pp.platforms) {
      const statusLabel =
        p.presence === 'observed'
          ? 'Observed'
          : p.presence === 'not_found_during_discovery'
            ? 'Not found during discovery'
            : 'Not checked';
      bullet(`${p.platform}: ${statusLabel}${p.source_url ? ` — ${p.source_url}` : ''}`);
      if (p.business_name) {
        bodyText(`Name: ${p.business_name}`, 5);
      }
    }
  } else {
    bodyText('Platform presence data not available.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 7. INTELLIGENCE SIGNALS
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(7, 'Intelligence Signals');
  const is = report.intelligence_signals;
  if (is && is.signals.length > 0) {
    for (const s of is.signals) {
      bullet(`${s.code}: ${s.label}`);
      if (s.basis) {
        bodyText(s.basis, 5);
      }
    }
  } else {
    bodyText('No validated intelligence signals at this time.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 8. VERIFICATION ACTIVITY
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(8, 'Verification Activity');
  const va = report.verification_activity;
  if (va && va.events.length > 0) {
    // Owner-contact language (spec §15.4): owner responses are shown
    // separately from public-source observations.
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    const ownerContactNote =
      'We contacted this business to verify specific facts. Responses are shown ' +
      'separately from public-source observations so it is clear what was ' +
      'discovered and what was confirmed directly.';
    const ocLines = doc.splitTextToSize(ownerContactNote, pageWidth - 2 * margin);
    doc.text(ocLines, margin, yPos);
    yPos += ocLines.length * 3.5 + 3;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    for (const e of va.events) {
      ensureSpace(15);
      doc.setFont('helvetica', 'bold');
      doc.text(`${e.date} — ${e.channel}`, margin, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      if (e.purpose) {
        bodyText(`Purpose: ${e.purpose}`, 5);
      }
      if (e.contact_outcome) {
        bodyText(`Outcome: ${e.contact_outcome}`, 5);
      }
      if (e.facts_confirmed.length > 0) {
        bodyText(`Confirmed: ${e.facts_confirmed.join(', ')}`, 5);
      }
      if (e.facts_corrected.length > 0) {
        bodyText(`Corrected: ${e.facts_corrected.join(', ')}`, 5);
      }
      if (e.next_action) {
        bodyText(`Next: ${e.next_action}`, 5);
      }
      yPos += 2;
    }
  } else {
    bodyText('No verification activity recorded yet.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 9. CLAIM SUMMARY
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(9, 'Claim Summary');
  const cs = report.claim_summary;
  if (cs) {
    strFactLine('Status', cs.claim_status);
    if (cs.claim_url) {
      bullet(`Claim link: ${cs.claim_url}`);
    }
    if (cs.claim_benefits.length > 0) {
      yPos += 2;
      bodyText('Benefits of claiming:');
      for (const b of cs.claim_benefits) {
        bullet(b);
      }
    }
    if (cs.owner_confirmation_count > 0) {
      bullet(`${cs.owner_confirmation_count} owner confirmation${cs.owner_confirmation_count !== 1 ? 's' : ''}`);
    }
    if (cs.owner_correction_count > 0) {
      bullet(`${cs.owner_correction_count} owner correction${cs.owner_correction_count !== 1 ? 's' : ''}`);
    }

    // Claim QR — pre-claim reports embed a QR the owner can scan to claim.
    // Post-claim reports skip it (the listing is already claimed).
    if (!isClaimed && claimToken) {
      try {
        const qrBuffer = await generateClaimQrPng(claimToken);
        if (qrBuffer) {
          ensureSpace(55);
          yPos += 5;
          const qrSize = 40;
          const qrX = pageWidth - margin - qrSize;
          doc.addImage(qrBuffer, 'PNG', qrX, yPos, qrSize, qrSize);
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          doc.text('Scan to claim', qrX + qrSize / 2, yPos + qrSize + 5, { align: 'center' });
          yPos += qrSize + 10;
        }
      } catch {
        // QR generation is best-effort — the claim URL text still works.
      }
    }
  } else {
    bodyText('Claim summary not available.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 10. NEXT ACTIONS
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(10, 'Next Actions');
  const na = report.next_actions;
  if (na) {
    if (na.cta_eligible && na.primary_cta) {
      bodyText('Recommended action: Claim your listing to verify and update your business information.');
      bullet(`Claim URL: ${na.primary_cta}`);
    } else if (na.cta_disabled_reason) {
      bodyText(`Claim not available: ${na.cta_disabled_reason}`);
    }
    if (na.suggested_actions.length > 0) {
      yPos += 2;
      bodyText('Suggested actions:');
      for (const a of na.suggested_actions) {
        bullet(`[${a.priority}] ${a.action}: ${a.description}`);
      }
    }
    if (!na.cta_eligible && na.suggested_actions.length === 0) {
      bodyText('No actions available at this time.');
    }
  } else {
    bodyText('Next actions not available.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // FOOTER (on every page)
  // ════════════════════════════════════════════════════════════════════════

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${branding.platformName} — Seed Intelligence Report v${report.version} — ${businessName}`,
      margin,
      pageHeight - 10,
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  const filename = `seed-intelligence-report-v${report.version}-${report.seed_id}.pdf`;
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return { pdfBuffer, filename, reportVersion: report.version, reportStatus: report.status };
}

// ─── Internal helpers ────────────────────────────────────────────────────

/** Last-resort display for an internal snake_case key (e.g. a bronze
    reason_key with no catalog label and no basis). */
function humanizeKey(key: string): string {
  const h = key.replace(/[_-]+/g, ' ').trim();
  return h ? h.charAt(0).toUpperCase() + h.slice(1) : key;
}

async function loadReportVersion(
  seedId: string,
  version?: number,
): Promise<SeedIntelligenceReport | null> {
  if (version !== undefined) {
    const row = await prisma.$queryRaw<any[]>`
      SELECT report_data, version, status
      FROM mkt_seed_intelligence_reports
      WHERE seed_id = ${seedId} AND version = ${version}
      LIMIT 1
    `;
    if (!row[0]) return null;
    return row[0].report_data as SeedIntelligenceReport;
  }

  // Latest published
  const row = await prisma.$queryRaw<any[]>`
    SELECT report_data, version, status
    FROM mkt_seed_intelligence_reports
    WHERE seed_id = ${seedId} AND published_at IS NOT NULL
    ORDER BY version DESC
    LIMIT 1
  `;
  if (!row[0]) return null;
  return row[0].report_data as SeedIntelligenceReport;
}

async function resolveClaimToken(seedId: string): Promise<{ token: string; shortCode: string | null } | null> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT token, short_code
    FROM directory_claim_tokens
    WHERE seed_id = ${seedId}
      AND consumed_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows[0]?.token) return null;
  return { token: rows[0].token, shortCode: rows[0].short_code ?? null };
}

/**
 * Generate a QR code PNG for the claim URL. Uses the same `qrcode` library
 * as ClaimInviteQrKitService. Returns a Buffer for doc.addImage().
 */
async function generateClaimQrPng(claimToken: { token: string; shortCode: string | null }): Promise<Buffer | null> {
  try {
    const QRCode = await import('qrcode');
    const frontendUrl = unifiedConfig.frontendUrl;
    // Prefer the short-code tracked redirect for the QR — it records the
    // scan as claim_invite before landing on the claim page.
    const claimUrl = claimToken.shortCode
      ? `${frontendUrl}/q/${claimToken.shortCode}`
      : `${frontendUrl}/place/claim/${claimToken.token}`;
    const buffer = await QRCode.toBuffer(claimUrl, {
      type: 'png',
      width: 256,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    return buffer;
  } catch {
    return null;
  }
}

/**
 * ProspectReportPdfService — Business Visibility Report PDF renderer.
 *
 * Replicates the SeedReportPdfService jsPDF pattern against the owner-safe
 * ProspectReport DTO (§6 structure):
 *
 *   header → short version → chapters → locked teasers (greyed blocks) →
 *   "how this report was made" → CTA
 *
 * QR handling (§5.2a): the caller passes the share-minted short code via
 * `qrCode`; the PDF embeds a QR for `${frontendUrl}/r/pr/{code}` so a print
 * scan lands on the tracked resolve+redirect route. This service NEVER
 * mints a mkt_prospect_report_links row — render is side-effect-free.
 *
 * Input: the assembled ProspectReport DTO (the same object the public JSON
 * route returns — the tier clamp and chapter selection already applied).
 * Output: PDF buffer.
 */
import { loadPlatformBranding } from '../marketing/MarketingReceiptPdfService';
import { unifiedConfig } from '../../config/unifiedConfig';
import type { ProspectReportDto } from '../../validators/prospect-report-dto.schema';

export interface ProspectReportPdfInput {
  report: ProspectReportDto;
  /** Share-minted short code (from ?qr=) — embeds a tracked /r/pr/{code} QR. */
  qrCode?: string;
}

export interface GeneratedProspectReportPdf {
  pdfBuffer: Buffer;
  filename: string;
}

/**
 * Generate the Business Visibility Report PDF.
 *
 * Usage:
 *   const { pdfBuffer, filename } = await generateProspectReportPdf({ report, qrCode });
 *   res.setHeader('Content-Type', 'application/pdf');
 *   res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
 *   res.send(pdfBuffer);
 */
export async function generateProspectReportPdf(
  input: ProspectReportPdfInput,
): Promise<GeneratedProspectReportPdf> {
  const { report, qrCode } = input;

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

  const sectionHeading = (title: string) => {
    ensureSpace(20);
    yPos += 6;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(branding.primaryColor);
    doc.text(title, margin, yPos);
    yPos += 7;
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
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - indent - 4);
    ensureSpace(6);
    doc.text(`• ${lines[0]}`, margin + indent, yPos);
    yPos += 5;
    for (let i = 1; i < lines.length; i++) {
      ensureSpace(6);
      doc.text(`  ${lines[i]}`, margin + indent, yPos);
      yPos += 5;
    }
  };

  const subLabel = (text: string) => {
    ensureSpace(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(90, 90, 90);
    doc.text(text, margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
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
  doc.text('Business Visibility Report', pageWidth - margin, 20, { align: 'right' });

  yPos = 38;
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text(report.business_name, margin, yPos);
  yPos += 6;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const prepared = new Date(report.prepared_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(
    `Prepared ${prepared}${report.website_url ? ` • ${report.website_url}` : ''}`,
    margin,
    yPos,
  );

  yPos += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ════════════════════════════════════════════════════════════════════════
  // THE SHORT VERSION
  // ════════════════════════════════════════════════════════════════════════

  if (report.short_version.lead || report.short_version.bullets.length > 0) {
    sectionHeading('The short version');
    if (report.short_version.lead) {
      bodyText(report.short_version.lead);
      yPos += 2;
    }
    for (const b of report.short_version.bullets) {
      bullet(b);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // CHAPTERS
  // ════════════════════════════════════════════════════════════════════════

  for (const chapter of report.chapters) {
    // Every registered chapter emits the same owner-safe shape — render all
    // of them (website = positioning audit; repair/drift/cta/reviews/
    // recovery/products = filtered BA extracts).
    const category = chapter.category ?? 'your category';

    sectionHeading(chapter.title);
    bodyText(chapter.verdict);
    yPos += 2;

    if (chapter.already_working.length > 0) {
      subLabel('Already working');
      for (const line of chapter.already_working) bullet(line, 3);
      yPos += 2;
    }

    const now = chapter.costing_customers.filter((i: { tier: string }) => i.tier === 'now');
    const worth = chapter.costing_customers.filter((i: { tier: string }) => i.tier === 'worth_fixing');
    if (now.length > 0) {
      subLabel("What's costing you customers now");
      for (const issue of now) {
        bullet(issue.headline, 3);
        if (issue.cost) bodyText(`What it costs you: ${issue.cost}`, 8);
        if (issue.evidence) bodyText(`Where we saw it: ${issue.evidence}`, 8);
      }
      yPos += 2;
    }
    if (worth.length > 0) {
      subLabel('Worth fixing');
      for (const issue of worth) {
        bullet(issue.headline, 3);
        if (issue.cost) bodyText(`What it costs you: ${issue.cost}`, 8);
        if (issue.evidence) bodyText(`Where we saw it: ${issue.evidence}`, 8);
      }
      yPos += 2;
    }

    if (chapter.expectations.length > 0) {
      subLabel(`What ${category.toLowerCase()} customers expect`);
      for (const gap of chapter.expectations) {
        bullet(
          `${gap.field} — customers expect ${gap.expected_text}; your site shows ${gap.actual_text}.`,
          3,
        );
        if (gap.note) bodyText(gap.note, 8);
      }
      yPos += 2;
    }

    if (chapter.competitive_frame.length > 0) {
      subLabel(`What leading ${category.toLowerCase()} businesses do`);
      for (const line of chapter.competitive_frame) bullet(line, 3);
      yPos += 2;
    }

    subLabel('The fix');
    bodyText(chapter.fix.headline, 3);
    if (chapter.fix.scope_notes) bodyText(chapter.fix.scope_notes, 3);
    if (chapter.fix.page_plan && chapter.fix.page_plan.length > 0) {
      subLabel('What the new site includes');
      for (const page of chapter.fix.page_plan) bullet(page, 6);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // LOCKED CHAPTERS — greyed teaser blocks, never content (§5.1a)
  // ════════════════════════════════════════════════════════════════════════

  if (report.locked_chapters.length > 0) {
    sectionHeading('More in the full assessment');
    for (const locked of report.locked_chapters) {
      ensureSpace(18);
      doc.setFillColor(245, 245, 245);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 14, 2, 2, 'FD');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(90, 90, 90);
      doc.text(locked.teaser, margin + 4, yPos + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(140, 140, 140);
      doc.text(
        report.cta.kind === 'claim'
          ? 'Claim your listing to unlock this chapter'
          : 'Unlock the full assessment to read this chapter',
        margin + 4,
        yPos + 10.5,
      );
      yPos += 18;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // PROBLEMS ANNEX (§2 — outreach pairs in owner-facing framing)
  // ════════════════════════════════════════════════════════════════════════

  if (report.problems.length > 0) {
    sectionHeading('What this means for you');
    for (const p of report.problems) {
      if (p.line) bodyText(`\u201C${p.line}\u201D`);
      if (p.problem && p.problem !== p.line) bullet(p.problem, 3);
      if (p.solution) bodyText(`How we'd fix it: ${p.solution}`, 8);
      if (p.evidence) bodyText(`What we saw: ${p.evidence}`, 8);
      yPos += 2;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // HOW THIS REPORT WAS MADE (§6.5)
  // ════════════════════════════════════════════════════════════════════════

  const dq = report.data_quality;
  if (dq.verified.length > 0 || dq.couldnt_check.length > 0 || dq.limitations.length > 0) {
    sectionHeading('How this report was made');
    if (dq.verified.length > 0) {
      subLabel('What we verified');
      for (const line of dq.verified) bullet(line, 3);
      yPos += 2;
    }
    if (dq.couldnt_check.length > 0) {
      subLabel("What we couldn't check");
      for (const line of dq.couldnt_check) bullet(line, 3);
      yPos += 2;
    }
    for (const line of dq.limitations) {
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      const limLines = doc.splitTextToSize(line, pageWidth - 2 * margin);
      doc.text(limLines, margin, yPos);
      yPos += limLines.length * 3.5 + 2;
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // CTA + QR (§6.6, §5.2a — QR only from a share-minted ?qr= code)
  // ════════════════════════════════════════════════════════════════════════

  ensureSpace(60);
  yPos += 4;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(report.cta.label, margin, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  if (report.cta.url) {
    bodyText(report.cta.url);
  }

  if (qrCode) {
    try {
      const qrBuffer = await generateReportQrPng(qrCode);
      if (qrBuffer) {
        ensureSpace(50);
        yPos += 5;
        const qrSize = 38;
        const qrX = pageWidth - margin - qrSize;
        doc.addImage(qrBuffer, 'PNG', qrX, yPos, qrSize, qrSize);
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text('Scan to view this report', qrX + qrSize / 2, yPos + qrSize + 5, {
          align: 'center',
        });
        doc.text(
          `${unifiedConfig.frontendUrl}/r/pr/${qrCode}`,
          margin,
          yPos + qrSize / 2,
        );
        yPos += qrSize + 10;
      }
    } catch {
      // QR generation is best-effort — the report URL text still works.
    }
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
      `${branding.platformName} — Business Visibility Report — ${report.business_name}`,
      margin,
      pageHeight - 10,
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, {
      align: 'right',
    });
  }

  const slug = report.business_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `visibility-report-${slug || 'business'}.pdf`;
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return { pdfBuffer, filename };
}

// ─── QR helper ───────────────────────────────────────────────────────────

/** QR PNG for the share-minted short code — the /r/pr/{code} tracked route.
    Uses the same `qrcode` library as SeedReportPdfService. Never mints a
    links row — the code was minted by the share endpoint. */
async function generateReportQrPng(code: string): Promise<Buffer | null> {
  try {
    const QRCode = await import('qrcode');
    const url = `${unifiedConfig.frontendUrl}/r/pr/${code.toUpperCase()}`;
    return await QRCode.toBuffer(url, {
      type: 'png',
      width: 256,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch {
    return null;
  }
}

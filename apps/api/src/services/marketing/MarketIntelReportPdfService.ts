/**
 * MarketIntelReportPdfService — Market Intelligence Report PDF generator.
 *
 * Reuses the jsPDF pattern from MarketingReceiptPdfService (NOT PDFKit).
 * Generates a multi-section report per spec §5.1:
 *   1. Executive Summary
 *   2. Market Position
 *   3. Category Signals Checklist
 *   4. Gold Standard Comparison
 *   5. Growth Opportunities
 *   6. Market Gaps
 *   7. Recommendations
 *   8. Appendix: Market Context
 *
 * Input: business slug + full market intel data (MarketIntelFullContent).
 * Output: PDF buffer.
 *
 * Spec: docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§5)
 */
import { prisma } from '../../prisma';
import type { MarketIntelFullContent } from '../MarketIntelService';
import type { CategoryMarketIntelFull, CityMarketIntelFull } from '../MarketIntelService';
import { loadPlatformBranding, type ReceiptBranding } from './MarketingReceiptPdfService';

export interface ReportPdfInput {
  businessSlug: string;
  fullContent: MarketIntelFullContent;
}

export interface GeneratedReport {
  pdfBuffer: Buffer;
  filename: string;
}

/**
 * Generate a Market Intelligence Report PDF.
 *
 * Usage:
 *   const { pdfBuffer, filename } = await MarketIntelReportPdfService.generate({
 *     businessSlug, fullContent,
 *   });
 *   res.setHeader('Content-Type', 'application/pdf');
 *   res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
 *   res.send(pdfBuffer);
 */
export async function generateReportPdf(input: ReportPdfInput): Promise<GeneratedReport> {
  const { businessSlug, fullContent } = input;
  const branding = await loadPlatformBranding();

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  // ── Helper: ensure space, add page if needed ───────────────────────────
  const ensureSpace = (needed: number) => {
    if (yPos + needed > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }
  };

  // ── Helper: section heading ────────────────────────────────────────────
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

  // ── Helper: body text with word wrap ───────────────────────────────────
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

  // ── Helper: bullet item ───────────────────────────────────────────────
  const bullet = (text: string, indent = 0) => {
    ensureSpace(6);
    doc.text(`• ${text}`, margin + indent, yPos);
    yPos += 5;
  };

  // ════════════════════════════════════════════════════════════════════════
  // HEADER
  // ════════════════════════════════════════════════════════════════════════

  // Logo
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

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Market Intelligence Report', pageWidth - margin, 20, { align: 'right' });

  // Business name + location
  yPos = 38;
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text(fullContent.businessName ?? businessSlug, margin, yPos);
  yPos += 6;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPos);

  // Divider
  yPos += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ════════════════════════════════════════════════════════════════════════
  // 1. EXECUTIVE SUMMARY
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(1, 'Executive Summary');
  const oppCount = fullContent.growthOpportunities.items.length;
  const metCount = fullContent.howItStacksUp.signals.filter((s) => s.met === true).length;
  const totalCount = fullContent.howItStacksUp.signals.length;
  bodyText(
    `${fullContent.businessName ?? 'This business'} meets ${metCount} of ${totalCount} category signals ` +
    `and has ${oppCount} growth opportunit${oppCount !== 1 ? 'ies' : 'y'} identified. ` +
    `This report provides a comprehensive market analysis including category positioning, ` +
    `gold standard benchmarking, and prioritized recommendations.`,
  );

  // ════════════════════════════════════════════════════════════════════════
  // 2. MARKET POSITION
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(2, 'Market Position');
  const cat = fullContent.marketContext?.category as any;
  const loc = fullContent.marketContext?.location as any;

  if (fullContent.marketContext?.hasCategoryIntelligence && cat) {
    if (cat.category_profile?.market_density) {
      bullet(`Market density: ${cat.category_profile.market_density}`);
    }
  } else {
    bodyText('Category intelligence not yet available for this market.');
  }

  if (fullContent.marketContext?.hasLocationIntelligence && loc) {
    if (loc.city_profile?.metro_description) {
      bullet(`City profile: ${loc.city_profile.metro_description}`);
    }
    if (loc.city_profile?.major_industries?.length) {
      bullet(`Major industries: ${loc.city_profile.major_industries.join(', ')}`);
    }
    if (loc.city_profile?.growth_trajectory) {
      bullet(`Growth trajectory: ${loc.city_profile.growth_trajectory}`);
    }
    if (loc.metro_dynamics?.length) {
      bullet('Metro dynamics:');
      for (const dyn of loc.metro_dynamics) {
        bullet(`${dyn.city}${dyn.state ? `, ${dyn.state}` : ''} — ${dyn.relationship}`, 5);
      }
    }
  } else {
    bodyText('Location intelligence not yet available for this market.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. CATEGORY SIGNALS CHECKLIST
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(3, 'Category Signals Checklist');
  if (fullContent.howItStacksUp.available && fullContent.howItStacksUp.signals.length > 0) {
    for (const s of fullContent.howItStacksUp.signals) {
      const mark = s.met === true ? '[✓]' : s.met === false ? '[✗]' : '[?]';
      bullet(`${mark} ${s.signal}`);
      if (s.evidence) {
        bodyText(s.evidence, 5);
      }
    }
  } else {
    bodyText('Category signal evaluation pending.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. GOLD STANDARD COMPARISON
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(4, 'Gold Standard Comparison');
  if (fullContent.gapAnalysis) {
    const gaps = (fullContent.gapAnalysis as any).gaps;
    if (Array.isArray(gaps) && gaps.length > 0) {
      const below = gaps.filter((g: any) => g.severity === 'non_negotiable' || g.severity === 'recommended');
      if (below.length > 0) {
        bodyText('Below benchmark:');
        for (const g of below) {
          bullet(`${g.field ?? 'Unknown gap'} (${g.severity ?? 'unknown'})`);
        }
      }
      const above = fullContent.howItStacksUp.signals.filter((s) => s.met === true);
      if (above.length > 0) {
        bodyText('Above benchmark:');
        for (const s of above) {
          bullet(s.signal);
        }
      }
      const alignment = metCount >= totalCount * 0.7 ? 'Strong' : metCount >= totalCount * 0.5 ? 'Moderate' : 'Needs improvement';
      bodyText(`Overall alignment: ${alignment} (${metCount}/${totalCount} signals met)`);
    } else {
      bodyText('Gold standard comparison not available.');
    }
  } else {
    bodyText('Gold standard comparison not available.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. GROWTH OPPORTUNITIES
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(5, 'Growth Opportunities');
  if (fullContent.growthOpportunities.available && fullContent.growthOpportunities.items.length > 0) {
    // Sort by impact: HIGH → MEDIUM → LOW
    const impactRank: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const sorted = [...fullContent.growthOpportunities.items].sort((a, b) => {
      return (impactRank[a.impact ?? ''] ?? 3) - (impactRank[b.impact ?? ''] ?? 3);
    });
    for (let i = 0; i < sorted.length; i++) {
      const opp = sorted[i];
      ensureSpace(15);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}. ${opp.title}`, margin, yPos);
      yPos += 5;
      if (opp.impact) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`Impact: ${opp.impact}`, margin + 5, yPos);
        yPos += 5;
      }
      doc.setTextColor(60, 60, 60);
      if (opp.description) {
        bodyText(opp.description, 5);
      }
    }
  } else {
    bodyText('No growth opportunities identified.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. MARKET GAPS
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(6, 'Market Gaps');
  if (fullContent.marketContext?.hasLocationIntelligence && loc?.market_gaps?.length) {
    for (const gap of loc.market_gaps) {
      bullet(`${gap.category}: ${gap.signal}`);
      if (gap.area) {
        bodyText(`Area: ${gap.area}`, 5);
      }
    }
  } else {
    bodyText('No market gaps identified for this location.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 7. RECOMMENDATIONS
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(7, 'Recommendations');
  // Derive recommendations from unmet signals + top opportunities
  const unmet = fullContent.howItStacksUp.signals.filter((s) => s.met === false);
  if (unmet.length > 0) {
    bodyText('Prioritized action items based on unmet category signals:');
    for (const s of unmet) {
      bullet(`Address: ${s.signal}`);
      if (s.evidence) {
        bodyText(s.evidence, 5);
      }
    }
  }
  if (fullContent.growthOpportunities.items.length > 0) {
    bodyText('Top opportunities to pursue:');
    for (const opp of fullContent.growthOpportunities.items.slice(0, 3)) {
      bullet(`${opp.title} (Impact: ${opp.impact ?? 'N/A'})`);
    }
  }
  if (unmet.length === 0 && fullContent.growthOpportunities.items.length === 0) {
    bodyText('No specific recommendations at this time. Continue monitoring market conditions.');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 8. APPENDIX: MARKET CONTEXT
  // ════════════════════════════════════════════════════════════════════════

  sectionHeading(8, 'Appendix: Market Context');
  if (fullContent.marketContext?.hasCategoryIntelligence && cat) {
    bodyText('Category summary:');
    const catSummary = JSON.stringify(cat, null, 2);
    bodyText(catSummary, 5);
  }
  if (fullContent.marketContext?.hasLocationIntelligence && loc) {
    bodyText('City market summary:');
    const locSummary = JSON.stringify(loc, null, 2);
    bodyText(locSummary, 5);
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
      `${branding.platformName} — Market Intelligence Report — ${fullContent.businessName ?? businessSlug}`,
      margin,
      pageHeight - 10,
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  const filename = `market-intel-report-${businessSlug}.pdf`;
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return { pdfBuffer, filename };
}

// ─── Category Market Brief (§12.5) ─────────────────────────────────────────

export interface CategoryReportPdfInput {
  categorySlug: string;
  city: string;
  state: string | null;
  fullContent: CategoryMarketIntelFull;
}

export async function generateCategoryReportPdf(input: CategoryReportPdfInput): Promise<GeneratedReport> {
  const { categorySlug, city, state, fullContent } = input;
  const branding = await loadPlatformBranding();

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  const ensureSpace = (needed: number) => {
    if (yPos + needed > pageHeight - 30) { doc.addPage(); yPos = 20; }
  };
  const sectionHeading = (title: string) => {
    ensureSpace(20); yPos += 6;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(branding.primaryColor);
    doc.text(title, margin, yPos); yPos += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
  };
  const bodyText = (text: string, indent = 0) => {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - indent);
    for (const line of lines) { ensureSpace(6); doc.text(line, margin + indent, yPos); yPos += 5; }
  };
  const bullet = (text: string, indent = 0) => {
    ensureSpace(6); doc.text(`• ${text}`, margin + indent, yPos); yPos += 5;
  };

  // Header
  doc.setFontSize(20); doc.setTextColor(branding.primaryColor);
  doc.text(branding.platformName, margin, yPos);
  doc.setFontSize(16); doc.setTextColor(0, 0, 0);
  doc.text('Category Market Brief', pageWidth - margin, 20, { align: 'right' });
  yPos = 38;
  doc.setFontSize(12); doc.setTextColor(80, 80, 80);
  const cityName = city === '__all__' ? 'National' : `${city}${state ? `, ${state}` : ''}`;
  doc.text(`${categorySlug} — ${cityName}`, margin, yPos);
  yPos += 6;
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPos);
  yPos += 6;
  doc.setDrawColor(200, 200, 200); doc.line(margin, yPos, pageWidth - margin, yPos); yPos += 6;

  // 1. Category Summary
  sectionHeading('Category Summary');
  if (fullContent.categorySummary) {
    bodyText(fullContent.categorySummary);
  } else {
    bodyText('Category summary not yet available.');
  }

  // 2. Category Signals
  sectionHeading('Benchmark Signals');
  if (fullContent.categorySignals.length > 0) {
    for (const s of fullContent.categorySignals) {
      bullet(s);
    }
  } else {
    bodyText('No benchmark signals tracked yet.');
  }

  // 3. Category Profile
  sectionHeading('Category Profile');
  const profile = fullContent.categoryProfile as any;
  if (profile) {
    if (profile.business_model) { bullet(`Business model: ${profile.business_model}`); }
    if (profile.customer_base) { bullet(`Customer base: ${profile.customer_base}`); }
    if (profile.competitive_landscape) { bullet(`Competitive landscape: ${profile.competitive_landscape}`); }
    if (profile.typical_scale) { bullet(`Typical scale: ${profile.typical_scale}`); }
    if (profile.online_presence_pattern) { bullet(`Online presence: ${profile.online_presence_pattern}`); }
  } else {
    bodyText('Category profile not yet available.');
  }

  // 4. Market Density
  sectionHeading('Market Density');
  if (fullContent.marketDensity) {
    bodyText(fullContent.marketDensity);
  } else {
    bodyText('Market density analysis not yet available.');
  }

  // 5. Prospect Signals
  sectionHeading('Prospect Signals');
  if (fullContent.prospectSignals.length > 0) {
    for (const s of fullContent.prospectSignals) {
      bullet(s);
    }
  } else {
    bodyText('No prospect signals available.');
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`${branding.platformName} — Category Market Brief — ${categorySlug}`, margin, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  const filename = `category-market-brief-${categorySlug}.pdf`;
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return { pdfBuffer, filename };
}

// ─── City Market Brief (§12.5) ─────────────────────────────────────────────

export interface CityReportPdfInput {
  city: string;
  state: string;
  fullContent: CityMarketIntelFull;
}

export async function generateCityReportPdf(input: CityReportPdfInput): Promise<GeneratedReport> {
  const { city, state, fullContent } = input;
  const branding = await loadPlatformBranding();

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  const ensureSpace = (needed: number) => {
    if (yPos + needed > pageHeight - 30) { doc.addPage(); yPos = 20; }
  };
  const sectionHeading = (title: string) => {
    ensureSpace(20); yPos += 6;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(branding.primaryColor);
    doc.text(title, margin, yPos); yPos += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
  };
  const bodyText = (text: string, indent = 0) => {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - indent);
    for (const line of lines) { ensureSpace(6); doc.text(line, margin + indent, yPos); yPos += 5; }
  };
  const bullet = (text: string, indent = 0) => {
    ensureSpace(6); doc.text(`• ${text}`, margin + indent, yPos); yPos += 5;
  };

  // Header
  doc.setFontSize(20); doc.setTextColor(branding.primaryColor);
  doc.text(branding.platformName, margin, yPos);
  doc.setFontSize(16); doc.setTextColor(0, 0, 0);
  doc.text('City Market Brief', pageWidth - margin, 20, { align: 'right' });
  yPos = 38;
  doc.setFontSize(12); doc.setTextColor(80, 80, 80);
  doc.text(`${city}, ${state}`, margin, yPos);
  yPos += 6;
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, yPos);
  yPos += 6;
  doc.setDrawColor(200, 200, 200); doc.line(margin, yPos, pageWidth - margin, yPos); yPos += 6;

  // 1. Market Summary
  sectionHeading('Market Summary');
  if (fullContent.marketSummary) {
    bodyText(fullContent.marketSummary);
  } else {
    bodyText('Market summary not yet available.');
  }

  // 2. City Profile
  sectionHeading('City Profile');
  const profile = fullContent.cityProfile as any;
  if (profile) {
    if (profile.metro_description) { bullet(`Metro description: ${profile.metro_description}`); }
    if (profile.major_industries?.length) { bullet(`Major industries: ${profile.major_industries.join(', ')}`); }
    if (profile.growth_trajectory) { bullet(`Growth trajectory: ${profile.growth_trajectory}`); }
    if (profile.demographic_character) { bullet(`Demographics: ${profile.demographic_character}`); }
    if (profile.market_character) { bullet(`Market character: ${profile.market_character}`); }
  } else {
    bodyText('City profile not yet available.');
  }

  // 3. Market Gaps
  sectionHeading('Market Gaps');
  if (fullContent.marketGaps.length > 0) {
    for (const gap of fullContent.marketGaps as any[]) {
      bullet(`${gap.category}: ${gap.signal}`);
      if (gap.area) { bodyText(`Area: ${gap.area}`, 5); }
    }
  } else {
    bodyText('No market gaps identified.');
  }

  // 4. Metro Dynamics
  sectionHeading('Metro Dynamics');
  if (fullContent.metroDynamics.length > 0) {
    for (const dyn of fullContent.metroDynamics as any[]) {
      bullet(`${dyn.city}${dyn.state ? `, ${dyn.state}` : ''} — ${dyn.relationship}`);
      if (dyn.character) { bodyText(dyn.character, 5); }
    }
  } else {
    bodyText('Metro dynamics not yet available.');
  }

  // 5. Notable Areas
  sectionHeading('Notable Areas');
  if (fullContent.notableAreas.length > 0) {
    for (const area of fullContent.notableAreas) {
      bullet(area);
    }
  } else {
    bodyText('No notable areas listed.');
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`${branding.platformName} — City Market Brief — ${city}, ${state}`, margin, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  const filename = `city-market-brief-${city}-${state}.pdf`.replace(/\s+/g, '-').toLowerCase();
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return { pdfBuffer, filename };
}

/**
 * MarketIntelReportPdfService — namespace export.
 */
export const MarketIntelReportPdfService = {
  generate: generateReportPdf,
  generateCategoryReport: generateCategoryReportPdf,
  generateCityReport: generateCityReportPdf,
};

export default MarketIntelReportPdfService;

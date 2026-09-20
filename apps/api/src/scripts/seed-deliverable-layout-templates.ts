/**
 * Seed script: Deliverable layout templates (G-8)
 *
 * Seeds one default jsPDF layout_spec per deliverable type into
 * `mkt_deliverable_templates_list`, so the Generate Deliverable modal's
 * Template dropdown has a designed layout for each type instead of falling
 * back to `getDefaultLayoutSpec()` (heading + body).
 *
 * Layout contract (MarketingDeliverableService.renderLayoutSections):
 *   section.type ∈ heading | subheading | body | divider | spacing
 *   A `body` section WITHOUT `text` renders the generated content. There must
 *   be exactly ONE such section — every text-less body repeats the full content.
 *
 * Idempotent — deterministic IDs, update-in-place.
 *
 * Usage (run from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-deliverable-layout-templates.ts
 *   doppler run --config prd   -- npx tsx src/scripts/seed-deliverable-layout-templates.ts
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md (G-8)
 */

import { MarketingDeliverableService } from '../services/MarketingDeliverableService';
import { logger } from '../logger';

const SEED_VERSION_MARKER = 'DELIVERABLE_LAYOUT_SEED_V5';

const CLAIM_CTA =
  'Claim your listing and correct your details here — it takes about two minutes and there is no cost.';

const RETAINER_NEXT_STEP =
  'Keep this coverage active — an ongoing listing-synchronization retainer re-verifies these platforms monthly and catches new drift before it costs you customers.';

interface LayoutTemplate {
  id: string;
  name: string;
  deliverableType: string;
  pageSize: string;
  orientation: string;
  title: string;
  subtitle: string;
  nextStep?: string;
}

const TEMPLATES: LayoutTemplate[] = [
  {
    id: 'mdt-default-review-responses', name: 'Default — Review Responses',
    deliverableType: 'review_responses', pageSize: 'letter', orientation: 'portrait',
    title: 'Review Responses', subtitle: 'Drafted owner responses, written in your voice',
  },
  {
    id: 'mdt-default-service-menu', name: 'Default — Service Menu',
    deliverableType: 'service_menu', pageSize: 'letter', orientation: 'portrait',
    title: 'Service Menu', subtitle: 'What you offer, clearly presented',
  },
  {
    id: 'mdt-default-gbp-audit', name: 'Default — GBP Audit Report',
    deliverableType: 'gbp_audit', pageSize: 'letter', orientation: 'portrait',
    title: 'Google Business Profile Audit', subtitle: "What's missing and what to fix first",
  },
  {
    id: 'mdt-default-testimonial-cards', name: 'Default — Testimonial Cards',
    deliverableType: 'testimonial_cards', pageSize: 'letter', orientation: 'landscape',
    title: 'Testimonial Cards', subtitle: 'Ready-to-publish customer praise',
  },
  {
    id: 'mdt-default-nap-report', name: 'Default — NAP Consistency Report',
    deliverableType: 'nap_report', pageSize: 'letter', orientation: 'portrait',
    title: 'NAP Consistency Report', subtitle: 'Where your details disagree across platforms',
  },
  {
    id: 'mdt-default-seo-content', name: 'Default — SEO Content Pack',
    deliverableType: 'seo_content', pageSize: 'letter', orientation: 'portrait',
    title: 'SEO Content Pack', subtitle: 'Ready-to-publish service pages',
  },
  {
    id: 'mdt-default-lead-magnet', name: 'Default — Lead Magnet',
    deliverableType: 'lead_magnet', pageSize: 'letter', orientation: 'portrait',
    title: 'Lead Magnet', subtitle: 'A conversion asset for your site',
  },
  {
    id: 'mdt-default-product-visibility', name: 'Default — Product Visibility Preview',
    deliverableType: 'product_visibility_preview', pageSize: 'letter', orientation: 'portrait',
    title: 'Product Visibility Preview', subtitle: 'Help customers find and verify what you sell',
  },
  // PB-08 (website gap) — the visual homepage mockup (spec OQ-2). Landscape
  // reads like a screen; the content is the section-by-section mockup +
  // must-have pages from the website_positioning audit.
  {
    id: 'mdt-default-website-mockup', name: 'Default — Website Mockup',
    deliverableType: 'website_mockup', pageSize: 'letter', orientation: 'landscape',
    title: 'Website Mockup', subtitle: 'What your new site will look like, section by section',
    nextStep: RETAINER_NEXT_STEP,
  },
  // PB-08 (website gap) — the platform-centric build package: the delivery
  // artifact behind the mockup. Portrait — it's a working spec (site map,
  // copy spec, domain/hosting, asset checklist, QA/launch, profile cutover),
  // not a visual preview.
  {
    id: 'mdt-default-website-build-package', name: 'Default — Website Build Package',
    deliverableType: 'website_build_package', pageSize: 'letter', orientation: 'portrait',
    title: 'Website Build Package', subtitle: 'Everything the platform needs to ship your site',
    nextStep: RETAINER_NEXT_STEP,
  },
  // Profile Repair Fulfillment Sprint (W5c) — the shared Track A package
  // artifact. The composed content already carries the §5.1 section order
  // (Canonical NAP → per-platform fix sheets → claim links → verification
  // checklist → submission guide), so the layout is a single text-less body
  // rendering that content between a title block and the claim CTA.
  {
    id: 'mdt-default-citation-repair-package', name: 'Default — Citation & Profile Repair Package',
    deliverableType: 'citation_repair_package', pageSize: 'letter', orientation: 'portrait',
    title: 'Citation & Profile Repair Package', subtitle: 'Per-platform fix sheets, claim links, and verification checklist',
  },
  // W8 — completion report assembled from repair_fulfillment.platform_status
  // + checklist progress (RepairFulfillmentService.buildCompletionReport).
  // The retainer pitch is inside the content; the closing CTA is retainer,
  // not claim.
  {
    id: 'mdt-default-repair-completion-report', name: 'Default — Repair Completion Report',
    deliverableType: 'repair_completion_report', pageSize: 'letter', orientation: 'portrait',
    title: 'Repair Completion Report', subtitle: 'Verified outcomes per platform and what happens next',
    nextStep: RETAINER_NEXT_STEP,
  },
];

/**
 * Build a layout spec. Exactly one text-less `body` section pulls the
 * generated content; all other sections carry explicit text.
 */
function buildLayoutSpec(t: LayoutTemplate): any {
  return {
    _seed: SEED_VERSION_MARKER,
    sections: [
      { type: 'heading', text: t.title },
      { type: 'subheading', text: t.subtitle },
      { type: 'divider' },
      { type: 'body' },
      { type: 'spacing', height: 8 },
      { type: 'divider' },
      { type: 'subheading', text: 'Next step' },
      { type: 'body', text: t.nextStep ?? CLAIM_CTA },
    ],
  };
}

async function main() {
  const prisma = (MarketingDeliverableService.getInstance() as any).prisma;
  let created = 0;
  let updated = 0;

  for (const t of TEMPLATES) {
    try {
      const existing = await prisma.mkt_deliverable_templates_list.findUnique({ where: { id: t.id } });
      const data = {
        name: t.name,
        deliverable_type: t.deliverableType,
        category: null,
        layout_spec: buildLayoutSpec(t),
        page_size: t.pageSize,
        orientation: t.orientation,
        is_active: true,
        is_default: true,
        updated_at: new Date(),
      };

      if (existing) {
        await prisma.mkt_deliverable_templates_list.update({ where: { id: t.id }, data });
        updated++;
        logger.info(`Updated layout template: ${t.name}`);
      } else {
        await prisma.mkt_deliverable_templates_list.create({
          data: { id: t.id, ...data, version: 1, created_by: 'system' },
        });
        created++;
        logger.info(`Created layout template: ${t.name}`);
      }
    } catch (err) {
      logger.error(`Failed to seed layout template: ${t.name}`, undefined, {
        error: err instanceof Error ? { message: err.message } : String(err),
      });
    }
  }

  logger.info(`Layout seed complete: ${created} created, ${updated} updated`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Layout seed script failed', undefined, {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

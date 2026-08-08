/**
 * Diagnostic Gallery — Archetype-Aware Default Content
 *
 * Pure helper that maps a resolved campaign archetype (A1–A6) to the
 * default gallery title, subtitle, friction summary, and CTA label/amount.
 * Used by the gallery-token issuance route when the operator does not
 * supply explicit values.
 *
 * No DB access, no async, no side effects — pure function.
 *
 * See: docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md §5 + §12 Sprint 2
 */

import type { ArchetypeCode, NegativeReviewTheme } from '../outreach-openers/archetype-selection';

export interface GalleryArchetypeDefaults {
  galleryTitle: string;
  gallerySubtitle: string;
  frictionSummary: Record<string, string | number>;
  ctaLabel: string;
}

const ARCHETYPE_DEFAULTS: Record<ArchetypeCode, Omit<GalleryArchetypeDefaults, 'frictionSummary'>> = {
  A1: {
    galleryTitle: 'Review Response Diagnostic',
    gallerySubtitle: 'Your unanswered reviews are costing you customers. Here is the fix.',
    ctaLabel: 'Start Recovery',
  },
  A2: {
    galleryTitle: 'Review Recovery Diagnostic',
    gallerySubtitle: 'A recurring negative theme is dragging down your reputation.',
    ctaLabel: 'Start Recovery',
  },
  A3: {
    galleryTitle: 'Listing Accuracy Diagnostic',
    gallerySubtitle: 'Your business info is inconsistent across platforms.',
    ctaLabel: 'Fix My Listings',
  },
  A4: {
    galleryTitle: 'Conversion Gap Diagnostic',
    gallerySubtitle: 'Your website is leaking customers. Here is where.',
    ctaLabel: 'Fix My Funnel',
  },
  A5: {
    galleryTitle: 'Multi-Signal Diagnostic',
    gallerySubtitle: 'Several issues are holding back your visibility.',
    ctaLabel: 'Start Recovery',
  },
  A6: {
    galleryTitle: 'Product Visibility Diagnostic',
    gallerySubtitle: 'Your products are invisible online. Here is the fix.',
    ctaLabel: 'Fix My Visibility',
  },
};

/**
 * Resolve archetype-aware defaults for a gallery token.
 *
 * For A2, the friction summary includes the recurring negative theme
 * (passed in from selectArchetype's `theme` field). For other archetypes,
 * the friction summary is built from the archetype's generic pain points.
 */
export function resolveGalleryArchetypeDefaults(
  archetype: ArchetypeCode,
  theme?: NegativeReviewTheme | null,
): GalleryArchetypeDefaults {
  const base = ARCHETYPE_DEFAULTS[archetype];
  let frictionSummary: Record<string, string | number>;

  switch (archetype) {
    case 'A1':
      frictionSummary = {
        pain: 'unanswered_reviews',
        impact: 'Customers see unanswered complaints and choose competitors.',
      };
      break;
    case 'A2':
      frictionSummary = {
        pain: 'recurring_negative_theme',
        theme: theme?.theme ?? 'unknown',
        summary: theme?.summary ?? 'A recurring negative theme in your reviews.',
        supporting_review_count: theme?.supporting_review_count ?? 0,
      };
      break;
    case 'A3':
      frictionSummary = {
        pain: 'nap_inconsistency',
        impact: 'Customers and search engines see conflicting business info.',
      };
      break;
    case 'A4':
      frictionSummary = {
        pain: 'conversion_gap',
        impact: 'Website visitors leave without a clear next step.',
      };
      break;
    case 'A5':
      frictionSummary = {
        pain: 'multi_signal',
        impact: 'Multiple visibility issues compound across platforms.',
      };
      break;
    case 'A6':
      frictionSummary = {
        pain: 'product_invisibility',
        impact: 'Customers cannot browse or buy your products online.',
      };
      break;
  }

  return {
    galleryTitle: base.galleryTitle,
    gallerySubtitle: base.gallerySubtitle,
    frictionSummary,
    ctaLabel: base.ctaLabel,
  };
}

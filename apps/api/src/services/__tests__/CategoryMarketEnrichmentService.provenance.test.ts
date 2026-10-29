/**
 * CategoryMarketEnrichmentService — campaign/narrative provenance guard.
 *
 * A category-set enrichment must not overwrite business-specific copy with the
 * market template. The guard originally knew only the pre-2026-10-28 source
 * names (`business_analysis_audit`), so the narrative lanes added by the
 * listing resolver (`discovery_scan`, `business_analysis`,
 * `category_identification`) slipped through and a market sweep clobbered
 * freshly recomposed seed copy. Pin both directions.
 */
import { describe, it, expect } from 'vitest';
import { isCampaignSourcedProvenance } from '../CategoryMarketEnrichmentService';

describe('isCampaignSourcedProvenance', () => {
  it.each([
    'discovery_scan',
    'business_analysis',
    'category_identification',
    'operator_override',
    'linked_campaign',
    'business_analysis_audit',
    'seed_seo_composer',
    'intelligence_profile',
  ])('protects %s content from market enrichment', (source) => {
    expect(isCampaignSourcedProvenance(source)).toBe(true);
  });

  it.each(['market_enrichment', '', null, undefined, 'unknown_lane'])(
    'does not protect %s',
    (source) => {
      expect(isCampaignSourcedProvenance(source as any)).toBe(false);
    },
  );
});

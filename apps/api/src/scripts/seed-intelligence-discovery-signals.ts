/**
 * Seed script: Intelligence Discovery Signals (INT_* family)
 *
 * Seeds the 11 INT_* discovery signal codes into `mkt_signal_registry` as a
 * new `INT` family (idempotent update-in-place). The registry is the runtime
 * source of truth for signal validation — the spec explicitly forbids
 * hardcoding these as a TS-only union (§6.7, §3.4 rule 3).
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md §6.7
 *
 * These are discovery-scope signals only. They must NOT be mixed with
 * business-audit signal families (RA, DS, WC, CP, VP, OX) in prompt output.
 *
 * Usage (from apps/api):
 *   doppler run --config local -- npx tsx src/scripts/seed-intelligence-discovery-signals.ts
 *   doppler run --config prd --    npx tsx src/scripts/seed-intelligence-discovery-signals.ts
 *
 * Re-run after editing this file. Verify the live registry rows' updated_at
 * is newer than this file's last git commit.
 */

import { MarketingSignalRegistryService } from '../services/MarketingSignalRegistryService';
import { logger } from '../logger';
import { invalidateSignalRegistryCache } from '../services/triage/signal-taxonomy';

/**
 * SEED_VERSION_MARKER — bump when signal definitions change to force
 * update-in-place of label/description on already-registered rows.
 */
const SEED_VERSION_MARKER = '2026-09-18-v2-signal-divergence';

export const INTELLIGENCE_DISCOVERY_SIGNALS = [
  {
    code: 'INT_LOW_VISIBILITY',
    family: 'INT',
    label: 'Low public visibility',
    description:
      'The business has minimal presence across the sources checked — few independent identity signals, limited platform coverage, or thin directory footprint.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_WEAK_MAINSTREAM_INDEXING',
    family: 'INT',
    label: 'Weak mainstream indexing',
    description:
      'The business is not well-indexed on mainstream search or map platforms relative to its category peers, reducing discoverability for customers who search broadly.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_SINGLE_SOURCE',
    family: 'INT',
    label: 'Single-source identity',
    description:
      'The business identity was established from only one independent source, increasing the risk that the record is incomplete or stale.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_HIDDEN_TRUST',
    family: 'INT',
    label: 'Hidden trust signals',
    description:
      'The business has trust-relevant attributes (credentials, certifications, community reputation) that are present but not surfaced on the platforms customers use most.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_RECENT_BUSINESS_EVIDENCE',
    family: 'INT',
    label: 'Recent business evidence',
    description:
      'Fresh operational signals (recent reviews, updated hours, active social posts) indicate the business is currently active, even if overall visibility is thin.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_POSSIBLE_CATEGORY_MISALIGNMENT',
    family: 'INT',
    label: 'Possible category misalignment',
    description:
      'The business may be classified under a category that does not match how customers in this market search for it, limiting discoverability in the right context.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_VERTICAL_SOURCE_DISCOVERY',
    family: 'INT',
    label: 'Vertical source discovery',
    description:
      'The business was found through a category-specific or vertical source rather than mainstream directories, suggesting a specialized customer discovery path.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_MULTISOURCE_IDENTITY',
    family: 'INT',
    label: 'Multi-source identity',
    description:
      'The business identity is corroborated across multiple independent sources, increasing confidence in the seed record and reducing reconciliation risk.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_ACTIVE_OPERATIONAL_EVIDENCE',
    family: 'INT',
    label: 'Active operational evidence',
    description:
      'Current operational signals (active hours, recent activity, live listings) confirm the business is operating, not just listed.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_CATEGORY_SPECIALIZATION',
    family: 'INT',
    label: 'Category specialization',
    description:
      'The business shows depth in its category — specialized services, category-specific attributes, or vertical expertise that distinguishes it from generic competitors.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'INT_UNDEREXPOSED_CREDENTIAL',
    family: 'INT',
    label: 'Underexposed credential',
    description:
      'The business holds credentials, certifications, or affiliations that would build customer trust but are not visible on the platforms where customers discover the business.',
    detectionSource: 'model_emitted' as const,
  },
  {
    // Spec: CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC §5 — a confidence-gated
    // local signal-weight estimate that diverges from the national one is
    // itself an intelligence observation (a market where a nationally-quiet
    // platform over-indexes is a market characteristic, not an error).
    // Display-only per §S1 — never enters detected_signals or triage.
    code: 'INT_PLATFORM_SIGNAL_DIVERGENCE',
    family: 'INT',
    label: 'Platform signal divergence',
    description:
      'A confidence-gated local signal-weight estimate diverges from the national category estimate for this platform — the local market reads differently than the national norm.',
    detectionSource: 'derived' as const,
  },
];

export async function seedIntelligenceDiscoverySignals(): Promise<void> {
  const signalService = MarketingSignalRegistryService.getInstance();

  logger.info('Starting Intelligence Discovery (INT_*) signals seed...', undefined, {
    marker: SEED_VERSION_MARKER,
    count: INTELLIGENCE_DISCOVERY_SIGNALS.length,
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const sig of INTELLIGENCE_DISCOVERY_SIGNALS) {
    try {
      const existing = await signalService.getSignalByCode(sig.code).catch(() => null);

      if (existing) {
        // Update-in-place: refresh label/description if the seed version changed.
        // The registry is the runtime source of truth, so we keep it in sync
        // with the seed definitions without deleting/recreating rows.
        const needsUpdate =
          existing.label !== sig.label ||
          existing.description !== sig.description ||
          existing.family !== sig.family;

        if (needsUpdate) {
          await signalService.updateSignal(existing.id, {
            family: sig.family,
            label: sig.label,
            description: sig.description,
            detectionSource: sig.detectionSource,
            isActive: true,
          });
          updated++;
          logger.info(`Updated signal ${sig.code}`, undefined, { marker: SEED_VERSION_MARKER });
        } else {
          skipped++;
          logger.info(`Signal ${sig.code} already up-to-date, skipping.`);
        }
      } else {
        await signalService.createSignal({
          code: sig.code,
          family: sig.family,
          label: sig.label,
          description: sig.description,
          detectionSource: sig.detectionSource,
          isActive: true,
        });
        created++;
        logger.info(`Registered signal ${sig.code}`, undefined, { marker: SEED_VERSION_MARKER });
      }
    } catch (err) {
      logger.error(`Error processing signal ${sig.code}`, undefined, {
        error: (err as Error).message,
      });
    }
  }

  invalidateSignalRegistryCache();
  logger.info('Intelligence Discovery signals seed completed.', undefined, {
    marker: SEED_VERSION_MARKER,
    created,
    updated,
    skipped,
    total: INTELLIGENCE_DISCOVERY_SIGNALS.length,
  });
}

if (require.main === module) {
  seedIntelligenceDiscoverySignals()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

/**
 * Seed script: Profile Repair Escalated Signals & Triage Output Schema
 *
 * Seeds the 5 escalated profile repair signal codes into `mkt_signal_registry` (idempotent),
 * and updates `mpt-profile-repair-triage-default` to declare `output_schema = {"name": "profile_repair_triage"}`.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-profile-repair-signals.ts
 */

import { MarketingSignalRegistryService } from '../services/MarketingSignalRegistryService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { invalidateSignalRegistryCache } from '../services/triage/signal-taxonomy';

const ESCALATED_SIGNALS = [
  {
    code: 'DS_PROFILE_SUSPENDED',
    family: 'DS',
    label: 'Google Business Profile suspended',
    description: 'The Google Business Profile or map listing is suspended or pending verification review.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'DS_DUPLICATE_LISTING',
    family: 'DS',
    label: 'Duplicate listing detected',
    description: 'A duplicate listing exists on Google, Apple Maps, or Bing Places causing split reviews/traffic.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'DS_HIJACKED_LISTING',
    family: 'DS',
    label: 'Listing appears hijacked',
    description: 'The listing has been claimed or altered by an unauthorized third party.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'DS_OWNERSHIP_DISPUTE',
    family: 'DS',
    label: 'Ownership dispute evident',
    description: 'Conflicting ownership or management access requests on the business profile.',
    detectionSource: 'model_emitted' as const,
  },
  {
    code: 'DS_ADDRESS_VERIFICATION_BLOCK',
    family: 'DS',
    label: 'Address verification blocked',
    description: 'Address verification failed or requires video/postcard verification with location proof.',
    detectionSource: 'model_emitted' as const,
  },
];

export async function seedProfileRepairSignals(): Promise<void> {
  const signalService = MarketingSignalRegistryService.getInstance();

  logger.info('Starting Profile Repair signals seed...');

  for (const sig of ESCALATED_SIGNALS) {
    try {
      const existing = await signalService.getSignalByCode(sig.code).catch(() => null);
      if (existing) {
        logger.info(`Signal ${sig.code} already exists, skipping.`);
      } else {
        await signalService.createSignal({
          code: sig.code,
          family: sig.family,
          label: sig.label,
          description: sig.description,
          detectionSource: sig.detectionSource,
          isActive: true,
        });
        logger.info(`Registered signal ${sig.code}`);
      }
    } catch (err) {
      logger.error(`Error processing signal ${sig.code}`, undefined, { error: (err as Error).message });
    }
  }

  // Update triage template output_schema if it exists
  try {
    const triageTemplate = await prisma.mkt_prompt_templates_list.findUnique({
      where: { id: 'mpt-profile-repair-triage-default' },
    });

    if (triageTemplate) {
      const currentSchema = triageTemplate.output_schema as any;
      if (!currentSchema || currentSchema.name !== 'profile_repair_triage') {
        await prisma.mkt_prompt_templates_list.update({
          where: { id: 'mpt-profile-repair-triage-default' },
          data: {
            output_schema: { name: 'profile_repair_triage' },
          },
        });
        logger.info('Updated mpt-profile-repair-triage-default output_schema to profile_repair_triage');
      }
    }
  } catch (err) {
    logger.error('Error updating triage template output_schema', undefined, { error: (err as Error).message });
  }

  invalidateSignalRegistryCache();
  logger.info('Profile Repair signals seed completed.');
}

if (require.main === module) {
  seedProfileRepairSignals()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

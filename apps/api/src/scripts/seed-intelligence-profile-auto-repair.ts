/**
 * Seed script: auto_repair_us v1 Category Intelligence Profile
 *
 * Seeds the PoC profile for the Auto Repair category with the CARFAX
 * source model per spec §46. This is the reference shape for the
 * intelligence_profile Zod schema (GAP-P8) — the establishment loop
 * needs a known-good profile format to validate against.
 *
 * The profile is seeded as ACTIVE (not draft) because it is the hand-seeded
 * PoC reference. Profiles created via the establishment loop (GAP-P8) are
 * seeded as DRAFT and require operator activation.
 *
 * Idempotent — uses a deterministic ID so re-running updates in place.
 *
 * Usage:
 *   npx tsx apps/api/src/scripts/seed-intelligence-profile-auto-repair.ts
 */

import { IntelligenceProfileService } from '../services/intelligence/IntelligenceProfileService';
import { logger } from '../logger';

const AUTO_REPAIR_PROFILE = {
  id: 'auto_repair_us',
  categoryKey: 'auto repair',
  categoryName: 'Auto Repair',
  configurationJson: {
    terminology: {
      bay: 'A service work area where a vehicle is lifted for repair',
      RO: 'Repair Order — the work ticket tracking services performed on a vehicle',
      flat_rate: 'A pricing model where technicians are paid per job completed, not per hour',
      parts_markup: 'The margin added to wholesale parts cost when billing customers',
      labor_rate: 'The hourly rate charged for technician labor',
      diagnostic_fee: 'A charge for identifying the problem before quoting repairs',
    },
    synonyms: [
      'auto repair shop',
      'car repair',
      'mechanic',
      'auto service',
      'automotive repair',
      'garage',
      'auto body',
      'collision repair',
    ],
    subcategories: [
      'general_repair: engine, transmission, brake, suspension work',
      'specialized: transmission specialists, brake specialists, exhaust/muffler',
      'auto_body: collision repair, paint, frame straightening',
      'tire_service: tire sales, mounting, alignment',
      'oil_change_quick: fast-lube and oil change specialists',
      'diagnostic: computer diagnostics, check engine light, electrical',
    ],
    specialized_sources: [
      {
        name: 'CARFAX',
        type: 'service_history',
        priority: 1,
        capabilities: [
          'Service history records from participating dealerships and repair shops',
          'Vehicle mileage at time of service',
          'Types of services performed (oil change, brake job, transmission, etc.)',
          'Frequency of service — indicator of business activity volume',
          'Evidence of repeat customers (same vehicle serviced multiple times)',
        ],
        limitations: [
          'CARFAX service history is NOT a review system — service records ≠ customer reviews',
          'CARFAX review count ≠ total online reviews — do not conflate service record count with review count',
          'Not all repair shops report to CARFAX — absence from CARFAX does NOT mean the business is inactive',
          'Service history shows vehicle activity, not business quality or customer satisfaction',
          'A shop with many CARFAX records may still have poor online reviews — these are independent signals',
        ],
      },
      {
        name: 'ASE Certification Registry',
        type: 'certification',
        priority: 2,
        capabilities: [
          'Verifies technician certifications (ASE = National Institute for Automotive Service Excellence)',
          'Certification categories: A1-A9 (engine repair, automatic trans, manual trans, suspension, brakes, electrical, heating/AC, engine performance, light vehicle diesel)',
          'Master Technician status (all A1-A8 certified)',
          'Underexposed credential — many certified shops do not surface this online',
        ],
        limitations: [
          'ASE certification is not required to operate — absence does not mean unqualified',
          'Certification status changes — verify current standing, not historical',
          'Some shops have certified technicians but do not advertise it',
        ],
      },
      {
        name: 'iATN (International Automotive Technicians Network)',
        type: 'professional_network',
        priority: 3,
        capabilities: [
          'Professional network membership indicates technician engagement',
          'Forum activity can indicate specialization depth',
          'Underexposed credential — membership is a positive trust signal',
        ],
        limitations: [
          'Membership is voluntary — absence does not mean unqualified',
          'Not all quality technicians participate in online professional networks',
        ],
      },
      {
        name: 'Google Business Profile',
        type: 'mainstream_directory',
        priority: 4,
        capabilities: [
          'Business listing with hours, photos, services',
          'Customer reviews and ratings',
          'Q&A section for customer inquiries',
          'Posts/updates for promotions and service reminders',
        ],
        limitations: [
          'Many independent shops have unclaimed GBP profiles',
          'Review count on GBP ≠ total customers served',
          'Photo quality varies — absence of photos does not mean poor service quality',
        ],
      },
    ],
    discovery_patterns: {
      vertical_search: 'Search CARFAX Service Shop directory for the city + category',
      certification_search: 'Search ASE certification registry by city/state',
      social_discovery: 'Facebook business pages for independent shops often have more activity than their websites',
      directory_long_tail: 'Search Yelp, YellowPages, and local chamber of commerce directories — many independent shops are directory-only',
      word_of_mouth_indicators: 'Facebook community groups, Nextdoor recommendations — capture as discovery_provenance source',
    },
    category_evidence_rules: {
      active_operation: 'Recent CARFAX service records OR recent GBP reviews OR recent Facebook posts indicate active operation',
      specialization: 'ASE certifications in specific categories (A1-A9) indicate specialization depth',
      customer_base: 'Repeat CARFAX service records for the same vehicle indicate customer retention',
      capacity: 'Number of bays (from GBP photos or website) indicates service capacity',
      pricing_transparency: 'Website with service menu and pricing indicates digital maturity',
    },
    prohibited_inferences: [
      'CARFAX service record count ≠ total customers served — CARFAX only captures participating shops',
      'CARFAX review count ≠ total online reviews — service records and reviews are independent systems',
      'Absence from CARFAX does NOT mean the business is inactive or low-quality',
      'No website does NOT mean no customers — many independent auto repair shops operate on word-of-mouth',
      'Low GBP review count does NOT mean few customers — auto repair has lower review velocity than restaurants/retail',
      'ASE certification absence does NOT mean unqualified — certification is voluntary',
      'Do not infer pricing or revenue from service records — CARFAX does not capture all transactions',
    ],
    category_signals: [
      'INT_VERTICAL_SOURCE_DISCOVERY',
      'INT_HIDDEN_TRUST',
      'INT_SINGLE_SOURCE',
      'INT_RECENT_BUSINESS_EVIDENCE',
      'INT_UNDEREXPOSED_CREDENTIAL',
      'INT_ACTIVE_OPERATIONAL_EVIDENCE',
      'INT_CATEGORY_SPECIALIZATION',
    ],
  },
};

async function main() {
  const service = IntelligenceProfileService.getInstance();

  // Check if the profile already exists
  const existing = await service.getVersion(AUTO_REPAIR_PROFILE.id, 1);

  if (existing) {
    // For the hand-seeded PoC profile, we update the configuration in place
    // at version 1. This is the ONLY exception to the immutability rule —
    // the seed script is the authoritative source for the reference shape.
    // All other profile updates go through publishVersion (new version row).
    logger.info('auto_repair_us v1 already exists — skipping seed', undefined, {
      profileId: AUTO_REPAIR_PROFILE.id,
      status: existing.status,
    });
    return;
  }

  // Seed as ACTIVE — this is the hand-seeded PoC reference profile.
  // The establishment loop (GAP-P8) seeds as DRAFT; the hand-seed is the
  // known-good reference that the establishment template validates against.
  const profile = await service.createProfile({
    id: AUTO_REPAIR_PROFILE.id,
    categoryKey: AUTO_REPAIR_PROFILE.categoryKey,
    categoryName: AUTO_REPAIR_PROFILE.categoryName,
    configurationJson: AUTO_REPAIR_PROFILE.configurationJson,
    status: 'active',
  });

  logger.info('auto_repair_us v1 profile seeded', undefined, {
    profileId: profile.id,
    version: profile.version,
    status: profile.status,
    categoryKey: profile.category_key,
  });
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, { error: (err as Error).message });
  process.exit(1);
});

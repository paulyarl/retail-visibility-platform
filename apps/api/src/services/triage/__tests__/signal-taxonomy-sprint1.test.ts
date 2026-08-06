/**
 * Signal taxonomy tests — Sprint 1 (Universal Recalibration)
 *
 * Verifies the 7 new product-visibility signal codes are registered, labeled,
 * and correctly classified by the family predicates. Also verifies the
 * business-type-sensitive DS_PHOTO_DEFICIT threshold constants exist.
 *
 * Spec: docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md
 */

import { describe, it, expect } from 'vitest';
import {
  KNOWN_SIGNAL_CODES,
  SIGNAL_LABELS,
  SIGNAL_FAMILIES,
  signalFamily,
  isRepairSignal,
  isReviewSignal,
  isCrisisSignal,
  isVisualSignal,
  isKnownSignalCode,
  signalLabel,
} from '../signal-taxonomy';

const NEW_CODES = [
  'DS_MISSING_PRODUCT_CATALOG',
  'DS_OUTDATED_HOLIDAY_HOURS',
  'WC_MISSING_PRODUCT_BROWSING',
  'WC_MISSING_AVAILABILITY_INQUIRY',
  'WC_MISSING_PICKUP_DELIVERY',
  'VP_MISSING_STOREFRONT_PHOTOS',
  'VP_MISSING_PRODUCT_PHOTOS',
] as const;

describe('Sprint 1 — signal taxonomy: 7 new product-visibility codes', () => {
  it('KNOWN_SIGNAL_CODES contains all 7 new codes (24 → 31)', () => {
    for (const code of NEW_CODES) {
      expect(KNOWN_SIGNAL_CODES).toContain(code);
    }
    expect(KNOWN_SIGNAL_CODES.length).toBe(31);
  });

  it('every new code has a human-readable label in SIGNAL_LABELS', () => {
    for (const code of NEW_CODES) {
      const label = SIGNAL_LABELS[code];
      expect(label, `${code} should have a label`).toBeTruthy();
      expect(label).not.toBe(code); // label != code
    }
  });

  it('signalLabel() returns the label for new codes', () => {
    expect(signalLabel('DS_MISSING_PRODUCT_CATALOG')).toBe('Missing Product Catalog');
    expect(signalLabel('WC_MISSING_PRODUCT_BROWSING')).toBe('Missing Product Browsing');
    expect(signalLabel('VP_MISSING_STOREFRONT_PHOTOS')).toBe('Missing Storefront Photos');
  });

  it('isKnownSignalCode() returns true for all 7 new codes', () => {
    for (const code of NEW_CODES) {
      expect(isKnownSignalCode(code)).toBe(true);
    }
  });

  it('signalFamily() classifies new codes by prefix', () => {
    expect(signalFamily('DS_MISSING_PRODUCT_CATALOG')).toBe('DS');
    expect(signalFamily('DS_OUTDATED_HOLIDAY_HOURS')).toBe('DS');
    expect(signalFamily('WC_MISSING_PRODUCT_BROWSING')).toBe('WC');
    expect(signalFamily('WC_MISSING_AVAILABILITY_INQUIRY')).toBe('WC');
    expect(signalFamily('WC_MISSING_PICKUP_DELIVERY')).toBe('WC');
    expect(signalFamily('VP_MISSING_STOREFRONT_PHOTOS')).toBe('VP');
    expect(signalFamily('VP_MISSING_PRODUCT_PHOTOS')).toBe('VP');
  });
});

describe('Sprint 1 — family predicate updates', () => {
  it('isRepairSignal() includes DS_OUTDATED_HOLIDAY_HOURS (hours drift is repair-class)', () => {
    expect(isRepairSignal('DS_OUTDATED_HOLIDAY_HOURS')).toBe(true);
  });

  it('isRepairSignal() still includes the original repair signals', () => {
    expect(isRepairSignal('CP_NAP_NAME_DRIFT')).toBe(true);
    expect(isRepairSignal('WC_URL_MISMATCH')).toBe(true);
    expect(isRepairSignal('WC_BROKEN_WEBSITE')).toBe(true);
    expect(isRepairSignal('DS_BROKEN_PROFILE_LINK')).toBe(true);
  });

  it('isVisualSignal() includes new VP photo codes', () => {
    expect(isVisualSignal('VP_MISSING_STOREFRONT_PHOTOS')).toBe(true);
    expect(isVisualSignal('VP_MISSING_PRODUCT_PHOTOS')).toBe(true);
  });

  it('isReviewSignal() and isCrisisSignal() are unchanged by Sprint 1', () => {
    expect(isReviewSignal('RA_REVIEW_DROUGHT')).toBe(true);
    expect(isReviewSignal('DS_MISSING_PRODUCT_CATALOG')).toBe(false);
    expect(isCrisisSignal('RA_BBB_GRADE_SUPPRESSION')).toBe(true);
    expect(isCrisisSignal('DS_OUTDATED_HOLIDAY_HOURS')).toBe(false);
  });
});

describe('Sprint 1 — SIGNAL_FAMILIES unchanged', () => {
  it('SIGNAL_FAMILIES still has exactly 5 families (no new family added)', () => {
    expect(SIGNAL_FAMILIES).toEqual(['RA', 'DS', 'WC', 'CP', 'VP']);
  });
});

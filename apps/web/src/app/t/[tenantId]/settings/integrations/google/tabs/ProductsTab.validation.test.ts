/**
 * ProductsTab — validation index.
 *
 * The Products tab is where the Overview banners ("check the Products tab for
 * details") send a merchant to see which products Google will reject and what
 * to fix. Each table row looks its issues up by inventory item id, so the index
 * must key only items that actually carry issues — a clean item renders as
 * "—" rather than a phantom "0 errors" badge.
 */
import { describe, it, expect } from 'vitest';
import { buildValidationIndex } from './ProductsTab';
import type { BulkValidationReport, ValidationResult } from '@/services/GMCValidationService';

const validation = (over: Partial<ValidationResult> = {}): ValidationResult => ({
  valid: true,
  errors: 0,
  warnings: 0,
  issues: [],
  ...over,
});

const report = (results: BulkValidationReport['results']): BulkValidationReport => ({
  tenantId: 'tid-1',
  totalItems: results.length,
  validItems: 0,
  itemsWithErrors: 0,
  itemsWithWarnings: 0,
  results,
});

describe('buildValidationIndex', () => {
  it('returns an empty map when there is no report', () => {
    expect(buildValidationIndex(null).size).toBe(0);
  });

  it('indexes only items carrying at least one issue', () => {
    const index = buildValidationIndex(
      report([
        {
          itemId: 'item-clean',
          itemName: 'Clean Product',
          sku: 'SKU-1',
          validation: validation(),
        },
        {
          itemId: 'item-error',
          itemName: 'Rejected Product',
          sku: 'SKU-2',
          validation: validation({
            valid: false,
            errors: 1,
            issues: [{ field: 'image_url', severity: 'error', message: 'Image URL is required' }],
          }),
        },
        {
          itemId: 'item-warning',
          itemName: 'Recommended Product',
          sku: 'SKU-3',
          validation: validation({
            warnings: 1,
            issues: [{ field: 'brand', severity: 'warning', message: 'Brand is recommended.' }],
          }),
        },
      ]),
    );

    expect(index.size).toBe(2);
    expect(index.has('item-clean')).toBe(false);
    expect(index.get('item-error')?.errors).toBe(1);
    expect(index.get('item-warning')?.warnings).toBe(1);
  });
});

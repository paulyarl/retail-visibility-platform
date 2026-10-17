/**
 * Unit tests for the profile-repair issue-type normalizer.
 *
 * Regression: a triage briefing's compound `issue_type_confirmed` was written
 * verbatim into `mkt_campaigns_list.repair_issue_type` (VarChar(40)) and threw
 * Prisma's "value too long for the column's type" on POST /switch-track.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeRepairIssueType,
  REPAIR_ISSUE_TYPE_MAX_LENGTH,
  REPAIR_TRIAGE_VOCABULARY,
} from '../repair-issue-type';

describe('normalizeRepairIssueType', () => {
  it('passes an exact canonical token through, case- and whitespace-insensitive', () => {
    expect(normalizeRepairIssueType('nap_drift')).toBe('nap_drift');
    expect(normalizeRepairIssueType('  NAP_Drift  ')).toBe('nap_drift');
    expect(normalizeRepairIssueType('address_verification_block')).toBe('address_verification_block');
  });

  it('returns null for empty or non-string input', () => {
    expect(normalizeRepairIssueType(null)).toBeNull();
    expect(normalizeRepairIssueType(undefined)).toBeNull();
    expect(normalizeRepairIssueType('')).toBeNull();
    expect(normalizeRepairIssueType('   ')).toBeNull();
  });

  it('collapses the compound diagnosis that overflowed the column to its first token', () => {
    // The exact value that produced the 500 on switch-track (88 chars).
    const reported =
      'listing_hygiene_and_shelf_visibility (nap_drift + missing_category + missing_hours + no_website)';
    expect(normalizeRepairIssueType(reported)).toBe('nap_drift');
  });

  it('maps free-text phrasings onto the closest canonical token', () => {
    expect(normalizeRepairIssueType('NAP drift, broken website')).toBe('nap_drift');
    expect(normalizeRepairIssueType('Google Business Profile suspended')).toBe('suspension');
    expect(normalizeRepairIssueType('Hours are wrong on every listing')).toBe('missing_hours');
    expect(normalizeRepairIssueType('Listed under the wrong category')).toBe('missing_category');
    expect(normalizeRepairIssueType('No website at all')).toBe('platform_gap');
    expect(normalizeRepairIssueType('Profile not claimed')).toBe('unclaimed_profile');
    expect(normalizeRepairIssueType('Two live listings for one shop')).toBe('duplicate_listing');
  });

  it('slugifies unrecognized input and clamps it to the column width', () => {
    const result = normalizeRepairIssueType('Some entirely novel problem: ~*~ weird & unclassified!!!');
    expect(result).toBe('some_entirely_novel_problem_weird_unclas');
    expect(result!.length).toBeLessThanOrEqual(REPAIR_ISSUE_TYPE_MAX_LENGTH);
  });

  it('returns null when the input has no alphanumeric characters', () => {
    expect(normalizeRepairIssueType('--- ??? ---')).toBeNull();
  });

  it('never returns a value longer than the VarChar(40) column', () => {
    for (const input of [
      'x'.repeat(500),
      'listing_hygiene_and_shelf_visibility (nap_drift + missing_category + missing_hours + no_website)',
      'A very long operator note about a broken website and a wrong phone number and wrong hours',
      ...REPAIR_TRIAGE_VOCABULARY,
    ]) {
      const result = normalizeRepairIssueType(input);
      expect(result === null || result.length <= REPAIR_ISSUE_TYPE_MAX_LENGTH).toBe(true);
    }
  });

  it('every canonical token normalizes to itself', () => {
    for (const token of REPAIR_TRIAGE_VOCABULARY) {
      expect(normalizeRepairIssueType(token)).toBe(token);
    }
  });
});

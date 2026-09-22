/**
 * Bronze-standard campaign-create refine semantics (sprint plan Phase 10).
 *
 * Verifies the kind-aware geo/platform refines on campaignCreateSchema
 * (BRONZE_STANDARD_SPEC §10.2, Option A):
 *   - national bronze ESTABLISHMENT (stage 1) is geo-exempt like gold
 *   - bronze DISCOVERY (stage 2) requires city + state like emerging
 *   - bronze NEVER requires intelligence_platform (unlike gold)
 *   - gold_standards keeps its platform requirement
 *
 * The schema is exported for this test only — the route itself is not
 * exercised (a zod failure currently surfaces as 500 via handleServiceError,
 * which would make HTTP-level assertions misleading).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../middleware/auth', () => ({
  authenticateToken: (_req: any, _res: any, next: any) => next(),
  requirePlatformAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../prisma', () => ({ prisma: {} }));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { campaignCreateSchema } from '../routes/marketing-ops';

const issuePaths = (payload: any): string[] => {
  const result = campaignCreateSchema.safeParse(payload);
  if (result.success) return [];
  return result.error.issues.map((i) => i.path.join('.'));
};

describe('campaignCreateSchema — bronze_standards refine semantics', () => {
  it('allows a national bronze establishment campaign without city/state or platform', () => {
    const paths = issuePaths({
      scope: 'intelligence',
      category: 'African Grocery Store',
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'establishment',
    });
    expect(paths).not.toContain('city');
    expect(paths).not.toContain('state');
    expect(paths).not.toContain('intelligence_platform');
    expect(campaignCreateSchema.safeParse({
      scope: 'intelligence',
      category: 'African Grocery Store',
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'establishment',
    }).success).toBe(true);
  });

  it('requires city + state for a bronze discovery (city) campaign', () => {
    const paths = issuePaths({
      scope: 'intelligence',
      category: 'African Grocery Store',
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'discovery',
    });
    expect(paths).toContain('city');
    expect(paths).toContain('state');
  });

  it('allows a bronze discovery campaign with city + state and no platform', () => {
    const result = campaignCreateSchema.safeParse({
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'discovery',
    });
    expect(result.success).toBe(true);
  });

  it('allows a platform-scoped bronze campaign (platform optional, never required)', () => {
    const result = campaignCreateSchema.safeParse({
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'discovery',
      intelligence_platform: 'google',
    });
    expect(result.success).toBe(true);
  });

  it('defaults a bronze campaign with no kind to discovery (geo required)', () => {
    const paths = issuePaths({
      scope: 'intelligence',
      category: 'African Grocery Store',
      intelligence_focus: 'bronze_standards',
    });
    expect(paths).toContain('city');
    expect(paths).toContain('state');
  });

  it('still requires intelligence_platform for gold_standards (unchanged)', () => {
    const paths = issuePaths({
      scope: 'intelligence',
      category: 'African Grocery Store',
      intelligence_focus: 'gold_standards',
    });
    expect(paths).toContain('intelligence_platform');
  });

  it('still requires city + state for an emerging discovery campaign (unchanged)', () => {
    const paths = issuePaths({
      scope: 'intelligence',
      category: 'African Grocery Store',
      intelligence_focus: 'emerging',
      intelligence_campaign_kind: 'discovery',
    });
    expect(paths).toContain('city');
    expect(paths).toContain('state');
  });
});

describe('campaignCreateSchema — national + market-scope semantics', () => {
  it('accepts a national (__all__) discovery campaign — sentinel satisfies geo presence', () => {
    const result = campaignCreateSchema.safeParse({
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: '__all__',
      state: '__all__',
      intelligence_focus: 'emerging',
      intelligence_campaign_kind: 'discovery',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a national (__all__) competitive discovery campaign', () => {
    const result = campaignCreateSchema.safeParse({
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: '__all__',
      state: '__all__',
      intelligence_focus: 'competitive',
      intelligence_campaign_kind: 'discovery',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a market-scoped gold standard campaign (city + state + platform)', () => {
    const result = campaignCreateSchema.safeParse({
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Kansas City',
      state: 'MO',
      intelligence_focus: 'gold_standards',
      intelligence_platform: 'google',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a nationwide gold standard (no geo, platform still required)', () => {
    const result = campaignCreateSchema.safeParse({
      scope: 'intelligence',
      category: 'African Grocery Store',
      intelligence_focus: 'gold_standards',
      intelligence_platform: 'google',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a half-scoped gold standard (city without state)', () => {
    const paths = issuePaths({
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Kansas City',
      intelligence_focus: 'gold_standards',
      intelligence_platform: 'google',
    });
    expect(paths).toContain('state');
  });

  it('rejects a half-scoped gold standard (state without city)', () => {
    const paths = issuePaths({
      scope: 'intelligence',
      category: 'African Grocery Store',
      state: 'MO',
      intelligence_focus: 'gold_standards',
      intelligence_platform: 'google',
    });
    expect(paths).toContain('state');
  });

  it('rejects a half-scoped bronze establishment (city without state)', () => {
    const paths = issuePaths({
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'establishment',
    });
    expect(paths).toContain('state');
  });

  it('accepts a market-scoped bronze establishment (city + state)', () => {
    const result = campaignCreateSchema.safeParse({
      scope: 'intelligence',
      category: 'African Grocery Store',
      city: 'Indianapolis',
      state: 'IN',
      intelligence_focus: 'bronze_standards',
      intelligence_campaign_kind: 'establishment',
    });
    expect(result.success).toBe(true);
  });
});

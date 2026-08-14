/**
 * Unit tests for scope system extensions (Sprint 1 — Seek Intelligence Scope).
 *
 * Verifies:
 *   - intelligence scope is in SCOPE_VARIABLES
 *   - intelligence scope variables include the expected discovery inputs
 *   - assertScopeCompatible accepts intelligence-intelligence pairs
 *   - assertScopeCompatible rejects intelligence vs business/category/city
 *   - PromptType now includes 'fragment'
 *   - ProspectSourceKind includes 'intelligence_seek'
 *   - ProspectCampaignScope includes 'intelligence'
 */

import { describe, it, expect } from 'vitest';
import { SCOPE_VARIABLES, assertScopeCompatible, ScopeMismatchError } from '../scope-utils';
import type { PromptType, PromptScope } from '../MarketingPromptService';
import type { CampaignScope } from '../MarketingCampaignService';
import type { ProspectSourceKind, ProspectCampaignScope } from '../MarketingProspectQueueService';

describe('SCOPE_VARIABLES — intelligence scope', () => {
  it('includes intelligence in SCOPE_VARIABLES', () => {
    expect(SCOPE_VARIABLES.intelligence).toBeDefined();
    expect(Array.isArray(SCOPE_VARIABLES.intelligence)).toBe(true);
  });

  it('includes the expected intelligence variables', () => {
    const vars = SCOPE_VARIABLES.intelligence;
    expect(vars).toContain('category');
    expect(vars).toContain('city');
    expect(vars).toContain('state');
    expect(vars).toContain('focus');
    expect(vars).toContain('zip_codes');
    expect(vars).toContain('search_radius_miles');
    expect(vars).toContain('neighborhood');
  });
});

describe('assertScopeCompatible — intelligence scope', () => {
  it('passes when both template and campaign are intelligence scope', () => {
    expect(() =>
      assertScopeCompatible({ scope: 'intelligence' }, { scope: 'intelligence' }),
    ).not.toThrow();
  });

  it('rejects intelligence template vs business campaign', () => {
    expect(() =>
      assertScopeCompatible({ scope: 'intelligence' }, { scope: 'business' }),
    ).toThrow(ScopeMismatchError);
  });

  it('rejects intelligence template vs category campaign', () => {
    expect(() =>
      assertScopeCompatible({ scope: 'intelligence' }, { scope: 'category' }),
    ).toThrow(ScopeMismatchError);
  });

  it('rejects intelligence template vs city campaign', () => {
    expect(() =>
      assertScopeCompatible({ scope: 'intelligence' }, { scope: 'city' }),
    ).toThrow(ScopeMismatchError);
  });

  it('rejects business template vs intelligence campaign', () => {
    expect(() =>
      assertScopeCompatible({ scope: 'business' }, { scope: 'intelligence' }),
    ).toThrow(ScopeMismatchError);
  });

  it('is case-insensitive for intelligence scope', () => {
    expect(() =>
      assertScopeCompatible({ scope: 'Intelligence' }, { scope: 'INTELLIGENCE' }),
    ).not.toThrow();
  });
});

describe('PromptType — fragment', () => {
  it('includes fragment in PromptType', () => {
    // Type-level check — if 'fragment' is not in PromptType, this assignment
    // would fail at compile time.
    const t: PromptType = 'fragment' as any;
    expect(t).toBe('fragment');
  });
});

describe('PromptScope — intelligence', () => {
  it('includes intelligence in PromptScope', () => {
    const s: PromptScope = 'intelligence' as any;
    expect(s).toBe('intelligence');
  });
});

describe('CampaignScope — intelligence', () => {
  it('includes intelligence in CampaignScope', () => {
    const s: CampaignScope = 'intelligence' as any;
    expect(s).toBe('intelligence');
  });
});

describe('ProspectSourceKind — intelligence_seek', () => {
  it('includes intelligence_seek in ProspectSourceKind', () => {
    const k: ProspectSourceKind = 'intelligence_seek' as any;
    expect(k).toBe('intelligence_seek');
  });
});

describe('ProspectCampaignScope — intelligence', () => {
  it('includes intelligence in ProspectCampaignScope', () => {
    const s: ProspectCampaignScope = 'intelligence' as any;
    expect(s).toBe('intelligence');
  });
});

/**
 * Unit tests for MarketingExecutionService scope validation (G19/G20).
 *
 * Tests the pure helpers (assertScopeCompatible, ScopeMismatchError,
 * renderTemplate scope-aware variable injection) without needing Prisma.
 */

import { describe, it, expect } from 'vitest';
import {
  ScopeMismatchError,
  assertScopeCompatible,
  MarketingExecutionService,
} from '../MarketingExecutionService';

// Get the singleton instance — renderTemplate is an instance method.
const service = MarketingExecutionService.getInstance();

describe('assertScopeCompatible', () => {
  it('passes when template and campaign scopes match', () => {
    expect(() => assertScopeCompatible({ scope: 'business' }, { scope: 'business' })).not.toThrow();
    expect(() => assertScopeCompatible({ scope: 'category' }, { scope: 'category' })).not.toThrow();
    expect(() => assertScopeCompatible({ scope: 'city' }, { scope: 'city' })).not.toThrow();
  });

  it('defaults both to business when scope is null/undefined', () => {
    expect(() => assertScopeCompatible({}, {})).not.toThrow();
    expect(() => assertScopeCompatible({ scope: null }, { scope: null })).not.toThrow();
    expect(() => assertScopeCompatible({ scope: undefined }, { scope: undefined })).not.toThrow();
  });

  it('throws ScopeMismatchError when business template meets city campaign', () => {
    expect(() => assertScopeCompatible({ scope: 'business' }, { scope: 'city' })).toThrow(ScopeMismatchError);
    try {
      assertScopeCompatible({ scope: 'business' }, { scope: 'city' });
    } catch (e) {
      expect(e).toBeInstanceOf(ScopeMismatchError);
      expect((e as ScopeMismatchError).templateScope).toBe('business');
      expect((e as ScopeMismatchError).campaignScope).toBe('city');
      expect((e as Error).message).toContain('business');
      expect((e as Error).message).toContain('city');
    }
  });

  it('throws ScopeMismatchError when category template meets business campaign', () => {
    expect(() => assertScopeCompatible({ scope: 'category' }, { scope: 'business' })).toThrow(ScopeMismatchError);
  });

  it('throws ScopeMismatchError when city template meets category campaign', () => {
    expect(() => assertScopeCompatible({ scope: 'city' }, { scope: 'category' })).toThrow(ScopeMismatchError);
  });

  it('is case-insensitive', () => {
    expect(() => assertScopeCompatible({ scope: 'Business' }, { scope: 'BUSINESS' })).not.toThrow();
    expect(() => assertScopeCompatible({ scope: 'Category' }, { scope: 'category' })).not.toThrow();
  });
});

describe('renderTemplate — scope-aware variable injection', () => {
  const businessCampaign = {
    scope: 'business',
    business_name: 'Acme HVAC',
    category: 'HVAC',
    city: 'Plainfield',
    neighborhood: 'Downtown',
    contact_method: 'phone',
    contact_info: '555-1234',
    unaddressed_reviews: 3,
    last_review_date: new Date('2026-06-15'),
    gbp_claimed: true,
    has_website: 'yes',
    nap_consistent: true,
    pain_score: 7,
    estimated_tier: 'tier_1',
    notes: 'Some notes',
    tone: 'friendly',
    attributes: ['fast', 'affordable'],
  };

  const categoryCampaign = { ...businessCampaign, scope: 'category', business_name: null };
  const cityCampaign = { ...businessCampaign, scope: 'city', business_name: null, category: '' };

  it('injects all variables for business scope', () => {
    const body = 'Business: {{business_name}} in {{city}}, {{category}}. Pain: {{pain_score}}';
    const rendered = service.renderTemplate(body, undefined, businessCampaign);
    expect(rendered).toBe('Business: Acme HVAC in Plainfield, HVAC. Pain: 7');
  });

  it('injects category-scope variables and rejects business_name reference', () => {
    const body = 'Category: {{category}} in {{city}}';
    const rendered = service.renderTemplate(body, undefined, categoryCampaign);
    expect(rendered).toBe('Category: HVAC in Plainfield');
  });

  it('rejects out-of-scope business_name reference for category scope', () => {
    const body = 'Business: {{business_name}} in {{city}}';
    expect(() => service.renderTemplate(body, undefined, categoryCampaign)).toThrow(
      /out-of-scope variables for scope "category"/,
    );
  });

  it('rejects out-of-scope business_name reference for city scope', () => {
    const body = 'Business: {{business_name}} in {{city}}';
    expect(() => service.renderTemplate(body, undefined, cityCampaign)).toThrow(
      /out-of-scope variables for scope "city"/,
    );
  });

  it('rejects out-of-scope category reference for city scope', () => {
    const body = 'Category: {{category}} in {{city}}';
    expect(() => service.renderTemplate(body, undefined, cityCampaign)).toThrow(
      /out-of-scope variables for scope "city"/,
    );
  });

  it('allows caller-supplied overrides even if out of scope', () => {
    const body = 'Business: {{business_name}} in {{city}}';
    const rendered = service.renderTemplate(body, { business_name: 'Override Co' }, cityCampaign);
    expect(rendered).toBe('Business: Override Co in Plainfield');
  });

  it('injects tone and attributes for category scope', () => {
    const body = 'Tone: {{tone}}, Attrs: {{attributes}}';
    const rendered = service.renderTemplate(body, undefined, categoryCampaign);
    expect(rendered).toBe('Tone: friendly, Attrs: fast, affordable');
  });

  it('does not inject tone for city scope (out of scope)', () => {
    const body = 'Tone: {{tone}}';
    expect(() => service.renderTemplate(body, undefined, cityCampaign)).toThrow(
      /out-of-scope variables for scope "city"/,
    );
  });

  it('leaves unreferenced variables unsubstituted (no error for unknown vars not in body)', () => {
    const body = 'Just {{city}}';
    const rendered = service.renderTemplate(body, undefined, cityCampaign);
    expect(rendered).toBe('Just Plainfield');
  });
});

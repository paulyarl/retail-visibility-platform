/**
 * PB-08 / A7 — Website Gap tests
 *
 * Covers the spec's test matrix (WEBSITE_GAP_AUDIT_PLAYBOOK_SPEC §10):
 *   - host classification (shared helper)
 *   - extractor derivation + friction suppression (§5)
 *   - A7 selection + A6 split + A7 primary severity (§7)
 *   - A7 field extraction
 *   - cascade: PB-08 claims each website-gap signal, PB-05 dual still wins
 *     defect+review, PB-03 fallback intact (§4)
 */

import { describe, it, expect } from 'vitest';
import { evaluateTriage } from '../TriageEngineService';
import { extractSignals } from '../signal-extractor';
import type { MatchingRules, PlaybookCatalogRow, SignalCode, SignalExtractorInput } from '../types';
import {
  isSocialPlatformHost,
  isBuilderSubdomainHost,
  hostnameOf,
  thirdPartyPlatformLabel,
} from '../website-host-classification';
import { selectArchetype } from '../../outreach-openers/archetype-selection';
import { computePrimarySignalSeverity } from '../../outreach-openers/signal-magnitude';
import { extractA7Fields, extractFields } from '../../outreach-openers/field-extractors';
import { isRepairSignal } from '../signal-taxonomy';

// ─── Fixtures ────────────────────────────────────────────────────────────

function rules(overrides: Partial<MatchingRules> = {}): MatchingRules {
  return { any: [], all: [], none: [], dual: null, confidence: 0.85, ...overrides };
}

function playbook(
  code: string,
  rank: number,
  archetype: string,
  category: string,
  matchingRules: MatchingRules,
): PlaybookCatalogRow {
  return {
    id: `pbk-${code.toLowerCase()}`,
    code: code as any,
    name: `Playbook ${code}`,
    category: category as any,
    archetype: archetype as any,
    archetypeLabel: `${archetype}_LABEL`,
    description: null,
    matchingRules,
    priorityRank: rank,
    fitdOfferTitle: `FITD ${code}`,
    fitdDefaultFeeCents: 10000,
    retainerPitchTitle: `Retainer ${code}`,
    retainerFeeCents: 20000,
    openerPromptTemplateId: null,
    previewDeliverableType: 'preview',
    isActive: true,
  };
}

const DEFECT_CODES = ['WC_UNSECURED_WEBSITE', 'WC_LEGACY_BUILDER_SITE', 'WC_STALE_WEBSITE', 'WC_POOR_SITE_QUALITY', 'WC_CATEGORY_MISMATCH'];
const PB05_GROUPA_BASE = ['CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_URL_MISMATCH', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK'];

/** The post-migration-303 cascade, in priority_rank order. */
function cascade303(): PlaybookCatalogRow[] {
  return [
    playbook('PB-04', 1, 'A2', 'recovery_management', rules({
      any: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_UNADDRESSED_NEGATIVE_BACKLOG'],
      confidence: 0.95,
    })),
    playbook('PB-05', 2, 'A5', 'triage_management', rules({
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
      dual: {
        groupA: [...PB05_GROUPA_BASE, ...DEFECT_CODES],
        groupB: ['RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      },
      confidence: 0.90,
    })),
    playbook('PB-01', 3, 'A3', 'profile_repair', rules({
      any: ['WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      confidence: 0.85,
    })),
    playbook('PB-02', 4, 'A1', 'review_management', rules({
      any: ['RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK', ...DEFECT_CODES],
      confidence: 0.85,
    })),
    playbook('PB-07', 5, 'A6', 'profile_repair', rules({
      any: ['DS_MISSING_PRODUCT_CATALOG', 'WC_MISSING_PRODUCT_BROWSING', 'WC_MISSING_AVAILABILITY_INQUIRY', 'WC_MISSING_PICKUP_DELIVERY'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_UNADDRESSED_NEGATIVE_BACKLOG'],
      confidence: 0.82,
    })),
    playbook('PB-06', 6, 'A3', 'profile_repair', rules({
      any: ['VP_MISSING_PROJECT_PHOTOS', 'VP_STALE_SOCIAL_ACTIVITY', 'DS_PHOTO_DEFICIT'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS', 'RA_REVIEW_DROUGHT', 'RA_LOW_REVIEW_VOLUME', 'RA_UNADDRESSED_NEGATIVE_BACKLOG', 'RA_UNADDRESSED_POSITIVE_BACKLOG', 'WC_URL_MISMATCH', 'CP_NAP_NAME_DRIFT', 'CP_NAP_ADDRESS_DRIFT', 'CP_NAP_PHONE_DRIFT', 'WC_BROKEN_WEBSITE', 'DS_BROKEN_PROFILE_LINK', ...DEFECT_CODES],
      confidence: 0.80,
    })),
    playbook('PB-08', 7, 'A7', 'profile_repair', rules({
      any: ['WC_MISSING_WEBSITE', 'WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN', 'WC_BROKEN_WEBSITE', 'WC_PARKED_DOMAIN', 'WC_UNFINISHED_SITE', 'WC_UNSECURED_WEBSITE', 'WC_LEGACY_BUILDER_SITE', 'WC_STALE_WEBSITE', 'WC_POOR_SITE_QUALITY', 'WC_CATEGORY_MISMATCH'],
      none: ['RA_BBB_GRADE_SUPPRESSION', 'RA_UNANSWERED_COMPLAINTS'],
      confidence: 0.88,
    })),
    playbook('PB-03', 8, 'A4', 'profile_repair', rules({
      any: ['WC_MISSING_CTA', 'WC_MISSING_SERVICE_PAGES', 'DS_MISSING_SERVICE_MENU', 'WC_MOBILE_FRICTION', 'WC_MISSING_WEBSITE'],
      confidence: 0.70,
    })),
  ];
}

function input(campaign: Partial<SignalExtractorInput['campaign']>, website: any): SignalExtractorInput {
  return {
    campaign: {
      unaddressed_reviews: 0,
      has_website: 'yes',
      website_url: website?.url ?? null,
      ...campaign,
    },
    auditData: { combined_review_metrics: { observable_unanswered_reviews: 0, observable_unanswered_rate_percent: 0, observable_unanswered_negative_reviews: 0 }, website } as any,
  };
}

// ─── Host classification ─────────────────────────────────────────────────

describe('website-host-classification', () => {
  it('matches social hosts with suffix tolerance', () => {
    expect(isSocialPlatformHost('https://facebook.com/page')).toBe(true);
    expect(isSocialPlatformHost('https://m.facebook.com/page')).toBe(true);
    expect(isSocialPlatformHost('wa.me/12345')).toBe(true);
    expect(isSocialPlatformHost('https://api.whatsapp.com/send')).toBe(true);
    expect(isSocialPlatformHost('https://example.com')).toBe(false);
  });

  it('matches builder subdomains', () => {
    expect(isBuilderSubdomainHost('https://myshop.wixsite.com/store')).toBe(true);
    expect(isBuilderSubdomainHost('https://mybiz.wordpress.com')).toBe(true);
    expect(isBuilderSubdomainHost('https://myshop.myshopify.com')).toBe(true);
    expect(isBuilderSubdomainHost('https://mybiz.com')).toBe(false);
  });

  it('normalizes hostnames and labels the platform', () => {
    expect(hostnameOf('https://www.Facebook.com/x')).toBe('facebook.com');
    expect(hostnameOf(null)).toBeNull();
    expect(thirdPartyPlatformLabel('https://m.facebook.com/x')).toBe('Facebook');
  });
});

// ─── Extractor derivation + suppression (§5) ─────────────────────────────

describe('signal-extractor — website gap derivation (§5)', () => {
  it('emits WC_THIRD_PARTY_DOMAIN for a social page and suppresses friction', () => {
    const signals = extractSignals(input({}, { url: 'https://facebook.com/mybusiness', status: 'social_media_only', call_to_action_present: 'no' }));
    expect(signals).toContain('WC_THIRD_PARTY_DOMAIN');
    expect(signals).not.toContain('WC_MISSING_WEBSITE');
    expect(signals).not.toContain('WC_MISSING_CTA'); // friction suppressed
  });

  it('emits WC_BUILDER_SUBDOMAIN for a free subdomain', () => {
    const signals = extractSignals(input({}, { url: 'https://myshop.wixsite.com/store', status: 'working', call_to_action_present: 'no' }));
    expect(signals).toContain('WC_BUILDER_SUBDOMAIN');
    expect(signals).not.toContain('WC_MISSING_CTA');
  });

  it('emits WC_UNSECURED_WEBSITE for an owned site over HTTP', () => {
    const signals = extractSignals(input({}, { url: 'https://owned.example.com', status: 'working', https: 'no', call_to_action_present: 'yes', click_to_call_available: 'yes' }));
    expect(signals).toContain('WC_UNSECURED_WEBSITE');
  });

  it('does NOT emit WC_UNSECURED_WEBSITE for a third-party host', () => {
    const signals = extractSignals(input({}, { url: 'https://facebook.com/x', status: 'social_media_only', https: 'no' }));
    expect(signals).not.toContain('WC_UNSECURED_WEBSITE');
  });

  it('keeps WC_BROKEN_WEBSITE evaluating for a dead third-party URL', () => {
    const signals = extractSignals(input({}, { url: 'https://facebook.com/deadpage', status: 'dead' }));
    // status 'dead' → websiteExists true (url present); broken still evaluates
    expect(signals).toContain('WC_BROKEN_WEBSITE');
  });

  it('does not derive gap codes when detected_signals[] is canonical', () => {
    const inp = input({}, { url: 'https://facebook.com/x', status: 'social_media_only' });
    (inp.auditData as any).detected_signals = [];
    const signals = extractSignals(inp);
    expect(signals).not.toContain('WC_THIRD_PARTY_DOMAIN');
  });

  // Campaign-column fallback — no audit website block, only the campaign's
  // website_url / has_website columns (e.g. a PB-08 sibling re-triaged before
  // its own audit lands). Host classification still applies.
  it('emits WC_THIRD_PARTY_DOMAIN when campaign.website_url is a social page (no audit)', () => {
    const signals = extractSignals(input(
      { website_url: 'https://facebook.com/mybusiness', has_website: 'yes' },
      null,
    ));
    expect(signals).toContain('WC_THIRD_PARTY_DOMAIN');
    expect(signals).not.toContain('WC_MISSING_WEBSITE');
  });

  it('emits WC_BUILDER_SUBDOMAIN when campaign.website_url is a builder subdomain (no audit)', () => {
    const signals = extractSignals(input(
      { website_url: 'https://myshop.wixsite.com/store', has_website: 'yes' },
      null,
    ));
    expect(signals).toContain('WC_BUILDER_SUBDOMAIN');
    expect(signals).not.toContain('WC_MISSING_WEBSITE');
  });

  it('still emits WC_MISSING_WEBSITE when no audit and no URL (genuine absence)', () => {
    const signals = extractSignals(input(
      { website_url: null, has_website: 'no' },
      null,
    ));
    expect(signals).toContain('WC_MISSING_WEBSITE');
    expect(signals).not.toContain('WC_THIRD_PARTY_DOMAIN');
  });
});

// ─── isRepairSignal ──────────────────────────────────────────────────────

describe('isRepairSignal — defect vs absence class', () => {
  it('treats defect-class website codes as repair signals', () => {
    for (const code of DEFECT_CODES) expect(isRepairSignal(code)).toBe(true);
  });
  it('leaves absence-class website codes out of repair semantics', () => {
    for (const code of ['WC_THIRD_PARTY_DOMAIN', 'WC_BUILDER_SUBDOMAIN', 'WC_PARKED_DOMAIN', 'WC_UNFINISHED_SITE', 'WC_MISSING_WEBSITE']) {
      expect(isRepairSignal(code)).toBe(false);
    }
  });
});

// ─── Cascade (§4) ────────────────────────────────────────────────────────

describe('cascade — PB-08 claims website-gap signals', () => {
  const cases: SignalCode[][] = [
    ['WC_MISSING_WEBSITE'],
    ['WC_THIRD_PARTY_DOMAIN'],
    ['WC_BUILDER_SUBDOMAIN'],
    ['WC_PARKED_DOMAIN'],
    ['WC_UNFINISHED_SITE'],
    ['WC_UNSECURED_WEBSITE'],
    ['WC_LEGACY_BUILDER_SITE'],
    ['WC_STALE_WEBSITE'],
    ['WC_POOR_SITE_QUALITY'],
    ['WC_CATEGORY_MISMATCH'],
    ['WC_BROKEN_WEBSITE'],
  ];
  for (const sig of cases) {
    it(`routes ${sig[0]} to PB-08`, () => {
      const rec = evaluateTriage(sig, cascade303());
      expect(rec?.playbookCode).toBe('PB-08');
      expect(rec?.archetype).toBe('A7');
    });
  }

  it('PB-05 dual still wins a defect-class signal + a review signal', () => {
    const rec = evaluateTriage(['WC_UNSECURED_WEBSITE', 'RA_REVIEW_DROUGHT'], cascade303());
    expect(rec?.playbookCode).toBe('PB-05');
  });

  it('PB-03 fallback is intact for CTA friction', () => {
    const rec = evaluateTriage(['WC_MISSING_CTA'], cascade303());
    expect(rec?.playbookCode).toBe('PB-03');
  });

  it('PB-03 still catches WC_MISSING_WEBSITE if PB-08 is inactive', () => {
    const pb = cascade303().filter((p) => p.code !== 'PB-08');
    const rec = evaluateTriage(['WC_MISSING_WEBSITE'], pb);
    expect(rec?.playbookCode).toBe('PB-03');
  });

  it('PB-02 none-guard blocks the defect-class codes (PB-08 wins when PB-05 is absent)', () => {
    const pb = cascade303().filter((p) => p.code !== 'PB-05');
    const rec = evaluateTriage(['RA_LOW_REVIEW_VOLUME', 'WC_STALE_WEBSITE'], pb);
    // PB-02 is blocked by its none guard; PB-08 claims the website code.
    expect(rec?.playbookCode).toBe('PB-08');
  });
});

// ─── A7 selection + severity + fields (§7) ───────────────────────────────

function audit(website: any, extra: any = {}) {
  return {
    combined_review_metrics: { observable_unanswered_reviews: 0, observable_unanswered_rate_percent: 0, observable_unanswered_negative_reviews: 0 },
    website,
    ...extra,
  } as any;
}

describe('selectArchetype — A7 website gap', () => {
  it('selects A7 for no website', () => {
    expect(selectArchetype(audit({ status: 'none_found' })).archetype).toBe('A7');
  });
  it('selects A7 for a social-page website', () => {
    expect(selectArchetype(audit({ url: 'https://facebook.com/x', status: 'social_media_only' })).archetype).toBe('A7');
  });
  it('selects A7 for a broken website', () => {
    expect(selectArchetype(audit({ url: 'https://x.com', status: 'broken' })).archetype).toBe('A7');
  });
  it('splits A6: a product business with no site routes to A7, not A6', () => {
    expect(selectArchetype(audit({ status: 'none_found' }, { business_type: 'product' })).archetype).toBe('A7');
  });
  it('keeps A6 for a product business whose site lacks product browsing', () => {
    expect(selectArchetype(audit({ url: 'https://x.com', status: 'working', has_product_browsing: false }, { business_type: 'product' })).archetype).toBe('A6');
  });
  it('A3 listing drift outranks A7', () => {
    const a = audit({ status: 'none_found' }, { nap_consistency: { overall_status: 'inconsistent', name_variations: ['A', 'B'] } });
    expect(selectArchetype(a).archetype).toBe('A3');
  });
});

describe('computePrimarySignalSeverity — A7', () => {
  it('crisis for no presence / third-party / broken', () => {
    expect(computePrimarySignalSeverity('A7', audit({ status: 'none_found' }))).toBe('crisis');
    expect(computePrimarySignalSeverity('A7', audit({ url: 'https://facebook.com/x', status: 'social_media_only' }))).toBe('crisis');
    expect(computePrimarySignalSeverity('A7', audit({ url: 'https://x.com', status: 'broken' }))).toBe('crisis');
  });
  it('material for a builder subdomain', () => {
    expect(computePrimarySignalSeverity('A7', audit({ url: 'https://x.wixsite.com/y', status: 'working' }))).toBe('material');
  });
  it('material for a parked domain (via detected_signals)', () => {
    expect(computePrimarySignalSeverity('A7', audit({ url: 'https://example.com', status: 'working' }, { detected_signals: ['WC_PARKED_DOMAIN'] }))).toBe('material');
  });
  it('borderline otherwise', () => {
    expect(computePrimarySignalSeverity('A7', audit({ url: 'https://example.com', status: 'working' }))).toBe('borderline');
  });
});

describe('extractA7Fields', () => {
  const common: any = { business_name: 'X', contact_name: null, tone: 'informal', city: null, state: null, phone: null, website_url: null, business_origin: null, triggered_signals: [], primary_signal_severity: 'crisis', strongest_co_occurring: null };

  it('classifies third_party_only and names the platform', () => {
    const f = extractA7Fields(audit({ url: 'https://m.facebook.com/x', status: 'social_media_only' }), common);
    expect(f.presence_class).toBe('third_party_only');
    expect(f.third_party_host).toBe('Facebook');
  });
  it('classifies builder_subdomain', () => {
    expect(extractA7Fields(audit({ url: 'https://x.wixsite.com/y', status: 'working' }), common).presence_class).toBe('builder_subdomain');
  });
  it('collects defect-class issues from triggered signals', () => {
    const c = { ...common, triggered_signals: [{ code: 'WC_STALE_WEBSITE', label: 'x', severity: 'material' }] };
    expect(extractA7Fields(audit({ url: 'https://example.com', status: 'working' }), c).issues).toEqual(['WC_STALE_WEBSITE']);
  });
  it('dispatches A7 through extractFields', () => {
    const f: any = extractFields('A7', audit({ status: 'none_found' }), common);
    expect(f.presence_class).toBe('no_presence');
  });
});

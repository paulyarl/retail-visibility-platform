import { describe, it, expect } from 'vitest';
import { surfaceHasReportableAudit, canSkipProspectReportProbe } from './OwnerReportSection';
import type { Audit, CampaignDetail } from '@/services/MarketingOpsService';

const asAudit = (a: Partial<Audit>): Audit => a as unknown as Audit;

describe('surfaceHasReportableAudit (Owner Report fetch gate)', () => {
  it('false on an empty audit list and on undefined', () => {
    expect(surfaceHasReportableAudit([])).toBe(false);
    expect(surfaceHasReportableAudit(undefined)).toBe(false);
  });

  it('false when the only business_analysis row is a discovery stub', () => {
    expect(
      surfaceHasReportableAudit([
        asAudit({
          platform: 'business_analysis',
          audit_data: {
            audit_metadata: { source: 'discovery_scan', verdict: 'partial' },
            detected_signals: ['DS_MISSING_PROFILE'],
            summary: 'Discovery scan verdict (partial)',
          },
        }),
      ]),
    ).toBe(false);
  });

  it('false on every stub source and on non-reportable platforms', () => {
    const stubSources = [
      'manual_queue',
      'queue_promotion',
      'derived_from_parent',
      'derived_from_city_scan',
      'discovery_scan',
    ];
    for (const source of stubSources) {
      expect(
        surfaceHasReportableAudit([
          asAudit({
            platform: 'business_analysis',
            audit_data: { audit_metadata: { source }, detected_signals: [] },
          }),
        ]),
      ).toBe(false);
    }
    expect(
      surfaceHasReportableAudit([
        asAudit({ platform: 'intelligence_discovery', audit_data: {} }),
        asAudit({ platform: 'category_identification', audit_data: {} }),
      ]),
    ).toBe(false);
  });

  it('true on a real business_analysis row (non-stub or no source)', () => {
    expect(
      surfaceHasReportableAudit([
        asAudit({
          platform: 'business_analysis',
          audit_data: { audit_metadata: { source: 'prompt_execution' }, summary: 'real' },
        }),
      ]),
    ).toBe(true);
    expect(
      surfaceHasReportableAudit([
        asAudit({ platform: 'business_analysis', audit_data: { summary: 'real' } }),
      ]),
    ).toBe(true);
  });

  it('true on a website_positioning row even alongside stubs', () => {
    expect(
      surfaceHasReportableAudit([
        asAudit({
          platform: 'business_analysis',
          audit_data: { audit_metadata: { source: 'queue_promotion' } },
        }),
        asAudit({ platform: 'website_positioning', audit_data: { summary: 'real' } }),
      ]),
    ).toBe(true);
  });

  it('false when audit_data is null even on a reportable platform', () => {
    expect(
      surfaceHasReportableAudit([
        asAudit({ platform: 'business_analysis', audit_data: null }),
      ]),
    ).toBe(false);
  });
});

describe('canSkipProspectReportProbe (sibling-aware fetch gate)', () => {
  const discoveryStub = asAudit({
    platform: 'business_analysis',
    audit_data: { audit_metadata: { source: 'discovery_scan' }, detected_signals: [] },
  });
  const realAudit = asAudit({
    platform: 'business_analysis',
    audit_data: { summary: 'real' },
  });
  const asCampaign = (
    c: Partial<Pick<CampaignDetail, 'audits' | 'businessProspectId' | 'hasSiblings' | 'hasAudit' | 'siblingHasAudit'>>,
  ) => c as CampaignDetail;

  it('probes when the payload has no audits field at all', () => {
    expect(canSkipProspectReportProbe(asCampaign({}))).toBe(false);
    expect(
      canSkipProspectReportProbe(
        asCampaign({ businessProspectId: 'bp-1', hasSiblings: false }),
      ),
    ).toBe(false);
  });

  it('skips a stub-only surface with no prospect group', () => {
    expect(
      canSkipProspectReportProbe(asCampaign({ audits: [discoveryStub] })),
    ).toBe(true);
  });

  it('skips a stub-only surface on a lone-primary prospect (hasSiblings=false)', () => {
    // The mcamp-2667i0oi case — primary flag set, zero actual siblings.
    expect(
      canSkipProspectReportProbe(
        asCampaign({
          audits: [discoveryStub],
          businessProspectId: 'bp-yj4dh71p',
          hasSiblings: false,
        }),
      ),
    ).toBe(true);
  });

  it('probes on a stub-only surface when siblings exist — the audit may live on a sibling', () => {
    expect(
      canSkipProspectReportProbe(
        asCampaign({
          audits: [discoveryStub],
          businessProspectId: 'bp-1',
          hasSiblings: true,
        }),
      ),
    ).toBe(false);
  });

  it('probes on a stub-only surface when sibling awareness is unknown', () => {
    expect(
      canSkipProspectReportProbe(
        asCampaign({ audits: [discoveryStub], businessProspectId: 'bp-1' }),
      ),
    ).toBe(false);
  });

  it('probes whenever a reportable audit is visible, siblings or not', () => {
    expect(
      canSkipProspectReportProbe(
        asCampaign({ audits: [discoveryStub, realAudit], hasSiblings: false }),
      ),
    ).toBe(false);
    expect(
      canSkipProspectReportProbe(
        asCampaign({ audits: [realAudit], businessProspectId: 'bp-1', hasSiblings: true }),
      ),
    ).toBe(false);
  });

  // Server-stamped flags take precedence — they see the WHOLE prospect
  // group (incl. schema validation the client can't replicate).
  it('flag-driven: siblingHasAudit=true probes even when this campaign is audit-less', () => {
    // The "load anyway regardless of which sibling produced it" case —
    // e.g. PB-05 primary (partial stub) viewing while PB-08 holds the full
    // website_positioning audit.
    expect(
      canSkipProspectReportProbe(
        asCampaign({
          audits: [discoveryStub],
          businessProspectId: 'bp-1',
          hasSiblings: true,
          hasAudit: false,
          siblingHasAudit: true,
        }),
      ),
    ).toBe(false);
  });

  it('flag-driven: hasAudit=true probes regardless', () => {
    expect(
      canSkipProspectReportProbe(
        asCampaign({ audits: [], hasAudit: true, siblingHasAudit: true, hasSiblings: true }),
      ),
    ).toBe(false);
  });

  it('flag-driven: hasAudit=false + siblingHasAudit=false skips — no sibling can produce a chapter', () => {
    // Both siblings audit-less, or only partials anywhere in the group.
    expect(
      canSkipProspectReportProbe(
        asCampaign({
          audits: [discoveryStub],
          businessProspectId: 'bp-1',
          hasSiblings: true,
          hasAudit: false,
          siblingHasAudit: false,
        }),
      ),
    ).toBe(true);
    // Lone-primary prospect (the mcamp-2667i0oi shape).
    expect(
      canSkipProspectReportProbe(
        asCampaign({
          audits: [discoveryStub],
          businessProspectId: 'bp-yj4dh71p',
          hasSiblings: false,
          hasAudit: false,
          siblingHasAudit: false,
        }),
      ),
    ).toBe(true);
  });
});

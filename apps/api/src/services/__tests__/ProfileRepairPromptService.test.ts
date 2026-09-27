/**
 * Unit tests for ProfileRepairPromptService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ProfileRepairPromptService,
  PROFILE_REPAIR_TRIAGE_TEMPLATE_ID,
  PROFILE_REPAIR_NAP_DRIFT_TEMPLATE_ID,
  PROFILE_REPAIR_UNCLAIMED_TEMPLATE_ID,
  PROFILE_REPAIR_PLATFORM_GAP_TEMPLATE_ID,
} from '../ProfileRepairPromptService';

describe('ProfileRepairPromptService', () => {
  let service: ProfileRepairPromptService;

  beforeEach(() => {
    service = ProfileRepairPromptService.getInstance();
  });

  describe('resolveSeekTemplateId', () => {
    it('returns triage template for null or unknown issue types', () => {
      expect(service.resolveSeekTemplateId(null)).toBe(PROFILE_REPAIR_TRIAGE_TEMPLATE_ID);
      expect(service.resolveSeekTemplateId(undefined)).toBe(PROFILE_REPAIR_TRIAGE_TEMPLATE_ID);
      expect(service.resolveSeekTemplateId('')).toBe(PROFILE_REPAIR_TRIAGE_TEMPLATE_ID);
      expect(service.resolveSeekTemplateId('suspension')).toBe(PROFILE_REPAIR_TRIAGE_TEMPLATE_ID);
      expect(service.resolveSeekTemplateId('unknown')).toBe(PROFILE_REPAIR_TRIAGE_TEMPLATE_ID);
    });

    it('returns specific seek templates for standard issue types', () => {
      expect(service.resolveSeekTemplateId('nap_drift')).toBe(PROFILE_REPAIR_NAP_DRIFT_TEMPLATE_ID);
      expect(service.resolveSeekTemplateId('unclaimed_profile')).toBe(PROFILE_REPAIR_UNCLAIMED_TEMPLATE_ID);
      expect(service.resolveSeekTemplateId('platform_gap')).toBe(PROFILE_REPAIR_PLATFORM_GAP_TEMPLATE_ID);
    });
  });

  describe('serializeSignals', () => {
    it('returns empty string for empty or invalid array', () => {
      expect(service.serializeSignals([])).toBe('');
      expect(service.serializeSignals(null as any)).toBe('');
    });

    it('maps raw signal codes to triage vocabulary and deduplicates', () => {
      const signals = [
        'CP_NAP_NAME_DRIFT',
        'CP_NAP_ADDRESS_DRIFT',
        'DS_CLAIMED_STATUS',
        'DS_PROFILE_SUSPENDED',
      ];
      const serialized = service.serializeSignals(signals);
      const terms = serialized.split('\n');
      expect(terms).toContain('nap_drift');
      expect(terms).toContain('unclaimed_profile');
      expect(terms).toContain('suspension');
      // nap_drift is deduped
      expect(terms.filter((t) => t === 'nap_drift').length).toBe(1);
    });

    it('ignores unknown signal codes safely', () => {
      const signals = ['UNKNOWN_CODE_XYZ', 'DS_DUPLICATE_LISTING'];
      const serialized = service.serializeSignals(signals);
      expect(serialized).toBe('duplicate_listing');
    });
  });

  describe('serializeAuditResults', () => {
    it('returns empty string for null audit data', () => {
      expect(service.serializeAuditResults(null)).toBe('');
      expect(service.serializeAuditResults(undefined)).toBe('');
    });

    it('formats NAP, platform, website, and detected signals into Markdown', () => {
      const auditData = {
        nap_consistency: {
          canonical_name: 'Acme HVAC',
          canonical_address: '123 Main St, Plainfield, IL',
          canonical_phone: '555-123-4567',
          material_issues: ['Phone differs on Apple Maps'],
        },
        platforms: {
          google: { profile_status: 'verified', displayed_name: 'Acme HVAC' },
          apple: { profile_status: 'unclaimed' },
        },
        website: {
          status: 'live',
          issues: ['SSL expired'],
        },
        detected_signals: ['CP_NAP_PHONE_DRIFT', 'DS_UNCLAIMED_PROFILE'],
      };

      const md = service.serializeAuditResults(auditData);
      expect(md).toContain('## Canonical NAP');
      expect(md).toContain('Acme HVAC');
      expect(md).toContain('Phone differs on Apple Maps');
      expect(md).toContain('## Platform Status');
      expect(md).toContain('google: verified (Acme HVAC)');
      expect(md).toContain('apple: unclaimed');
      expect(md).toContain('## Website');
      expect(md).toContain('SSL expired');
      expect(md).toContain('## Detected Signals');
      expect(md).toContain('- CP_NAP_PHONE_DRIFT');
    });

    it('marks a business_analysis audit FULL and folds render-control determinations into Platform Status', () => {
      const auditData = {
        platforms: {
          bbb: { profile_status: 'unable_to_verify' },
          google: { profile_status: 'active', displayed_name: 'Acme' },
        },
        render_controls: [
          { platform: 'bbb', determination: 'business_specific_failure', access_barrier: 'none' },
          { platform: 'google', determination: 'platform_available' },
        ],
        gap_analysis: { gaps: [{ platform: 'bbb', field: 'profile_presence', severity: 'non_negotiable', gap_description: 'No BBB record' }] },
      };

      const md = service.serializeAuditResults(auditData);
      expect(md).toContain('## Audit Coverage');
      expect(md).toContain('FULL — business analysis audit on file');
      expect(md).toContain('bbb: unable_to_verify · verified absent (render control confirmed)');
      expect(md).toContain('google: active (Acme) · rendered');
      expect(md).toContain('## Gap Analysis');
      expect(md).toContain('[non_negotiable] bbb.profile_presence — No BBB record');
    });

    it('serializes a category_identification audit as PARTIAL with the presence snapshot caveat', () => {
      const auditData = {
        business_name: 'Acme Market',
        primary_category: 'Grocery Store',
        primary_category_confidence: 'high',
        business_summary: 'Neighborhood grocer.',
        candidate_categories: [{ category: 'Grocery Store', confidence: 'high', is_known_category: true }],
        nap: { canonical_name: 'Acme Market', address_line1: '1 Main St', city: 'Milwaukee', state: 'WI', phone: '414-555-0000' },
        digital_footprint: {
          platforms_found: [
            { platform: 'google', claimed: false, rating: 4.2, review_count: 12, url: 'https://g.page/acme' },
          ],
          website_url: 'https://acme.example.com',
          website_status: 'working',
        },
      };

      const md = service.serializeAuditResults(auditData);
      expect(md).toContain('PARTIAL — category identification only');
      expect(md).toContain('## Platform Presence Snapshot');
      expect(md).toContain('google: unclaimed · 4.2 (12 reviews)');
      expect(md).toContain('Acme Market');
      expect(md).toContain('Grocery Store');
    });

    it('serializes a signal-stub audit as PARTIAL with provenance, never FULL', () => {
      const auditData = {
        audit_metadata: {
          business_name: 'Acme Market',
          source: 'discovery_scan',
          parent_campaign_id: 'mcamp-parent',
          verdict: 'partial',
        },
        detected_signals: ['DS_MISSING_PROFILE', 'WC_MISSING_WEBSITE'],
        discovery_signal_map: [
          { code: 'DS_MISSING_PROFILE', via: 'weakness_key', ref: 'single_platform_concentration', basis: 'only GBP found' },
          { code: 'WC_MISSING_WEBSITE', via: 'field', ref: 'website' },
        ],
        summary: 'Discovery scan verdict (partial) — 2 signals translated from discovery evidence.',
      };

      const md = service.serializeAuditResults(auditData);
      expect(md).toContain('PARTIAL — signal stub only (provenance: discovery_scan)');
      expect(md).not.toContain('FULL —');
      expect(md).toContain('## Detected Signals (translated upstream — unverified)');
      expect(md).toContain('- DS_MISSING_PROFILE');
      expect(md).toContain('## Signal Provenance');
      expect(md).toContain('weakness_key:single_platform_concentration');
      expect(md).toContain('verdict: partial');
    });

    it('emits a NONE coverage banner for an unknown-shape audit object', () => {
      const md = service.serializeAuditResults({});
      expect(md).toContain('NONE — no audit on file');
    });
  });

  describe('pickRepairSourceAudit', () => {
    it('prefers business_analysis over category_identification', () => {
      const ba = { platform: 'business_analysis', audit_data: { summary: 'x' } };
      const cat = { platform: 'category_identification', audit_data: { candidate_categories: [] } };
      expect(service.pickRepairSourceAudit([cat, ba])).toBe(ba);
      expect(service.pickRepairSourceAudit([cat])).toBe(cat);
      expect(service.pickRepairSourceAudit([])).toBeNull();
      expect(service.pickRepairSourceAudit(null)).toBeNull();
      expect(service.pickRepairSourceAudit([{ platform: 'website_positioning' }])).toBeNull();
    });

    it('skips stub business_analysis audits — a stub can neither mislabel itself nor shadow a real audit', () => {
      const stub = {
        platform: 'business_analysis',
        audit_data: {
          audit_metadata: { source: 'discovery_scan', verdict: 'partial' },
          detected_signals: ['DS_MISSING_PROFILE'],
        },
      };
      const realBa = { platform: 'business_analysis', audit_data: { summary: 'real audit' } };
      const cat = { platform: 'category_identification', audit_data: { candidate_categories: [] } };

      // Stub first in the list must not shadow the real audit.
      expect(service.pickRepairSourceAudit([stub, realBa])).toBe(realBa);
      // cat-id is the richer partial artifact — preferred over a stub.
      expect(service.pickRepairSourceAudit([stub, cat])).toBe(cat);
      // A lone stub is still usable evidence — it is the partial lane's carrier.
      expect(service.pickRepairSourceAudit([stub])).toBe(stub);
    });
  });

  describe('buildSeekVariables', () => {
    it('builds variables from campaign and audit signals', () => {
      const campaign = {
        id: 'camp-1',
        repair_issue_type: 'nap_drift',
        gbp_claimed: true,
        nap_consistent: false,
      };
      const latestAudit = {
        audit_data: {
          detected_signals: ['CP_NAP_NAME_DRIFT', 'DS_CLAIMED_STATUS'],
        },
      };

      const vars = service.buildSeekVariables(campaign, latestAudit);
      expect(vars.issue_type).toBe('nap_drift');
      expect(vars.audit_signals).toContain('nap_drift');
      expect(vars.audit_signals).toContain('unclaimed_profile');
    });

    it('handles legacy audits without detected_signals array via SignalExtractor', () => {
      const campaign = {
        id: 'camp-legacy',
        repair_issue_type: 'unclaimed_profile',
        gbp_claimed: false,
        nap_consistent: null,
      };
      const latestAudit = {
        audit_data: {
          // No detected_signals array
          nap_consistency: null,
        },
      };

      const vars = service.buildSeekVariables(campaign, latestAudit);
      expect(vars.issue_type).toBe('unclaimed_profile');
      expect(vars.audit_signals).toContain('unclaimed_profile');
    });
  });

  describe('buildFulfillVariables', () => {
    it('formats audit_results Markdown for citation package', async () => {
      const campaign = { id: 'camp-1' };
      const latestAudit = {
        audit_data: {
          nap_consistency: {
            canonical_name: 'Best Plumbing',
            canonical_address: '456 Oak St',
            canonical_phone: '555-9876',
          },
        },
      };

      const vars = await service.buildFulfillVariables(campaign, latestAudit);
      expect(vars.audit_results).toContain('## Canonical NAP');
      expect(vars.audit_results).toContain('Best Plumbing');
    });
  });

  describe('buildResolutionVariables', () => {
    it('builds resolution variables from campaign and intake', () => {
      const campaign = {
        id: 'camp-1',
        repair_issue_type: 'suspension',
      };
      const intake = {
        id: 'intake-123',
        owner_statement: 'My profile was suspended after I moved offices.',
        proposed_resolution: 'Reopen the profile with our new lease agreement.',
        evidence_payload: {
          proof_of_location: ['lease.pdf', 'utility.pdf'],
          google_profile_id: '123456789',
        },
        mkt_dispute_attachments: [
          { file_name: 'lease.pdf', file_type: 'application/pdf' },
        ],
      };

      const vars = service.buildResolutionVariables(campaign, intake);
      expect(vars.issueType).toBe('suspension');
      expect(vars.intakeId).toBe('intake-123');

      const parsedIntake = JSON.parse(vars.intakePayload);
      expect(parsedIntake.ownerStatement).toContain('suspended after I moved');

      const parsedEvidence = JSON.parse(vars.evidencePayload);
      expect(parsedEvidence.google_profile_id).toBe('123456789');

      const parsedAttachments = JSON.parse(vars.attachmentMeta);
      expect(parsedAttachments[0].fileName).toBe('lease.pdf');
    });
  });
});

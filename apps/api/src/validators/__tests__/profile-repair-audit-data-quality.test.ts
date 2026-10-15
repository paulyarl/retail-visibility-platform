/**
 * profile_repair_audit — the `data_quality` block.
 *
 * Every archetype briefing (A1–A8) emits this shape. `website_positioning` has
 * carried a `data_quality` block since its sprint, which is why the website
 * audit is the one briefing that qualifies its own figures ("content verified
 * from the served catalog payload, not a browser render"). `profile_repair_audit`
 * had no slot, so the archetype briefings asserted third-party mirror data as
 * settled fact — the Arsema A8 and A3 briefings both opened on "18 of your 21
 * five-star reviews" while the live profiles read 22 and 8.
 *
 * These tests pin the slot's existence, its optionality (older briefings must
 * still parse), and its presence in the rendered output contract.
 */
import { describe, it, expect } from 'vitest';
import {
  profileRepairAuditSchema,
  PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX,
} from '../profile-repair-output.schema';

const baseAudit = {
  severityScore: 7,
  issueType: 'nap_drift',
  scope: { summary: 's', affected_platforms: ['google'], specifics: 'x' },
  impact: { primary_consequence: 'p', estimated_reach_loss: 'h', competitive_gap: 'c' },
  pitch: { opener_hook: 'o', pain_points: ['a'], value_preview: 'v' },
  risks: ['r'],
  outreach_problems: [
    { problem: 'p', regular: 'r', hook: 'h', solution: 's', evidence: 'e', outreach_use: 'u' },
  ],
};

describe('profile_repair_audit data_quality', () => {
  it('still parses a briefing that omits the block', () => {
    expect(profileRepairAuditSchema.safeParse({ profile_repair_audit: baseAudit }).success).toBe(true);
  });

  it('keeps the block when present', () => {
    const result = profileRepairAuditSchema.safeParse({
      profile_repair_audit: {
        ...baseAudit,
        data_quality: {
          verified_fields: ['google primary category, from the served listing payload'],
          unavailable_fields: ['yelp render blocked on both business and control'],
          limitations: ['review counts sourced from third-party mirror cards, not verified against the live profile'],
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const dq = result.data.profile_repair_audit.data_quality;
      expect(dq?.limitations?.[0]).toMatch(/mirror/i);
      expect(dq?.unavailable_fields?.[0]).toMatch(/blocked/i);
    }
  });

  it('names data_quality in the output contract suffix', () => {
    expect(PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX).toContain('"data_quality"');
    expect(PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX).toContain('unavailable_fields');
    expect(PROFILE_REPAIR_AUDIT_PROMPT_SUFFIX).toContain('limitations');
  });
});

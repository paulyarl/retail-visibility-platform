import { describe, it, expect } from 'vitest';
import { resolveSocialPosting } from './SocialPostingResolver';

describe('resolveSocialPosting — LinkedIn', () => {
  it('grants linkedin via social_posting_flexible with no explicit key', () => {
    const r = resolveSocialPosting({ social_posting_enabled: true, social_posting_flexible: true }, null);
    expect(r.can_post_linkedin).toBe(true);
    expect(r.linkedin_enabled).toBe(true);
    expect(r.enabled).toBe(true);
  });

  it('grants linkedin via the explicit key without flexible', () => {
    const r = resolveSocialPosting({ social_posting_enabled: true, social_posting_linkedin: true }, null);
    expect(r.can_post_linkedin).toBe(true);
    expect(r.linkedin_enabled).toBe(true);
    // Other platforms stay gated
    expect(r.can_post_facebook).toBe(false);
    expect(r.enabled).toBe(true); // linkedin alone keeps the module on
  });

  it('keeps linkedin dark when only meta keys are granted', () => {
    const r = resolveSocialPosting({ social_posting_enabled: true, social_posting_meta: true }, null);
    expect(r.can_post_linkedin).toBe(false);
    expect(r.linkedin_enabled).toBe(false);
  });

  it('module off → linkedin off even with the key', () => {
    const r = resolveSocialPosting({ social_posting_linkedin: true }, null);
    expect(r.can_post_linkedin).toBe(false);
  });

  it('merchant soft toggle social_posting_linkedin_on=false disables posting but keeps hard gate', () => {
    const r = resolveSocialPosting(
      { social_posting_enabled: true, social_posting_linkedin: true },
      { social_posting_linkedin_on: false }
    );
    expect(r.can_post_linkedin).toBe(true);
    expect(r.linkedin_enabled).toBe(false);
  });

  it('master toggle off disables every surface including linkedin', () => {
    const r = resolveSocialPosting(
      { social_posting_enabled: true, social_posting_linkedin: true },
      { social_posting_enabled: false }
    );
    expect(r.linkedin_enabled).toBe(false);
  });
});

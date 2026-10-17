import { describe, it, expect } from 'vitest';
import { resolveGbpManagement } from './GbpManagementResolver';

describe('resolveGbpManagement', () => {
  it('returns disabled when no features are present', () => {
    const result = resolveGbpManagement({}, null);
    expect(result.enabled).toBe(false);
    expect(result.is_flexible).toBe(false);
    expect(result.can_show_reviews).toBe(false);
    expect(result.can_show_content).toBe(false);
    expect(result.can_use_ai_response).toBe(false);
    expect(result.can_use_posts_scheduler).toBe(false);
    expect(result.can_use_media_upload).toBe(false);
    expect(result.can_use_attributes).toBe(false);
    expect(result.reviews_enabled).toBe(false);
    expect(result.content_enabled).toBe(false);
  });

  it('enables all capabilities with gbp_management_flexible', () => {
    const result = resolveGbpManagement({ gbp_management_flexible: true }, null);
    expect(result.enabled).toBe(true);
    expect(result.is_flexible).toBe(true);
    expect(result.can_show_reviews).toBe(true);
    expect(result.can_show_content).toBe(true);
    expect(result.can_use_ai_response).toBe(true);
    expect(result.can_use_posts_scheduler).toBe(true);
    expect(result.can_use_media_upload).toBe(true);
    expect(result.can_use_attributes).toBe(true);
    expect(result.reviews_enabled).toBe(true);
    expect(result.content_enabled).toBe(true);
  });

  it('enables individual features without flexible', () => {
    const features = {
      gbp_directory_reviews: true,
      gbp_directory_content: true,
      gbp_ai_response: true,
      gbp_posts_scheduler: true,
      gbp_media_upload: true,
      gbp_attributes: true,
    };
    const result = resolveGbpManagement(features, null);
    expect(result.enabled).toBe(true);
    expect(result.is_flexible).toBe(false);
    expect(result.can_show_reviews).toBe(true);
    expect(result.can_show_content).toBe(true);
    expect(result.can_use_ai_response).toBe(true);
    expect(result.can_use_posts_scheduler).toBe(true);
    expect(result.can_use_media_upload).toBe(true);
    expect(result.can_use_attributes).toBe(true);
  });

  it('media upload / attributes are tier-level and never gated by merchant display prefs', () => {
    const features = { gbp_media_upload: true, gbp_attributes: true };
    const result = resolveGbpManagement(features, { gbp_reviews_display: false, gbp_content_display: false });
    expect(result.can_use_media_upload).toBe(true);
    expect(result.can_use_attributes).toBe(true);
  });

  it('respects merchant gate — reviews off hides reviews_enabled but not can_show_reviews', () => {
    const features = { gbp_directory_reviews: true };
    const result = resolveGbpManagement(features, { gbp_reviews_display: false });
    // Hard gate still passes
    expect(result.can_show_reviews).toBe(true);
    // Effective state is gated by merchant preference
    expect(result.reviews_enabled).toBe(false);
  });

  it('respects merchant gate — content off hides content_enabled but not can_show_content', () => {
    const features = { gbp_directory_content: true };
    const result = resolveGbpManagement(features, { gbp_content_display: false });
    expect(result.can_show_content).toBe(true);
    expect(result.content_enabled).toBe(false);
  });

  it('merchant gate defaults to true when prefs are null', () => {
    const features = { gbp_directory_reviews: true, gbp_directory_content: true };
    const result = resolveGbpManagement(features, null);
    expect(result.reviews_enabled).toBe(true);
    expect(result.content_enabled).toBe(true);
    expect(result.merchant_preferences.gbp_reviews_display).toBe(true);
    expect(result.merchant_preferences.gbp_content_display).toBe(true);
  });

  it('flexible key overrides individual feature checks but still respects merchant gate', () => {
    const result = resolveGbpManagement(
      { gbp_management_flexible: true },
      { gbp_reviews_display: false, gbp_content_display: true }
    );
    // Hard gate: flexible unlocks all
    expect(result.can_show_reviews).toBe(true);
    expect(result.can_show_content).toBe(true);
    // Effective: merchant gate applies
    expect(result.reviews_enabled).toBe(false);
    expect(result.content_enabled).toBe(true);
  });

  it('autopilot is opt-in — entitled but not opted in stays off', () => {
    const result = resolveGbpManagement({ gbp_ai_response: true }, { gbp_autopilot_enabled: false });
    expect(result.can_use_ai_response).toBe(true);
    expect(result.autopilot_enabled).toBe(false);
    expect(result.merchant_preferences.gbp_autopilot_enabled).toBe(false);
  });

  it('autopilot defaults to off and 5★ when no prefs exist', () => {
    const result = resolveGbpManagement({ gbp_ai_response: true }, null);
    expect(result.autopilot_enabled).toBe(false);
    expect(result.merchant_preferences.gbp_autopilot_min_rating).toBe(5);
  });

  it('autopilot turns on only when entitled AND opted in', () => {
    const result = resolveGbpManagement(
      { gbp_ai_response: true },
      { gbp_autopilot_enabled: true, gbp_autopilot_min_rating: 4 }
    );
    expect(result.autopilot_enabled).toBe(true);
    expect(result.merchant_preferences.gbp_autopilot_min_rating).toBe(4);
  });

  it('autopilot stays off when opted in but not entitled', () => {
    const result = resolveGbpManagement({}, { gbp_autopilot_enabled: true });
    expect(result.can_use_ai_response).toBe(false);
    expect(result.autopilot_enabled).toBe(false);
  });

  it('flexible tier + opt-in turns autopilot on', () => {
    const result = resolveGbpManagement(
      { gbp_management_flexible: true },
      { gbp_autopilot_enabled: true }
    );
    expect(result.autopilot_enabled).toBe(true);
  });
});

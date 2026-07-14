import { describe, it, expect } from 'vitest';
import { resolvePlatformServices } from './PlatformServiceResolver';

describe('resolvePlatformServices', () => {
  it('returns disabled when no features are present', () => {
    const result = resolvePlatformServices({});
    expect(result.enabled).toBe(false);
    expect(result.allowed_services).toEqual([]);
    expect(result.can_use_logo_design).toBe(false);
    expect(result.can_use_banner_design).toBe(false);
    expect(result.can_use_store_setup).toBe(false);
    expect(result.can_use_profile_setup).toBe(false);
    expect(result.can_use_seo_optimization).toBe(false);
    expect(result.can_use_social_media_kit).toBe(false);
    expect(result.is_flexible).toBe(false);
  });

  it('returns disabled when platform_services_disabled is true', () => {
    const features = {
      platform_service_logo_design: true,
      platform_services_disabled: true,
    };
    const result = resolvePlatformServices(features);
    expect(result.enabled).toBe(false);
    expect(result.allowed_services).toEqual(['logo_design']);
    expect(result.can_use_logo_design).toBe(false);
  });

  it('returns enabled when a service feature is purchased', () => {
    const features = { platform_service_logo_design: true };
    const result = resolvePlatformServices(features);
    expect(result.enabled).toBe(true);
    expect(result.allowed_services).toEqual(['logo_design']);
    expect(result.can_use_logo_design).toBe(true);
    expect(result.can_use_banner_design).toBe(false);
  });

  it('returns correct can_use_* flags for each service', () => {
    const features = {
      platform_service_logo_design: true,
      platform_service_banner_design: true,
      platform_service_store_setup: true,
      platform_service_profile_setup: true,
      platform_service_seo_optimization: true,
      platform_service_social_media_kit: true,
    };
    const result = resolvePlatformServices(features);
    expect(result.enabled).toBe(true);
    expect(result.allowed_services).toHaveLength(6);
    expect(result.can_use_logo_design).toBe(true);
    expect(result.can_use_banner_design).toBe(true);
    expect(result.can_use_store_setup).toBe(true);
    expect(result.can_use_profile_setup).toBe(true);
    expect(result.can_use_seo_optimization).toBe(true);
    expect(result.can_use_social_media_kit).toBe(true);
  });

  it('returns multiple services when multiple features are enabled', () => {
    const features = {
      platform_service_logo_design: true,
      platform_service_seo_optimization: true,
      platform_service_social_media_kit: true,
    };
    const result = resolvePlatformServices(features);
    expect(result.enabled).toBe(true);
    expect(result.allowed_services).toEqual(['logo_design', 'seo_optimization', 'social_media_kit']);
    expect(result.can_use_logo_design).toBe(true);
    expect(result.can_use_seo_optimization).toBe(true);
    expect(result.can_use_social_media_kit).toBe(true);
    expect(result.can_use_banner_design).toBe(false);
  });

  it('returns disabled with empty allowed_services when no individual services are purchased', () => {
    const features = { platform_services_enabled: true };
    const result = resolvePlatformServices(features);
    expect(result.enabled).toBe(false);
    expect(result.allowed_services).toEqual([]);
    expect(result.can_use_logo_design).toBe(false);
  });
});

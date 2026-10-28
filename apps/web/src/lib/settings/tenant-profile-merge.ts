import type { BusinessProfile } from '@/lib/validation/businessProfile';

type ProfileLike = Partial<BusinessProfile> | null | undefined;

/**
 * Merge the saved business profile over onboarding progress for the settings
 * card. The profile wins; onboarding fills the gaps.
 *
 * Every field the readiness score reads has to survive this merge. `hours` and
 * `seo_tags` were dropped here, so a tenant with hours on file still lost those
 * points on the card — the score has to describe the stored profile, not the
 * subset this view happens to render.
 */
export function mergeTenantProfile(profile: ProfileLike, onboarding: ProfileLike): BusinessProfile {
  const p = profile || {};
  const o = onboarding || {};

  return {
    business_name: p.business_name || o.business_name || '',
    address_line1: p.address_line1 || o.address_line1 || '',
    address_line2: p.address_line2 || o.address_line2 || '',
    city: p.city || o.city || '',
    state: p.state || o.state || '',
    postal_code: p.postal_code || o.postal_code || '',
    country_code: p.country_code || o.country_code || 'US',
    phone_number: p.phone_number || o.phone_number || '',
    email: p.email || o.email || '',
    website: p.website || o.website || '',
    contact_person: p.contact_person || o.contact_person || '',
    logo_url: p.logo_url || o.logo_url || '',
    business_description: p.business_description || o.business_description || '',
    social_links: p.social_links || o.social_links || {},
    hours: p.hours || o.hours || null,
    seo_tags: p.seo_tags || o.seo_tags || null,
    // `??` so a coordinate of 0 (equator / prime meridian) is not treated as missing.
    latitude: p.latitude ?? o.latitude ?? undefined,
    longitude: p.longitude ?? o.longitude ?? undefined,
    slug: p.slug || o.slug || '',
  };
}

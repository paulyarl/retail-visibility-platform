/**
 * PlatformBrandingService — announce-safe platform identification.
 *
 * The receipt loader (`loadPlatformBranding`) returns no social handles and
 * lives in a PDF module that imports `sharp`. The announce standard needs the
 * full identification block (name, staffed phone/email, address, social
 * handles) plus a dated fallback snapshot, so it gets its own reader.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §2.0 / §8 / §11 B5.
 */

import { prisma } from '../prisma';

/** The day the fallback surfaces were captured. Bump only after re-verifying
 *  that the fallback phone/email/socials are still active. */
export const ANNOUNCE_SNAPSHOT_DATE = '2026-10-19';

/** Static fallback — the receipt defaults, frozen on the snapshot day. */
const SNAPSHOT = {
  platformName: 'VisibleShelf',
  contactEmail: 'billing@visibleshelf.store',
  contactPhone: '(913) 703-6157',
  contactAddress: '',
  contactWebsite: 'https://visibleshelf.store',
  socials: [] as Array<{ platform: string; handle: string }>,
};

export interface AnnounceBranding {
  platformName: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactWebsite: string;
  socials: Array<{ platform: string; handle: string }>;
  snapshotDate: string;
  source: 'platform_settings' | 'snapshot';
  /** Required fields with no active surface — the announce is blocked. */
  missingRequired: string[];
  /** Social handles are part of the standard; a missing set is a warning. */
  missingSocial: boolean;
}

function socialsFrom(row: any): Array<{ platform: string; handle: string }> {
  if (!row) return [];
  return [
    ['facebook', row.social_facebook],
    ['twitter', row.social_twitter],
    ['instagram', row.social_instagram],
    ['linkedin', row.social_linkedin],
    ['youtube', row.social_youtube],
  ]
    .filter(([, handle]) => typeof handle === 'string' && handle.trim().length > 0)
    .map(([platform, handle]) => ({ platform, handle: String(handle).trim() }));
}

/**
 * Load the announce identification block. DB values win; the dated snapshot
 * fills only absent values. The caller records the returned values and
 * `snapshotDate` on the announce marker.
 */
export async function loadAnnounceBranding(): Promise<AnnounceBranding> {
  let row: any = null;
  try {
    row = await prisma.platform_settings_list.findFirst();
  } catch {
    // DB read failure falls through to the snapshot — the announce still
    // carries a complete, dated block.
  }

  const source: 'platform_settings' | 'snapshot' = row ? 'platform_settings' : 'snapshot';
  const platformName = row?.platform_name || SNAPSHOT.platformName;
  const contactEmail = row?.contact_email || SNAPSHOT.contactEmail;
  const contactPhone = row?.contact_phone || SNAPSHOT.contactPhone;
  const contactAddress = row?.contact_address || SNAPSHOT.contactAddress;
  const contactWebsite = row?.contact_website || SNAPSHOT.contactWebsite;
  const socials = socialsFrom(row);
  const effectiveSocials = socials.length > 0 ? socials : SNAPSHOT.socials;

  const missingRequired: string[] = [];
  if (!platformName.trim()) missingRequired.push('platform_name');
  if (!contactEmail.trim()) missingRequired.push('contact_email');
  if (!contactPhone.trim()) missingRequired.push('contact_phone');

  return {
    platformName,
    contactEmail,
    contactPhone,
    contactAddress,
    contactWebsite,
    socials: effectiveSocials,
    snapshotDate: ANNOUNCE_SNAPSHOT_DATE,
    source,
    missingRequired,
    missingSocial: effectiveSocials.length === 0,
  };
}

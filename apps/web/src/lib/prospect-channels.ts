import type { ProspectQueueEntry } from '@/services/MarketingOpsService';

/**
 * resolveProspectChannels — the prospect's reachable contact channels,
 * merged from every place they can live on a queue row:
 *
 *   1. campaign_* fields (present when the queue list ran with
 *      includeCampaigns) — the graduated campaign carries the verified
 *      phone/email/website/social values, so they win post-graduation.
 *   2. business_snapshot.verified_nap (then `nap`) — the verification call's
 *      authoritative capture.
 *   3. Flat snapshot keys (phone / business_phone / email / website /
 *      social_profiles) — the discovery scan's raw evidence.
 *   4. channel_sequence rung `contact` values — the operator-built ladder
 *      (call/sms rungs carry the phone, email the address, form the URL).
 *
 * The PG cockpit communications panel renders one row per channel; the
 * shared touch modal shows the same set so the operator can dial/copy
 * without leaving the log flow.
 */
export interface ProspectChannels {
  phone: string | null;
  email: string | null;
  website: string | null;
  socials: { platform: string; url: string }[];
  /** 'campaign' when any campaign_* field supplied a value — the verified
   *  channel set. 'snapshot' when only pre-campaign data exists. */
  source: 'campaign' | 'snapshot' | 'none';
}

function websiteUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as any).url === 'string') {
    return (value as any).url;
  }
  return '';
}

function rungContact(
  ladder: ProspectQueueEntry['channel_sequence'],
  channels: string[],
): string {
  if (!Array.isArray(ladder)) return '';
  const rung = ladder.find((r) => channels.includes(r.channel) && r.contact);
  return typeof rung?.contact === 'string' ? rung.contact : '';
}

function socialList(value: unknown): { platform: string; url: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((p: any) => ({
      platform: typeof p?.platform === 'string' ? p.platform : '',
      url: typeof p?.url === 'string' ? p.url : '',
    }))
    .filter((p) => p.url);
}

/** Minimal entry shape — ProspectQueueEntry satisfies it, and so does the
 *  communications page's ProspectSummary (queue id + business_snapshot). */
export type ProspectChannelSource = Partial<
  Pick<
    ProspectQueueEntry,
    | 'campaign_phone'
    | 'campaign_email'
    | 'campaign_website_url'
    | 'campaign_social_profiles'
    | 'channel_sequence'
    | 'current_channel_index'
  >
> & { business_snapshot?: Record<string, any> | null };

export function resolveProspectChannels(entry: ProspectChannelSource): ProspectChannels {
  const snap = (entry.business_snapshot ?? {}) as Record<string, any>;
  const nap = (snap.verified_nap ?? snap.nap ?? {}) as Record<string, any>;

  const campaignPhone = entry.campaign_phone ?? null;
  const campaignEmail = entry.campaign_email ?? null;
  const campaignWebsite = entry.campaign_website_url ?? null;
  const campaignSocials = socialList(entry.campaign_social_profiles);
  const fromCampaign = !!(campaignPhone || campaignEmail || campaignWebsite || campaignSocials.length);

  const phone =
    campaignPhone ||
    [nap.phone, snap.phone, snap.business_phone, rungContact(entry.channel_sequence, ['call', 'sms'])]
      .map((v) => String(v ?? '').trim())
      .find(Boolean) ||
    null;

  const email =
    campaignEmail ||
    [nap.email, snap.email, rungContact(entry.channel_sequence, ['email'])]
      .map((v) => String(v ?? '').trim())
      .find(Boolean) ||
    null;

  const website =
    campaignWebsite ||
    [nap.website, websiteUrl(snap.website), rungContact(entry.channel_sequence, ['form'])]
      .map((v) => String(v ?? '').trim())
      .find(Boolean) ||
    null;

  const socials = campaignSocials.length ? campaignSocials : socialList(snap.social_profiles);

  return {
    phone,
    email,
    website,
    socials,
    source: fromCampaign ? 'campaign' : phone || email || website || socials.length ? 'snapshot' : 'none',
  };
}

import type {
  CampaignDetail,
  GalleryEligibility,
  GalleryToken,
  MailerQrDestination,
} from '@/services/MarketingOpsService';

/**
 * Postal mailer QR destinations (Outreach Kit tab).
 *
 * Minting a *new* diagnostic gallery link needs the campaign to be
 * gallery-eligible (preview_built|shown + at least one screenshot + a
 * resolvable archetype). Encoding an *existing* link does not — a seek/seed
 * campaign that minted at preview_built still has a live gallery to send
 * people to. That is why the gallery destination is offered whenever live
 * links exist, eligible or not, and why the picker is the token-aware half of
 * the option.
 */
export const MAILER_DESTINATION_OPTIONS: { value: MailerQrDestination; label: string }[] = [
  { value: 'auto', label: 'Auto (best available)' },
  { value: 'diagnostic_gallery', label: 'Diagnostic gallery link' },
  { value: 'claim', label: 'Claim link' },
  { value: 'portal', label: 'Customer portal' },
  { value: 'site', label: 'Website homepage' },
  { value: 'custom', label: 'Custom URL' },
];

/** Links a QR can still encode — unconverted and unexpired. */
export function filterLiveGalleryTokens(tokens: GalleryToken[], now: number = Date.now()): GalleryToken[] {
  return tokens.filter(
    (t) => !t.converted_at && (!t.expires_at || new Date(t.expires_at).getTime() > now),
  );
}

/** Whether a fresh gallery link can be minted (the eligibility gate). */
export function canMintGalleryLink(eligibility: GalleryEligibility | null): boolean {
  return eligibility?.eligible === true;
}

export interface MailerDestinationContext {
  eligibility: GalleryEligibility | null;
  liveGalleryTokens: GalleryToken[];
  campaign: Pick<CampaignDetail, 'email' | 'customer_id' | 'date_paid'>;
}

/**
 * Destinations that can actually resolve for this campaign. The server still
 * validates hard at resolve/generate time — the omission here is advisory, so
 * the operator can't pick a target that would 400.
 */
export function resolveMailerDestinations({
  eligibility,
  liveGalleryTokens,
  campaign,
}: MailerDestinationContext): { value: MailerQrDestination; label: string }[] {
  return MAILER_DESTINATION_OPTIONS.filter((opt) => {
    switch (opt.value) {
      case 'diagnostic_gallery':
        return canMintGalleryLink(eligibility) || liveGalleryTokens.length > 0;
      case 'claim':
        // Mirrors the auto-path precondition — issueClaimToken only mints for
        // a paid, unclaimed campaign email.
        return !!campaign.email && !campaign.customer_id && !!campaign.date_paid;
      case 'portal':
        return !!campaign.customer_id;
      default:
        return true;
    }
  });
}

/**
 * Gallery link to preselect when the destination switches to the gallery: the
 * newest live link when the campaign can't mint, since the "reuse or mint"
 * sentinel would 400 on an ineligible campaign. Empty string keeps the
 * sentinel for mint-eligible campaigns.
 */
export function defaultGalleryTokenId(
  eligibility: GalleryEligibility | null,
  liveGalleryTokens: GalleryToken[],
): string {
  return canMintGalleryLink(eligibility) ? '' : liveGalleryTokens[0]?.id ?? '';
}

/** Picker label — the short code the operator sees in the Gallery Links panel. */
export function galleryTokenLabel(token: GalleryToken): string {
  const parts = [token.short_code ? `/g/${token.short_code}` : `…${token.token.slice(-8)}`];
  if (token.viewed_at) parts.push('viewed');
  if (token.expires_at) parts.push(`exp ${new Date(token.expires_at).toLocaleDateString()}`);
  return parts.join(' · ');
}

'use client';

import { useState } from 'react';
import { Phone, Mail, Globe, Share2, Sparkles, ExternalLink, RefreshCw, MapPin, User, Store, Star, CheckCircle, XCircle, HelpCircle, ListChecks } from 'lucide-react';
import type { Campaign } from '@/services/MarketingOpsService';
import { marketingOpsService } from '@/services/MarketingOpsService';

/**
 * BusinessContactCard — Overview tab block showing each contact channel with
 * its outreach affordance (Text / Email / Open Contact Form / Open DM).
 *
 * Visible before `preview_built` so operators have the right channel at hand
 * the moment they reach the outreach stages. Includes an "Enrich from GBP"
 * button that calls the Places-backed enrichment endpoint (Sprint 1 Task 2).
 *
 * Empty rows show "—" with a muted "Add in Edit" hint.
 */
interface BusinessContactCardProps {
  campaign: Campaign;
  onEnriched?: () => void;
}

export default function BusinessContactCard({ campaign, onEnriched }: BusinessContactCardProps) {
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichSource, setEnrichSource] = useState<string | null>(null);

  const handleEnrich = async (force: boolean) => {
    setEnriching(true);
    setEnrichError(null);
    try {
      const result = await marketingOpsService.enrichContact(campaign.id, { force });
      setEnrichSource(result.source);
      onEnriched?.();
    } catch (err: any) {
      setEnrichError(err.message || 'Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  const phone = campaign.phone;
  const email = campaign.email;
  const website = campaign.website_url;
  const socials = campaign.social_profiles ?? [];
  const ownerNames = campaign.owner_names ?? [];
  const additionalPhones = campaign.phones ?? [];
  const directoryProfiles = campaign.directory_profiles ?? [];

  // Compose a single display string for the structured address.
  const addressParts: string[] = [];
  if (campaign.address_line1) {
    addressParts.push(campaign.address_line1 + (campaign.address_line2 ? `, ${campaign.address_line2}` : ''));
  }
  const cityStateZip = [campaign.address_city, campaign.address_state, campaign.address_zip]
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*,/g, ', ')
    .trim();
  if (cityStateZip) addressParts.push(cityStateZip);
  if (campaign.address_country && campaign.address_country !== 'US') {
    addressParts.push(campaign.address_country);
  }
  const addressString = addressParts.join(', ') || null;

  // Google Maps directions link from the structured address.
  const mapsQuery = [
    campaign.address_line1,
    campaign.address_line2,
    campaign.address_city,
    campaign.address_state,
    campaign.address_zip,
    campaign.address_country,
  ].filter(Boolean).join(', ');
  const mapsHref = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Business Contact</h3>
        <button
          type="button"
          onClick={() => handleEnrich(false)}
          disabled={enriching}
          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          {enriching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Enrich from GBP
        </button>
      </div>

      {enrichError && (
        <div className="mb-3 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {enrichError}
        </div>
      )}
      {enrichSource && enrichSource !== 'already_populated' && (
        <div className="mb-3 rounded-md bg-green-50 px-2 py-1 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
          Enriched via {enrichSource === 'places_api' ? 'Google Places API' : enrichSource === 'cache' ? 'cached lookup' : enrichSource}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ContactRow
          icon={<Store className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
          label="Business Name"
          value={campaign.business_name}
        />
        {ownerNames.length > 0 ? (
          ownerNames.map((name, idx) => (
            <ContactRow
              key={`owner-${idx}-${name}`}
              icon={<User className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
              label={ownerNames.length > 1 ? `Owner ${idx + 1}` : 'Business Owner'}
              value={name}
            />
          ))
        ) : (
          <ContactRow
            icon={<User className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
            label="Business Owner"
            value={null}
          />
        )}
        <ContactRow
          icon={<MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
          label="Address"
          value={addressString}
          action={mapsHref ? { href: mapsHref, label: 'Maps', icon: <ExternalLink className="h-3 w-3" />, external: true } : undefined}
        />
        <ContactRow
          icon={<Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
          label="Primary Phone"
          value={phone}
          action={phone ? { href: `sms:${phone}`, label: 'Text', icon: <Phone className="h-3 w-3" /> } : undefined}
        />
        {additionalPhones.map((p, idx) => (
          <ContactRow
            key={`phone-${idx}-${p.number}`}
            icon={<Phone className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
            label={p.label || `Phone ${idx + 2}`}
            value={p.number}
            action={p.number ? { href: `sms:${p.number}`, label: 'Text', icon: <Phone className="h-3 w-3" /> } : undefined}
          />
        ))}
        <ContactRow
          icon={<Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
          label="Email"
          value={email}
          action={email ? { href: `mailto:${email}`, label: 'Email', icon: <Mail className="h-3 w-3" /> } : undefined}
        />
        <ContactRow
          icon={<Globe className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
          label="Website"
          value={website}
          action={website ? { href: website, label: 'Open', icon: <ExternalLink className="h-3 w-3" />, external: true } : undefined}
        />
        {socials.length > 0 ? (
          socials.map((sp) => (
            <ContactRow
              key={`${sp.platform}-${sp.url}`}
              icon={<Share2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
              label={sp.platform || 'Social'}
              value={sp.url}
              action={sp.url ? { href: sp.url, label: 'Open', icon: <ExternalLink className="h-3 w-3" />, external: true } : undefined}
            />
          ))
        ) : (
          <ContactRow
            icon={<Share2 className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
            label="Social"
            value={null}
          />
        )}
      </div>

      {directoryProfiles.length > 0 && (
        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Directory Profiles</h4>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {directoryProfiles.map((dp, idx) => {
              const platformLabel = DIRECTORY_PLATFORM_LABELS[dp.platform] || dp.platform || 'Unknown';
              const claimIcon = dp.claim_status === 'claimed'
                ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                : dp.claim_status === 'unclaimed'
                  ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                  : <HelpCircle className="h-3.5 w-3.5 text-gray-400" />;
              const claimLabel = dp.claim_status === 'claimed' ? 'Claimed' : dp.claim_status === 'unclaimed' ? 'Unclaimed' : 'Unknown';
              const ratingText = dp.star_rating != null
                ? `${dp.star_rating.toFixed(1)}★`
                : null;
              const reviewText = dp.review_count != null
                ? `${dp.review_count} reviews`
                : null;
              const summary = [ratingText, reviewText].filter(Boolean).join(' · ') || null;
              return (
                <div key={`dp-${idx}`} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {claimIcon}
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{platformLabel}</span>
                    </div>
                    {dp.url && (
                      <a href={dp.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400">
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{claimLabel}</span>
                    {summary && <span>· {summary}</span>}
                    {dp.category && <span>· {dp.category}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const DIRECTORY_PLATFORM_LABELS: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  yellow_pages: 'Yellow Pages',
  apple_maps: 'Apple Maps',
  bbb: 'BBB',
  mapquest: 'MapQuest',
  yahoo_local: 'Yahoo Local',
  other: 'Other',
};

interface ContactRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  action?: { href: string; label: string; icon: React.ReactNode; external?: boolean };
}

function ContactRow({ icon, label, value, action }: ContactRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50">
      <div className="flex items-center gap-2 overflow-hidden">
        {icon}
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
          {value ? (
            <div className="truncate text-sm text-gray-900 dark:text-gray-100">{value}</div>
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500">— <span className="text-xs">Add in Edit</span></div>
          )}
        </div>
      </div>
      {action && value && (
        <a
          href={action.href}
          target={action.external ? '_blank' : undefined}
          rel={action.external ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:bg-gray-700 dark:text-blue-300 dark:hover:bg-gray-600"
        >
          {action.icon}
          {action.label}
        </a>
      )}
    </div>
  );
}

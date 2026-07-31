'use client';

import { useState } from 'react';
import { Phone, Mail, Globe, Share2, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
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
          icon={<Phone className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
          label="Phone"
          value={phone}
          action={phone ? { href: `sms:${phone}`, label: 'Text', icon: <Phone className="h-3 w-3" /> } : undefined}
        />
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
              action={{ href: sp.url, label: 'Open DM', icon: <ExternalLink className="h-3 w-3" />, external: true }}
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
    </div>
  );
}

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

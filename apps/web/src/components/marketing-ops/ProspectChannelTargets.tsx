'use client';

/**
 * ProspectChannelTargets — the value behind each contact channel the prospect
 * is reachable on, with a direct action link (Call / Text / Email / Open).
 *
 * Extracted from LogContactModal so the two surfaces that show a prospect's
 * reachable channels — the Log Contact modal and the Outreach Prep worksheet
 * tab — cannot drift. The modal passes `onSelect`, which also makes each row
 * select that channel for the log entry; the worksheet tab omits it, so the
 * rows are plain reference rather than controls.
 */

import { Phone, Mail, Globe, Share2 } from 'lucide-react';
import type { Campaign, ContactChannel } from '@/services/MarketingOpsService';

export interface ChannelTarget {
  key: string;
  channel: ContactChannel;
  icon: React.ReactNode;
  label: string;
  value: string;
  links: { href: string; label: string; external?: boolean }[];
}

/**
 * Build the reachable-channel rows for a campaign. Pure — exported so the row
 * contract is unit-testable without rendering.
 */
export function buildChannelTargets(campaign: Campaign): ChannelTarget[] {
  const targets: ChannelTarget[] = [];
  const pushPhoneTarget = (key: string, label: string, number: string) =>
    targets.push({
      key,
      channel: 'phone',
      icon: <Phone className="h-3.5 w-3.5 text-gray-400" />,
      label,
      value: number,
      links: [
        { href: `tel:${number}`, label: 'Call' },
        { href: `sms:${number}`, label: 'Text' },
      ],
    });

  if (campaign.phone) pushPhoneTarget('phone', 'Phone', campaign.phone);
  (campaign.phones ?? []).forEach((p, i) => {
    if (p.number) pushPhoneTarget(`phone-${i}`, p.label || 'Phone', p.number);
  });
  if (campaign.email) {
    targets.push({
      key: 'email',
      channel: 'email',
      icon: <Mail className="h-3.5 w-3.5 text-gray-400" />,
      label: 'Email',
      value: campaign.email,
      links: [{ href: `mailto:${campaign.email}`, label: 'Email' }],
    });
  }
  if (campaign.website_url) {
    targets.push({
      key: 'website',
      channel: 'website',
      icon: <Globe className="h-3.5 w-3.5 text-gray-400" />,
      label: 'Website',
      value: campaign.website_url,
      links: [{ href: campaign.website_url, label: 'Open', external: true }],
    });
  }
  (campaign.social_profiles ?? []).forEach((sp, i) => {
    if (sp.url) {
      targets.push({
        key: `social-${i}`,
        channel: 'social',
        icon: <Share2 className="h-3.5 w-3.5 text-gray-400" />,
        label: sp.platform || 'Social',
        value: sp.url,
        links: [{ href: sp.url, label: 'Open', external: true }],
      });
    }
  });

  return targets;
}

export default function ProspectChannelTargets({
  campaign,
  onSelect,
  activeChannel,
}: {
  campaign: Campaign;
  /** When provided, each row becomes a button that selects that channel. */
  onSelect?: (channel: ContactChannel) => void;
  /** Highlights the row for the currently-selected channel. */
  activeChannel?: ContactChannel;
}) {
  const targets = buildChannelTargets(campaign);
  if (targets.length === 0) return null;

  return (
    <div className="rounded-md border border-gray-200 divide-y divide-gray-100 dark:border-gray-700 dark:divide-gray-800">
      {targets.map((t) => (
        <div
          key={t.key}
          className={`flex items-center gap-2 px-3 py-1.5 ${
            activeChannel === t.channel ? 'bg-blue-50 dark:bg-blue-900/20' : ''
          }`}
        >
          {onSelect ? (
            <button
              type="button"
              onClick={() => onSelect(t.channel)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              title={`Log a ${t.label.toLowerCase()} contact`}
            >
              {t.icon}
              <span className="w-14 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t.label}
              </span>
              <span className="truncate text-xs text-gray-800 dark:text-gray-200">{t.value}</span>
            </button>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {t.icon}
              <span className="w-14 flex-shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t.label}
              </span>
              <span className="truncate text-xs text-gray-800 dark:text-gray-200">{t.value}</span>
            </div>
          )}
          <span className="flex flex-shrink-0 items-center gap-1">
            {t.links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
              >
                {l.label}
              </a>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

'use client';

/**
 * ProspectChannelTargets — the value behind each contact channel the prospect
 * is reachable on, with a direct action link (Call / Text / Email / Open).
 *
 * The single shared block for the three surfaces that show reachable channels:
 * the Log Contact modal, the Outreach Prep worksheet tab, and the Log Touch
 * modal. Campaign-backed surfaces pass a `Campaign`; queue/seed surfaces pass
 * the `resolveProspectChannels` result. Same rows, same actions, no drift.
 *
 * The modal passes `onSelect`, which also makes each row select that channel
 * for the log entry; the worksheet tab omits it, so the rows are plain
 * reference rather than controls.
 */

import { Phone, Mail, Globe, Share2 } from 'lucide-react';
import type { Campaign, ContactChannel } from '@/services/MarketingOpsService';
import type { ProspectChannels } from '@/lib/prospect-channels';

export interface ChannelTarget {
  key: string;
  channel: ContactChannel;
  icon: React.ReactNode;
  label: string;
  value: string;
  links: { href: string; label: string; external?: boolean }[];
}

export interface ChannelTargetSource {
  phone?: string | null;
  phones?: Array<{ number?: string | null; label?: string | null }> | null;
  email?: string | null;
  website?: string | null;
  socials?: Array<{ platform?: string | null; url: string }> | null;
}

/**
 * Build the reachable-channel rows from the normalized source. Pure — exported
 * so the row contract is unit-testable without rendering.
 */
export function buildChannelTargetsFromSource(source: ChannelTargetSource): ChannelTarget[] {
  const targets: ChannelTarget[] = [];
  const pushPhone = (key: string, label: string, number: string) =>
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

  if (source.phone) pushPhone('phone', 'Phone', source.phone);
  (source.phones ?? []).forEach((p, i) => {
    if (p.number) pushPhone(`phone-${i}`, p.label || 'Phone', p.number);
  });
  if (source.email) {
    targets.push({
      key: 'email',
      channel: 'email',
      icon: <Mail className="h-3.5 w-3.5 text-gray-400" />,
      label: 'Email',
      value: source.email,
      links: [{ href: `mailto:${source.email}`, label: 'Email' }],
    });
  }
  if (source.website) {
    targets.push({
      key: 'website',
      channel: 'website',
      icon: <Globe className="h-3.5 w-3.5 text-gray-400" />,
      label: 'Website',
      value: source.website,
      links: [{ href: source.website, label: 'Open', external: true }],
    });
  }
  (source.socials ?? []).forEach((sp, i) => {
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

/** Campaign-backed surfaces (Log Contact, Outreach Prep). */
export function buildChannelTargets(campaign: Campaign): ChannelTarget[] {
  return buildChannelTargetsFromSource({
    phone: campaign.phone,
    phones: campaign.phones,
    email: campaign.email,
    website: campaign.website_url,
    socials: (campaign.social_profiles ?? []).map((sp) => ({
      platform: sp.platform,
      url: sp.url,
    })),
  });
}

/** Queue/seed surfaces (Log Touch) — the same rows from the resolved channels. */
export function buildChannelTargetsFromChannels(channels: ProspectChannels): ChannelTarget[] {
  return buildChannelTargetsFromSource({
    phone: channels.phone,
    email: channels.email,
    website: channels.website,
    socials: channels.socials,
  });
}

export default function ProspectChannelTargets({
  campaign,
  channels,
  onSelect,
  activeChannel,
}: {
  campaign?: Campaign;
  /** Queue/seed path — takes precedence when provided. */
  channels?: ProspectChannels;
  /** When provided, each row becomes a button that selects that channel. */
  onSelect?: (channel: ContactChannel) => void;
  /** Highlights the row for the currently-selected channel. */
  activeChannel?: ContactChannel;
}) {
  const targets = channels
    ? buildChannelTargetsFromChannels(channels)
    : campaign
      ? buildChannelTargets(campaign)
      : [];
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

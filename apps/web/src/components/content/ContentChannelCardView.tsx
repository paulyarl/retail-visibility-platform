'use client';

/**
 * ContentChannelCardView — presentational card for one content channel.
 * Plain tailwind + next/link only (no Mantine) so it server-renders in the
 * node-env vitest suite without a provider.
 */

import Link from 'next/link';
import {
  STATE_META,
  metricSummary,
  editorHref,
  type ContentChannelCard,
  type QuickLever,
} from '@/lib/content-hub';

export interface ContentChannelCardViewProps {
  card: ContentChannelCard;
  tenantId: string;
  /** Called when a quick lever is flipped; undefined disables lever interaction. */
  onToggleLever?: (lever: QuickLever) => void;
  leverBusy?: string | null;
}

export default function ContentChannelCardView({ card, tenantId, onToggleLever, leverBusy }: ContentChannelCardViewProps) {
  const meta = STATE_META[card.state];
  const locked = card.state === 'locked' || card.state === 'dark';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{card.label}</h3>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {card.rendersOn.join(' · ')}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-2 py-0.5 shrink-0 ${meta.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      <div className="text-sm text-gray-600">
        {metricSummary(card)}
        {card.detail ? <span className="text-gray-400"> — {card.detail}</span> : null}
      </div>
      {card.freshness ? (
        <div className="text-xs text-gray-400 -mt-1">
          Last published {new Date(card.freshness).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </div>
      ) : null}

      {card.quickLevers && card.quickLevers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {card.quickLevers.map((lever) => (
            <button
              key={lever.key}
              type="button"
              disabled={!lever.available || !onToggleLever || leverBusy === lever.key}
              onClick={() => onToggleLever?.(lever)}
              title={lever.available ? `Toggle ${lever.label}` : `${lever.label} — requires an upgrade`}
              className={`text-xs border rounded-full px-2.5 py-1 transition-colors ${
                lever.available
                  ? lever.value
                    ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                  : 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
              } ${leverBusy === lever.key ? 'opacity-50' : ''}`}
            >
              {lever.label}
            </button>
          ))}
        </div>
      ) : null}

      {card.nudge ? <p className="text-xs text-amber-600">{card.nudge}</p> : null}

      <div className="mt-auto pt-1">
        {locked ? (
          <span className="text-xs text-gray-400">
            {card.state === 'dark' ? 'In pilot' : 'Upgrade to unlock'}
          </span>
        ) : (
          <Link
            href={editorHref(card, tenantId)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Manage →
          </Link>
        )}
      </div>
    </div>
  );
}

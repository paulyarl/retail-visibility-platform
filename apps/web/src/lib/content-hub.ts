/**
 * Content Hub — shared types + pure helpers for /t/[tenantId]/content.
 *
 * Spec: docs/LocalBiz/TENANT_CONTENT_HUB_SPEC.md. The API route
 * `GET /api/tenants/:tenantId/content/summary` emits `ContentSummaryPayload`;
 * these helpers derive display state from it (kept pure + exported so the
 * node-env vitest suite can pin the mapping without rendering).
 */

export type ContentChannelState = 'empty' | 'active' | 'locked' | 'dark';

export interface QuickLever {
  key: string;
  label: string;
  value: boolean;
  available: boolean;
}

export interface ContentChannelCard {
  key: string;
  label: string;
  rendersOn: string[];
  state: ContentChannelState;
  metrics: Record<string, number>;
  detail?: string;
  freshness?: string | null;
  capability: { enabled: boolean; flexible: boolean };
  editorHref: string;
  quickLevers?: QuickLever[];
  nudge?: string;
}

export interface ContentSummaryPayload {
  surfaces: { live: number; total: number };
  channels: ContentChannelCard[];
  meta?: { tierKey?: string };
}

export const STATE_META: Record<ContentChannelState, { label: string; dot: string; badge: string }> = {
  active: { label: 'Live', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  empty: { label: 'Not started', dot: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  locked: { label: 'Locked', dot: 'bg-gray-300', badge: 'bg-gray-50 text-gray-500 border-gray-200' },
  dark: { label: 'Coming soon', dot: 'bg-violet-300', badge: 'bg-violet-50 text-violet-600 border-violet-200' },
};

/** First actionable gap across channels — feeds the header/dashboard nudge. */
export function topNudge(channels: ContentChannelCard[]): string | null {
  for (const card of channels) {
    if (card.state === 'empty' && card.nudge) return card.nudge;
  }
  for (const card of channels) {
    if (card.nudge && card.state !== 'locked' && card.state !== 'dark') return card.nudge;
  }
  return null;
}

/** Metric key → display label (falls back to de-camelCased key). */
const METRIC_LABELS: Record<string, string> = {
  items: 'items',
  photos: 'photos',
  sectionsOn: 'sections on',
  published: 'published',
  scheduled: 'scheduled',
  live: 'live',
  drafts: 'drafts',
};

function metricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/** Human one-liner for a card's metrics ("124 items", "2 scheduled"). */
export function metricSummary(card: ContentChannelCard): string {
  const entries = Object.entries(card.metrics).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    const first = Object.keys(card.metrics)[0];
    return first ? `0 ${metricLabel(first)}` : '—';
  }
  return entries.map(([k, v]) => `${v} ${metricLabel(k)}`).join(' · ');
}

/** Absolute tenant-internal href for a card's editor deep link. */
export function editorHref(card: ContentChannelCard, tenantId: string): string {
  return `/t/${tenantId}${card.editorHref}`;
}

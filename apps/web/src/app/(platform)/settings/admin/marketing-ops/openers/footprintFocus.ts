/**
 * Structured footprint focus vocabulary (A5 / A3 / A8 preview slots).
 *
 * The Focus Info dropdown was a static five (NAP+W + Claim Status). It is
 * now the full briefing vocabulary, split into two families and surfaced
 * archetype-aware:
 *   - identity — the canonical listing attributes (always offered)
 *   - problem  — the other briefing-shaped focuses the analyst raises
 *     (category mislabeling, review gap, missing presence, …), filtered to
 *     the ones the archetype's briefing actually emits. This lets an A5
 *     multi-signal problem like "filed as a convenience store" be captured
 *     as a `category` focus instead of being forced into the NAP+W list.
 *
 * Values mirror the backend `FootprintFocusAttribute` union in
 * `apps/api/src/services/outreach-pitch/pitch-renderer.ts` — keep the two
 * in sync (the value is persisted on the pitch's review_pairs JSON and
 * rendered by the footprint-diff report).
 */

import type { FootprintFocusAttribute, OpenerArchetype } from '@/services/MarketingOpsService';

export interface FootprintFocusOption {
  value: FootprintFocusAttribute;
  label: string;
  group: 'identity' | 'problem';
  /** Archetypes this option is offered for. Omitted = every structured archetype. */
  archetypes?: OpenerArchetype[];
}

export const FOOTPRINT_FOCUS_CATALOG: FootprintFocusOption[] = [
  // Identity — canonical listing attributes (always available).
  { value: 'name', label: 'Name', group: 'identity' },
  { value: 'address', label: 'Address', group: 'identity' },
  { value: 'phone', label: 'Phone', group: 'identity' },
  { value: 'website', label: 'Website', group: 'identity' },
  { value: 'claim_status', label: 'Claim Status', group: 'identity' },
  // Problem — the other briefing-shaped focuses the analyst raises.
  { value: 'category', label: 'Category', group: 'problem' },
  { value: 'description', label: 'Business description', group: 'problem' },
  { value: 'hours', label: 'Hours', group: 'problem' },
  { value: 'reviews', label: 'Reviews', group: 'problem', archetypes: ['A5'] },
  { value: 'photos', label: 'Photos', group: 'problem', archetypes: ['A5', 'A8'] },
  { value: 'products', label: 'Products / catalog', group: 'problem', archetypes: ['A5'] },
  { value: 'cta', label: 'Booking / CTA', group: 'problem', archetypes: ['A5'] },
  { value: 'presence', label: 'Profile presence', group: 'problem' },
  { value: 'suspended', label: 'Suspended / duplicate', group: 'problem', archetypes: ['A8'] },
  { value: 'other', label: 'Other problem', group: 'problem' },
];

export const FOOTPRINT_FOCUS_LABELS: Record<FootprintFocusAttribute, string> = {
  name: 'Name',
  address: 'Address',
  phone: 'Phone',
  website: 'Website',
  claim_status: 'Claim Status',
  category: 'Category',
  reviews: 'Reviews',
  hours: 'Hours',
  photos: 'Photos',
  description: 'Business description',
  products: 'Products / catalog',
  cta: 'Booking / CTA',
  presence: 'Profile presence',
  suspended: 'Suspended / duplicate',
  other: 'Other problem',
};

export function focusLabelFor(value: FootprintFocusAttribute | undefined): string {
  return value ? FOOTPRINT_FOCUS_LABELS[value] ?? 'focus' : 'focus';
}

/** The focus options offered for a structured archetype, grouped for the dropdown. */
export function focusOptionsFor(archetype: OpenerArchetype): {
  identity: FootprintFocusOption[];
  problem: FootprintFocusOption[];
} {
  const applicable = FOOTPRINT_FOCUS_CATALOG.filter(
    (o) => !o.archetypes || o.archetypes.includes(archetype),
  );
  return {
    identity: applicable.filter((o) => o.group === 'identity'),
    problem: applicable.filter((o) => o.group === 'problem'),
  };
}

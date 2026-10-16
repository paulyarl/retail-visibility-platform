import type { Campaign } from '@/services/MarketingOpsService';

/**
 * Text search for the campaign pickers (opener / follow-up workspaces).
 * Matches the same fields the dropdown label shows — business name / title,
 * category, market, and archetype — so typing what you see in the option
 * narrows the list.
 */
export function searchCampaigns(list: Campaign[], search: string): Campaign[] {
  const q = search.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) =>
    [c.title, c.business_name, c.category, c.city, c.state, c.archetype, c.archetypeLabel]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
}

/**
 * Intelligence profile geographic scope helpers.
 *
 * Gold-standard profiles can be nationwide (reference_city = null,
 * reference_state = null), state-scoped (city null, state set), or
 * city-scoped (both set). These helpers produce consistent labels and
 * badge colors for display across the marketing-ops UI.
 *
 * Used by:
 *   - IntelligenceProfilesClient (list cards, view modal)
 *   - GoldStandardProfileView (detail header)
 *   - GoldStandardEstablishmentPanel (active + draft list)
 *   - GoldStandardDiscoveryPanel (profile ref grid)
 *   - PromptWorkspaceClient (profile selection)
 *   - PromptLibraryClient (profile badges — scope key prevents collisions)
 */

export interface ScopedProfile {
  reference_city?: string | null;
  reference_state?: string | null;
}

export type ProfileScopeKind = 'nationwide' | 'state' | 'city';

export interface ProfileScopeLabel {
  kind: ProfileScopeKind;
  /** "Nationwide" | "Georgia" | "Atlanta, GA" */
  label: string;
  /** Same as label today; reserved for compact contexts. */
  shortLabel: string;
  /** Mantine badge color: gray (nationwide), blue (state), cyan (city). */
  color: 'gray' | 'blue' | 'cyan';
}

/**
 * Resolve a profile's geographic scope to a display label + badge color.
 *
 * - Both null → "Nationwide" (gray)
 * - city null, state set → state name (blue)
 * - city set → "City, State" or "City" (cyan)
 */
export function profileScopeLabel(profile: ScopedProfile): ProfileScopeLabel {
  if (profile.reference_city) {
    const label = profile.reference_state
      ? `${profile.reference_city}, ${profile.reference_state}`
      : profile.reference_city;
    return { kind: 'city', label, shortLabel: label, color: 'cyan' };
  }
  if (profile.reference_state) {
    return {
      kind: 'state',
      label: profile.reference_state,
      shortLabel: profile.reference_state,
      color: 'blue',
    };
  }
  return { kind: 'nationwide', label: 'Nationwide', shortLabel: 'Nationwide', color: 'gray' };
}

/**
 * Build a stable scope key for a profile. Used to disambiguate profiles
 * that share the same category_name but have different geographic scopes
 * (e.g. "Beauty Supply" nationwide vs "Beauty Supply" Atlanta, GA).
 *
 * Returns "" for nationwide, "GA" for state-scoped, "Atlanta|GA" for city-scoped.
 */
export function profileScopeKey(profile: ScopedProfile): string {
  if (profile.reference_city) {
    return `${profile.reference_city}|${profile.reference_state ?? ''}`;
  }
  if (profile.reference_state) {
    return profile.reference_state;
  }
  return '';
}

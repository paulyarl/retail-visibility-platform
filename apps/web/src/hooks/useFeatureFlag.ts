/**
 * useFeatureFlag
 *
 * Convenience hook for checking a single feature flag.
 * Returns boolean (false during SSR / loading / errors).
 *
 * Usage:
 *   const mapCardOn = useFeatureFlag('FF_MAP_CARD');
 *   if (mapCardOn) return <MapCard />;
 */

import { useEffectiveFlags } from './useEffectiveFlags';

export function useFeatureFlag(flag: string): boolean {
  const { data } = useEffectiveFlags();
  return data?.[flag]?.effectiveOn ?? false;
}

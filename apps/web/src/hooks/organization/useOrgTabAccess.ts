/**
 * useOrgTabAccess Hook
 *
 * Combines org-level capability gating (tier-based) with RBAC role gating
 * to determine which tabs are visible and which are locked.
 */

import { useMemo } from 'react';
import { useOrgCapabilities } from './useOrgCapabilities';
import type { OrgTabKey, OrgPanelKey, OrgPropagationType, OrgCapabilitiesState } from '@/services/OrgCapabilityService';
import type { TabDef } from '@/components/organization/types';

// ====================
// RBAC ROLE GATING
// ====================

const ALL_TABS: OrgTabKey[] = [
  'overview', 'locations', 'propagation', 'capabilities',
  'team', 'commerce', 'billing',
];

const ROLE_TAB_ACCESS: Record<string, OrgTabKey[]> = {
  PLATFORM_ADMIN: ALL_TABS,
  OWNER: ALL_TABS,
  TENANT_OWNER: ALL_TABS,
  ORG_ADMIN: ALL_TABS,
  ORG_OWNER: ALL_TABS,
  TENANT_ADMIN: ['overview', 'locations', 'propagation', 'capabilities', 'team', 'commerce', 'billing'],
  SUPPORT: ['overview', 'locations', 'capabilities', 'team'],
  ORG_MEMBER: ['overview', 'locations'],
  VIEWER: ['overview', 'locations'],
};

function getRoleAllowedTabs(role: string | null | undefined): OrgTabKey[] {
  if (!role) return ['overview'];
  return ROLE_TAB_ACCESS[role] || ['overview'];
}

// ====================
// HOOK
// ====================

export interface OrgTabAccessResult {
  visibleTabs: TabDef[];
  lockedTabs: TabDef[];
  isTabAllowed: (tab: OrgTabKey) => boolean;
  isTabLocked: (tab: OrgTabKey) => boolean;
  isPanelAllowed: (panel: OrgPanelKey) => boolean;
  isPropagationAllowed: (type: OrgPropagationType) => boolean;
  orgCaps: OrgCapabilitiesState | undefined;
  loading: boolean;
}

export function useOrgTabAccess(
  allTabs: TabDef[],
  organizationId: string | null | undefined,
  userRole: string | null | undefined,
  isPlatformAdmin?: boolean
): OrgTabAccessResult {
  const { data: orgCaps, isLoading } = useOrgCapabilities(organizationId);

  return useMemo(() => {
    const roleAllowed = isPlatformAdmin ? ALL_TABS : getRoleAllowedTabs(userRole);
    const capAllowed = orgCaps?.allowedTabs ?? ALL_TABS;
    const capPanels = orgCaps?.allowedPanels ?? [];
    const capPropagation = orgCaps?.allowedPropagationTypes ?? [];

    // Tab is visible if BOTH role and capability allow it
    const allowedSet = new Set<OrgTabKey>(
      ALL_TABS.filter((tab) => roleAllowed.includes(tab) && capAllowed.includes(tab))
    );

    // Always allow the capabilities tab when orgCaps is loaded,
    // even if subscription is read-only — so users can see their plan summary.
    if (orgCaps && roleAllowed.includes('capabilities') && !allowedSet.has('capabilities')) {
      allowedSet.add('capabilities');
    }

    // Tab is locked if role allows it but capability doesn't
    const lockedSet = new Set<OrgTabKey>(
      ALL_TABS.filter((tab) => roleAllowed.includes(tab) && !capAllowed.includes(tab))
    );

    // Don't show capabilities as locked if we force-allowed it above
    if (allowedSet.has('capabilities')) {
      lockedSet.delete('capabilities');
    }

    const visibleTabs = allTabs.filter((t) => allowedSet.has(t.key as OrgTabKey));
    const lockedTabs = allTabs.filter((t) => lockedSet.has(t.key as OrgTabKey));

    const isTabAllowed = (tab: OrgTabKey) => allowedSet.has(tab);
    const isTabLocked = (tab: OrgTabKey) => lockedSet.has(tab);
    const isPanelAllowed = (panel: OrgPanelKey) => capPanels.includes(panel);
    const isPropagationAllowed = (type: OrgPropagationType) => capPropagation.includes(type);

    return {
      visibleTabs,
      lockedTabs,
      isTabAllowed,
      isTabLocked,
      isPanelAllowed,
      isPropagationAllowed,
      orgCaps,
      loading: isLoading,
    };
  }, [allTabs, orgCaps, userRole, isPlatformAdmin, isLoading]);
}

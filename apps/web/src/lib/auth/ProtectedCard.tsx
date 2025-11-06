/**
 * Protected Card Component
 * 
 * Conditionally renders a settings card based on access control rules.
 * Uses the centralized access control system to determine visibility.
 */

import { ReactNode } from 'react';
import { useAccessControl, AccessPresets } from './useAccessControl';
import { AccessControlOptions } from './access-control';

export interface ProtectedCardProps {
  /** The card content to render if user has access */
  children: ReactNode;
  
  /** Tenant ID for scoped access checks */
  tenantId?: string | null;
  
  /** Access control options or preset */
  accessOptions?: AccessControlOptions;
  
  /** Whether to fetch organization data */
  fetchOrganization?: boolean;
  
  /** If true, show nothing when access denied. If false, show a disabled/locked state */
  hideWhenDenied?: boolean;
  
  /** Custom fallback content when access is denied */
  deniedContent?: ReactNode;
}

/**
 * Wraps a settings card with access control.
 * Only renders the card if the user has the required permissions.
 * 
 * @example
 * <ProtectedCard 
 *   tenantId={tenantId} 
 *   accessOptions={AccessPresets.ORGANIZATION_ADMIN}
 *   fetchOrganization={true}
 * >
 *   <SettingCard {...propagationCard} />
 * </ProtectedCard>
 */
export function ProtectedCard({
  children,
  tenantId,
  accessOptions = {},
  fetchOrganization = false,
  hideWhenDenied = true,
  deniedContent,
}: ProtectedCardProps) {
  const { hasAccess, loading } = useAccessControl(
    tenantId || null,
    accessOptions,
    fetchOrganization
  );

  // Don't render anything while loading
  if (loading) {
    return null;
  }

  // If access denied and hideWhenDenied is true, don't render
  if (!hasAccess && hideWhenDenied) {
    return null;
  }

  // If access denied and we have custom denied content, show it
  if (!hasAccess && deniedContent) {
    return <>{deniedContent}</>;
  }

  // If access denied and hideWhenDenied is false, show locked state
  if (!hasAccess && !hideWhenDenied) {
    return (
      <div className="relative opacity-50 pointer-events-none">
        {children}
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/10 dark:bg-neutral-100/10 rounded-lg">
          <svg className="w-8 h-8 text-neutral-600 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      </div>
    );
  }

  // User has access, render the card
  return <>{children}</>;
}

/**
 * Helper function to conditionally include cards in an array based on access control
 * 
 * @example
 * const cards = [
 *   basicCard,
 *   conditionalCard(
 *     propagationCard,
 *     tenantId,
 *     AccessPresets.ORGANIZATION_ADMIN
 *   ),
 * ].filter(Boolean);
 */
export function conditionalCard<T>(
  card: T,
  hasAccess: boolean
): T | null {
  return hasAccess ? card : null;
}

/**
 * Hook to check multiple access conditions for card visibility
 * 
 * @example
 * const { canViewPropagation, canViewAdmin } = useCardAccess(tenantId, {
 *   canViewPropagation: AccessPresets.ORGANIZATION_ADMIN,
 *   canViewAdmin: AccessPresets.PLATFORM_ADMIN_ONLY,
 * });
 */
export function useCardAccess(
  tenantId: string | null,
  checks: Record<string, AccessControlOptions>
): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  
  for (const [key, options] of Object.entries(checks)) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { hasAccess } = useAccessControl(tenantId, options, false);
    results[key] = hasAccess;
  }
  
  return results;
}

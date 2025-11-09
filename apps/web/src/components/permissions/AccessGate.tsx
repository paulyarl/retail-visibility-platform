'use client';

import { ReactNode } from 'react';
import { useTenantTier, PermissionType } from '@/hooks/dashboard/useTenantTier';
import { Button } from '@/components/ui';
import { useRouter } from 'next/navigation';

interface AccessGateProps {
  tenantId: string;
  featureId: string;
  permissionType: PermissionType;
  children: ReactNode;
  // Optional: Custom fallback UI
  fallback?: (reason: string, isTierIssue: boolean, isRoleIssue: boolean) => ReactNode;
  // Optional: Show as disabled instead of hidden
  showDisabled?: boolean;
}

/**
 * Smart access gate component
 * Automatically shows appropriate message based on:
 * - Tier access (Level 1) → Upgrade CTA
 * - Role access (Level 2) → Contact admin CTA
 */
export default function AccessGate({
  tenantId,
  featureId,
  permissionType,
  children,
  fallback,
  showDisabled = false,
}: AccessGateProps) {
  const router = useRouter();
  const { canAccess, getAccessDeniedReason, hasFeature } = useTenantTier(tenantId);

  const hasAccess = canAccess(featureId, permissionType);
  const deniedReason = getAccessDeniedReason(featureId, permissionType);

  // Determine which level failed
  const hasTierAccess = hasFeature(featureId);
  const isTierIssue = !hasTierAccess; // Level 1 failed
  const isRoleIssue = hasTierAccess && !hasAccess; // Level 2 failed

  // If access granted, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback(deniedReason || 'Access denied', isTierIssue, isRoleIssue)}</>;
  }

  // Default fallback UI
  if (showDisabled) {
    // Show disabled version with tooltip
    return (
      <div className="relative group">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg max-w-xs">
            {deniedReason}
          </div>
        </div>
      </div>
    );
  }

  // Show smart message based on issue type
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {isTierIssue ? (
        // Tier issue → Show upgrade CTA
        <div className="text-center">
          <div className="text-2xl mb-2">🔒</div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {deniedReason}
          </p>
          <Button
            onClick={() => router.push(`/t/${tenantId}/settings/subscription`)}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            View Upgrade Options
          </Button>
        </div>
      ) : (
        // Role issue → Show contact admin CTA
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {deniedReason}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Contact your administrator to request access
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Inline access gate for buttons/actions
 * Shows disabled state with smart tooltip
 */
export function InlineAccessGate({
  tenantId,
  featureId,
  permissionType,
  children,
}: Omit<AccessGateProps, 'fallback' | 'showDisabled'>) {
  const { canAccess, getAccessDeniedReason, hasFeature } = useTenantTier(tenantId);

  const hasAccess = canAccess(featureId, permissionType);
  const deniedReason = getAccessDeniedReason(featureId, permissionType);
  const hasTierAccess = hasFeature(featureId);
  const isTierIssue = !hasTierAccess;

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative group inline-block">
      <div className="opacity-50 cursor-not-allowed">
        {children}
      </div>
      
      {/* Smart tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        <div className="bg-gray-900 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap">
          {deniedReason}
          {isTierIssue && (
            <div className="text-blue-400 mt-1">
              Click to upgrade →
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for programmatic access checking with smart messages
 */
export function useAccessControl(tenantId: string) {
  const { canAccess, getAccessDeniedReason, hasFeature } = useTenantTier(tenantId);

  const checkAccess = (featureId: string, permissionType: PermissionType) => {
    const hasAccess = canAccess(featureId, permissionType);
    const deniedReason = getAccessDeniedReason(featureId, permissionType);
    const hasTierAccess = hasFeature(featureId);
    
    return {
      hasAccess,
      deniedReason,
      isTierIssue: !hasTierAccess,
      isRoleIssue: hasTierAccess && !hasAccess,
      // Smart action suggestion
      suggestedAction: !hasTierAccess 
        ? 'upgrade' as const
        : 'contact_admin' as const,
    };
  };

  return { checkAccess };
}

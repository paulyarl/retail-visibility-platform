"use client";

import { Badge } from "@/components/ui";
import { ViewingAsBadge } from "@/components/RoleBadge";

interface ContextBadgesProps {
  /** Optional tenant data to display */
  tenant?: {
    id: string;
    name: string;
    metadata?: {
      branding?: {
        logoUrl?: string;
      };
    };
  };
  /** Show platform role if no tenant context */
  showPlatformRole?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Show border bottom separator */
  showBorder?: boolean;
}

/**
 * Context Badges Component
 * 
 * Displays viewing context badges showing:
 * 1. Who is viewing (role badge)
 * 2. What they're viewing (tenant badge with optional logo)
 * 
 * Perfect for:
 * - Subscription pages
 * - Tenant-scoped settings
 * - Admin tools
 * - Support workflows
 * - Any page where context clarity is important
 * 
 * @example
 * // With tenant context
 * <ContextBadges tenant={tenant} showBorder />
 * 
 * // Platform user without tenant
 * <ContextBadges showPlatformRole showBorder />
 * 
 * // Custom styling
 * <ContextBadges tenant={tenant} className="my-4" />
 */
export function ContextBadges({ 
  tenant, 
  showPlatformRole = false, 
  className = "",
  showBorder = true 
}: ContextBadgesProps) {
  const containerClasses = `flex items-center gap-3 ${showBorder ? 'pb-4 border-b border-neutral-200 dark:border-neutral-700' : ''} ${className}`;

  return (
    <div className={containerClasses}>
      {/* Role Badge - Who is viewing */}
      <ViewingAsBadge 
        tenantId={tenant?.id} 
        showPlatformRole={showPlatformRole || !tenant} 
      />
      
      {/* Tenant Badge - What they're viewing */}
      {tenant && (
        <div className="inline-flex items-center gap-3 px-3 py-1.5 bg-white dark:bg-neutral-800 rounded-lg border-2 border-neutral-300 dark:border-neutral-600 shadow-sm">
          {/* Tenant Logo */}
          {tenant.metadata?.branding?.logoUrl && (
            <img 
              src={tenant.metadata.branding.logoUrl} 
              alt={`${tenant.name} logo`}
              className="h-8 w-8 object-contain rounded"
            />
          )}
          
          {/* Tenant Name */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
              Subscription:
            </span>
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {tenant.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Context Badges Section
 * 
 * Pre-styled section wrapper for context badges.
 * Use this for consistent spacing in page layouts.
 * 
 * @example
 * <ContextBadgesSection tenant={tenant} />
 */
export function ContextBadgesSection(props: ContextBadgesProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <ContextBadges {...props} showBorder />
    </div>
  );
}

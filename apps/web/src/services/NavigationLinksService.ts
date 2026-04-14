/**
 * Navigation Links Singleton Service
 * 
 * Extends AdminApiSingleton to provide cached navigation links operations
 * Uses the platform's singleton architecture for admin authentication and caching
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { ApiResult, RequestType } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SidebarTarget = 'all' | 'tenant' | 'admin';
export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'new';
export type DynamicTemplate = 'none' | 'tenant-locations' | 'organization-locations';

export interface NavLink {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge: string;
  badgeVariant: BadgeVariant;
  targets: SidebarTarget[];
  order: number;
  enabled: boolean;
  dividerBefore: boolean;
  requiredPermission: string;
  requiredGroup: string;
  requiredRole: string;
  metadata: {
    nestingLevel: number;
    parentKey?: string;
    hasChildren: boolean;
    childrenKeys: string[];
    dynamicTemplate?: DynamicTemplate;
  };
  children?: NavLink[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

class NavigationLinksService extends AdminApiSingleton {
  private static instance: NavigationLinksService;

  private constructor() {
    super('navigation-links', {
      ttl: 5 * 60 * 1000, // 5 minutes
    });
  }

  public static getInstance(): NavigationLinksService {
    if (!NavigationLinksService.instance) {
      NavigationLinksService.instance = new NavigationLinksService();
    }
    return NavigationLinksService.instance;
  }

  /**
   * Get all navigation links
   */
  async getLinks(): Promise<ApiResult<NavLink[]>> {
    return this.makeDefaultRequest<NavLink[]>(
      '/api/admin/navigation-links',
      {},
      'navigation-links-all',
      5 * 60 * 1000, // 5 minutes,
              {
                context: AppContext.USER,
                isolation: CacheIsolation.USER,
                requestType: RequestType.AUTHENTICATED
              }
    );
  }

  /**
   * Save navigation links
   */
  async saveLinks(links: Partial<NavLink>[]): Promise<ApiResult<NavLink[]>> {
    // Invalidate cache on save
    this.cache.delete('navigation-links-all');
    
    return this.makeDefaultRequest<NavLink[]>(
      '/api/admin/navigation-links',
      {
        method: 'POST',
        body: JSON.stringify({ links }),
      }
    );
  }

  /**
   * Invalidate the navigation links cache
   */
  async invalidateCache(key?: string): Promise<void> {
    this.cache.delete('navigation-links-all');
    this.cacheManager.remove('navigation-links-all').catch(() => {});
  }
}

// Export singleton instance
export const navigationLinksService = NavigationLinksService.getInstance();

/**
 * Navigation Links Singleton Service
 * 
 * Extends AdminApiSingleton to provide cached navigation links operations
 * Uses the platform's singleton architecture for admin authentication and caching
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { ApiResult, RequestType } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { ReactNode } from 'react';

// Type for navigation items with ReactNode icons (imported from useNavLinks)
export type ProcessedNavLink = Omit<NavLink, 'icon'> & {
  icon?: ReactNode;
  children?: ProcessedNavLink[];
};

// Template parsing context interface
export interface NavTemplateContext {
  tenantId?: string;
  slug?: string;
  organizationId?: string;
  userId?: string;
  [key: string]: any;
}

// Template parser utility functions
export class NavTemplateParser {
  /**
   * Parse template variables in a string using context
   * Supports {tenantId}, {slug}, {organizationId}, {userId} and custom context variables
   * Also handles legacy $tid- prefix in URLs
   */
  static parseTemplate(template: string, context: NavTemplateContext): string {
    if (!template || !context) return template;
    
    // First, handle legacy $tid- prefix in URLs
    let processedTemplate = template.replace(/\/\$tid-/g, '/tid-');
    
    return processedTemplate.replace(/\{(\w+)\}/g, (match, key) => {
      const value = context[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Parse navigation link with all its properties
   */
  static parseNavLink(link: NavLink | ProcessedNavLink, context: NavTemplateContext): NavLink | ProcessedNavLink {
    const parsedLink = { ...link };
    
    // Parse href
    if (parsedLink.href) {
      parsedLink.href = this.parseTemplate(parsedLink.href, context);
    }
    
    // Parse label (in case it contains template variables)
    if (parsedLink.label) {
      parsedLink.label = this.parseTemplate(parsedLink.label, context);
    }
    
    // Parse children recursively
    if (parsedLink.children && parsedLink.children.length > 0) {
      parsedLink.children = parsedLink.children.map(child => 
        this.parseNavLink(child, context)
      ) as typeof parsedLink.children;
    }
    
    return parsedLink;
  }

  /**
   * Parse an array of navigation links
   */
  static parseNavLinks(links: NavLink[] | ProcessedNavLink[], context: NavTemplateContext): NavLink[] | ProcessedNavLink[] {
    return links.map(link => this.parseNavLink(link, context));
  }

  /**
   * Extract context from URL parameters
   */
  static extractContextFromUrl(): NavTemplateContext {
    const context: NavTemplateContext = {};
    
    // Extract tenant ID from URL path
    const pathname = window.location.pathname;
    const tenantMatch = pathname.match(/\/t\/([^\/]+)/);
    if (tenantMatch) {
      // Clean tenant ID by removing $ prefix if present
      const rawTenantId = tenantMatch[1];
      context.tenantId = rawTenantId.replace(/^\$/, '');
    }
    
    // Extract from URL search params
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('tenantId')) {
      const rawTenantId = searchParams.get('tenantId') || undefined;
      context.tenantId = rawTenantId?.replace(/^\$/, '');
    }
    if (searchParams.has('slug')) {
      context.slug = searchParams.get('slug') || undefined;
    }
    if (searchParams.has('organizationId')) {
      context.organizationId = searchParams.get('organizationId') || undefined;
    }
    
    return context;
  }

  /**
   * Extract context from localStorage
   */
  static extractContextFromStorage(): NavTemplateContext {
    const context: NavTemplateContext = {};
    
    try {
      // Get from localStorage if available
      const storedTenantId = localStorage.getItem('currentTenantId');
      if (storedTenantId) {
        context.tenantId = storedTenantId;
      }
      
      const storedSlug = localStorage.getItem('currentTenantSlug');
      if (storedSlug) {
        context.slug = storedSlug;
      }
      
      const storedOrgId = localStorage.getItem('currentOrganizationId');
      if (storedOrgId) {
        context.organizationId = storedOrgId;
      }
      
      // Get user info from auth context if available
      const userInfo = localStorage.getItem('userInfo');
      if (userInfo) {
        try {
          const user = JSON.parse(userInfo);
          context.userId = user.id;
        } catch (e) {
          // Ignore parsing errors
        }
      }
    } catch (e) {
      // Ignore localStorage access errors
    }
    
    return context;
  }

  /**
   * Get complete context from multiple sources
   */
  static getContext(additionalContext?: NavTemplateContext): NavTemplateContext {
    const urlContext = this.extractContextFromUrl();
    const storageContext = this.extractContextFromStorage();
    
    return {
      ...urlContext,
      ...storageContext,
      ...additionalContext,
    };
  }
}

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
  prefetch: boolean;
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

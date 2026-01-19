/**
 * Centralized tenant navigation utility
 * Provides context-aware navigation when switching tenants
 * Single source of truth for tenant switching logic
 */

import { isFeatureEnabled } from './featureFlags';
import { api } from './api';
import { LocalStorageCache } from './cache/local-storage-cache';

export interface TenantNavigationOptions {
  tenantId: string;
  currentPath?: string;
  preserveCurrentPage?: boolean; // New option to control page preservation
  skipOnboarding?: boolean;
}

export interface OnboardingCheckResult {
  needsOnboarding: boolean;
  redirectUrl?: string;
}

/**
 * Store the last visited page for a tenant
 */
export async function storeLastVisitedPage(tenantId: string, path: string): Promise<void> {
  try {
    // Only store tenant-specific pages (not platform pages)
    if (path.startsWith('/t/')) {
      await LocalStorageCache.set('last-visited-page', path, {
        tenantId,
        ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
    }
  } catch (error) {
    console.warn('[TenantNavigation] Failed to store last visited page:', error);
  }
}

/**
 * Get the last visited page for a tenant
 */
export async function getLastVisitedPage(tenantId: string): Promise<string | null> {
  try {
    const lastPage = await LocalStorageCache.get<string>('last-visited-page', { tenantId });
    return lastPage;
  } catch (error) {
    console.warn('[TenantNavigation] Failed to get last visited page:', error);
    return null;
  }
}

/**
 * Track current page as user navigates (call this on route changes)
 */
export async function trackCurrentPage(tenantId: string, path: string): Promise<void> {
  await storeLastVisitedPage(tenantId, path);
}

/**
 * Check if a tenant needs onboarding
 */
export async function checkTenantOnboarding(tenantId: string): Promise<OnboardingCheckResult> {
  try {
    const res = await api.get(`/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`, { 
      skipAuthRedirect: true 
    });
    
    if (res.ok) {
      const p = await res.json();
      const nameOk = !!(p.business_name && String(p.business_name).trim().length >= 2);
      const addrOk = !!(p.address_line1 && String(p.address_line1).trim().length >= 3);
      const cityOk = !!(p.city && String(p.city).trim().length >= 2);
      const postalOk = !!(p.postal_code && String(p.postal_code).trim().length >= 3);
      const countryOk = !!(p.country_code && String(p.country_code).trim().length === 2);
      const emailOk = !!(p.email && String(p.email).includes('@'));

      const needsOnboarding = !(nameOk && addrOk && cityOk && postalOk && countryOk && emailOk);
      
      if (needsOnboarding) {
        return {
          needsOnboarding: true,
          redirectUrl: `/onboarding?tenantId=${encodeURIComponent(tenantId)}`
        };
      }
    }
  } catch (error) {
    console.warn('[TenantNavigation] Onboarding check failed:', error);
  }

  return { needsOnboarding: false };
}

/**
 * Get the target URL when switching to a tenant
 * Context-aware: preserves current page when possible (unless preserveCurrentPage is false)
 * Enhanced: Uses last visited page from cache when appropriate
 */
export async function getTenantNavigationUrl(options: TenantNavigationOptions): Promise<string> {
  const { tenantId, currentPath, preserveCurrentPage = true } = options;
  const path = currentPath || (typeof window !== 'undefined' ? window.location.pathname : '/');
  
  // If preserveCurrentPage is false, always go to dashboard
  if (!preserveCurrentPage) {
    return `/t/${encodeURIComponent(tenantId)}/dashboard`;
  }
  
  // If already on a tenant page, replace the tenant ID (always, regardless of feature flags)
  if (path.startsWith('/t/')) {
    const pathParts = path.split('/');
    pathParts[2] = tenantId; // Replace tenant ID at index 2
    const newPath = pathParts.join('/');
    
    // Store this as the last visited page for the tenant
    await storeLastVisitedPage(tenantId, newPath);
    
    return newPath;
  }
  
  // Check if we have a last visited page for this tenant (when coming from platform pages)
  if (!path.startsWith('/t/')) {
    const lastVisitedPage = await getLastVisitedPage(tenantId);
    if (lastVisitedPage) {
      return lastVisitedPage;
    }
  }
  
  // Check if tenant URLs are enabled for platform → tenant navigation
  const tenantUrlsEnabled = 
    (typeof window !== 'undefined' && localStorage.getItem('ff_tenant_urls') === 'on') || 
    isFeatureEnabled('FF_TENANT_URLS', tenantId);
  
  if (tenantUrlsEnabled) {
    // Map platform pages to tenant-scoped equivalents
    if (path === '/' || path === '/dashboard') {
      const dashboardUrl = `/t/${encodeURIComponent(tenantId)}/dashboard`;
      await storeLastVisitedPage(tenantId, dashboardUrl);
      return dashboardUrl;
    }
    
    if (path.startsWith('/settings')) {
      // Map platform settings to tenant settings
      const settingsPath = path.replace('/settings', '');
      
      // Some platform settings don't have tenant equivalents
      // Redirect to tenant dashboard instead of creating invalid routes
      const tenantSettingsRoutes = ['/admin', '/appearance', '/branding', '/contact', '/directory', '/gbp-category', '/hours', '/integrations', '/language', '/location-status', '/offerings', '/organization', '/promotion', '/propagation', '/subscription', '/tenant', '/users', '/account'];
      
      if (settingsPath === '' || settingsPath === '/' || !tenantSettingsRoutes.some(route => settingsPath.startsWith(route))) {
        // Default to tenant dashboard for settings pages without tenant equivalents
        const dashboardUrl = `/t/${encodeURIComponent(tenantId)}/dashboard`;
        await storeLastVisitedPage(tenantId, dashboardUrl);
        return dashboardUrl;
      }
      
      const settingsUrl = `/t/${encodeURIComponent(tenantId)}/settings${settingsPath}`;
      await storeLastVisitedPage(tenantId, settingsUrl);
      return settingsUrl;
    }
    
    if (path === '/items') {
      const itemsUrl = `/t/${encodeURIComponent(tenantId)}/items`;
      await storeLastVisitedPage(tenantId, itemsUrl);
      return itemsUrl;
    }
  }

  // Default destination: tenant-scoped dashboard
  const dashboardUrl = `/t/${encodeURIComponent(tenantId)}/dashboard`;
  await storeLastVisitedPage(tenantId, dashboardUrl);
  return dashboardUrl;
}

/**
 * Navigate to a tenant with context awareness
 * Handles onboarding checks and localStorage updates
 */
export async function navigateToTenant(
  tenantId: string,
  options: {
    skipOnboarding?: boolean;
    currentPath?: string;
    preserveCurrentPage?: boolean; // New option
    navigate: (url: string) => void;
  }
): Promise<void> {
  const { skipOnboarding = false, currentPath, preserveCurrentPage = true, navigate } = options;
  
  // Update localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('tenantId', tenantId);
  }

  // Check onboarding if not skipped
  if (!skipOnboarding) {
    const onboardingCheck = await checkTenantOnboarding(tenantId);
    if (onboardingCheck.needsOnboarding && onboardingCheck.redirectUrl) {
      navigate(onboardingCheck.redirectUrl);
      return;
    }
  }

  // Get context-aware navigation URL (now async)
  const targetUrl = await getTenantNavigationUrl({ tenantId, currentPath, preserveCurrentPage });
  
  console.log('[TenantNavigation] Navigating to:', targetUrl);
  navigate(targetUrl);
}

/**
 * Simple synchronous version for client-side navigation
 * Use when you don't need onboarding checks
 */
export async function getQuickTenantUrl(tenantId: string, currentPath?: string, preserveCurrentPage: boolean = true): Promise<string> {
  return await getTenantNavigationUrl({ tenantId, currentPath, preserveCurrentPage });
}

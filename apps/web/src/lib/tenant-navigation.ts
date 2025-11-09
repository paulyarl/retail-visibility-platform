/**
 * Centralized tenant navigation utility
 * Provides context-aware navigation when switching tenants
 * Single source of truth for tenant switching logic
 */

import { isFeatureEnabled } from './featureFlags';
import { api } from './api';

export interface TenantNavigationOptions {
  tenantId: string;
  currentPath?: string;
  skipOnboarding?: boolean;
}

export interface OnboardingCheckResult {
  needsOnboarding: boolean;
  redirectUrl?: string;
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
 * Context-aware: preserves current page when possible
 */
export function getTenantNavigationUrl(options: TenantNavigationOptions): string {
  const { tenantId, currentPath } = options;
  const path = currentPath || (typeof window !== 'undefined' ? window.location.pathname : '/');
  
  // If already on a tenant page, replace the tenant ID (always, regardless of feature flags)
  if (path.startsWith('/t/')) {
    const pathParts = path.split('/');
    pathParts[2] = tenantId; // Replace tenant ID at index 2
    return pathParts.join('/');
  }
  
  // Check if tenant URLs are enabled for platform → tenant navigation
  const tenantUrlsEnabled = 
    (typeof window !== 'undefined' && localStorage.getItem('ff_tenant_urls') === 'on') || 
    isFeatureEnabled('FF_TENANT_URLS', tenantId);
  
  if (tenantUrlsEnabled) {
    // Map platform pages to tenant-scoped equivalents
    if (path === '/' || path === '/dashboard') {
      return `/t/${encodeURIComponent(tenantId)}/dashboard`;
    }
    
    if (path.startsWith('/settings')) {
      // Map platform settings to tenant settings
      const settingsPath = path.replace('/settings', '');
      return `/t/${encodeURIComponent(tenantId)}/settings${settingsPath}`;
    }
    
    if (path === '/items') {
      return `/t/${encodeURIComponent(tenantId)}/items`;
    }
  }

  // Default destination: tenant-scoped dashboard
  return `/t/${encodeURIComponent(tenantId)}/dashboard`;
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
    navigate: (url: string) => void;
  }
): Promise<void> {
  const { skipOnboarding = false, currentPath, navigate } = options;
  
  // Update localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('tenantId', tenantId);
    localStorage.setItem('lastTenantId', tenantId);
  }

  // Check onboarding if not skipped
  if (!skipOnboarding) {
    const onboardingCheck = await checkTenantOnboarding(tenantId);
    if (onboardingCheck.needsOnboarding && onboardingCheck.redirectUrl) {
      navigate(onboardingCheck.redirectUrl);
      return;
    }
  }

  // Get context-aware navigation URL
  const targetUrl = getTenantNavigationUrl({ tenantId, currentPath });
  
  console.log('[TenantNavigation] Navigating to:', targetUrl);
  navigate(targetUrl);
}

/**
 * Simple synchronous version for client-side navigation
 * Use when you don't need onboarding checks
 */
export function getQuickTenantUrl(tenantId: string, currentPath?: string): string {
  return getTenantNavigationUrl({ tenantId, currentPath });
}

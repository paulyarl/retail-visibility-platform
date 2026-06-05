/**
 * Admin Email Configuration Library
 * 
 * Provides access to admin email addresses for different categories
 * Uses AdminEmailConfigService for platform caching and proper error handling
 */

import { adminEmailConfigService } from '@/services/AdminEmailConfigService';

export type EmailCategory = 
  | 'subscription'
  | 'upgrade_requests'
  | 'organization_requests'
  | 'sales'
  | 'support'
  | 'managed_services'
  | 'partnerships'
  | 'marketing'
  | 'compliance'
  | 'general';

export const DEFAULT_ADMIN_EMAILS: Record<EmailCategory, string> = {
  subscription: 'subscriptions@visibleshelf.store',
  upgrade_requests: 'upgrades@visibleshelf.store',
  organization_requests: 'organizations@visibleshelf.store',
  sales: 'sales@visibleshelf.store',
  support: 'support@visibleshelf.store',
  managed_services: 'services@visibleshelf.store',
  partnerships: 'partnerships@visibleshelf.store',
  marketing: 'marketing@visibleshelf.store',
  compliance: 'compliance@visibleshelf.store',
  general: 'info@visibleshelf.store',
};

// Cache for email configurations
let emailCache: Record<EmailCategory, string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch email configurations from AdminEmailConfigService
 */
async function fetchEmailConfigs(): Promise<Record<EmailCategory, string>> {
  try {
    // Use AdminEmailConfigService for platform caching and proper error handling
    const emailMap = await adminEmailConfigService.getEmailConfigMap();
    
    // Merge with defaults
    return { ...DEFAULT_ADMIN_EMAILS, ...emailMap } as Record<EmailCategory, string>;
  } catch (error) {
    console.error('[AdminEmails] Error fetching email configs from service:', error);
  }
  
  return DEFAULT_ADMIN_EMAILS;
}

/**
 * Get the configured admin email for a specific category
 * Falls back to default if not configured
 * Uses cached values for performance
 */
export function getAdminEmail(category: EmailCategory): string {
  if (typeof window === 'undefined') {
    // Server-side: return default
    return DEFAULT_ADMIN_EMAILS[category];
  }

  // Return from cache if valid
  if (emailCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return emailCache[category] || DEFAULT_ADMIN_EMAILS[category];
  }

  // Return default immediately, but fetch in background
  fetchEmailConfigs().then(configs => {
    emailCache = configs;
    cacheTimestamp = Date.now();
  });

  return emailCache?.[category] || DEFAULT_ADMIN_EMAILS[category];
}

/**
 * Get all configured admin emails (async version for fresh data)
 */
export async function getAllAdminEmails(): Promise<Record<EmailCategory, string>> {
  if (typeof window === 'undefined') {
    return DEFAULT_ADMIN_EMAILS;
  }

  return await fetchEmailConfigs();
}

/**
 * Get all configured admin emails (sync version with cache)
 */
export function getAllAdminEmailsSync(): Record<EmailCategory, string> {
  if (typeof window === 'undefined') {
    return DEFAULT_ADMIN_EMAILS;
  }

  // Return from cache if valid
  if (emailCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return emailCache;
  }

  // Fetch in background
  fetchEmailConfigs().then(configs => {
    emailCache = configs;
    cacheTimestamp = Date.now();
  });

  return emailCache || DEFAULT_ADMIN_EMAILS;
}

/**
 * Refresh the email cache (force fresh data from service)
 */
export async function refreshAdminEmails(): Promise<Record<EmailCategory, string>> {
  if (typeof window === 'undefined') {
    return DEFAULT_ADMIN_EMAILS;
  }

  try {
    const configs = await fetchEmailConfigs();
    emailCache = configs;
    cacheTimestamp = Date.now();
    return configs;
  } catch (error) {
    console.error('[AdminEmails] Failed to refresh email cache:', error);
    return emailCache || DEFAULT_ADMIN_EMAILS;
  }
}

/**
 * Clear the email cache (useful for testing or admin updates)
 */
export function clearAdminEmailCache(): void {
  emailCache = null;
  cacheTimestamp = 0;
}

/**
 * Invalidate the email cache (call after updating emails)
 */
export function invalidateEmailCache(): void {
  emailCache = null;
  cacheTimestamp = 0;
}

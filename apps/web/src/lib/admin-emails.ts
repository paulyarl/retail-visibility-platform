/**
 * Admin email management utilities
 * Centralized access to configured admin emails from database
 */

export type EmailCategory = 
  | 'subscription'
  | 'sales'
  | 'support'
  | 'managed_services'
  | 'partnerships'
  | 'marketing'
  | 'compliance'
  | 'general';

export const DEFAULT_ADMIN_EMAILS: Record<EmailCategory, string> = {
  subscription: 'subscriptions@yourplatform.com',
  sales: 'sales@yourplatform.com',
  support: 'support@yourplatform.com',
  managed_services: 'services@yourplatform.com',
  partnerships: 'partnerships@yourplatform.com',
  marketing: 'marketing@yourplatform.com',
  compliance: 'legal@yourplatform.com',
  general: 'info@yourplatform.com',
};

// Cache for email configurations
let emailCache: Record<EmailCategory, string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch email configurations from API
 */
async function fetchEmailConfigs(): Promise<Record<EmailCategory, string>> {
  try {
    const response = await fetch('/api/admin/email-config');
    if (response.ok) {
      const configs = await response.json();
      const emailMap: Record<string, string> = {};
      configs.forEach((config: { category: string; email: string }) => {
        emailMap[config.category] = config.email;
      });
      
      // Merge with defaults
      return { ...DEFAULT_ADMIN_EMAILS, ...emailMap } as Record<EmailCategory, string>;
    }
  } catch (error) {
    console.error('Error fetching admin emails from API:', error);
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
 * Invalidate the email cache (call after updating emails)
 */
export function invalidateEmailCache(): void {
  emailCache = null;
  cacheTimestamp = 0;
}

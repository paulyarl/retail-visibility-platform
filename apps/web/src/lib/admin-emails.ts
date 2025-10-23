/**
 * Admin email management utilities
 * Centralized access to configured admin emails
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

/**
 * Get the configured admin email for a specific category
 * Falls back to default if not configured
 */
export function getAdminEmail(category: EmailCategory): string {
  if (typeof window === 'undefined') {
    // Server-side: return default
    return DEFAULT_ADMIN_EMAILS[category];
  }

  try {
    const savedEmails = localStorage.getItem('admin_emails');
    if (savedEmails) {
      const emailConfig = JSON.parse(savedEmails);
      return emailConfig[category] || DEFAULT_ADMIN_EMAILS[category];
    }
  } catch (error) {
    console.error('Error reading admin emails:', error);
  }

  return DEFAULT_ADMIN_EMAILS[category];
}

/**
 * Get all configured admin emails
 */
export function getAllAdminEmails(): Record<EmailCategory, string> {
  if (typeof window === 'undefined') {
    return DEFAULT_ADMIN_EMAILS;
  }

  try {
    const savedEmails = localStorage.getItem('admin_emails');
    if (savedEmails) {
      const emailConfig = JSON.parse(savedEmails);
      // Merge with defaults to ensure all categories exist
      return { ...DEFAULT_ADMIN_EMAILS, ...emailConfig };
    }
  } catch (error) {
    console.error('Error reading admin emails:', error);
  }

  return DEFAULT_ADMIN_EMAILS;
}

/**
 * Set admin email for a category
 */
export function setAdminEmail(category: EmailCategory, email: string): void {
  if (typeof window === 'undefined') return;

  try {
    const currentEmails = getAllAdminEmails();
    currentEmails[category] = email;
    localStorage.setItem('admin_emails', JSON.stringify(currentEmails));
  } catch (error) {
    console.error('Error saving admin email:', error);
  }
}

/**
 * Reset all emails to defaults
 */
export function resetAdminEmails(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('admin_emails', JSON.stringify(DEFAULT_ADMIN_EMAILS));
  } catch (error) {
    console.error('Error resetting admin emails:', error);
  }
}

/**
 * Admin Email Configuration Service
 * 
 * Handles admin email configuration management
 * Extends AdminApiSingleton for admin privilege validation and caching
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface EmailConfig {
  category: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailConfigRequest {
  category: string;
  email: string;
  isActive?: boolean;
}

export interface UpdateEmailConfigRequest {
  email?: string;
  isActive?: boolean;
}

class AdminEmailConfigService extends AdminApiSingleton {
  private static instance: AdminEmailConfigService;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for email configs

  private constructor() {
    super('admin-email-config-service');
  }

  public static getInstance(): AdminEmailConfigService {
    if (!AdminEmailConfigService.instance) {
      AdminEmailConfigService.instance = new AdminEmailConfigService();
    }
    return AdminEmailConfigService.instance;
  }

  /**
   * Get all email configurations
   */
  async getAllEmailConfigs(): Promise<EmailConfig[]> {
    try {
      const result = await this.makeDefaultRequest<EmailConfig[]>(
        '/admin/email-config',
        {},
        'admin-email-configs',
        this.cacheTTL
      );

      return result.data || [];
    } catch (error) {
      console.error('[AdminEmailConfigService] Failed to get email configs:', error);
      return [];
    }
  }

  /**
   * Get email configuration by category
   */
  async getEmailConfigByCategory(category: string): Promise<EmailConfig | null> {
    try {
      const configs = await this.getAllEmailConfigs();
      return configs.find(config => config.category === category) || null;
    } catch (error) {
      console.error('[AdminEmailConfigService] Failed to get email config by category:', error);
      return null;
    }
  }

  /**
   * Create new email configuration
   */
  async createEmailConfig(config: CreateEmailConfigRequest): Promise<EmailConfig | null> {
    try {
      const result = await this.makeDefaultRequest<EmailConfig>(
        '/admin/email-config',
        {
          method: 'POST',
          body: JSON.stringify(config)
        },
        `admin-email-config-create-${config.category}`,
        this.cacheTTL
      );

      // Invalidate cache
      await this.invalidateCache('admin-email-configs*');

      return result.data || null;
    } catch (error) {
      console.error('[AdminEmailConfigService] Failed to create email config:', error);
      return null;
    }
  }

  /**
   * Update email configuration
   */
  async updateEmailConfig(category: string, updates: UpdateEmailConfigRequest): Promise<EmailConfig | null> {
    try {
      const result = await this.makeDefaultRequest<EmailConfig>(
        `/admin/email-config/${category}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates)
        },
        `admin-email-config-${category}`,
        this.cacheTTL
      );

      // Invalidate cache
      await this.invalidateCache('admin-email-configs*');

      return result.data || null;
    } catch (error) {
      console.error('[AdminEmailConfigService] Failed to update email config:', error);
      return null;
    }
  }

  /**
   * Delete email configuration
   */
  async deleteEmailConfig(category: string): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean }>(
        `/admin/email-config/${category}`,
        {
          method: 'DELETE'
        },
        `admin-email-config-delete-${category}`,
        this.cacheTTL
      );

      // Invalidate cache
      await this.invalidateCache('admin-email-configs*');

      return result.data?.success || false;
    } catch (error) {
      console.error('[AdminEmailConfigService] Failed to delete email config:', error);
      return false;
    }
  }

  /**
   * Get email configurations as a simple record for easy lookup
   */
  async getEmailConfigMap(): Promise<Record<string, string>> {
    try {
      const configs = await this.getAllEmailConfigs();
      const emailMap: Record<string, string> = {};
      
      configs.forEach((config: EmailConfig) => {
        if (config.isActive) {
          emailMap[config.category] = config.email;
        }
      });
      
      return emailMap;
    } catch (error) {
      console.error('[AdminEmailConfigService] Failed to get email config map:', error);
      return {};
    }
  }
}

// Export singleton instance
export const adminEmailConfigService = AdminEmailConfigService.getInstance();

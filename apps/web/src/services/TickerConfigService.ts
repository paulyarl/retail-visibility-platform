import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { RequestType } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface TickerMessage {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  icon: 'info' | 'warning' | 'success' | 'bulb';
  scrolling: boolean;
  dismissible: boolean;
  targetAudience: 'all' | 'specific_tiers' | 'specific_tenants';
  targetTiers?: string[];
  targetTenants?: string[];
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  priority: number; // Higher number = higher priority
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface TickerConfig {
  enabled: boolean;
  messages: TickerMessage[];
  globalSettings: {
    maxMessages: number;
    scrollSpeed: 'slow' | 'medium' | 'fast';
    autoRotate: boolean;
    rotationInterval: number; // seconds
  };
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

class TickerConfigService extends AdminApiSingleton {
  private static _instance: TickerConfigService;

  protected defaultContext: AppContext = AppContext.SYSTEM;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SYSTEM;

  protected constructor() {
    super('ticker-config-service');
  }

  public static getInstance(): TickerConfigService {
    if (!TickerConfigService._instance) {
      TickerConfigService._instance = new TickerConfigService();
    }
    return TickerConfigService._instance;
  }

  /**
   * Get current ticker configuration
   */
  async getTickerConfig(): Promise<{
    success: boolean;
    data?: TickerConfig;
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<TickerConfig>(
        '/api/admin/ticker-config',
        {},
        'ticker-config',
        5 * 60 * 1000, // 5 minutes cache
        {
          context: AppContext.USER,
          isolation: CacheIsolation.USER,
          requestType: RequestType.AUTHENTICATED
        }
      );

      if (!result.success) {
        this.logError('Failed to get ticker config', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      return this.createResponse(true, result.data);
    } catch (error) {
      // Handle authentication errors specifically
      if (error instanceof Error && error.message === 'No authentication token available') {
        console.warn('[TickerConfigService] User not authenticated, skipping ticker config load');
        return this.createResponse(false, undefined, {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
          status: 401
        }, 'Please log in to access ticker settings');
      }
      
      this.logError('Failed to get ticker config', error);
      return this.createResponse(false, undefined, error, 'Failed to load ticker configuration');
    }
  }

  /**
   * Get active messages for specific tenant
   */
  async getActiveMessages(tenantId?: string, tenantTier?: string): Promise<{
    success: boolean;
    data?: TickerMessage[];
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.append('tenantId', tenantId);
      if (tenantTier) params.append('tier', tenantTier);

      const result = await this.makeDefaultRequest<TickerMessage[]>(
        `/api/admin/ticker-messages/active?${params.toString()}`,
        {},
        'active-ticker-messages',
        2 * 60 * 1000, // 2 minutes cache
        {
          context: AppContext.USER,
          isolation: CacheIsolation.USER,
          requestType: RequestType.AUTHENTICATED
        }
      );

      if (!result.success) {
        this.logError('Failed to get active messages', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      return this.createResponse(true, result.data);
    } catch (error) {
      this.logError('Failed to get active messages', error);
      return this.createResponse(false, undefined, error, 'Failed to load active messages');
    }
  }

  /**
   * Add new message
   */
  async addMessage(message: Omit<TickerMessage, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<{
    success: boolean;
    data?: TickerMessage;
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<TickerMessage>(
        '/api/admin/ticker-messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        },
        'ticker-messages',
        0 // No cache for updates
      );

      if (!result.success) {
        this.logError('Failed to add ticker message', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      // Clear cache to force refresh - use pattern matching for dynamic keys
      await this.invalidateCachePattern('ticker-config*');
      await this.invalidateCachePattern('active-ticker-messages*');

      return this.createResponse(true, result.data);
    } catch (error) {
      this.logError('Failed to add ticker message', error);
      return this.createResponse(false, undefined, error, 'Failed to add ticker message');
    }
  }

  /**
   * Update message
   */
  async updateMessage(messageId: string, updates: Partial<TickerMessage>): Promise<{
    success: boolean;
    data?: TickerMessage;
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<TickerMessage>(
        `/api/admin/ticker-messages/${messageId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        },
        `ticker-message-${messageId}`,
        0 // No cache for updates
      );

      if (!result.success) {
        this.logError('Failed to update ticker message', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      // Clear cache to force refresh - use pattern matching for dynamic keys
      await this.invalidateCachePattern('ticker-config*');
      await this.invalidateCachePattern('active-ticker-messages*');

      return this.createResponse(true, result.data);
    } catch (error) {
      this.logError('Failed to update ticker message', error);
      return this.createResponse(false, undefined, error, 'Failed to update ticker message');
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string): Promise<{
    success: boolean;
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<void>(
        `/api/admin/ticker-messages/${messageId}`,
        {
          method: 'DELETE',
        },
        `ticker-message-${messageId}`,
        0 // No cache for updates
      );

      if (!result.success) {
        this.logError('Failed to delete ticker message', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      // Clear cache to force refresh - use pattern matching for dynamic keys
      await this.invalidateCachePattern('ticker-config*');
      await this.invalidateCachePattern('active-ticker-messages*');

      return this.createResponse(true);
    } catch (error) {
      this.logError('Failed to delete ticker message', error);
      return this.createResponse(false, undefined, error, 'Failed to delete ticker message');
    }
  }

  /**
   * Update global settings
   */
  async updateGlobalSettings(settings: TickerConfig['globalSettings']): Promise<{
    success: boolean;
    data?: TickerConfig;
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<TickerConfig>(
        '/api/admin/ticker-config/settings',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        },
        'ticker-config-settings',
        0 // No cache for updates
      );

      if (!result.success) {
        this.logError('Failed to update ticker settings', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      // Clear cache to force refresh
      await this.clearCache('ticker-config');

      return this.createResponse(true, result.data);
    } catch (error) {
      this.logError('Failed to update ticker settings', error);
      return this.createResponse(false, undefined, error, 'Failed to update ticker settings');
    }
  }

  /**
   * Get available tiers for targeting
   */
  async getAvailableTiers(): Promise<{
    success: boolean;
    data?: string[];
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<string[]>(
        '/api/admin/tiers/list',
        {},
        'available-tiers',
        10 * 60 * 1000, // 10 minutes cache
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );

      if (!result.success) {
        this.logError('Failed to get available tiers', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      return this.createResponse(true, result.data);
    } catch (error) {
      this.logError('Failed to get available tiers', error);
      return this.createResponse(false, undefined, error, 'Failed to load available tiers');
    }
  }

  /**
   * Get available tenants for targeting
   */
  async getAvailableTenants(): Promise<{
    success: boolean;
    data?: Array<{ id: string; name: string; tier?: string }>;
    error?: { code: string; message: string; status?: number };
    userMessage?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<Array<{ id: string; name: string; tier?: string }>>(
        '/api/admin/tenants/list',
        {},
        'available-tenants',
        10 * 60 * 1000, // 10 minutes cache
        {
          context: AppContext.TENANT,
          isolation: CacheIsolation.TENANT,
          requestType: RequestType.AUTHENTICATED
        }
      );

      if (!result.success) {
        this.logError('Failed to get available tenants', result.error);
        return this.createResponse(false, undefined, result.error);
      }

      return this.createResponse(true, result.data);
    } catch (error) {
      this.logError('Failed to get available tenants', error);
      return this.createResponse(false, undefined, error, 'Failed to load available tenants');
    }
  }

  /**
   * Check if message should be shown for specific tenant
   */
  shouldShowMessage(message: TickerMessage, tenantId?: string, tenantTier?: string): boolean {
    if (!message.isActive) return false;

    // Check date range
    const now = new Date();
    if (message.startDate && new Date(message.startDate) > now) return false;
    if (message.endDate && new Date(message.endDate) < now) return false;

    // Check audience targeting
    switch (message.targetAudience) {
      case 'all':
        return true;
      case 'specific_tiers':
        return message.targetTiers?.includes(tenantTier || '') || false;
      case 'specific_tenants':
        return message.targetTenants?.includes(tenantId || '') || false;
      default:
        return true;
    }
  }

  /**
   * Filter and sort messages for display
   */
  getDisplayMessages(messages: TickerMessage[], tenantId?: string, tenantTier?: string, maxMessages?: number): TickerMessage[] {
    const now = new Date();
    
    // Filter active, non-expired messages that should be shown to this tenant
    const activeMessages = messages.filter(message => 
      this.shouldShowMessage(message, tenantId, tenantTier)
    );

    // Sort by priority (highest first), then by creation date (newest first)
    activeMessages.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    // Limit to max messages
    return maxMessages ? activeMessages.slice(0, maxMessages) : activeMessages;
  }
}

export const tickerConfigService = TickerConfigService.getInstance();

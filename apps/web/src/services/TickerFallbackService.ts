/**
 * Ticker Fallback Service
 * Provides local storage redundancy for critical ticker communications
 * Ensures ticker works even when database/API is down
 */

export interface TickerConfig {
  enabled: boolean;
  globalSettings: {
    maxMessages: number;
    autoRotate: boolean;
    rotationInterval: number;
    showDismissButton?: boolean;
  };
}

export interface TickerMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon: string;
  scrolling: boolean;
  dismissible: boolean;
  targetAudience: 'all' | 'specific_tiers' | 'specific_tenants';
  targetTiers: string[];
  targetTenants: string[];
  startDate?: string;
  endDate?: string;
  priority: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TickerFallbackData {
  config: TickerConfig | null;
  messages: TickerMessage[];
  lastUpdated: string;
  isEmergencyMode: boolean;
}

class TickerFallbackService {
  private static readonly STORAGE_KEY = 'ticker-fallback-data';
  private static readonly EMERGENCY_MESSAGES_KEY = 'ticker-emergency-messages';
  private static readonly CONFIG_KEY = 'ticker-fallback-config';
  private static readonly FALLBACK_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Save ticker data to local storage for fallback
   */
  static saveFallbackData(config: TickerConfig | null, messages: TickerMessage[]): void {
    try {
      const fallbackData: TickerFallbackData = {
        config,
        messages,
        lastUpdated: new Date().toISOString(),
        isEmergencyMode: false
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(fallbackData));
      console.log('[TickerFallbackService] Saved fallback data:', { configEnabled: config?.enabled, messageCount: messages.length });
    } catch (error) {
      console.error('[TickerFallbackService] Failed to save fallback data:', error);
    }
  }

  /**
   * Get fallback data from local storage
   */
  static getFallbackData(): TickerFallbackData | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const data: TickerFallbackData = JSON.parse(stored);
      
      // Check if data is still valid (not too old)
      const now = new Date().getTime();
      const lastUpdated = new Date(data.lastUpdated).getTime();
      
      if (now - lastUpdated > this.FALLBACK_TTL) {
        console.log('[TickerFallbackService] Fallback data expired, removing');
        this.clearFallbackData();
        return null;
      }

      return data;
    } catch (error) {
      console.error('[TickerFallbackService] Failed to get fallback data:', error);
      return null;
    }
  }

  /**
   * Save emergency messages that should always show
   */
  static saveEmergencyMessages(messages: TickerMessage[]): void {
    try {
      localStorage.setItem(this.EMERGENCY_MESSAGES_KEY, JSON.stringify(messages));
      console.log('[TickerFallbackService] Saved emergency messages:', messages.length);
    } catch (error) {
      console.error('[TickerFallbackService] Failed to save emergency messages:', error);
    }
  }

  /**
   * Get emergency messages
   */
  static getEmergencyMessages(): TickerMessage[] {
    try {
      const stored = localStorage.getItem(this.EMERGENCY_MESSAGES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[TickerFallbackService] Failed to get emergency messages:', error);
      return [];
    }
  }

  /**
   * Save fallback config
   */
  static saveFallbackConfig(config: TickerConfig): void {
    try {
      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
      console.log('[TickerFallbackService] Saved fallback config:', { enabled: config.enabled });
    } catch (error) {
      console.error('[TickerFallbackService] Failed to save fallback config:', error);
    }
  }

  /**
   * Get fallback config
   */
  static getFallbackConfig(): TickerConfig | null {
    try {
      const stored = localStorage.getItem(this.CONFIG_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('[TickerFallbackService] Failed to get fallback config:', error);
      return null;
    }
  }

  /**
   * Clear all fallback data
   */
  static clearFallbackData(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.EMERGENCY_MESSAGES_KEY);
      localStorage.removeItem(this.CONFIG_KEY);
      console.log('[TickerFallbackService] Cleared all fallback data');
    } catch (error) {
      console.error('[TickerFallbackService] Failed to clear fallback data:', error);
    }
  }

  /**
   * Get combined data (fallback + emergency)
   */
  static getCombinedFallbackData(): { config: TickerConfig | null; messages: TickerMessage[]; isEmergencyMode: boolean } {
    const fallbackData = this.getFallbackData();
    const emergencyMessages = this.getEmergencyMessages();
    const fallbackConfig = this.getFallbackConfig();

    // Use fallback config if available, otherwise use emergency default
    const config = fallbackData?.config || fallbackConfig || {
      enabled: true,
      globalSettings: {
        maxMessages: 5,
        autoRotate: true,
        rotationInterval: 5,
        showDismissButton: true
      }
    };

    // Combine messages, prioritize emergency messages
    let messages: TickerMessage[] = [];
    let isEmergencyMode = false;

    if (emergencyMessages.length > 0) {
      messages = emergencyMessages;
      isEmergencyMode = true;
    } else if (fallbackData?.messages) {
      messages = fallbackData.messages;
    }

    return { config, messages, isEmergencyMode };
  }

  /**
   * Check if we're in emergency mode
   */
  static isInEmergencyMode(): boolean {
    const combined = this.getCombinedFallbackData();
    return combined.isEmergencyMode;
  }

  /**
   * Set emergency mode with critical messages
   */
  static setEmergencyMode(messages: TickerMessage[]): void {
    this.saveEmergencyMessages(messages);
    console.log('[TickerFallbackService] Emergency mode activated:', messages.length, 'critical messages');
  }

  /**
   * Clear emergency mode
   */
  static clearEmergencyMode(): void {
    this.saveEmergencyMessages([]);
    console.log('[TickerFallbackService] Emergency mode cleared');
  }
}

export default TickerFallbackService;

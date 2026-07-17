/**
 * Integrations Singleton
 * 
 * MIGRATION: Now uses TenantIntegrationsService for proper caching and context management
 * Maintains backward compatibility while leveraging service layer benefits
 */

import TenantIntegrationsService from '@/services/TenantIntegrationsService';
import { clientLogger } from '@/lib/client-logger';

interface CloverIntegration {
  connected: boolean;
  merchantId?: string;
  lastSync?: string;
  syncStatus?: 'idle' | 'syncing' | 'error';
  itemCount?: number;
}

interface SquareIntegration {
  connected: boolean;
  locationId?: string;
  lastSync?: string;
  syncStatus?: 'idle' | 'syncing' | 'error';
  itemCount?: number;
}

interface IntegrationStatus {
  clover: CloverIntegration | null;
  square: SquareIntegration | null;
}

interface IntegrationsState {
  integrations: IntegrationStatus;
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
}

class IntegrationsSingleton {
  private static instances: Map<string, IntegrationsSingleton> = new Map();
  private state: IntegrationsState;
  private listeners: Set<() => void> = new Set();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor(private tenantId: string) {
    this.state = {
      integrations: {
        clover: null,
        square: null
      },
      loading: false,
      error: null,
      lastFetch: null
    };
  }

  static getInstance(tenantId: string): IntegrationsSingleton {
    if (!IntegrationsSingleton.instances.has(tenantId)) {
      IntegrationsSingleton.instances.set(tenantId, new IntegrationsSingleton(tenantId));
    }
    return IntegrationsSingleton.instances.get(tenantId)!;
  }

  static destroyInstance(tenantId: string): void {
    IntegrationsSingleton.instances.delete(tenantId);
  }

  private setState(updates: Partial<IntegrationsState>) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): IntegrationsState {
    return this.state;
  }

  async fetchCloverIntegration(forceRefresh = false): Promise<CloverIntegration | null> {
    // Check cache first
    if (!forceRefresh && this.state.lastFetch) {
      const cacheAge = Date.now() - this.state.lastFetch;
      if (cacheAge < this.CACHE_TTL && this.state.integrations.clover) {
        console.log(`IntegrationsSingleton: Using cached Clover status for tenant ${this.tenantId} (age: ${Math.round(cacheAge / 1000)}s)`);
        return this.state.integrations.clover;
      }
    }

    this.setState({ loading: true, error: null });

    try {
      console.log(`IntegrationsSingleton: Fetching Clover integration for tenant ${this.tenantId}`);
      
      // MIGRATION: Using TenantIntegrationsService instead of direct fetch
      const integration = await TenantIntegrationsService.getTenantIntegration(this.tenantId, 'CLOVER');
      
      const cloverIntegration: CloverIntegration = {
        connected: integration?.isConnected || false,
        merchantId: integration?.config?.merchantId,
        lastSync: integration?.lastSyncAt,
        syncStatus: integration?.status === 'CONNECTED' ? 'idle' : integration?.status?.toLowerCase() as any || 'idle',
        itemCount: 0 // TODO: Add itemCount to integration metadata if needed
      };

      this.setState({
        integrations: {
          ...this.state.integrations,
          clover: cloverIntegration
        },
        loading: false,
        error: null,
        lastFetch: Date.now()
      });

      console.log(`IntegrationsSingleton: Fetched Clover integration for tenant ${this.tenantId}`);
      return cloverIntegration;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      clientLogger.error(`IntegrationsSingleton: Error fetching Clover integration:`, { detail: error });
      
      this.setState({
        loading: false,
        error: errorMessage
      });

      throw error;
    }
  }

  async fetchSquareIntegration(forceRefresh = false): Promise<SquareIntegration | null> {
    // Check cache first
    if (!forceRefresh && this.state.lastFetch) {
      const cacheAge = Date.now() - this.state.lastFetch;
      if (cacheAge < this.CACHE_TTL && this.state.integrations.square) {
        console.log(`IntegrationsSingleton: Using cached Square status for tenant ${this.tenantId} (age: ${Math.round(cacheAge / 1000)}s)`);
        return this.state.integrations.square;
      }
    }

    try {
      console.log(`IntegrationsSingleton: Fetching Square integration for tenant ${this.tenantId}`);
      
      // MIGRATION: Using TenantIntegrationsService instead of direct fetch
      const integration = await TenantIntegrationsService.getTenantIntegration(this.tenantId, 'SQUARE');
      
      const squareIntegration: SquareIntegration = {
        connected: integration?.isConnected || false,
        locationId: integration?.config?.locationId,
        lastSync: integration?.lastSyncAt,
        syncStatus: integration?.status === 'CONNECTED' ? 'idle' : integration?.status?.toLowerCase() as any || 'idle',
        itemCount: 0 // TODO: Add itemCount to integration metadata if needed
      };

      this.setState({
        integrations: {
          ...this.state.integrations,
          square: squareIntegration
        },
        lastFetch: Date.now()
      });

      console.log(`IntegrationsSingleton: Fetched Square integration for tenant ${this.tenantId}`);
      return squareIntegration;
    } catch (error) {
      clientLogger.error(`IntegrationsSingleton: Error fetching Square integration:`, { detail: error });
      throw error;
    }
  }

  // Convenience method to fetch all integrations
  async fetchAll(forceRefresh = false): Promise<IntegrationStatus> {
    const [clover, square] = await Promise.allSettled([
      this.fetchCloverIntegration(forceRefresh),
      this.fetchSquareIntegration(forceRefresh)
    ]);

    return {
      clover: clover.status === 'fulfilled' ? clover.value : null,
      square: square.status === 'fulfilled' ? square.value : null
    };
  }

  hasActiveIntegration(): boolean {
    return !!(this.state.integrations.clover?.connected || this.state.integrations.square?.connected);
  }

  getActiveIntegrations(): string[] {
    const active: string[] = [];
    if (this.state.integrations.clover?.connected) active.push('clover');
    if (this.state.integrations.square?.connected) active.push('square');
    return active;
  }

  clearCache(): void {
    this.setState({
      integrations: {
        clover: null,
        square: null
      },
      lastFetch: null,
      error: null
    });
  }
}

// Export singleton getter
export function getIntegrationsSingleton(tenantId: string): IntegrationsSingleton {
  return IntegrationsSingleton.getInstance(tenantId);
}

export function destroyIntegrationsSingleton(tenantId: string): void {
  IntegrationsSingleton.destroyInstance(tenantId);
}

export default IntegrationsSingleton;

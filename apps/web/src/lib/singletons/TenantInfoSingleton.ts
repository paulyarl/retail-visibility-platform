/**
 * Tenant Info Singleton
 * 
 * Manages tenant information with automatic caching:
 * - Tenant details (name, slug, status)
 * - Tenant profile (logo, branding)
 * - Tenant tier information
 * 
 * Used by: StoreInventoryHeader, QRCodeModal, and other components
 * needing tenant metadata.
 */

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionTier?: string;
  organizationId?: string;
}

interface TenantProfile {
  logo_url?: string;
  banner_url?: string;
  primary_color?: string;
  secondary_color?: string;
  description?: string;
}

interface TenantTier {
  id: string;
  name: string;
  effective?: {
    id: string;
    name: string;
    source: 'tenant' | 'organization';
  };
}

interface TenantInfoState {
  info: TenantInfo | null;
  profile: TenantProfile | null;
  tier: TenantTier | null;
  loading: boolean;
  error: string | null;
  lastFetch: {
    info: number | null;
    profile: number | null;
    tier: number | null;
  };
}

class TenantInfoSingleton {
  private static instances: Map<string, TenantInfoSingleton> = new Map();
  private state: TenantInfoState;
  private listeners: Set<() => void> = new Set();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

  private constructor(private tenantId: string) {
    this.state = {
      info: null,
      profile: null,
      tier: null,
      loading: false,
      error: null,
      lastFetch: {
        info: null,
        profile: null,
        tier: null
      }
    };
  }

  static getInstance(tenantId: string): TenantInfoSingleton {
    if (!TenantInfoSingleton.instances.has(tenantId)) {
      TenantInfoSingleton.instances.set(tenantId, new TenantInfoSingleton(tenantId));
    }
    return TenantInfoSingleton.instances.get(tenantId)!;
  }

  static destroyInstance(tenantId: string): void {
    TenantInfoSingleton.instances.delete(tenantId);
  }

  private setState(updates: Partial<TenantInfoState>) {
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

  getState(): TenantInfoState {
    return this.state;
  }

  async fetchTenantInfo(forceRefresh = false): Promise<TenantInfo | null> {
    // Check cache first
    if (!forceRefresh && this.state.lastFetch.info) {
      const cacheAge = Date.now() - this.state.lastFetch.info;
      if (cacheAge < this.CACHE_TTL && this.state.info) {
        console.log(`TenantInfoSingleton: Using cached info for tenant ${this.tenantId} (age: ${Math.round(cacheAge / 1000)}s)`);
        return this.state.info;
      }
    }

    this.setState({ loading: true, error: null });

    try {
      console.log(`TenantInfoSingleton: Fetching info for tenant ${this.tenantId}`);
      const response = await fetch(`${this.API_BASE_URL}/api/tenants/${this.tenantId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tenant info: ${response.status}`);
      }

      const data = await response.json();
      const info: TenantInfo = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        status: data.status,
        subscriptionTier: data.subscriptionTier,
        organizationId: data.organizationId
      };

      this.setState({
        info,
        loading: false,
        error: null,
        lastFetch: { ...this.state.lastFetch, info: Date.now() }
      });

      console.log(`TenantInfoSingleton: Fetched info for tenant ${this.tenantId}`);
      return info;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`TenantInfoSingleton: Error fetching info:`, error);
      
      this.setState({
        loading: false,
        error: errorMessage
      });

      throw error;
    }
  }

  async fetchTenantProfile(forceRefresh = false): Promise<TenantProfile | null> {
    // Check cache first
    if (!forceRefresh && this.state.lastFetch.profile) {
      const cacheAge = Date.now() - this.state.lastFetch.profile;
      if (cacheAge < this.CACHE_TTL && this.state.profile) {
        console.log(`TenantInfoSingleton: Using cached profile for tenant ${this.tenantId} (age: ${Math.round(cacheAge / 1000)}s)`);
        return this.state.profile;
      }
    }

    try {
      console.log(`TenantInfoSingleton: Fetching profile for tenant ${this.tenantId}`);
      const response = await fetch(`${this.API_BASE_URL}/api/tenants/${this.tenantId}/profile`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tenant profile: ${response.status}`);
      }

      const profile = await response.json();

      this.setState({
        profile,
        lastFetch: { ...this.state.lastFetch, profile: Date.now() }
      });

      console.log(`TenantInfoSingleton: Fetched profile for tenant ${this.tenantId}`);
      return profile;
    } catch (error) {
      console.error(`TenantInfoSingleton: Error fetching profile:`, error);
      throw error;
    }
  }

  async fetchTenantTier(forceRefresh = false): Promise<TenantTier | null> {
    // Check cache first
    if (!forceRefresh && this.state.lastFetch.tier) {
      const cacheAge = Date.now() - this.state.lastFetch.tier;
      if (cacheAge < this.CACHE_TTL && this.state.tier) {
        console.log(`TenantInfoSingleton: Using cached tier for tenant ${this.tenantId} (age: ${Math.round(cacheAge / 1000)}s)`);
        return this.state.tier;
      }
    }

    try {
      console.log(`TenantInfoSingleton: Fetching tier for tenant ${this.tenantId}`);
      const response = await fetch(`${this.API_BASE_URL}/api/tenants/${this.tenantId}/tier/public`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tenant tier: ${response.status}`);
      }

      const tier = await response.json();

      this.setState({
        tier,
        lastFetch: { ...this.state.lastFetch, tier: Date.now() }
      });

      console.log(`TenantInfoSingleton: Fetched tier for tenant ${this.tenantId}`);
      return tier;
    } catch (error) {
      console.error(`TenantInfoSingleton: Error fetching tier:`, error);
      throw error;
    }
  }

  // Convenience method to fetch all tenant data at once
  async fetchAll(forceRefresh = false): Promise<{
    info: TenantInfo | null;
    profile: TenantProfile | null;
    tier: TenantTier | null;
  }> {
    const [info, profile, tier] = await Promise.all([
      this.fetchTenantInfo(forceRefresh),
      this.fetchTenantProfile(forceRefresh),
      this.fetchTenantTier(forceRefresh)
    ]);

    return { info, profile, tier };
  }

  clearCache(): void {
    this.setState({
      info: null,
      profile: null,
      tier: null,
      lastFetch: {
        info: null,
        profile: null,
        tier: null
      },
      error: null
    });
  }
}

// Export singleton getter
export function getTenantInfoSingleton(tenantId: string): TenantInfoSingleton {
  return TenantInfoSingleton.getInstance(tenantId);
}

export function destroyTenantInfoSingleton(tenantId: string): void {
  TenantInfoSingleton.destroyInstance(tenantId);
}

export default TenantInfoSingleton;

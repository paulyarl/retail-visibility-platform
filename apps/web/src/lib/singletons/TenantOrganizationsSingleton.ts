/**
 * Tenant Organizations Singleton
 * 
 * Manages organizations state and operations for admin functionality.
 * Follows the same pattern as TenantFeaturedProductsSingleton.
 */

import { apiRequest } from '@/lib/api';

// Types
export interface Organization {
  id: string;
  name: string;
  maxLocations: number;
  maxTotalSKUs: number;
  subscriptionTier: string;
  subscriptionStatus: string;
  createdAt: string;
  updatedAt: string;
  tenants: Array<{
    id: string;
    name: string;
    _count: { items: number };
  }>;
  stats: {
    totalLocations: number;
    totalSKUs: number;
    utilizationPercent: number;
  };
}

export interface Tenant {
  id: string;
  name: string;
  subscription_tier?: string;
  subscription_status?: string;
}

export interface OrganizationsState {
  organizations: Organization[];
  availableTenants: Tenant[];
  loading: boolean;
  error: string | null;
  processing: boolean;
  lastUpdated: Date | null;
}

export interface CreateOrganizationData {
  name: string;
  subscription_tier: string;
  max_locations: number;
}

export interface UpdateOrganizationData {
  subscription_tier: string;
  subscription_status: string;
  max_locations: number;
}

class TenantOrganizationsSingleton {
  private static instances: Map<string, TenantOrganizationsSingleton> = new Map();
  
  private state: OrganizationsState = {
    organizations: [],
    availableTenants: [],
    loading: false,
    error: null,
    processing: false,
    lastUpdated: null,
  };
  
  private subscribers: Set<(state: OrganizationsState) => void> = new Set();
  private tenantId: string;

  private constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  static getInstance(tenantId: string): TenantOrganizationsSingleton {
    if (!this.instances.has(tenantId)) {
      this.instances.set(tenantId, new TenantOrganizationsSingleton(tenantId));
    }
    return this.instances.get(tenantId)!;
  }

  static destroyInstance(tenantId: string): void {
    const instance = this.instances.get(tenantId);
    if (instance) {
      instance.subscribers.clear();
      this.instances.delete(tenantId);
    }
  }

  // State subscription
  subscribe(callback: (state: OrganizationsState) => void): () => void {
    this.subscribers.add(callback);
    callback(this.state);
    return () => this.subscribers.delete(callback);
  }

  private setState(updates: Partial<OrganizationsState>): void {
    this.state = { ...this.state, ...updates, lastUpdated: new Date() };
    this.subscribers.forEach(callback => callback(this.state));
  }

  // Get current state
  getState(): OrganizationsState {
    return { ...this.state };
  }

  // Data fetching methods
  async fetchOrganizations(skipCache: boolean = false): Promise<void> {
    this.setState({ loading: true, error: null });
    
    try {
      console.log('TenantOrganizationsSingleton: Fetching organizations...');
      const response = await apiRequest('/api/organizations', { skipCache });
      const data = await response.json();
      
      console.log('TenantOrganizationsSingleton: Raw organizations response:', data);
      
      // Transform snake_case API response to camelCase for frontend
      const transformed = (Array.isArray(data) ? data : []).map((org: any) => ({
        id: org.id,
        name: org.name,
        maxLocations: org.max_locations ?? org.maxLocations ?? 5,
        maxTotalSKUs: org.max_total_skus ?? org.maxTotalSKUs ?? 2500,
        subscriptionTier: org.subscription_tier ?? org.subscriptionTier ?? 'chain_starter',
        subscriptionStatus: org.subscription_status ?? org.subscriptionStatus ?? 'active',
        createdAt: org.created_at ?? org.createdAt,
        updatedAt: org.updated_at ?? org.updatedAt,
        tenants: (org.tenants || []).map((tenant: any) => ({
          id: tenant.id,
          name: tenant.name,
          _count: { items: tenant._count?.inventory_items ?? tenant._count?.items ?? 0 }
        })),
        stats: {
          totalLocations: org.stats?.total_locations ?? org.stats?.totalLocations ?? 0,
          totalSKUs: org.stats?.total_skus ?? org.stats?.totalSKUs ?? 0,
          utilizationPercent: org.stats?.utilization_percent ?? org.stats?.utilizationPercent ?? 0
        }
      }));
      
      this.setState({ organizations: transformed });
      console.log('TenantOrganizationsSingleton: Organizations fetched successfully', transformed.length);
    } catch (error) {
      console.error('TenantOrganizationsSingleton: Error fetching organizations:', error);
      this.setState({ error: error instanceof Error ? error.message : 'Failed to fetch organizations' });
    } finally {
      this.setState({ loading: false });
    }
  }

  async fetchAvailableTenants(): Promise<void> {
    try {
      console.log('TenantOrganizationsSingleton: Fetching available tenants...');
      const response = await apiRequest('/api/tenants');
      const data = await response.json();
      
      console.log('TenantOrganizationsSingleton: Available tenants response:', data);
      
      const tenants = Array.isArray(data) ? data : [];
      this.setState({ availableTenants: tenants });
      console.log('TenantOrganizationsSingleton: Available tenants fetched successfully', tenants.length);
    } catch (error) {
      console.error('TenantOrganizationsSingleton: Error fetching available tenants:', error);
      // Don't set error state for this secondary fetch
    }
  }

  // Organization management methods
  async createOrganization(data: CreateOrganizationData): Promise<void> {
    this.setState({ processing: true, error: null });
    
    try {
      console.log('TenantOrganizationsSingleton: Creating organization:', data);
      
      const response = await apiRequest('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name.trim(),
          subscription_tier: data.subscription_tier,
          max_locations: data.max_locations,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create organization: ${response.status}`);
      }

      const newOrg = await response.json();
      console.log('TenantOrganizationsSingleton: Organization created successfully:', newOrg);
      
      // Refresh organizations list
      await this.fetchOrganizations();
    } catch (error) {
      console.error('TenantOrganizationsSingleton: Error creating organization:', error);
      this.setState({ error: error instanceof Error ? error.message : 'Failed to create organization' });
      throw error;
    } finally {
      this.setState({ processing: false });
    }
  }

  async updateOrganization(orgId: string, data: UpdateOrganizationData): Promise<void> {
    this.setState({ processing: true, error: null });
    
    try {
      console.log('TenantOrganizationsSingleton: Updating organization:', orgId, data);
      
      const response = await apiRequest(`/api/organizations/${orgId}/self-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_tier: data.subscription_tier,
          subscription_status: data.subscription_status,
          max_locations: data.max_locations,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update organization: ${response.status}`);
      }

      const updatedOrg = await response.json();
      console.log('TenantOrganizationsSingleton: Organization updated successfully:', updatedOrg);
      
      // Refresh organizations list with cache bypass to ensure fresh data
      await this.fetchOrganizations(true);
    } catch (error) {
      console.error('TenantOrganizationsSingleton: Error updating organization:', error);
      this.setState({ error: error instanceof Error ? error.message : 'Failed to update organization' });
      throw error;
    } finally {
      this.setState({ processing: false });
    }
  }

  async addTenantToOrganization(orgId: string, tenantId: string): Promise<void> {
    this.setState({ processing: true, error: null });
    
    try {
      console.log('TenantOrganizationsSingleton: Adding tenant to organization:', orgId, tenantId);
      
      const response = await apiRequest(`/api/organizations/${orgId}/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to add tenant to organization: ${response.status}`);
      }

      const result = await response.json();
      console.log('TenantOrganizationsSingleton: Tenant added to organization successfully:', result);
      
      // Refresh organizations list
      await this.fetchOrganizations();
    } catch (error) {
      console.error('TenantOrganizationsSingleton: Error adding tenant to organization:', error);
      this.setState({ error: error instanceof Error ? error.message : 'Failed to add tenant to organization' });
      throw error;
    } finally {
      this.setState({ processing: false });
    }
  }

  async removeTenantFromOrganization(orgId: string, tenantId: string): Promise<void> {
    this.setState({ processing: true, error: null });
    
    try {
      console.log('TenantOrganizationsSingleton: Removing tenant from organization:', orgId, tenantId);
      
      const response = await apiRequest(`/api/organizations/${orgId}/tenants/${tenantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to remove tenant from organization: ${response.status}`);
      }

      console.log('TenantOrganizationsSingleton: Tenant removed from organization successfully');
      
      // Refresh organizations list
      await this.fetchOrganizations();
    } catch (error) {
      console.error('TenantOrganizationsSingleton: Error removing tenant from organization:', error);
      this.setState({ error: error instanceof Error ? error.message : 'Failed to remove tenant from organization' });
      throw error;
    } finally {
      this.setState({ processing: false });
    }
  }

  // Utility methods
  clearError(): void {
    this.setState({ error: null });
  }

  reset(): void {
    this.setState({
      organizations: [],
      availableTenants: [],
      loading: false,
      error: null,
      processing: false,
      lastUpdated: null,
    });
  }
}

// Export singleton getter and types
export const getTenantOrganizationsSingleton = (tenantId: string) => 
  TenantOrganizationsSingleton.getInstance(tenantId);

export const destroyTenantOrganizationsSingleton = (tenantId: string) => 
  TenantOrganizationsSingleton.destroyInstance(tenantId);

export { TenantOrganizationsSingleton };

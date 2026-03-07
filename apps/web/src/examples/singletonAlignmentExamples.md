/**
 * Singleton Alignment Examples
 * 
 * Shows how to align all singletons with the context-aware cache manager
 */

import contextCacheManager from '@/utils/contextCacheManager';

// ========================================
// PRODUCT SINGLETON ALIGNMENT
// ========================================

// Before: Simple in-memory cache
// const cache = new Map<string, Product[]>();

// After: Context-aware product caching
export class AlignedProductSingleton {
  async getFeaturedProducts(location: { lat: number; lng: number } | undefined, limit: number = 20) {
    const cacheKey = `featured-${location?.lat || 'default'}-${location?.lng || 'default'}-${limit}`;
    
    // Use product context (shared data, medium TTL, compression)
    const cached = await contextCacheManager.getProductData(cacheKey);
    if (cached) {
      console.log('[ProductSingleton] Cache HIT:', cacheKey);
      return cached;
    }

    // Fetch from API
    const products = await this.fetchFromAPI(location, limit);
    
    // Store in product context
    await contextCacheManager.setProductData(cacheKey, products);
    console.log('[ProductSingleton] Cache MISS - stored:', cacheKey);
    
    return products;
  }

  async getProductCategories() {
    const cacheKey = 'categories-all';
    
    const cached = await contextCacheManager.getProductData(cacheKey);
    if (cached) return cached;

    const categories = await this.fetchCategories();
    await contextCacheManager.setProductData(cacheKey, categories);
    
    return categories;
  }

  private async fetchFromAPI(location: { lat: number; lng: number } | undefined, limit: number) {
    // API call implementation
    return [];
  }

  private async fetchCategories() {
    // API call implementation
    return [];
  }
}

// ========================================
// TENANT SINGLETON ALIGNMENT
// ========================================

export class AlignedTenantSingleton {
  async getTenantSettings(tenantId: string) {
    const cacheKey = 'settings';
    
    // Use tenant context (isolated per tenant, long TTL, encrypted)
    const cached = await contextCacheManager.getTenantData(tenantId, cacheKey);
    if (cached) {
      console.log('[TenantSingleton] Cache HIT for tenant:', tenantId);
      return cached;
    }

    const settings = await this.fetchTenantSettings(tenantId);
    await contextCacheManager.setTenantData(tenantId, cacheKey, settings);
    
    return settings;
  }

  async getTenantBranding(tenantId: string) {
    const cacheKey = 'branding';
    
    const cached = await contextCacheManager.getTenantData(tenantId, cacheKey);
    if (cached) return cached;

    const branding = await this.fetchTenantBranding(tenantId);
    await contextCacheManager.setTenantData(tenantId, cacheKey, branding);
    
    return branding;
  }

  private async fetchTenantSettings(tenantId: string) {
    // API call implementation
    return {};
  }

  private async fetchTenantBranding(tenantId: string) {
    // API call implementation
    return {};
  }
}

// ========================================
// STORE SINGLETON ALIGNMENT
// ========================================

class AlignedStoreSingleton {
  async getFeaturedStores(location: { lat: number; lng: number; radius: number }, limit: number = 10) {
    const locationKey = `${location.lat}-${location.lng}-${location.radius}`;
    const cacheKey = `featured-${locationKey}-${limit}`;
    
    // Use store context (location-based, medium TTL, compressed)
    const cached = await contextCacheManager.getStoreData(locationKey, cacheKey);
    if (cached) {
      console.log('[StoreSingleton] Cache HIT for location:', locationKey);
      return cached;
    }

    const stores = await this.fetchFeaturedStores(location, limit);
    await contextCacheManager.setStoreData(locationKey, cacheKey, stores);
    
    return stores;
  }

  async getStoreCategories(location: { lat: number; lng: number }) {
    const locationKey = `${location.lat}-${location.lng}`;
    const cacheKey = 'categories';
    
    const cached = await contextCacheManager.getStoreData(locationKey, cacheKey);
    if (cached) return cached;

    const categories = await this.fetchStoreCategories(location);
    await contextCacheManager.setStoreData(locationKey, cacheKey, categories);
    
    return categories;
  }

  private async fetchFeaturedStores(location: { lat: number; lng: number; radius: number }, limit: number) {
    // API call implementation
    return [];
  }

  private async fetchStoreCategories(location: { lat: number; lng: number }) {
    // API call implementation
    return [];
  }
}

// ========================================
// ADMIN SINGLETON ALIGNMENT
// ========================================

class AlignedAdminSingleton {
  async getUserPermissions(userId: string) {
    const cacheKey = 'permissions';
    
    // Use admin context (security-focused, short TTL, encrypted)
    const cached = await contextCacheManager.getAdminData(cacheKey);
    if (cached) {
      console.log('[AdminSingleton] Cache HIT for permissions');
      return cached;
    }

    const permissions = await this.fetchUserPermissions(userId);
    await contextCacheManager.setAdminData(cacheKey, permissions);
    
    return permissions;
  }

  async getSystemSettings() {
    const cacheKey = 'system-settings';
    
    const cached = await contextCacheManager.getAdminData(cacheKey);
    if (cached) return cached;

    const settings = await this.fetchSystemSettings();
    await contextCacheManager.setAdminData(cacheKey, settings);
    
    return settings;
  }

  private async fetchUserPermissions(userId: string) {
    // API call implementation
    return {};
  }

  private async fetchSystemSettings() {
    // API call implementation
    return {};
  }
}

// ========================================
// USER SINGLETON ALIGNMENT
// ========================================

class AlignedUserSingleton {
  async getUserProfile(userId: string) {
    const cacheKey = 'profile';
    
    // Use user context (personal data, session-based, memory-only)
    const cached = await contextCacheManager.getUserData(userId, cacheKey);
    if (cached) {
      console.log('[UserSingleton] Cache HIT for user profile:', userId);
      return cached;
    }

    const profile = await this.fetchUserProfile(userId);
    await contextCacheManager.setUserData(userId, cacheKey, profile);
    
    return profile;
  }

  async getUserPreferences(userId: string) {
    const cacheKey = 'preferences';
    
    const cached = await contextCacheManager.getUserData(userId, cacheKey);
    if (cached) return cached;

    const preferences = await this.fetchUserPreferences(userId);
    await contextCacheManager.setUserData(userId, cacheKey, preferences);
    
    return preferences;
  }

  private async fetchUserProfile(userId: string) {
    // API call implementation
    return {};
  }

  private async fetchUserPreferences(userId: string) {
    // API call implementation
    return {};
  }
}

// ========================================
// USAGE EXAMPLES
// ========================================

// Example: Using the aligned singletons
export async function exampleUsage() {
  // Product Singleton
  const productSingleton = new AlignedProductSingleton();
  const featuredProducts = await productSingleton.getFeaturedProducts(
    { lat: 40.7128, lng: -74.0060 }, 
    10
  );

  // Tenant Singleton
  const tenantSingleton = new AlignedTenantSingleton();
  const tenantSettings = await tenantSingleton.getTenantSettings('tenant-123');

  // Store Singleton
  const storeSingleton = new AlignedStoreSingleton();
  const nycStores = await storeSingleton.getFeaturedStores(
    { lat: 40.7128, lng: -74.0060, radius: 50 },
    20
  );

  // Admin Singleton
  const adminSingleton = new AlignedAdminSingleton();
  const permissions = await adminSingleton.getUserPermissions('admin-user');

  // User Singleton
  const userSingleton = new AlignedUserSingleton();
  const userProfile = await userSingleton.getUserProfile('user-456');

  // Get cache statistics
  const stats = contextCacheManager.getStats();
  console.log('Cache Statistics:', stats);
}

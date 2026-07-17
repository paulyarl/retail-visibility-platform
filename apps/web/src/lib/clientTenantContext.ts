import { clientLogger } from '@/lib/client-logger';

/**
 * Client-Side Tenant Context Utility
 * 
 * Centralized utility for managing tenant context on the client side
 * Works for both authenticated and public pages
 * Provides consistent tenant ID resolution from multiple sources
 */

export type TenantContextSource = 'url' | 'localStorage' | 'sessionStorage' | 'cookie' | 'none';

export interface TenantContextInfo {
  tenantId: string | null;
  source: TenantContextSource;
  url?: string;
}

/**
 * Centralized tenant context management for client-side
 * Provides consistent tenant ID resolution across the platform
 */
export class ClientTenantContextManager {
  private static instance: ClientTenantContextManager;
  
  // Storage keys
  private static readonly TENANT_ID_KEY = 'currentTenantId';
  private static readonly TENANT_CONTEXT_KEY = 'tenantContext';
  
  private constructor() {}
  
  public static getInstance(): ClientTenantContextManager {
    if (!ClientTenantContextManager.instance) {
      ClientTenantContextManager.instance = new ClientTenantContextManager();
    }
    return ClientTenantContextManager.instance;
  }
  
  /**
   * Get current tenant ID with fallback priority:
   * 1. URL pattern (highest priority for public pages)
   * 2. localStorage
   * 3. sessionStorage
   * 4. Cookie
   * 5. null (no tenant context)
   */
  public getCurrentTenantId(): string | null {
    const context = this.getTenantContext();
    return context.tenantId;
  }
  
  /**
   * Get detailed tenant context information
   */
  public getTenantContext(): TenantContextInfo {
    // Try URL extraction first (for public pages)
    const urlTenantId = this.extractFromUrl();
    if (urlTenantId) {
      return {
        tenantId: urlTenantId,
        source: 'url',
        url: window.location.pathname
      };
    }
    
    // Try localStorage (for authenticated pages)
    const localStorageTenantId = this.getFromLocalStorage();
    if (localStorageTenantId) {
      return {
        tenantId: localStorageTenantId,
        source: 'localStorage'
      };
    }
    
    // Try sessionStorage
    const sessionStorageTenantId = this.getFromSessionStorage();
    if (sessionStorageTenantId) {
      return {
        tenantId: sessionStorageTenantId,
        source: 'sessionStorage'
      };
    }
    
    // Try cookie
    const cookieTenantId = this.getFromCookie();
    if (cookieTenantId) {
      return {
        tenantId: cookieTenantId,
        source: 'cookie'
      };
    }
    
    // No tenant context found
    return {
      tenantId: null,
      source: 'none'
    };
  }
  
  /**
   * Set current tenant context
   * Updates all storage mechanisms for consistency
   */
  public setTenantContext(tenantId: string, source: TenantContextSource = 'localStorage'): void {
    if (!tenantId) {
      this.clearTenantContext();
      return;
    }
    
    // Update localStorage (primary storage)
    this.setInLocalStorage(tenantId);
    
    // Update sessionStorage (for session consistency)
    this.setInSessionStorage(tenantId);
    
    // Update cookie (for server-side access)
    this.setInCookie(tenantId);
    
    // Store context metadata
    const contextInfo: TenantContextInfo = {
      tenantId,
      source,
      url: window.location.pathname
    };
    
    try {
      localStorage.setItem(ClientTenantContextManager.TENANT_CONTEXT_KEY, JSON.stringify(contextInfo));
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to store context metadata:', { detail: error });
    }
    
    // console.log(`[ClientTenantContextManager] Tenant context set: ${tenantId} (source: ${source})`);
  }
  
  /**
   * Clear tenant context from all storage
   */
  public clearTenantContext(): void {
    this.removeFromLocalStorage();
    this.removeFromSessionStorage();
    this.removeFromCookie();
    
    try {
      localStorage.removeItem(ClientTenantContextManager.TENANT_CONTEXT_KEY);
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to clear context metadata:', { detail: error });
    }
    
    console.log('[ClientTenantContextManager] Tenant context cleared');
  }
  
  /**
   * Extract tenant ID from URL patterns
   * Supports: /shops/[tenantId], /tenant/[tenantId], /directory/[slug], /t/[tenantId]
   */
  private extractFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const pathname = window.location.pathname;
      
      // Extract from /shops/[tenantId]
      const shopsMatch = pathname.match(/^\/shops\/([^\/]+)/);
      if (shopsMatch) return shopsMatch[1];
      
      // Extract from /tenant/[tenantId]
      const tenantMatch = pathname.match(/^\/tenant\/([^\/]+)/);
      if (tenantMatch) return tenantMatch[1];
      
      // Extract from /t/[tenantId] (short form)
      const shortTenantMatch = pathname.match(/^\/t\/([^\/]+)/);
      if (shortTenantMatch) return shortTenantMatch[1];
      
      // Extract from /directory/[slug] (could be tenant ID or slug)
      const directoryMatch = pathname.match(/^\/directory\/([^\/]+)/);
      if (directoryMatch) return directoryMatch[1];
      
      return null;
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to extract tenant ID from URL:', { detail: error });
      return null;
    }
  }
  
  /**
   * Get tenant ID from localStorage
   */
  private getFromLocalStorage(): string | null {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      return null;
    }
    
    try {
      return localStorage.getItem(ClientTenantContextManager.TENANT_ID_KEY);
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to read from localStorage:', { detail: error });
      return null;
    }
  }
  
  /**
   * Set tenant ID in localStorage
   */
  private setInLocalStorage(tenantId: string): void {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      localStorage.setItem(ClientTenantContextManager.TENANT_ID_KEY, tenantId);
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to write to localStorage:', { detail: error });
    }
  }
  
  /**
   * Remove tenant ID from localStorage
   */
  private removeFromLocalStorage(): void {
    // Check if we're on the client side
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      localStorage.removeItem(ClientTenantContextManager.TENANT_ID_KEY);
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to remove from localStorage:', { detail: error });
    }
  }
  
  /**
   * Get tenant ID from sessionStorage
   */
  private getFromSessionStorage(): string | null {
    // Check if we're on the server side
    if (typeof window === 'undefined') return null;
    
    try {
      return sessionStorage.getItem(ClientTenantContextManager.TENANT_ID_KEY);
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to read from sessionStorage:', { detail: error });
      return null;
    }
  }
  
  /**
   * Set tenant ID in sessionStorage
   */
  private setInSessionStorage(tenantId: string): void {
    // Check if we're on the server side
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.setItem(ClientTenantContextManager.TENANT_ID_KEY, tenantId);
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to write to sessionStorage:', { detail: error });
    }
  }
  
  /**
   * Remove tenant ID from sessionStorage
   */
  private removeFromSessionStorage(): void {
    // Check if we're on the server side
    if (typeof window === 'undefined') return;
    
    try {
      sessionStorage.removeItem(ClientTenantContextManager.TENANT_ID_KEY);
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to remove from sessionStorage:', { detail: error });
    }
  }
  
  /**
   * Get tenant ID from cookie
   */
  private getFromCookie(): string | null {
    // Check if we're on the server side
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === ClientTenantContextManager.TENANT_ID_KEY) {
          return decodeURIComponent(value);
        }
      }
      return null;
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to read from cookie:', { detail: error });
      return null;
    }
  }
  
  /**
   * Set tenant ID in cookie
   */
  private setInCookie(tenantId: string): void {
    // Check if we're on the server side
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    
    try {
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry
      document.cookie = `${ClientTenantContextManager.TENANT_ID_KEY}=${encodeURIComponent(tenantId)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to write to cookie:', { detail: error });
    }
  }
  
  /**
   * Remove tenant ID from cookie
   */
  private removeFromCookie(): void {
    // Check if we're on the server side
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    
    try {
      document.cookie = `${ClientTenantContextManager.TENANT_ID_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    } catch (error) {
      clientLogger.warn('[ClientTenantContextManager] Failed to remove from cookie:', { detail: error });
    }
  }
  
  /**
   * Auto-detect and set tenant context from current URL
   * Call this when entering a tenant-specific page
   */
  public autoSetFromUrl(): boolean {
    const urlTenantId = this.extractFromUrl();
    if (urlTenantId) {
      this.setTenantContext(urlTenantId, 'url');
      return true;
    }
    return false;
  }
  
  /**
   * Check if currently in a tenant context
   */
  public isInTenantContext(): boolean {
    return this.getCurrentTenantId() !== null;
  }
  
  /**
   * Get tenant-aware cache key
   * Centralized method for all services to use
   */
  public getTenantAwareCacheKey(baseKey: string, tenantId?: string): string {
    const contextTenantId = tenantId || this.getCurrentTenantId();
    return contextTenantId ? `${baseKey}-${contextTenantId}` : baseKey;
  }
}

// Export singleton instance
export const clientTenantContextManager = ClientTenantContextManager.getInstance();

// Export convenience functions
export const getCurrentTenantId = () => clientTenantContextManager.getCurrentTenantId();
export const setTenantContext = (tenantId: string, source?: TenantContextSource) => 
  clientTenantContextManager.setTenantContext(tenantId, source);
export const getTenantAwareCacheKey = (baseKey: string, tenantId?: string) => 
  clientTenantContextManager.getTenantAwareCacheKey(baseKey, tenantId);
export const isInTenantContext = () => clientTenantContextManager.isInTenantContext();
export const autoSetFromUrl = () => clientTenantContextManager.autoSetFromUrl();

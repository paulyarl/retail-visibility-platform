/**
 * Universal Behavior Tracking Helper
 * 
 * Supports tracking across all pages:
 * - Store directory entry (/directory/[slug])
 * - Public product pages (/products/[productId])
 * - Public storefront (/tenant/[tenantId])
 * - Directory entry (/directory)
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { api } from '@/lib/api';

// Client-side tracking cache
interface CachedTrackingEvent extends TrackingData {
  timestamp: number;
  sessionId?: string;
  userId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// Event priority mapping for analytics optimization
const EVENT_PRIORITY_MAP: Record<string, CachedTrackingEvent['priority']> = {
  // Critical events - send immediately when possible
  'product_purchase': 'critical',
  'user_signup': 'critical',
  'subscription_upgrade': 'critical',
  
  // High priority events - send within current batch
  'store_view': 'high',
  'product_view': 'high',
  'category_browse': 'high',
  'search': 'high',
  
  // Normal priority - standard batch timing
  'storefront_view': 'normal',
  'directory_detail': 'normal',
  'product_page': 'normal',
  
  // Low priority - can be delayed
  'page_scroll': 'low',
  'time_spent': 'low',
  'element_click': 'low'
};

class BehaviorTrackingCache {
  private events: CachedTrackingEvent[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL = 30000; // 30 seconds
  private readonly MAX_CACHE_SIZE = 100; // Prevent memory issues
  private readonly STORAGE_KEY = 'behavior_tracking_cache';
  private readonly RETRY_KEY = 'behavior_tracking_retry_state';
  private isSending = false;
  private isOnline = true;
  private retryState: {
    attempts: number;
    nextRetryAt: number;
    lastFailureReason?: string;
  } = { attempts: 0, nextRetryAt: 0 };

  constructor() {
    this.loadFromStorage();
    this.loadRetryState();
    this.setupOnlineDetection();
    this.startBatchTimer();
    this.setupUnloadHandler();
  }

  /**
   * Add event to cache with priority assignment
   */
  addEvent(event: Omit<CachedTrackingEvent, 'timestamp' | 'priority'>): void {
    const priority = this.determineEventPriority(event as TrackingData);
    const cachedEvent: CachedTrackingEvent = {
      ...(event as TrackingData),
      timestamp: Date.now(),
      priority
    };

    this.events.push(cachedEvent);
    
    // Prevent excessive memory usage
    if (this.events.length > this.MAX_CACHE_SIZE) {
      // Remove lowest priority events first
      this.events.sort((a, b) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority));
      this.events = this.events.slice(-this.MAX_CACHE_SIZE);
    }
    
    this.saveToStorage();

    // Check if we should send critical events immediately
    if (priority === 'critical' && this.isOnline && !this.isSending) {
      console.log('[BehaviorTracking] Critical event detected, sending immediately');
      setTimeout(() => this.sendBatch(), 100); // Small delay to allow batching
    }
  }

  /**
   * Determine event priority based on entity type and context
   */
  private determineEventPriority(event: Omit<CachedTrackingEvent, 'timestamp' | 'priority'>): CachedTrackingEvent['priority'] {
    // Check entity type first
    const entityPriority = EVENT_PRIORITY_MAP[event.entityType];
    if (entityPriority) return entityPriority;

    // Check page type
    const pagePriority = EVENT_PRIORITY_MAP[event.pageType || ''];
    if (pagePriority) return pagePriority;

    // Check context for specific indicators
    if (event.context) {
      if (event.context.purchase || event.context.conversion) return 'critical';
      if (event.context.search || event.context.filter) return 'high';
    }

    return 'normal'; // Default priority
  }

  /**
   * Get numeric weight for priority sorting (higher = more important)
   */
  private getPriorityWeight(priority?: CachedTrackingEvent['priority']): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Send cached events in batches with retry logic
   */
  private async sendBatch(): Promise<void> {
    // Don't send if offline
    if (!this.isOnline) {
      console.log('[BehaviorTracking] Skipping batch send - offline');
      return;
    }

    // Check if we're in retry cooldown
    const now = Date.now();
    if (this.retryState.nextRetryAt > now) {
      console.log(`[BehaviorTracking] Skipping batch send - retry cooldown until ${new Date(this.retryState.nextRetryAt).toISOString()}`);
      return;
    }

    if (this.events.length === 0 || this.isSending) return;

    this.isSending = true;
    const eventsToSend = [...this.events];
    
    // Sort events by priority (critical first) for optimized sending
    eventsToSend.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
    
    this.events = []; // Clear cache immediately
    this.saveToStorage();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      // Get current location for all events in batch
      const location = await getUserLocationClient();
      
      const batchData = {
        events: eventsToSend.map(event => ({
          ...event,
          locationLat: location?.latitude,
          locationLng: location?.longitude,
          referrer: document.referrer,
          userAgent: navigator.userAgent
        })),
        // Analytics metadata for dashboard adjustments
        batchMetadata: {
          batchSize: eventsToSend.length,
          priorityBreakdown: this.getPriorityBreakdown(eventsToSend),
          clientTimestamp: Date.now(),
          clientVersion: '1.0.0',
          compressionUsed: eventsToSend.length > 10 // Use compression for batches > 10 events
        }
      };

      // Use compression for large batches to reduce network overhead
      let requestBody: string | Blob;
      let headers: Record<string, string> = {};

      if (batchData.batchMetadata.compressionUsed) {
        // Compress large batches using gzip-like compression
        const jsonString = JSON.stringify(batchData);
        requestBody = new Blob([jsonString], { type: 'application/json' });
        headers['Content-Encoding'] = 'gzip'; // Note: This would require server-side decompression
        console.log(`[BehaviorTracking] Using compression for large batch (${eventsToSend.length} events)`);
      } else {
        requestBody = JSON.stringify(batchData);
        headers['Content-Type'] = 'application/json';
      }
      
      const response = await api.post(`${apiUrl}/api/recommendations/track-batch`, {
        method: 'POST',
        headers,
        body: requestBody
      });

      if (!response.ok) {
        throw new Error(`Batch send failed: ${response.status}`);
      }

      // Success - reset retry state
      this.retryState.attempts = 0;
      this.retryState.nextRetryAt = 0;
      this.saveRetryState();

      console.log(`[BehaviorTracking] Sent ${eventsToSend.length} events in batch (priorities: ${Object.entries(this.getPriorityBreakdown(eventsToSend)).map(([p, c]) => `${p}:${c}`).join(', ')})`);
    } catch (error) {
      console.error('[BehaviorTracking] Batch send failed:', error);
      
      // Increment retry attempts
      this.retryState.attempts++;
      this.retryState.lastFailureReason = error instanceof Error ? error.message : 'Unknown error';
      
      // Calculate exponential backoff delay (1min, 2min, 4min, 8min, 16min, max 30min)
      const baseDelay = 60000; // 1 minute
      const maxDelay = 30 * 60000; // 30 minutes
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.retryState.attempts - 1), maxDelay);
      
      this.retryState.nextRetryAt = Date.now() + exponentialDelay;
      this.saveRetryState();
      
      // Re-queue failed events
      this.events.unshift(...eventsToSend);
      this.saveToStorage();
      
      console.log(`[BehaviorTracking] Re-queued ${eventsToSend.length} events, retry attempt ${this.retryState.attempts} in ${Math.round(exponentialDelay / 1000)}s`);
    } finally {
      this.isSending = false;
    }
  }

  /**
   * Get priority breakdown for analytics metadata
   */
  private getPriorityBreakdown(events: CachedTrackingEvent[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    events.forEach(event => {
      const priority = event.priority || 'normal';
      breakdown[priority] = (breakdown[priority] || 0) + 1;
    });
    return breakdown;
  }

  /**
   * Start periodic batch timer
   */
  private startBatchTimer(): void {
    if (typeof window === 'undefined') return;
    
    this.batchInterval = setInterval(() => {
      this.sendBatch();
    }, this.BATCH_INTERVAL);
  }

  /**
   * Setup page unload handler to send remaining events
   */
  private setupUnloadHandler(): void {
    if (typeof window === 'undefined') return;

    const handleUnload = () => {
      // Send synchronously on unload (best effort)
      if (this.events.length > 0 && !this.isSending) {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const eventsToSend = [...this.events];
        
        // Use sendBeacon for reliable delivery on page unload
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify({
            events: eventsToSend.map(event => ({
              ...event,
              referrer: document.referrer,
              userAgent: navigator.userAgent
            }))
          })], { type: 'application/json' });
          
          navigator.sendBeacon(`${apiUrl}/api/recommendations/track-batch`, blob);
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);
  }

  /**
   * Load cached events from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.events = Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.warn('[BehaviorTracking] Failed to load from storage:', error);
      this.events = [];
    }
  }

  /**
   * Save cached events to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.warn('[BehaviorTracking] Failed to save to storage:', error);
    }
  }

  /**
   * Setup online/offline detection
   */
  private setupOnlineDetection(): void {
    if (typeof window === 'undefined') return;

    // Set initial online state
    this.isOnline = navigator.onLine;

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('[BehaviorTracking] Back online, resuming batch sending');
      this.isOnline = true;
      this.retryState.attempts = 0; // Reset retry attempts on reconnection
      this.sendBatch(); // Immediately try to send pending events
    });

    window.addEventListener('offline', () => {
      console.log('[BehaviorTracking] Gone offline, queuing events');
      this.isOnline = false;
    });
  }

  /**
   * Load retry state from localStorage
   */
  private loadRetryState(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.RETRY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.retryState = { ...this.retryState, ...parsed };
      }
    } catch (error) {
      console.warn('[BehaviorTracking] Failed to load retry state:', error);
    }
  }

  /**
   * Save retry state to localStorage
   */
  private saveRetryState(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.RETRY_KEY, JSON.stringify(this.retryState));
    } catch (error) {
      console.warn('[BehaviorTracking] Failed to save retry state:', error);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }
}

// Global cache instance
let trackingCache: BehaviorTrackingCache | null = null;

function getTrackingCache(): BehaviorTrackingCache {
  if (!trackingCache && typeof window !== 'undefined') {
    trackingCache = new BehaviorTrackingCache();
  }
  return trackingCache!;
}

export interface TrackingData {
  entityType: 'store' | 'product' | 'category' | 'search';
  entityId: string;
  entityName?: string;
  context?: any;
  pageType: 'directory_detail' | 'product_page' | 'storefront' | 'directory_home' | 'search_results';
  durationSeconds?: number;
}

/**
 * Track user behavior from any page
 */
export async function trackBehavior(trackingData: TrackingData): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  try {
    // Get user session if available
    const session = await getServerSession(authOptions);
    
    // Extract user ID safely - handle different session structures
    const userId = (session as any)?.user?.id || 
                   (session as any)?.userId || 
                   undefined;
    
    // Get session token if available
    const sessionToken = (session as any)?.sessionToken || 
                         (session as any)?.token || 
                         undefined;
    
    // Get user location (server-side)
    const location = await getUserLocationServer();
    
    await fetch(`${apiUrl}/api/recommendations/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        sessionId: sessionToken,
        ...trackingData,
        locationLat: location?.latitude,
        locationLng: location?.longitude,
        referrer: '', // Server-side can't access referrer easily
        userAgent: '', // Server-side can't access user agent
      })
    });
  } catch (error) {
    console.error('Error tracking behavior:', error);
    // Don't throw - tracking failures shouldn't break the page
  }
}

/**
 * Track store view (for directory detail pages)
 */
export async function trackStoreView(tenantId: string, categories: any[] = []): Promise<void> {
  const primaryCategory = categories.find((c: any) => c.isPrimary) || categories[0];
  
  await trackBehavior({
    entityType: 'store',
    entityId: tenantId,
    entityName: '', // API will fetch store name
    context: {
      category_id: primaryCategory?.id,
      category_slug: primaryCategory?.slug,
      categories: categories.map((c: any) => ({ id: c.id, slug: c.slug }))
    },
    pageType: 'directory_detail'
  });
}

/**
 * Track product view (for product pages)
 */
export async function trackProductView(productId: string, tenantId: string, categoryId?: string): Promise<void> {
  await trackBehavior({
    entityType: 'product',
    entityId: productId,
    context: {
      tenant_id: tenantId,
      category_id: categoryId
    },
    pageType: 'product_page'
  });
}

/**
 * Track category browsing (for directory home and category pages)
 */
export async function trackCategoryBrowse(categoryId: string, categorySlug: string): Promise<void> {
  await trackBehavior({
    entityType: 'category',
    entityId: categoryId,
    entityName: categorySlug,
    context: {
      category_slug: categorySlug
    },
    pageType: 'directory_home'
  });
}

/**
 * Track search behavior
 */
export async function trackSearch(query: string, resultsCount: number): Promise<void> {
  await trackBehavior({
    entityType: 'search',
    entityId: `search_${Date.now()}`, // Generate unique ID for search
    entityName: query,
    context: {
      query,
      results_count: resultsCount
    },
    pageType: 'search_results'
  });
}

/**
 * Track storefront browsing
 */
export async function trackStorefrontView(tenantId: string, categoriesViewed: string[] = []): Promise<void> {
  await trackBehavior({
    entityType: 'store',
    entityId: tenantId,
    context: {
      categories_viewed: categoriesViewed,
      is_storefront: true
    },
    pageType: 'storefront'
  });
}

/**
 * Get user location (server-side)
 */
async function getUserLocationServer(): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  state: string;
} | null> {
  try {
    // For server-side, we can use IP-based location
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    return {
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      city: data.city || 'Unknown',
      state: data.region || 'Unknown'
    };
  } catch (error) {
    console.warn('IP location failed, using default');
    return null;
  }
}

/**
 * Client-side behavior tracking (for interactive elements)
 * Now uses caching for better performance and reliability
 */
// Simple decryption for client-side caching (matches AuthContext)
function decrypt(text: string): string {
  try {
    return decodeURIComponent(atob(text));
  } catch {
    return text;
  }
}

export function trackBehaviorClient(trackingData: Omit<TrackingData, 'durationSeconds'>): void {
  if (typeof window === 'undefined') return;

  // Get user information from localStorage (set by auth context)
  let userId: string | undefined;
  let sessionId: string | undefined;
  
  try {
    const authUser = localStorage.getItem('auth_user_cache');
    
    if (authUser) {
      const decrypted = decrypt(authUser);
      const parsed = JSON.parse(decrypted);
      if (parsed?.user?.id) {
        userId = parsed.user.id;
      }
    }
    
    // For anonymous users, use session ID from localStorage
    const lastViewedSession = localStorage.getItem('lastViewedSessionId');
    if (lastViewedSession && !userId) {
      sessionId = lastViewedSession;
    }
  } catch (error) {
    console.error('[Tracking] Error getting user data:', error);
  }

  const cache = getTrackingCache();
  
  // Add event to cache with user/session info
  const eventWithUser = {
    ...trackingData,
    userId,
    sessionId
  };
  
  console.log('[Tracking Debug] Adding event:', eventWithUser);
  cache.addEvent(eventWithUser);
}

/**
 * Get user location client-side (with geolocation)
 */
async function getUserLocationClient(): Promise<{
  latitude: number;
  longitude: number;
  city: string;
  state: string;
} | null> {
  try {
    // Try browser geolocation first
    if ('geolocation' in navigator) {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      // Reverse geocoding to get city/state
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );
      const data = await response.json();
      
      const address = data.address || {};
      const city = address.city || address.town || address.village || 'Unknown';
      const state = address.state || 'Unknown';
      
      return { latitude, longitude, city, state };
    }
  } catch (error) {
    console.warn('Geolocation failed, falling back to IP-based location');
  }
  
  // Fallback to IP-based location
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    
    return {
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      city: data.city || 'Unknown',
      state: data.region || 'Unknown'
    };
  } catch (error) {
    console.warn('IP location failed, using default');
    return null;
  }
}

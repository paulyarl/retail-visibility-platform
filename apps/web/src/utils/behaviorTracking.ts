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
    const userId = session?.user?.id || 
                   (session as any)?.user?.id || 
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
 */
export function trackBehaviorClient(trackingData: Omit<TrackingData, 'durationSeconds'>): void {
  if (typeof window === 'undefined') return;
  
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  
  // Get user location client-side
  getUserLocationClient().then(location => {
    fetch(`${apiUrl}/api/recommendations/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...trackingData,
        locationLat: location?.latitude,
        locationLng: location?.longitude,
        referrer: document.referrer,
        userAgent: navigator.userAgent
      })
    }).catch(error => {
      console.error('Error tracking client behavior:', error);
    });
  });
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

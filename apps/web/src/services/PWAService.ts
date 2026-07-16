/**
 * Progressive Web App Service
 * 
 * PWA features including offline support, push notifications, and app-like experience
 * Integrates with platform caching and service workers
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface PWAConfig {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'portrait' | 'landscape' | 'any';
  startUrl: string;
  scope: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: 'any' | 'maskable' | 'monochrome';
  }>;
  shortcuts: Array<{
    name: string;
    shortName: string;
    description: string;
    url: string;
    icons: Array<{
      src: string;
      sizes: string;
    }>;
  }>;
  categories: string[];
}

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface OfflineContent {
  id: string;
  type: 'product' | 'category' | 'page' | 'image';
  url: string;
  data: any;
  cachedAt: Date;
  expiresAt?: Date;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Progressive Web App Service
 * 
 * Provides PWA functionality with offline support and push notifications
 * Leverages platform caching and service workers
 */
class PWAService extends PublicApiSingleton {
  private static instance: PWAService;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private pushSubscription: PushSubscription | null = null;
  private isOnline: boolean = true;
  private offlineQueue: Array<{
    type: string;
    data: any;
    timestamp: Date;
  }> = [];

  private constructor() {
    super('pwa-service', { encrypt: false });
    this.initializePWA();
  }

  public static getInstance(): PWAService {
    if (!PWAService.instance) {
      PWAService.instance = new PWAService();
    }
    return PWAService.instance;
  }

  /**
   * Initialize PWA features
   */
  private async initializePWA(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    // Register service worker
    await this.registerServiceWorker();

    // Monitor online/offline status
    this.setupNetworkMonitoring();

    // Setup install prompt
    this.setupInstallPrompt();

    // Load offline content
    await this.loadOfflineContent();
  }

  /**
   * Register service worker
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      clientLogger.warn('[PWAService] Service Worker not supported');
      return;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[PWAService] Service Worker registered successfully');

      // Listen for updates
      this.swRegistration.addEventListener('updatefound', () => {
        const newWorker = this.swRegistration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              this.showUpdateAvailable();
            }
          });
        }
      });

    } catch (error) {
      clientLogger.error('[PWAService] Service Worker registration failed:', { detail: error });
    }
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    this.isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.handleOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.handleOffline();
    });
  }

  /**
   * Setup install prompt
   */
  private setupInstallPrompt(): void {
    let deferredPrompt: any = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.showInstallPrompt(deferredPrompt);
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWAService] App installed successfully');
      deferredPrompt = null;
    });
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    console.log('[PWAService] Back online');
    
    // Process offline queue
    this.processOfflineQueue();

    // Sync offline content
    this.syncOfflineContent();

    // Show notification
    this.showNotification('Back Online', 'Your connection has been restored');
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    console.log('[PWAService] Gone offline');
    
    // Show notification
    this.showNotification('Offline', 'You are currently offline. Some features may be limited.');
  }

  /**
   * Check if PWA is installed
   */
  isInstalled(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
  }

  /**
   * Get PWA installation status
   */
  async getInstallStatus(): Promise<{
    isInstalled: boolean;
    isInstallable: boolean;
    platform: string;
    browserSupport: boolean;
  }> {
    const isInstalled = this.isInstalled();
    const isInstallable = await this.isInstallable();
    const platform = this.getPlatform();
    const browserSupport = this.checkBrowserSupport();

    return {
      isInstalled,
      isInstallable,
      platform,
      browserSupport
    };
  }

  /**
   * Check if app is installable
   */
  private async isInstallable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    // Check if it's already installed
    if (this.isInstalled()) {
      return false;
    }

    // Check browser support
    if (!this.checkBrowserSupport()) {
      return false;
    }

    // Check if it meets install criteria
    return this.meetsInstallCriteria();
  }

  /**
   * Check browser support
   */
  private checkBrowserSupport(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      'caches' in window
    );
  }

  /**
   * Check if app meets install criteria
   */
  private meetsInstallCriteria(): boolean {
    // This would be based on user engagement, time spent, etc.
    // For now, return true for demonstration
    return true;
  }

  /**
   * Get platform information
   */
  private getPlatform(): string {
    if (typeof window === 'undefined') {
      return 'unknown';
    }

    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/android/.test(userAgent)) return 'android';
    if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
    if (/win/.test(userAgent)) return 'windows';
    if (/mac/.test(userAgent)) return 'macos';
    if (/linux/.test(userAgent)) return 'linux';
    
    return 'web';
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(): Promise<boolean> {
    if (!this.swRegistration) {
      clientLogger.warn('[PWAService] Service Worker not registered');
      return false;
    }

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        clientLogger.warn('[PWAService] Notification permission denied');
        return false;
      }

      // Subscribe to push
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '') as BufferSource
      });

      this.pushSubscription = subscription;

      // Send subscription to server
      await this.sendPushSubscriptionToServer(subscription);

      console.log('[PWAService] Push notification subscription successful');
      return true;

    } catch (error) {
      clientLogger.error('[PWAService] Push notification subscription failed:', { detail: error });
      return false;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPushNotifications(): Promise<boolean> {
    if (!this.pushSubscription) {
      return true;
    }

    try {
      await this.pushSubscription.unsubscribe();
      this.pushSubscription = null;

      // Remove subscription from server
      await this.removePushSubscriptionFromServer();

      console.log('[PWAService] Unsubscribed from push notifications');
      return true;

    } catch (error) {
      clientLogger.error('[PWAService] Failed to unsubscribe from push notifications:', { detail: error });
      return false;
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(notification: PushNotification): Promise<boolean> {
    try {
      const response = await this.makeDefaultRequest<void>(
        '/api/pwa/notify',
        {
          method: 'POST',
          body: JSON.stringify(notification)
        },
        `pwa-notification-${Date.now()}`,
        0 // No caching for notifications
      );

      if (!response.success) {
        clientLogger.error('[PWAService] Failed to send push notification:', { detail: response.error });
        return false;
      }

      return true;
    } catch (error) {
      clientLogger.error('[PWAService] Error sending push notification:', { detail: error });
      return false;
    }
  }

  /**
   * Show local notification
   */
  async showNotification(
    title: string,
    body: string,
    options: NotificationOptions = {}
  ): Promise<void> {
    if (!('Notification' in window)) {
      clientLogger.warn('[PWAService] Notifications not supported');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return;
    }

    new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      ...options
    });
  }

  /**
   * Cache content for offline use
   */
  async cacheContent(content: OfflineContent): Promise<void> {
    try {
      const cacheKey = `pwa-offline-${content.type}-${content.id}`;
      
      await this.makeDefaultRequest<void>(
        '/api/pwa/cache',
        {
          method: 'POST',
          body: JSON.stringify(content)
        },
        cacheKey,
        content.expiresAt ? 
          (content.expiresAt.getTime() - Date.now()) : 
          24 * 60 * 60 * 1000 // 24 hours default
      );

      console.log(`[PWAService] Cached ${content.type} ${content.id}`);
    } catch (error) {
      clientLogger.error('[PWAService] Failed to cache content:', { detail: error });
    }
  }

  /**
   * Get cached content
   */
  async getCachedContent(id: string, type: OfflineContent['type']): Promise<OfflineContent | null> {
    try {
      const cacheKey = `pwa-offline-${type}-${id}`;
      
      const response = await this.makeDefaultRequest<{
        content: OfflineContent;
      }>(
        `/api/pwa/cache/${type}/${id}`,
        {},
        cacheKey,
        60 * 1000 // 1 minute cache for cached content
      );

      if (!response.success) {
        return null;
      }

      return response.data?.content || null;
    } catch (error) {
      clientLogger.error('[PWAService] Failed to get cached content:', { detail: error });
      return null;
    }
  }

  /**
   * Load offline content
   */
  private async loadOfflineContent(): Promise<void> {
    try {
      const response = await this.makeDefaultRequest<{
        content: OfflineContent[];
      }>(
        '/api/pwa/offline-content',
        {},
        'pwa-offline-content',
        5 * 60 * 1000 // 5 minutes cache
      );

      if (response.success) {
        console.log(`[PWAService] Loaded ${response.data?.content?.length || 0} offline items`);
      }
    } catch (error) {
      clientLogger.error('[PWAService] Failed to load offline content:', { detail: error });
    }
  }

  /**
   * Sync offline content
   */
  private async syncOfflineContent(): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/pwa/sync',
        {
          method: 'POST',
          body: JSON.stringify({
            offlineQueue: this.offlineQueue,
            timestamp: new Date()
          })
        },
        `pwa-sync-${Date.now()}`,
        0 // No caching for sync
      );

      // Clear queue after successful sync
      this.offlineQueue = [];
      console.log('[PWAService] Offline content synced successfully');
    } catch (error) {
      clientLogger.error('[PWAService] Failed to sync offline content:', { detail: error });
    }
  }

  /**
   * Process offline queue
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    console.log(`[PWAService] Processing ${this.offlineQueue.length} offline actions`);

    for (const action of this.offlineQueue) {
      try {
        // Process each action based on type
        switch (action.type) {
          case 'analytics':
            // Retry analytics events
            break;
          case 'cart':
            // Sync cart actions
            break;
          case 'wishlist':
            // Sync wishlist actions
            break;
          default:
            clientLogger.warn(`[PWAService] Unknown offline action type: ${action.type}`);
        }
      } catch (error) {
        clientLogger.error(`[PWAService] Failed to process offline action:`, { detail: error });
      }
    }
  }

  /**
   * Queue offline action
   */
  queueOfflineAction(type: string, data: any): void {
    this.offlineQueue.push({
      type,
      data,
      timestamp: new Date()
    });

    // Limit queue size
    if (this.offlineQueue.length > 100) {
      this.offlineQueue = this.offlineQueue.slice(-50);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    isOnline: boolean;
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  } {
    if (typeof window === 'undefined' || !('connection' in navigator)) {
      return {
        isOnline: this.isOnline,
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
        saveData: false
      };
    }

    const connection = (navigator as any).connection;
    
    return {
      isOnline: this.isOnline,
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false
    };
  }

  /**
   * Send push subscription to server
   */
  private async sendPushSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    await this.makeDefaultRequest<void>(
      '/api/pwa/push/subscribe',
      {
        method: 'POST',
        body: JSON.stringify(subscription)
      },
      'pwa-push-subscription',
      0 // No caching
    );
  }

  /**
   * Remove push subscription from server
   */
  private async removePushSubscriptionFromServer(): Promise<void> {
    await this.makeDefaultRequest<void>(
      '/api/pwa/push/unsubscribe',
      {
        method: 'POST'
      },
      'pwa-push-unsubscription',
      0 // No caching
    );
  }

  /**
   * Show update available notification
   */
  private showUpdateAvailable(): void {
    this.showNotification(
      'Update Available',
      'A new version of the app is available. Click to refresh.',
      {
        requireInteraction: true
      }
    );
  }

  /**
   * Show install prompt
   */
  private showInstallPrompt(deferredPrompt: any): void {
    // This would show a custom install prompt UI
    console.log('[PWAService] Install prompt available');
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  /**
   * Get PWA manifest
   */
  async getManifest(): Promise<PWAConfig> {
    try {
      const response = await this.makeDefaultRequest<{
        manifest: PWAConfig;
      }>(
        '/api/pwa/manifest',
        {},
        'pwa-manifest',
        60 * 60 * 1000 // 1 hour cache
      );

      if (!response.success) {
        return this.getDefaultManifest();
      }

      return response.data?.manifest || this.getDefaultManifest();
    } catch (error) {
      clientLogger.error('[PWAService] Failed to get manifest:', { detail: error });
      return this.getDefaultManifest();
    }
  }

  /**
   * Get default manifest
   */
  private getDefaultManifest(): PWAConfig {
    return {
      name: 'Visible Shelf',
      shortName: 'VS',
      description: 'Advanced e-commerce platform with AI-powered recommendations',
      themeColor: '#1971c2',
      backgroundColor: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      startUrl: '/',
      scope: '/',
      icons: [
        {
          src: '/icons/icon-72x72.png',
          sizes: '72x72',
          type: 'image/png'
        },
        {
          src: '/icons/icon-96x96.png',
          sizes: '96x96',
          type: 'image/png'
        },
        {
          src: '/icons/icon-128x128.png',
          sizes: '128x128',
          type: 'image/png'
        },
        {
          src: '/icons/icon-144x144.png',
          sizes: '144x144',
          type: 'image/png'
        },
        {
          src: '/icons/icon-152x152.png',
          sizes: '152x152',
          type: 'image/png'
        },
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/icons/icon-384x384.png',
          sizes: '384x384',
          type: 'image/png'
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        }
      ],
      shortcuts: [],
      categories: ['shopping', 'business', 'lifestyle']
    };
  }
}

// Export singleton instance
export const pwaService = PWAService.getInstance();
export default PWAService;

/**
 * Tier System Service
 * 
 * Extends AdminApiSingleton to provide tier system management
 * Handles tier CRUD, status management, and sorting operations with admin privileges
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import TiersSingleton from '../providers/platform/TiersSingleton';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface TierFeatureObject {
  id: string;
  featureKey: string;
  featureName: string;
  isEnabled: boolean;
  isInherited: boolean;
  isHighlighted: boolean;
  highlightOrder: number;
  highlightDescription: string | null;
  marketingName: string | null;
}

export interface Tier {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  price: string; // API returns as string, not number
  maxSkus: number; // Direct property, not nested under limits
  maxLocations: number; // Direct property, not nested under limits
  type: 'individual' | 'organization';
  features: TierFeatureObject[];
  sortOrder: number;
  isActive: boolean;
  // Optional properties that might exist but not in current API response
  currency?: string;
  billingInterval?: 'monthly' | 'yearly';
  slug?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TierFeature {
  feature_key: string;
  feature_name: string;
  is_inherited: boolean;
  is_enabled?: boolean;
  is_highlighted?: boolean;
  highlight_order?: number;
  highlight_description?: string | null;
  marketing_name?: string | null;
}

export interface TierInfo {
  id: string;
  tier_key: string;
  name: string;
  display_name: string;
  description: string;
  price_monthly: number;
  max_skus: number | null;
  max_locations: number | null;
  tier_type: 'individual' | 'organization';
  sort_order: number;
  is_active: boolean;
  tier_features_list?: TierFeature[];
}

export interface TierGains {
  title: string;
  subtitle: string;
  gains: Array<{
    name: string;
    description: string;
    inherited?: boolean;
  }>;
  cta: {
    text: string;
    href: string;
  };
}

/**
 * Service for managing tier system operations
 * Handles tier CRUD, status management, and sorting operations
 */
export class TierSystemService extends AdminApiSingleton {
  private static instance: TierSystemService;

  protected constructor() {
    super('tier-system-service', {
      ttl: 60 * 60 * 1000 // 1 hour for tier data (changes infrequently)
    });
  }

  static getInstance(): TierSystemService {
    if (!TierSystemService.instance) {
      TierSystemService.instance = new TierSystemService();
    }
    return TierSystemService.instance;
  }

  /**
   * Get tier system tiers
   */
  async getTierSystemTiers(): Promise<Tier[] | null> {
    const response = await this.makeDefaultRequest<{ 
      individual: Tier[];
      organization: Tier[];
    }>(
      '/api/admin/tiers/tiers',
      {},
      'tier-system-tiers',
      60 * 60 * 1000 // 1 hour cache
    );

    // Combine individual and organization tiers
    const allTiers = [
      ...(response?.data?.individual || []),
      ...(response?.data?.organization || [])
    ];

    return allTiers.length > 0 ? allTiers : null;
  }

  /**
   * Update tier active status
   */
  async updateTierStatus(tierId: string, isActive: boolean): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers/${tierId}/status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: isActive })
      },
      `update-tier-status-${tierId}`,
      0 // No cache for admin operations
    );

    // Invalidate tier cache - use context-aware invalidation for admin operations
    // Clear admin context cache (current admin user) and system cache (shared data)
    await this.invalidateCacheAcrossContexts('tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM], [CacheIsolation.ADMIN, CacheIsolation.TENANT]);

    return response?.data || null;
  }

  /**
   * Update tier
   */
  async updateTier(tierId: string, tierData: Partial<Tier>): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers/${tierId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tierData)
      },
      `update-tier-${tierId}`,
      0 // No cache for admin operations
    );

    // Invalidate tier cache - use context-aware invalidation for admin operations
    // Clear admin context cache (current admin user) and system cache (shared data)
    await this.invalidateCacheAcrossContexts('tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM], [CacheIsolation.ADMIN, CacheIsolation.TENANT]);

    return response?.data || null;
  }

  /**
   * Update tier sort order
   */
  async updateTierSortOrder(tierId: string, sortOrder: number): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/admin/tiers/${tierId}/sort-order`,
      {
        method: 'PUT',
        body: JSON.stringify({ sortOrder }),
      },
      `tier-sort-${tierId}`,
      0
    );

    // Invalidate tier cache - use context-aware invalidation for admin operations
    // Clear admin context cache (current admin user) and system cache (shared data)
    await this.invalidateCacheAcrossContexts('tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM], [CacheIsolation.ADMIN, CacheIsolation.TENANT]);
  }

  /**
   * Create tier
   */
  async createTier(tierData: Omit<Tier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tier | null> {
    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers`,
      {
        method: 'POST',
        body: JSON.stringify(tierData)
      },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache - use context-aware invalidation for admin operations
    // Clear admin context cache (current admin user) and system cache (shared data)
    await this.invalidateCacheAcrossContexts('tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM], [CacheIsolation.ADMIN, CacheIsolation.TENANT]);

    return response?.data || null;
  }

  /**
   * Create tier from template
   */
  async createTierFromTemplate(templateId: string, newTierData: Partial<Tier>): Promise<Tier | null> {
    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers/from-template/${templateId}`,
      {
        method: 'POST',
        body: JSON.stringify(newTierData)
      },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache - use context-aware invalidation for admin operations
    // Clear admin context cache (current admin user) and system cache (shared data)
    await this.invalidateCacheAcrossContexts('tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM], [CacheIsolation.ADMIN, CacheIsolation.TENANT]);

    return response?.data || null;
  }

  /**
   * Delete tier
   */
  async deleteTier(tierId: string): Promise<void> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    await this.makeDefaultRequest<void>(
      `/api/admin/tiers/${tierId}`,
      { method: 'DELETE' },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache - use context-aware invalidation for admin operations
    // Clear admin context cache (current admin user) and system cache (shared data)
    await this.invalidateCacheAcrossContexts('tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM], [CacheIsolation.ADMIN, CacheIsolation.TENANT]);
  }

  /**
   * Get individual tiers only
   */
  async getIndividualTiers(): Promise<Tier[] | null> {
    const response = await this.makeDefaultRequest<{ individual: Tier[] }>(
      `/api/admin/tiers/individual`,
      {},
      'tier-system-tiers',
      60 * 60 * 1000
    );

    return response?.data?.individual || null;
  }

  /**
   * Get organization tiers only
   */
  async getOrganizationTiers(): Promise<Tier[] | null> {
    const response = await this.makeDefaultRequest<{ organization: Tier[] }>(
      `/api/admin/tiers/organization`,
      {},
      'tier-system-tiers',
      60 * 60 * 1000
    );

    return response?.data?.organization || null;
  }

  /**
   * Bulk update tier sort orders
   */
  async bulkUpdateSortOrders(tierUpdates: Array<{ id: string; sortOrder: number }>): Promise<void> {
    await this.makeDefaultRequest<void>(
      `/api/admin/tiers/bulk-update-sort`,
      {
        method: 'POST',
        body: JSON.stringify({ updates: tierUpdates })
      },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache - use context-aware invalidation for admin operations
    // Clear admin context cache (current admin user) and system cache (shared data)
    await this.invalidateCacheAcrossContexts('tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM], [CacheIsolation.ADMIN, CacheIsolation.TENANT]);
  }

  /**
   * Clone tier (create new tier based on existing one)
   */
  async cloneTier(tierId: string, newTierData: Partial<Tier>): Promise<Tier | null> {
    if (!tierId) {
      throw new Error('Tier ID is required');
    }

    const response = await this.makeDefaultRequest<Tier>(
      `/api/admin/tiers/${tierId}/clone`,
      {
        method: 'POST',
        body: JSON.stringify(newTierData)
      },
      'tier-system-tiers',
      0
    );

    // Invalidate tier cache - use context-aware invalidation for admin operations
    // Clear admin context cache (current admin user) and system cache (shared data)
    await this.invalidateCacheAcrossContexts('tier-system-tiers', [AppContext.ADMIN, AppContext.SYSTEM], [CacheIsolation.ADMIN, CacheIsolation.TENANT]);

    return response?.data || null;
  }

  /**
   * Get tier gains for tenant dashboard (public-facing, tenant-scoped)
   * Uses public API to get tier information with features
   */
  async getTenantTierGains(tierKey: string): Promise<TierGains | null> {
    if (!tierKey) {
      clientLogger.warn('[TierSystemService] Tier key is required');
      return null;
    }

    // console.log(`[TierSystemService] Looking for tier with key: "${tierKey}"`);

    try {
      // Use the working admin tiers API instead of TiersSingleton
      const response = await this.makeDefaultRequest<{
        individual: any[];
        organization: any[];
      }>(
        '/api/admin/tiers/tiers',
        {},
        'admin-tiers-all',
        15 * 60 * 1000 // 15 minutes cache
      );

      if (!response.success || !response.data) {
        clientLogger.warn(`[TierSystemService] Failed to fetch tiers from admin API, falling back to static data`);
        return this.getStaticTierGains(tierKey);
      }

      // Combine individual and organization tiers
      const allTiers = [
        ...(response.data?.individual || []),
        ...(response.data?.organization || [])
      ];

      // console.log(`[TierSystemService] Available tiers:`, allTiers.map(t => t.id));

      // Find the tier by ID
      const tier = allTiers.find(t => t.id === tierKey);
      
      if (!tier) {
        clientLogger.warn(`[TierSystemService] No data found for tier: ${tierKey}, falling back to static data`);
        console.log(`[TierSystemService] Available tier IDs:`, allTiers.map(t => t.id));
        return this.getStaticTierGains(tierKey);
      }

      // console.log(`[TierSystemService] Found tier:`, tier);

      // Convert API tier format to our TierGains format
      const gains: Array<{ name: string; description: string; inherited?: boolean }> = [];
      
      // Add features from the tier
      if (tier.features && Array.isArray(tier.features)) {
        // Separate highlighted and regular features
        const highlightedFeatures: any[] = [];
        const regularFeatures: any[] = [];
        
        tier.features.forEach((feature: any) => {
          // Handle both string format (legacy) and object format (new)
          const featureKey = typeof feature === 'string' ? feature : feature.featureKey;
          const featureName = typeof feature === 'object' && feature.featureName 
            ? feature.featureName 
            : this.formatFeatureName(featureKey);
          
          const featureObj = {
            name: typeof feature === 'object' && feature.marketingName 
              ? feature.marketingName 
              : featureName,
            description: typeof feature === 'object' && feature.highlightDescription
              ? feature.highlightDescription
              : this.getFeatureDescription(featureKey),
            order: typeof feature === 'object' && feature.highlightOrder 
              ? feature.highlightOrder 
              : 999
          };
          
          if (typeof feature === 'object' && feature.isHighlighted) {
            highlightedFeatures.push(featureObj);
          } else {
            regularFeatures.push(featureObj);
          }
        });
        
        // Sort highlighted features by order, then add regular features
        highlightedFeatures.sort((a, b) => a.order - b.order);
        regularFeatures.sort((a, b) => a.name.localeCompare(b.name));
        
        // Add highlighted features first (up to 3)
        highlightedFeatures.slice(0, 3).forEach(gain => gains.push(gain));
        
        // Add regular features if we have room (up to 5 total)
        const remainingSlots = Math.max(0, 5 - highlightedFeatures.length);
        regularFeatures.slice(0, remainingSlots).forEach(gain => gains.push(gain));
      }

      // Add limits as features
      if (tier.maxSkus && tier.maxSkus > 0) {
        gains.push({
          name: `${tier.maxSkus} Products`,
          description: `Manage up to ${tier.maxSkus} products`
        });
      }
      if (tier.maxLocations && tier.maxLocations > 0) {
        gains.push({
          name: `${tier.maxLocations} Locations`,
          description: `Manage up to ${tier.maxLocations} locations`
        });
      }

      const result = {
        title: this.getTierTitleFromApiTier(tier),
        subtitle: tier.description || '',
        gains,
        cta: this.getTierCTAFromApiTier(tier)
      };

      // console.log(`[TierSystemService] Returning result:`, result);
      return result;

    } catch (error) {
      clientLogger.error(`[TierSystemService] Failed to get tier gains for ${tierKey}:`, { detail: error });
      console.log(`[TierSystemService] Falling back to static data for tier: ${tierKey}`);
      // Fallback to static data if API fails
      return this.getStaticTierGains(tierKey);
    }
  }

  /**
   * Fallback method using static tier data when API fails
   */
  private getStaticTierGains(tierKey: string): TierGains | null {
    // Normalize tier name (handle both 'google_only' and 'starter' level names)
    const normalizedTier = tierKey.toLowerCase().replace(/_/g, '');
    
    switch (normalizedTier) {
      case 'googleonly':
        return {
          title: '🎯 You\'re on Google-Only!',
          subtitle: 'Your products are discoverable on Google Shopping with essential product management tools.',
          gains: [
            {
              name: 'Google Shopping',
              description: 'List your products on Google Shopping marketplace'
            },
            {
              name: 'Google Merchant Center',
              description: 'Sync inventory to Google Merchant Center automatically'
            },
            {
              name: 'Basic Product Pages',
              description: 'Simple product pages with essential information'
            },
            {
              name: 'Performance Analytics',
              description: 'Track how your products perform on Google'
            },
            {
              name: 'QR Codes (512px)',
              description: 'Generate QR codes for your products'
            },
            {
              name: 'Quick Start Wizard (Limited)',
              description: 'Get started quickly with guided setup'
            }
          ],
          cta: {
            text: 'View Your Stores',
            href: '/tenants'
          }
        };

      case 'starter':
        return {
          title: '🏪 You Now Have Your Own Storefront!',
          subtitle: 'Beyond Google - you have a beautiful online store with enhanced features for growing your business.',
          gains: [
            {
              name: '✨ Public Storefront',
              description: 'Your own website where customers can browse and shop'
            },
            {
              name: '✨ Product Search',
              description: 'Customers can search your products on your storefront'
            },
            {
              name: '✨ Mobile-Responsive Design',
              description: 'Looks great on phones, tablets, and desktops'
            },
            {
              name: '✨ Enhanced SEO',
              description: 'Get found on search engines beyond just Google Shopping'
            },
            {
              name: '✨ Basic Categories',
              description: 'Organize your products into categories'
            },
            {
              name: 'Google Shopping',
              description: 'Continue selling on Google Shopping marketplace'
            },
            {
              name: 'Performance Analytics',
              description: 'Track performance across all channels'
            }
          ],
          cta: {
            text: 'View Your Storefront',
            href: '/tenants'
          }
        };

      case 'professional':
        return {
          title: '⚡ Professional Features Unlocked!',
          subtitle: 'Advanced tools for established retail businesses - smart automation, enhanced branding, and priority support.',
          gains: [
            {
              name: '✨ Smart Barcode Scanner',
              description: 'Scan products with your camera - we auto-fill everything instantly'
            },
            {
              name: '✨ Quick Start Wizard (Full)',
              description: 'Add 100 products in minutes with AI-powered setup'
            },
            {
              name: '✨ Google Business Profile Integration',
              description: 'Sync your inventory to your Google Business listing automatically'
            },
            {
              name: '✨ Custom Branding',
              description: 'Make your storefront uniquely yours'
            },
            {
              name: '✨ Priority Support',
              description: 'Get help when you need it, fast'
            },
            {
              name: '✨ 5-Image Gallery',
              description: 'Show up to 5 photos per product'
            },
            {
              name: 'Public Storefront',
              description: 'Your own website with full features'
            },
            {
              name: 'Enhanced SEO & Mobile Design',
              description: 'Optimized for search and all devices'
            }
          ],
          cta: {
            text: 'Explore Professional Features',
            href: '/tenants'
          }
        };

      case 'enterprise':
        return {
          title: '🎨 Enterprise-Grade Customization!',
          subtitle: 'Full white-label customization and unlimited scale - make this platform entirely your own.',
          gains: [
            {
              name: '✨ Unlimited SKUs',
              description: 'No limits on your product catalog'
            },
            {
              name: '✨ White Label Branding',
              description: 'Your logo, your colors, your brand everywhere'
            },
            {
              name: '✨ Custom Domain',
              description: 'Use your own domain name (shop.yourbrand.com)'
            },
            {
              name: '✨ API Access',
              description: 'Integrate with your existing systems'
            },
            {
              name: '✨ Advanced Analytics',
              description: 'Deep insights into your business performance'
            },
            {
              name: '✨ Dedicated Account Manager',
              description: 'Personal support from your account manager'
            },
            {
              name: '✨ SLA Guarantee',
              description: 'Service level agreement for peace of mind'
            },
            {
              name: '✨ 10-Image Gallery',
              description: 'Show up to 10 photos per product'
            }
          ],
          cta: {
            text: 'Configure Enterprise Features',
            href: '/tenants'
          }
        };

      case 'organization':
        return {
          title: '🏢 Multi-Location Management Activated!',
          subtitle: 'Manage all your locations from one place - update once, apply everywhere with powerful organization tools.',
          gains: [
            {
              name: '✨ Multi-Location Management',
              description: 'Manage unlimited locations from one dashboard'
            },
            {
              name: '✨ Centralized Inventory',
              description: 'Control inventory across all locations'
            },
            {
              name: '✨ Bulk Operations',
              description: 'Update multiple locations at once'
            },
            {
              name: '✨ Role-Based Access Control',
              description: 'Granular permissions for team members'
            },
            {
              name: '✨ Organization Dashboard',
              description: 'See performance across all locations'
            },
            {
              name: '✨ Custom Pricing',
              description: 'Set different pricing by location'
            }
          ],
          cta: {
            text: 'Manage Your Organization',
            href: '/settings/admin'
          }
        };

      default:
        return null;
    }
  }

  /**
   * Get tier-specific title with emoji (for API tier format)
   */
  private getTierTitleFromApiTier(tier: any): string {
    const name = tier.name?.toLowerCase() || '';
    if (name.includes('google')) {
      return '🎯 You\'re on Google-Only!';
    } else if (name.includes('chain')) {
      return `🏪 ${tier.displayName} Unlocked!`;
    } else if (name.includes('starter')) {
      return '🏪 You Now Have Your Own Storefront!';
    } else if (name.includes('professional')) {
      return '⚡ Professional Features Unlocked!';
    } else if (name.includes('enterprise')) {
      return '🎨 Enterprise-Grade Customization!';
    } else if (name.includes('organization')) {
      return '🏢 Multi-Location Management Activated!';
    }
    return `🎉 ${tier.displayName} Activated!`;
  }

  /**
   * Get tier-specific call-to-action (for API tier format)
   */
  private getTierCTAFromApiTier(tier: any): { text: string; href: string } {
    const name = tier.name?.toLowerCase() || '';
    if (name.includes('google')) {
      return { text: 'View Your Stores', href: '/tenants' };
    } else if (name.includes('chain')) {
      return { text: 'Manage Chain Settings', href: '/tenants' };
    } else if (name.includes('starter')) {
      return { text: 'View Your Stores', href: '/tenants' };
    } else if (name.includes('professional')) {
      return { text: 'Explore Professional Features', href: '/tenants' };
    } else if (name.includes('enterprise')) {
      return { text: 'Configure Enterprise Features', href: '/tenants' };
    } else if (name.includes('organization')) {
      return { text: 'Manage Your Organization', href: '/settings/admin' };
    }
    return { text: 'View Dashboard', href: '/tenants' };
  }

  /**
   * Get tier-specific title with emoji (for TiersSingleton format)
   */
  private getTierTitleFromTier(tier: any): string {
    const name = tier.name?.toLowerCase() || '';
    if (name.includes('google')) {
      return '🎯 You\'re on Google-Only!';
    } else if (name.includes('starter')) {
      return '🏪 You Now Have Your Own Storefront!';
    } else if (name.includes('professional')) {
      return '⚡ Professional Features Unlocked!';
    } else if (name.includes('enterprise')) {
      return '🎨 Enterprise-Grade Customization!';
    } else if (name.includes('organization')) {
      return '🏢 Multi-Location Management Activated!';
    } else if (name.includes('chain')) {
      return `🏪 ${tier.displayName} Unlocked!`;
    }
    return `🎉 ${tier.displayName} Activated!`;
  }

  /**
   * Get tier-specific call-to-action (for TiersSingleton format)
   */
  private getTierCTAFromTier(tier: any): { text: string; href: string } {
    const name = tier.name?.toLowerCase() || '';
    if (name.includes('google') || name.includes('starter')) {
      return { text: 'View Your Stores', href: '/tenants' };
    } else if (name.includes('professional')) {
      return { text: 'Explore Professional Features', href: '/tenants' };
    } else if (name.includes('enterprise')) {
      return { text: 'Configure Enterprise Features', href: '/tenants' };
    } else if (name.includes('organization')) {
      return { text: 'Manage Your Organization', href: '/settings/admin' };
    }
    return { text: 'View Dashboard', href: '/tenants' };
  }

  /**
   * Format feature name from camelCase to readable format
   */
  private formatFeatureName(featureKey: string): string {
    const nameMap: Record<string, string> = {
      'basicAnalytics': 'Basic Analytics',
      'advancedAnalytics': 'Advanced Analytics',
      'customBranding': 'Custom Branding',
      'prioritySupport': 'Priority Support',
      'apiAccess': 'API Access',
      'bulkOperations': 'Bulk Operations',
      'customIntegrations': 'Custom Integrations',
      'whiteLabel': 'White Label Branding',
      // Database feature mappings
      'google_shopping': 'Google Shopping',
      'google_merchant_center': 'Google Merchant Center',
      'basic_product_pages': 'Basic Product Pages',
      'qr_codes_512': 'QR Codes (512px)',
      'performance_analytics': 'Performance Analytics',
      'quick_start_wizard': 'Quick Start Wizard',
      'barcode_scan': 'Barcode Scanner',
      'basic_categories': 'Basic Categories',
      'basic_search': 'Basic Search',
      'bulk_import': 'Bulk Import',
      'categories': 'Categories',
      'category_quick_start': 'Category Quick Start',
      'clover_sync': 'Clover Sync',
      'enhanced_seo': 'Enhanced SEO',
      'google_sync': 'Google Sync',
      'image_gallery_5': '5-Image Gallery',
      'manual_barcode': 'Manual Barcode',
      'manual_entry': 'Manual Entry',
      'mobile_responsive': 'Mobile Responsive',
      'product_search': 'Product Search',
      'square_sync': 'Square Sync',
      'storefront': 'Storefront'
    };
    return nameMap[featureKey] || featureKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  /**
   * Get tier-specific title with emoji (original method for TierInfo format)
   */
  private getTierTitle(tier: TierInfo): string {
    switch (tier.tier_key) {
      case 'google_only':
        return '🎯 You\'re on Google-Only!';
      case 'discovery':
        return '🎯 Get Found on Google!';
      case 'starter':
        return '🏪 You Now Have Your Own Storefront!';
      case 'storefront':
        return '🏪 You Now Have Your Own Storefront!';
      case 'commitment':
        return '⚡ Commitment - Capture Intent and Drive Foot Traffic!';
      case 'professional':
        return '⚡ Professional Features Unlocked!';
      case 'enterprise':
        return '🎨 Enterprise-Grade Customization!';
      case 'organization':
        return '🏢 Multi-Location Management Activated!';
      case 'chain_starter':
        return '🏪 Chain Starter Unlocked!';
      case 'chain_professional':
        return '⚡ Chain Professional Features!';
      case 'chain_enterprise':
        return '🎨 Chain Enterprise - Ultimate Control!';
      default:
        return `🎉 ${tier.display_name} Activated!`;
    }
  }

  /**
   * Get tier-specific call-to-action
   */
  private getTierCTA(tier: TierInfo): { text: string; href: string } {
    switch (tier.tier_key) {
      case 'google_only':
      case 'discovery':
      case 'commitment':
      case 'storefront':
      case 'starter':
        return { text: 'View Your Stores', href: '/tenants' };
      case 'professional':
        return { text: 'Explore Professional Features', href: '/tenants' };
      case 'enterprise':
        return { text: 'Configure Enterprise Features', href: '/tenants' };
      case 'organization':
        return { text: 'Manage Your Organization', href: '/settings/admin' };
      case 'chain_starter':
        return { text: 'Manage Chain Settings', href: '/tenants' };
      case 'chain_professional':
        return { text: 'Manage Professional Chain', href: '/tenants' };
      case 'chain_enterprise':
        return { text: 'Manage Enterprise Chain', href: '/tenants' };
      default:
        return { text: 'View Dashboard', href: '/tenants' };
    }
  }

  /**
   * Get human-readable description for feature keys
   */
  private getFeatureDescription(featureKey: string): string {
    const descriptions: Record<string, string> = {
      // Google-Only features
      'google_shopping': 'List your products on Google Shopping marketplace',
      'google_merchant_center': 'Sync inventory to Google Merchant Center automatically',
      'basic_product_pages': 'Simple product pages with essential information',
      'qr_codes_512': 'Generate QR codes for your products',
      'performance_analytics': 'Track how your products perform on Google',
      'quick_start_wizard': 'Get started quickly with guided setup',
      
      // Starter features
      'storefront': 'Your own website where customers can browse and shop',
      'product_search': 'Customers can search your products on your storefront',
      'mobile_responsive': 'Looks great on phones, tablets, and desktops',
      'enhanced_seo': 'Get found on search engines beyond just Google Shopping',
      'basic_categories': 'Organize your products into categories',
      'barcode_scan': 'Scan products with your camera - we auto-fill everything instantly',
      'basic_search': 'Basic search functionality for your products',
      'bulk_import': 'Import multiple products at once',
      'categories': 'Organize products into categories',
      'category_quick_start': 'Quick setup for product categories',
      'clover_sync': 'Sync with Clover POS system',
      'google_sync': 'Sync with Google services',
      'image_gallery_5': 'Show up to 5 photos per product',
      'manual_barcode': 'Manual barcode entry options',
      'manual_entry': 'Manual product entry',
      'square_sync': 'Sync with Square POS system',
      
      // Professional features
      'quick_start_wizard_full': 'Add 100 products in minutes with AI-powered setup',
      'gbp_integration': 'Sync your inventory to your Google Business listing automatically',
      'custom_branding': 'Make your storefront uniquely yours',
      'business_logo': 'Add your business logo everywhere',
      'priority_support': 'Get help when you need it, fast',
      'qr_codes_1024': 'High-resolution QR codes for print',
      'interactive_maps': 'Interactive maps showing your location',
      'privacy_mode': 'Control what information is public',
      'custom_marketing_copy': 'AI-generated marketing content',
      
      // Enterprise features
      'unlimited_skus': 'No limits on your product catalog',
      'white_label': 'Your logo, your colors, your brand everywhere',
      'custom_domain': 'Use your own domain name (shop.yourbrand.com)',
      'api_access': 'Integrate with your existing systems',
      'advanced_analytics': 'Deep insights into your business performance',
      'dedicated_account_manager': 'Personal support from your account manager',
      'sla_guarantee': 'Service level agreement for peace of mind',
      'custom_integrations': 'Build custom integrations with our help',
      'qr_codes_2048': 'Ultra-high resolution QR codes',
      'image_gallery_10': 'Show up to 10 photos per product',
      
      // Organization features
      'multi_location': 'Manage unlimited locations from one dashboard',
      'centralized_inventory': 'Control inventory across all locations',
      'location_groups': 'Group locations for regional management',
      'bulk_operations': 'Update multiple locations at once',
      'role_based_access': 'Granular permissions for team members',
      'organization_dashboard': 'See performance across all locations',
      'cross_location_reporting': 'Compare performance between locations',
      'custom_pricing': 'Set different pricing by location',
      
      // Chain features
      'chain_branding': 'Consistent branding across all locations',
      'franchise_management': 'Tools for franchise operations',
      'chain_analytics': 'See performance across your chain',
      'regional_management': 'Manage locations by region',
      'chain_promotions': 'Run promotions across multiple locations',
      'master_catalog': 'Central catalog for all locations',
      'location_templates': 'Template setup for new locations',
      'enterprise_sso': 'Single sign-on for your entire organization',
      
      // Legacy fallback
      'basicAnalytics': 'Basic analytics and insights',
      'advancedAnalytics': 'Advanced analytics and reporting',
      'customBranding': 'Custom branding options',
      'prioritySupport': 'Priority customer support',
      'apiAccess': 'API access for integrations',
      'bulkOperations': 'Bulk operation capabilities',
      'customIntegrations': 'Custom integration options',
      'whiteLabel': 'White label branding'
    };

    return descriptions[featureKey] || 'Advanced feature for your business';
  }
}

// Export singleton instance
export const tierSystemService = TierSystemService.getInstance();

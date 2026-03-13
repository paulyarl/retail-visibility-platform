/**
 * Shop Featured Types Integration
 * Management system for different types of featured shops
 */

import { Shop } from '@/types/shop';

export type FeaturedType = string;

export interface FeaturedShop {
  shopId: string;
  type: FeaturedType;
  featuredAt: string;
  expiresAt?: string;
  priority: number;
  metadata?: FeaturedShopMetadata;
}

export interface FeaturedShopMetadata {
  selectionReason?: string;
  staffMember?: string;
  season?: string;
  campaign?: string;
  highlightText?: string;
  badgeText?: string;
}

export interface FeaturedShopManager {
  addToFeatured(shopId: string, type: FeaturedType, metadata?: FeaturedShopMetadata): Promise<void>;
  removeFromFeatured(shopId: string, type: FeaturedType): Promise<void>;
  getFeaturedShops(type: FeaturedType, limit?: number): Promise<Shop[]>;
  getShopFeaturedTypes(shopId: string): Promise<FeaturedType[]>;
  updateFeaturedMetadata(shopId: string, type: FeaturedType, metadata: FeaturedShopMetadata): Promise<void>;
  getFeaturedStats(type?: FeaturedType): Promise<FeaturedStats>;
  getFeaturedExpiry(shopId: string, type: FeaturedType): Promise<string | null>;
  extendFeatured(shopId: string, type: FeaturedType, days: number): Promise<void>;
}

export interface FeaturedStats {
  totalFeatured: number;
  byType: Record<FeaturedType, number>;
  averageDuration: number;
  mostPopular: FeaturedType;
  recentAdditions: FeaturedShop[];
}

export interface FeaturedTypeConfig {
  type: FeaturedType;
  name: string;
  description: string;
  icon: string;
  color: string;
  maxDuration: number; // in days
  autoExpire: boolean;
  requiresApproval: boolean;
  priority: number;
}

export interface FeaturedTypeRule {
  type: FeaturedType;
  conditions: FeaturedCondition[];
  actions: FeaturedAction[];
}

export interface FeaturedCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'in_range';
  value: any;
}

export interface FeaturedAction {
  type: 'add' | 'remove' | 'notify' | 'update_priority';
  params: Record<string, any>;
}

// Featured type configurations
export const FEATURED_TYPE_CONFIGS: Record<FeaturedType, FeaturedTypeConfig> = {
  store_selection: {
    type: 'store_selection',
    name: 'Staff Selection',
    description: 'Hand-picked shops by our team',
    icon: 'star',
    color: '#FFD700',
    maxDuration: 30,
    autoExpire: false,
    requiresApproval: true,
    priority: 100
  },
  new_arrival: {
    type: 'new_arrival',
    name: 'New Arrival',
    description: 'Recently joined shops',
    icon: 'sparkles',
    color: '#00FF00',
    maxDuration: 14,
    autoExpire: true,
    requiresApproval: false,
    priority: 80
  },
  trending: {
    type: 'trending',
    name: 'Trending',
    description: 'Popular shops with high engagement',
    icon: 'trending-up',
    color: '#FF6B6B',
    maxDuration: 7,
    autoExpire: true,
    requiresApproval: false,
    priority: 90
  },
  seasonal: {
    type: 'seasonal',
    name: 'Seasonal',
    description: 'Seasonal promotions and themes',
    icon: 'calendar',
    color: '#4ECDC4',
    maxDuration: 90,
    autoExpire: true,
    requiresApproval: true,
    priority: 70
  },
  staff_pick: {
    type: 'staff_pick',
    name: 'Staff Pick',
    description: 'Recommended by our staff',
    icon: 'thumbs-up',
    color: '#6C5CE7',
    maxDuration: 21,
    autoExpire: true,
    requiresApproval: true,
    priority: 85
  },
  premium: {
    type: 'premium',
    name: 'Premium',
    description: 'Premium shops with enhanced features',
    icon: 'crown',
    color: '#FFA500',
    maxDuration: 365,
    autoExpire: false,
    requiresApproval: false,
    priority: 95
  }
};

// Featured type rules
export const FEATURED_TYPE_RULES: FeaturedTypeRule[] = [
  {
    type: 'new_arrival',
    conditions: [
      { field: 'createdAt', operator: 'greater_than', value: '7_days_ago' },
      { field: 'isActive', operator: 'equals', value: true },
      { field: 'isVerified', operator: 'equals', value: true }
    ],
    actions: [
      { type: 'add', params: { autoExpire: true } }
    ]
  },
  {
    type: 'trending',
    conditions: [
      { field: 'engagementScore', operator: 'greater_than', value: 80 },
      { field: 'growthRate', operator: 'greater_than', value: 20 },
      { field: 'isActive', operator: 'equals', value: true }
    ],
    actions: [
      { type: 'add', params: { priority: 90 } }
    ]
  },
  {
    type: 'premium',
    conditions: [
      { field: 'tier', operator: 'in_range', value: ['premium', 'enterprise'] },
      { field: 'isActive', operator: 'equals', value: true }
    ],
    actions: [
      { type: 'add', params: { autoExpire: false } }
    ]
  }
];

// Implementation of FeaturedShopManager
class FeaturedShopManagerImpl implements FeaturedShopManager {
  private static instance: FeaturedShopManagerImpl;
  private featuredShops: Map<string, FeaturedShop[]> = new Map();
  private shopFeaturedTypes: Map<string, FeaturedType[]> = new Map();

  private constructor() {
    this.loadFeaturedShops();
  }

  static getInstance(): FeaturedShopManagerImpl {
    if (!FeaturedShopManagerImpl.instance) {
      FeaturedShopManagerImpl.instance = new FeaturedShopManagerImpl();
    }
    return FeaturedShopManagerImpl.instance;
  }

  private loadFeaturedShops(): void {
    // In a real implementation, load from database
    // For now, initialize with empty arrays
    Object.values(FEATURED_TYPE_CONFIGS).forEach(config => {
      this.featuredShops.set(config.type, []);
    });
  }

  async addToFeatured(shopId: string, type: FeaturedType, metadata?: FeaturedShopMetadata): Promise<void> {
    const config = FEATURED_TYPE_CONFIGS[type];
    
    // Check if shop is already featured
    const existingFeatured = this.featuredShops.get(type) || [];
    const alreadyFeatured = existingFeatured.some(fs => fs.shopId === shopId);
    
    if (alreadyFeatured) {
      throw new Error(`Shop ${shopId} is already featured as ${type}`);
    }

    // Check approval requirements
    if (config.requiresApproval) {
      // In a real implementation, create approval request
      console.log(`Approval required for ${type} featuring of shop ${shopId}`);
    }

    // Create featured shop entry
    const featuredShop: FeaturedShop = {
      shopId,
      type,
      featuredAt: new Date().toISOString(),
      expiresAt: config.autoExpire ? this.calculateExpiryDate(config.maxDuration) : undefined,
      priority: config.priority,
      metadata
    };

    // Add to featured shops
    const currentFeatured = this.featuredShops.get(type) || [];
    currentFeatured.push(featuredShop);
    
    // Sort by priority
    currentFeatured.sort((a, b) => b.priority - a.priority);
    
    this.featuredShops.set(type, currentFeatured);
    
    // Update shop's featured types
    const shopTypes = this.shopFeaturedTypes.get(shopId) || [];
    if (!shopTypes.includes(type)) {
      shopTypes.push(type);
      this.shopFeaturedTypes.set(shopId, shopTypes);
    }

    console.log(`Shop ${shopId} added to ${type} featured`);
  }

  async removeFromFeatured(shopId: string, type: FeaturedType): Promise<void> {
    const currentFeatured = this.featuredShops.get(type) || [];
    const index = currentFeatured.findIndex(fs => fs.shopId === shopId);
    
    if (index === -1) {
      throw new Error(`Shop ${shopId} is not featured as ${type}`);
    }

    // Remove from featured shops
    currentFeatured.splice(index, 1);
    this.featuredShops.set(type, currentFeatured);
    
    // Update shop's featured types
    const shopTypes = this.shopFeaturedTypes.get(shopId) || [];
    const typeIndex = shopTypes.indexOf(type);
    if (typeIndex !== -1) {
      shopTypes.splice(typeIndex, 1);
      this.shopFeaturedTypes.set(shopId, shopTypes);
    }

    console.log(`Shop ${shopId} removed from ${type} featured`);
  }

  async getFeaturedShops(type: FeaturedType, limit?: number): Promise<Shop[]> {
    const featuredShops = this.featuredShops.get(type) || [];
    
    // Filter out expired shops
    const now = new Date();
    const activeFeatured = featuredShops.filter(fs => 
      !fs.expiresAt || new Date(fs.expiresAt) > now
    );

    // In a real implementation, fetch shop details
    // For now, return mock shop data
    const shops: Shop[] = activeFeatured.slice(0, limit || activeFeatured.length).map(fs => ({
      id: fs.shopId,
      tenantId: '1',
      autoId: fs.shopId,
      name: `Shop ${fs.shopId}`,
      description: `Featured ${type} shop`,
      imageUrl: '/api/placeholder/300/200',
      rating: 4.5,
      reviewCount: 100,
      location: 'New York, NY',
      productCount: 50,
      category: 'Electronics',
      isVerified: true,
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      urls: { 
        canonicalUrl: `/shops/${fs.shopId}`,
        slugUrl: `/shops/${fs.shopId}`,
        tenantIdUrl: `/t/${fs.shopId}`,
        autoIdUrl: `/shops/${fs.shopId}`
      }
    }));

    return shops;
  }

  async getShopFeaturedTypes(shopId: string): Promise<FeaturedType[]> {
    return this.shopFeaturedTypes.get(shopId) || [];
  }

  async updateFeaturedMetadata(shopId: string, type: FeaturedType, metadata: FeaturedShopMetadata): Promise<void> {
    const currentFeatured = this.featuredShops.get(type) || [];
    const featuredShop = currentFeatured.find(fs => fs.shopId === shopId);
    
    if (!featuredShop) {
      throw new Error(`Shop ${shopId} is not featured as ${type}`);
    }

    featuredShop.metadata = metadata;
    this.featuredShops.set(type, currentFeatured);
    
    console.log(`Updated metadata for ${type} featuring of shop ${shopId}`);
  }

  async getFeaturedStats(type?: FeaturedType): Promise<FeaturedStats> {
    let allFeaturedShops: FeaturedShop[] = [];
    
    if (type) {
      allFeaturedShops = this.featuredShops.get(type) || [];
    } else {
      // Get all featured shops across all types
      Object.values(this.featuredShops).forEach(shops => {
        allFeaturedShops.push(...shops);
      });
    }

    // Filter out expired shops
    const now = new Date();
    const activeFeatured = allFeaturedShops.filter(fs => 
      !fs.expiresAt || new Date(fs.expiresAt) > now
    );

    // Calculate stats
    const byType: Record<FeaturedType, number> = {} as any;
    let totalDuration = 0;
    
    Object.values(FEATURED_TYPE_CONFIGS).forEach(config => {
      const typeShops = this.featuredShops.get(config.type) || [];
      const activeTypeShops = typeShops.filter(fs => 
        !fs.expiresAt || new Date(fs.expiresAt) > now
      );
      byType[config.type] = activeTypeShops.length;
    });

    // Calculate average duration (mock calculation)
    const averageDuration = 14; // days

    // Find most popular type
    let mostPopular: FeaturedType = 'trending';
    let maxCount = 0;
    Object.entries(byType).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostPopular = type as FeaturedType;
      }
    });

    // Get recent additions
    const recentAdditions = activeFeatured
      .sort((a, b) => new Date(b.featuredAt).getTime() - new Date(a.featuredAt).getTime())
      .slice(0, 5);

    return {
      totalFeatured: activeFeatured.length,
      byType,
      averageDuration,
      mostPopular,
      recentAdditions
    };
  }

  // Utility methods
  async isShopFeatured(shopId: string, type?: FeaturedType): Promise<boolean> {
    if (type) {
      const featuredShops = this.featuredShops.get(type) || [];
      return featuredShops.some(fs => fs.shopId === shopId);
    } else {
      const shopTypes = await this.getShopFeaturedTypes(shopId);
      return shopTypes.length > 0;
    }
  }

  async getFeaturedExpiry(shopId: string, type: FeaturedType): Promise<string | null> {
    const featuredShops = this.featuredShops.get(type) || [];
    const featuredShop = featuredShops.find(fs => fs.shopId === shopId);
    
    return featuredShop?.expiresAt || null;
  }

  async extendFeatured(shopId: string, type: FeaturedType, days: number): Promise<void> {
    const currentFeatured = this.featuredShops.get(type) || [];
    const featuredShop = currentFeatured.find(fs => fs.shopId === shopId);
    
    if (!featuredShop) {
      throw new Error(`Shop ${shopId} is not featured as ${type}`);
    }

    const currentExpiry = featuredShop.expiresAt;
    const newExpiry = currentExpiry 
      ? new Date(new Date(currentExpiry).getTime() + (days * 24 * 60 * 60 * 1000))
      : new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
    
    featuredShop.expiresAt = newExpiry.toISOString();
    this.featuredShops.set(type, currentFeatured);
    
    console.log(`Extended ${type} featuring for shop ${shopId} by ${days} days`);
  }

  private calculateExpiryDate(days: number): string {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry.toISOString();
  }

  // Auto-cleanup expired featured shops
  async cleanupExpiredFeatured(): Promise<void> {
    const now = new Date();
    let removedCount = 0;
    
    Object.entries(this.featuredShops).forEach(([type, shops]: [string, FeaturedShop[]]) => {
      const activeShops = shops.filter(fs => 
        !fs.expiresAt || new Date(fs.expiresAt) > now
      );
      
      if (activeShops.length !== shops.length) {
        this.featuredShops.set(type, activeShops);
        removedCount += shops.length - activeShops.length;
      }
    });
    
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired featured shops`);
    }
  }
}

// Export singleton instance
export const featuredShopManager = FeaturedShopManagerImpl.getInstance();

// React hook for featured shops management
import { useState, useEffect } from 'react';

export function useFeaturedShops(type?: FeaturedType, limit?: number) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<FeaturedStats | null>(null);

  useEffect(() => {
    const loadFeaturedShops = async () => {
      setLoading(true);
      try {
        const [featuredShops, featuredStats] = await Promise.all([
          featuredShopManager.getFeaturedShops(type || 'trending', limit),
          featuredShopManager.getFeaturedStats(type || 'trending')
        ]);
        
        setShops(featuredShops);
        setStats(featuredStats);
      } catch (error) {
        console.error('Error loading featured shops:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFeaturedShops();
  }, [type, limit]);

  const addToFeatured = async (shopId: string, featuredType: FeaturedType, metadata?: FeaturedShopMetadata) => {
    try {
      await featuredShopManager.addToFeatured(shopId, featuredType, metadata);
      // Reload shops
      if (type) {
        const updatedShops = await featuredShopManager.getFeaturedShops(type, limit);
        setShops(updatedShops);
      }
    } catch (error) {
      console.error('Error adding to featured:', error);
      throw error;
    }
  };

  const removeFromFeatured = async (shopId: string, featuredType: FeaturedType) => {
    try {
      await featuredShopManager.removeFromFeatured(shopId, featuredType);
      // Reload shops
      if (type) {
        const updatedShops = await featuredShopManager.getFeaturedShops(type, limit);
        setShops(updatedShops);
      }
    } catch (error) {
      console.error('Error removing from featured:', error);
      throw error;
    }
  };

  return {
    shops,
    loading,
    stats,
    addToFeatured,
    removeFromFeatured,
    config: type ? FEATURED_TYPE_CONFIGS[type] : null
  };
}

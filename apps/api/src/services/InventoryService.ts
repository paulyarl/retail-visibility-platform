/**
 * Inventory Service - API Server Singleton
 * 
 * Manages inventory items, stock tracking, and product management
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';

// Inventory Types
export interface InventoryItem {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  price: {
    regular: number;
    sale?: number;
    currency: string;
  };
  stock: {
    quantity: number;
    reserved: number;
    available: number;
    reorderLevel: number;
    reorderPoint: number;
    lastRestocked: string;
  };
  location: {
    aisle?: string;
    shelf?: string;
    bin?: string;
    warehouse?: string;
    storeId?: string;
  };
  attributes: {
    weight?: number;
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: string;
    };
    color?: string;
    size?: string;
    material?: string;
    tags?: string[];
  };
  images: {
    primary?: string;
    gallery: string[];
    thumbnails: string[];
  };
  status: 'active' | 'inactive' | 'discontinued' | 'out_of_stock';
  metadata: {
    supplier?: string;
    supplierSku?: string;
    cost?: number;
    margin?: number;
    barcode?: string;
    upc?: string;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    lastModifiedBy?: string;
  };
  analytics: {
    views: number;
    clicks: number;
    orders: number;
    revenue: number;
    lastViewed?: string;
    conversionRate: number;
  };
}

export interface InventoryStats {
  totalItems: number;
  activeItems: number;
  outOfStockItems: number;
  lowStockItems: number;
  totalValue: number;
  totalStock: number;
  itemsByCategory: Record<string, number>;
  itemsByLocation: Record<string, number>;
  topSellingItems: Array<{
    itemId: string;
    name: string;
    sku: string;
    orders: number;
    revenue: number;
  }>;
  lowStockAlerts: Array<{
    itemId: string;
    name: string;
    sku: string;
    currentStock: number;
    reorderLevel: number;
  }>;
  valueByCategory: Record<string, number>;
}

export interface CreateInventoryItemRequest {
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  brand?: string;
  price: {
    regular: number;
    sale?: number;
    currency: string;
  };
  stock: {
    quantity: number;
    reorderLevel: number;
    reorderPoint: number;
  };
  location?: Partial<InventoryItem['location']>;
  attributes?: Partial<InventoryItem['attributes']>;
  images?: Partial<InventoryItem['images']>;
  metadata?: Partial<InventoryItem['metadata']>;
}

export interface UpdateInventoryItemRequest {
  name?: string;
  description?: string;
  category?: string;
  brand?: string;
  price?: Partial<InventoryItem['price']>;
  stock?: Partial<InventoryItem['stock']>;
  location?: Partial<InventoryItem['location']>;
  attributes?: Partial<InventoryItem['attributes']>;
  images?: Partial<InventoryItem['images']>;
  status?: InventoryItem['status'];
  metadata?: Partial<InventoryItem['metadata']>;
}

export interface InventoryFilter {
  tenantId?: string;
  category?: string;
  brand?: string;
  status?: InventoryItem['status'];
  location?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'sku' | 'price' | 'stock' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

class InventoryService extends UniversalSingleton {
  private static instance: InventoryService;
  private inventoryCache: Map<string, InventoryItem> = new Map();

  constructor() {
    super('inventory-service', {
      enableCache: true,
      enableEncryption: false,
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 1800, // 30 minutes
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize with mock data for testing
    this.initializeMockData();
  }

  static getInstance(): InventoryService {
    if (!InventoryService.instance) {
      InventoryService.instance = new InventoryService();
    }
    return InventoryService.instance;
  }

  // ====================
  // INVENTORY MANAGEMENT
  // ====================

  /**
   * Get inventory item by ID
   */
  async getInventoryItem(itemId: string): Promise<InventoryItem | null> {
    // Check local cache first
    const localCached = this.inventoryCache.get(itemId);
    if (localCached) {
      return localCached;
    }

    // Check persistent cache
    const cacheKey = `inventory-item-${itemId}`;
    const cached = await this.getFromCache<InventoryItem>(cacheKey);
    if (cached) {
      this.inventoryCache.set(itemId, cached);
      return cached;
    }

    try {
      // Query database for inventory item
      const item = await this.queryInventoryItem(itemId);
      
      if (item) {
        // Update caches
        this.inventoryCache.set(itemId, item);
        await this.setCache(cacheKey, item);
        return item;
      }

      return null;
    } catch (error) {
      this.logError('Error fetching inventory item', error);
      return null;
    }
  }

  /**
   * Get inventory item by SKU
   */
  async getInventoryItemBySku(tenantId: string, sku: string): Promise<InventoryItem | null> {
    try {
      const items = await this.listInventoryItems({ tenantId, search: sku });
      return items.find(item => item.sku === sku) || null;
    } catch (error) {
      this.logError('Error fetching inventory item by SKU', error);
      return null;
    }
  }

  /**
   * Create new inventory item
   */
  async createInventoryItem(request: CreateInventoryItemRequest): Promise<InventoryItem> {
    const newItem: InventoryItem = {
      id: this.generateId(),
      tenantId: request.tenantId,
      sku: request.sku,
      name: request.name,
      description: request.description,
      category: request.category,
      brand: request.brand,
      price: request.price,
      stock: {
        ...request.stock,
        reserved: 0,
        available: request.stock.quantity,
        lastRestocked: new Date().toISOString()
      },
      location: request.location || {},
      attributes: request.attributes || {},
      images: {
        primary: request.images?.primary,
        gallery: request.images?.gallery || [],
        thumbnails: request.images?.thumbnails || []
      } as InventoryItem['images'],
      status: 'active',
      metadata: {
        ...request.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      analytics: {
        views: 0,
        clicks: 0,
        orders: 0,
        revenue: 0,
        conversionRate: 0
      }
    };

    try {
      // Store in database
      await this.storeInventoryItem(newItem);
      
      // Update caches
      this.inventoryCache.set(newItem.id, newItem);
      const cacheKey = `inventory-item-${newItem.id}`;
      await this.setCache(cacheKey, newItem);

      this.logInfo('Inventory item created successfully', { itemId: newItem.id, sku: newItem.sku });
      
      return newItem;
    } catch (error) {
      this.logError('Error creating inventory item', error);
      throw new Error('Failed to create inventory item');
    }
  }

  /**
   * Update inventory item
   */
  async updateInventoryItem(itemId: string, updates: UpdateInventoryItemRequest): Promise<InventoryItem> {
    const existingItem = await this.getInventoryItem(itemId);
    if (!existingItem) {
      throw new Error('Inventory item not found');
    }

    const updatedItem: InventoryItem = {
      ...existingItem,
      ...updates,
      price: updates.price ? {
        ...existingItem.price,
        ...updates.price
      } : existingItem.price,
      stock: updates.stock ? {
        ...existingItem.stock,
        ...updates.stock,
        available: updates.stock.quantity !== undefined 
          ? updates.stock.quantity - existingItem.stock.reserved
          : existingItem.stock.available
      } : existingItem.stock,
      location: updates.location ? {
        ...existingItem.location,
        ...updates.location
      } : existingItem.location,
      attributes: updates.attributes ? {
        ...existingItem.attributes,
        ...updates.attributes
      } : existingItem.attributes,
      images: updates.images ? {
        ...existingItem.images,
        ...updates.images
      } : existingItem.images,
      metadata: updates.metadata ? {
        ...existingItem.metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString()
      } : existingItem.metadata
    };

    try {
      // Update in database
      await this.updateInventoryItemInDatabase(itemId, updates);
      
      // Update caches
      this.inventoryCache.set(itemId, updatedItem);
      const cacheKey = `inventory-item-${itemId}`;
      await this.setCache(cacheKey, updatedItem);

      this.logInfo('Inventory item updated successfully', { itemId, updates });
      
      return updatedItem;
    } catch (error) {
      this.logError('Error updating inventory item', error);
      throw new Error('Failed to update inventory item');
    }
  }

  /**
   * Delete inventory item
   */
  async deleteInventoryItem(itemId: string): Promise<void> {
    const item = await this.getInventoryItem(itemId);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    try {
      // Delete from database
      await this.deleteInventoryItemFromDatabase(itemId);
      
      // Clear caches
      this.inventoryCache.delete(itemId);
      const cacheKey = `inventory-item-${itemId}`;
      await this.clearCache(cacheKey);

      this.logInfo('Inventory item deleted successfully', { itemId });
    } catch (error) {
      this.logError('Error deleting inventory item', error);
      throw new Error('Failed to delete inventory item');
    }
  }

  /**
   * List inventory items with filters
   */
  async listInventoryItems(filters: InventoryFilter = {}): Promise<InventoryItem[]> {
    try {
      const items = await this.queryInventoryItems(filters);
      
      // Apply sorting
      if (filters.sortBy) {
        items.sort((a, b) => {
          const aValue = this.getSortValue(a, filters.sortBy!);
          const bValue = this.getSortValue(b, filters.sortBy!);
          
          if (filters.sortOrder === 'desc') {
            return bValue - aValue;
          }
          return aValue - bValue;
        });
      }
      
      return items;
    } catch (error) {
      this.logError('Error listing inventory items', error);
      return [];
    }
  }

  /**
   * Update stock levels
   */
  async updateStock(itemId: string, quantity: number, operation: 'add' | 'subtract' | 'set' = 'set'): Promise<InventoryItem> {
    const item = await this.getInventoryItem(itemId);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    let newQuantity: number;
    switch (operation) {
      case 'add':
        newQuantity = item.stock.quantity + quantity;
        break;
      case 'subtract':
        newQuantity = Math.max(0, item.stock.quantity - quantity);
        break;
      case 'set':
      default:
        newQuantity = quantity;
        break;
    }

    const updatedItem = await this.updateInventoryItem(itemId, {
      stock: {
        quantity: newQuantity,
        available: newQuantity - item.stock.reserved,
        lastRestocked: operation === 'add' ? new Date().toISOString() : item.stock.lastRestocked
      }
    });

    // Check for low stock alerts
    if (updatedItem.stock.available <= updatedItem.stock.reorderLevel) {
      this.logWarning('Low stock alert', { itemId, sku: updatedItem.sku, currentStock: updatedItem.stock.available, reorderLevel: updatedItem.stock.reorderLevel });
    }

    return updatedItem;
  }

  // ====================
  // INVENTORY ANALYTICS
  // ====================

  /**
   * Get inventory statistics
   */
  async getInventoryStats(tenantId?: string): Promise<InventoryStats> {
    try {
      const cacheKey = `inventory-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<InventoryStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const items = tenantId 
        ? await this.listInventoryItems({ tenantId })
        : Array.from(this.inventoryCache.values());
      
      const stats = await this.calculateInventoryStats(items);
      
      // Cache for 15 minutes
      await this.setCache(cacheKey, stats, { ttl: 900 });
      
      return stats;
    } catch (error) {
      this.logError('Error fetching inventory stats', error);
      throw new Error('Failed to fetch inventory statistics');
    }
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(tenantId?: string): Promise<InventoryItem[]> {
    try {
      const items = tenantId 
        ? await this.listInventoryItems({ tenantId })
        : Array.from(this.inventoryCache.values());
      
      return items.filter(item => 
        item.stock.available <= item.stock.reorderLevel && 
        item.status === 'active'
      );
    } catch (error) {
      this.logError('Error fetching low stock alerts', error);
      return [];
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private getSortValue(item: InventoryItem, sortBy: string): number {
    switch (sortBy) {
      case 'name':
        return item.name.toLowerCase().charCodeAt(0);
      case 'sku':
        return item.sku.toLowerCase().charCodeAt(0);
      case 'price':
        return item.price.regular;
      case 'stock':
        return item.stock.available;
      case 'createdAt':
        return new Date(item.metadata.createdAt).getTime();
      case 'updatedAt':
        return new Date(item.metadata.updatedAt).getTime();
      default:
        return 0;
    }
  }

  // ====================
  // MOCK DATA IMPLEMENTATION
  // ====================

  private initializeMockData(): void {
    // Create mock inventory items for testing
    const mockItems: InventoryItem[] = [
      {
        id: 'inv-001',
        tenantId: 'tid-m8ijkrnk',
        sku: 'ELEC-001',
        name: 'Smartphone Model X',
        description: 'Latest smartphone with advanced features',
        category: 'Electronics',
        brand: 'TechBrand',
        price: {
          regular: 99999,
          sale: 89999,
          currency: 'USD'
        },
        stock: {
          quantity: 50,
          reserved: 5,
          available: 45,
          reorderLevel: 10,
          reorderPoint: 5,
          lastRestocked: new Date().toISOString()
        },
        location: {
          aisle: 'A1',
          shelf: 'S1',
          bin: 'B1',
          warehouse: 'Main',
          storeId: 'store-001'
        },
        attributes: {
          weight: 180,
          dimensions: {
            length: 15,
            width: 7,
            height: 1,
            unit: 'cm'
          },
          color: 'Black',
          size: '6.5 inch',
          material: 'Glass',
          tags: ['smartphone', 'electronics', 'mobile']
        },
        images: {
          primary: 'https://example.com/images/phone1.jpg',
          gallery: ['https://example.com/images/phone1-1.jpg', 'https://example.com/images/phone1-2.jpg'],
          thumbnails: ['https://example.com/images/phone1-thumb.jpg']
        },
        status: 'active',
        metadata: {
          supplier: 'TechSupplier',
          supplierSku: 'TS-001',
          cost: 75000,
          margin: 25,
          barcode: '1234567890123',
          upc: '012345678901',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: new Date().toISOString()
        },
        analytics: {
          views: 150,
          clicks: 45,
          orders: 12,
          revenue: 1079988,
          lastViewed: new Date().toISOString(),
          conversionRate: 0.08
        }
      },
      {
        id: 'inv-002',
        tenantId: 'tid-m8ijkrnk',
        sku: 'ELEC-002',
        name: 'Laptop Pro 15"',
        description: 'High-performance laptop for professionals',
        category: 'Electronics',
        brand: 'TechBrand',
        price: {
          regular: 149999,
          currency: 'USD'
        },
        stock: {
          quantity: 25,
          reserved: 3,
          available: 22,
          reorderLevel: 5,
          reorderPoint: 3,
          lastRestocked: new Date().toISOString()
        },
        location: {
          aisle: 'B2',
          shelf: 'S2',
          bin: 'B2',
          warehouse: 'Main',
          storeId: 'store-001'
        },
        attributes: {
          weight: 1800,
          dimensions: {
            length: 35,
            width: 25,
            height: 2,
            unit: 'cm'
          },
          color: 'Silver',
          material: 'Aluminum',
          tags: ['laptop', 'computer', 'professional']
        },
        images: {
          primary: 'https://example.com/images/laptop1.jpg',
          gallery: ['https://example.com/images/laptop1-1.jpg'],
          thumbnails: ['https://example.com/images/laptop1-thumb.jpg']
        },
        status: 'active',
        metadata: {
          supplier: 'TechSupplier',
          supplierSku: 'TS-002',
          cost: 120000,
          margin: 20,
          barcode: '1234567890124',
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: new Date().toISOString()
        },
        analytics: {
          views: 200,
          clicks: 80,
          orders: 8,
          revenue: 1199992,
          lastViewed: new Date().toISOString(),
          conversionRate: 0.04
        }
      },
      {
        id: 'inv-003',
        tenantId: 'tid-m8ijkrnk',
        sku: 'CLOTH-001',
        name: 'Cotton T-Shirt',
        description: 'Comfortable cotton t-shirt',
        category: 'Clothing',
        brand: 'FashionBrand',
        price: {
          regular: 1999,
          currency: 'USD'
        },
        stock: {
          quantity: 100,
          reserved: 10,
          available: 90,
          reorderLevel: 20,
          reorderPoint: 15,
          lastRestocked: new Date().toISOString()
        },
        location: {
          aisle: 'C3',
          shelf: 'S3',
          bin: 'B3',
          warehouse: 'Main',
          storeId: 'store-001'
        },
        attributes: {
          weight: 200,
          dimensions: {
            length: 70,
            width: 50,
            height: 1,
            unit: 'cm'
          },
          color: 'Blue',
          size: 'Large',
          material: 'Cotton',
          tags: ['clothing', 'casual', 'cotton']
        },
        images: {
          primary: 'https://example.com/images/shirt1.jpg',
          gallery: ['https://example.com/images/shirt1-1.jpg'],
          thumbnails: ['https://example.com/images/shirt1-thumb.jpg']
        },
        status: 'active',
        metadata: {
          supplier: 'FashionSupplier',
          supplierSku: 'FS-001',
          cost: 500,
          margin: 75,
          barcode: '1234567890125',
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: new Date().toISOString()
        },
        analytics: {
          views: 300,
          clicks: 120,
          orders: 45,
          revenue: 89955,
          lastViewed: new Date().toISOString(),
          conversionRate: 0.15
        }
      }
    ];

    // Cache mock items
    mockItems.forEach(item => {
      this.inventoryCache.set(item.id, item);
    });
  }

  // ====================
  // DATABASE STUBS
  // ====================

  private async queryInventoryItem(itemId: string): Promise<InventoryItem | null> {
    console.log('Querying inventory item:', itemId);
    return this.inventoryCache.get(itemId) || null;
  }

  private async storeInventoryItem(item: InventoryItem): Promise<void> {
    console.log('Storing inventory item:', item.id);
    this.inventoryCache.set(item.id, item);
  }

  private async updateInventoryItemInDatabase(itemId: string, updates: UpdateInventoryItemRequest): Promise<void> {
    console.log('Updating inventory item in database:', itemId, updates);
  }

  private async deleteInventoryItemFromDatabase(itemId: string): Promise<void> {
    console.log('Deleting inventory item from database:', itemId);
  }

  private async queryInventoryItems(filters: InventoryFilter): Promise<InventoryItem[]> {
    console.log('Querying inventory items with filters:', filters);
    let items = Array.from(this.inventoryCache.values());

    // Apply filters
    if (filters.tenantId) {
      items = items.filter(item => item.tenantId === filters.tenantId);
    }
    
    if (filters.category) {
      items = items.filter(item => item.category === filters.category);
    }
    
    if (filters.brand) {
      items = items.filter(item => item.brand === filters.brand);
    }
    
    if (filters.status) {
      items = items.filter(item => item.status === filters.status);
    }
    
    if (filters.location) {
      items = items.filter(item => 
        item.location.aisle === filters.location || 
        item.location.shelf === filters.location ||
        item.location.warehouse === filters.location
      );
    }
    
    if (filters.lowStock) {
      items = items.filter(item => item.stock.available <= item.stock.reorderLevel);
    }
    
    if (filters.outOfStock) {
      items = items.filter(item => item.stock.available === 0);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.sku.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.brand?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply pagination
    if (filters.offset || filters.limit) {
      const start = filters.offset || 0;
      const end = filters.limit ? start + filters.limit : undefined;
      items = items.slice(start, end);
    }

    return items;
  }

  private async calculateInventoryStats(items: InventoryItem[]): Promise<InventoryStats> {
    const totalItems = items.length;
    const activeItems = items.filter(item => item.status === 'active').length;
    const outOfStockItems = items.filter(item => item.stock.available === 0).length;
    const lowStockItems = items.filter(item => item.stock.available <= item.stock.reorderLevel).length;
    
    const totalValue = items.reduce((sum, item) => sum + (item.price.regular * item.stock.quantity), 0);
    const totalStock = items.reduce((sum, item) => sum + item.stock.quantity, 0);
    
    const itemsByCategory = items.reduce((acc, item) => {
      const category = item.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const itemsByLocation = items.reduce((acc, item) => {
      const location = item.location.warehouse || 'unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topSellingItems = items
      .sort((a, b) => b.analytics.orders - a.analytics.orders)
      .slice(0, 5)
      .map(item => ({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        orders: item.analytics.orders,
        revenue: item.analytics.revenue
      }));
    
    const lowStockAlerts = items
      .filter(item => item.stock.available <= item.stock.reorderLevel && item.status === 'active')
      .map(item => ({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        currentStock: item.stock.available,
        reorderLevel: item.stock.reorderLevel
      }));
    
    const valueByCategory = items.reduce((acc, item) => {
      const category = item.category || 'uncategorized';
      acc[category] = (acc[category] || 0) + (item.price.regular * item.stock.quantity);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalItems,
      activeItems,
      outOfStockItems,
      lowStockItems,
      totalValue,
      totalStock,
      itemsByCategory,
      itemsByLocation,
      topSellingItems,
      lowStockAlerts,
      valueByCategory
    };
  }
}

export default InventoryService;

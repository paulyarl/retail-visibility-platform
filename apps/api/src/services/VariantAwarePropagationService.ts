/**
 * Variant-Aware Product Propagation Service
 * 
 * Unified service for propagating products and variants across:
 * - Inventory Transfers (internal movement)
 * - External Sync Services (Square, GMC, etc.)
 * - Bulk Operations (price updates, stock updates)
 * 
 * This creates a unified interface for all product propagation operations.
 */

import { prisma } from '../prisma';
import { BaseService } from './BaseService';
import { logger } from '../logger';

export interface PropagationProduct {
  // Core product data
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  brand?: string;
  categoryPath?: string[];
  gtin?: string;
  imageUrl?: string;
  
  // Variant information
  hasVariants: boolean;
  variantType: 'parent_item' | 'product_variant';
  variantId?: string;
  variantName?: string;
  variantAttributes?: Record<string, string>;
  parentItem?: {
    id: string;
    name: string;
    sku: string;
  };
  
  // Universal integration
  productSlug?: string;
  isUniversal?: boolean;
  universalSku?: string;
  
  // Enriched product content
  features?: string[];
  specifications?: Record<string, any>;
  enhanced_description?: string;
  
  // Digital product fields
  license_type?: string;
  access_duration_days?: number;
  download_limit?: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface PropagationTarget {
  type: 'inventory_transfer' | 'square_sync' | 'gmc_sync' | 'bulk_operation';
  targetId?: string; // location_id, integration_id, etc.
  config?: Record<string, any>;
}

export interface PropagationResult {
  success: boolean;
  propagatedCount: number;
  errorCount: number;
  errors: Array<{
    productId: string;
    variantId?: string;
    error: string;
  }>;
  details?: {
    target: PropagationTarget;
    operation: string;
    duration: number;
  };
}

export interface BulkPropagationRequest {
  tenantId: string;
  target: PropagationTarget;
  productIds?: string[];
  operation: 'create' | 'update' | 'delete' | 'sync';
  filters?: {
    category?: string;
    brand?: string;
    hasVariantsOnly?: boolean;
    lowStockOnly?: boolean;
  };
  options?: {
    includeVariants?: boolean;
    updateStockOnly?: boolean;
    updatePriceOnly?: boolean;
    batchSize?: number;
  };
}

export class VariantAwarePropagationService extends BaseService {
  private static instance: VariantAwarePropagationService;

  constructor() {
    super();
  }

  static getInstance(): VariantAwarePropagationService {
    if (!VariantAwarePropagationService.instance) {
      VariantAwarePropagationService.instance = new VariantAwarePropagationService();
    }
    return VariantAwarePropagationService.instance;
  }

  /**
   * Get products for propagation (variant-aware)
   */
  async getProductsForPropagation(request: BulkPropagationRequest): Promise<PropagationProduct[]> {
    const startTime = Date.now();
    
    try {
      const { tenantId, productIds, filters, options } = request;
      
      logger.info(`Getting products for propagation: tenant=${tenantId}, operation=${request.operation}`);

      // Build base query for inventory items
      const where: any = {
        tenant_id: tenantId,
        item_status: 'active'
      };

      if (productIds && productIds.length > 0) {
        where.id = { in: productIds };
      }

      if (filters?.category) {
        where.category_path = { hasSome: [filters.category] };
      }

      if (filters?.brand) {
        where.brand = { contains: filters.brand, mode: 'insensitive' };
      }

      if (filters?.lowStockOnly) {
        where.stock = { lte: 5 };
      }

      // Get parent items
      const parentItems = await prisma.inventory_items.findMany({
        where,
        select: {
          id: true,
          tenant_id: true,
          sku: true,
          name: true,
          description: true,
          price: true,
          brand: true,
          category_path: true,
          gtin: true,
          image_url: true,
          stock: true,
          has_variants: true,
          created_at: true,
          updated_at: true,
          metadata: true,
          // Add new enriched content fields
          features: true,
          specifications: true,
          enhanced_description: true,
          license_type: true,
          access_duration_days: true,
          download_limit: true
        },
        take: options?.batchSize || 1000
      });

      logger.info(`Found ${parentItems.length} parent items for propagation`);

      // Get variants if needed
      const variantData = new Map();
      if (options?.includeVariants !== false) {
        const itemsWithVariants = parentItems.filter(item => item.has_variants);
        
        if (itemsWithVariants.length > 0) {
          const variants = await prisma.product_variants.findMany({
            where: {
              parent_item_id: { in: itemsWithVariants.map(item => item.id) },
              tenant_id: tenantId,
              is_active: true
            },
            select: {
              id: true,
              parent_item_id: true,
              sku: true,
              variant_name: true,
              stock: true,
              price_cents: true,
              attributes: true,
              is_active: true,
              created_at: true,
              updated_at: true
            }
          });

          // Group variants by parent
          variants.forEach(variant => {
            if (!variantData.has(variant.parent_item_id)) {
              variantData.set(variant.parent_item_id, []);
            }
            variantData.get(variant.parent_item_id).push(variant);
          });

          logger.info(`Loaded ${variants.length} variants for propagation`);
        }
      }

      // Transform to propagation format
      const products: PropagationProduct[] = [];

      for (const item of parentItems) {
        const variants = variantData.get(item.id) || [];

        if (variants.length > 0 && options?.includeVariants !== false) {
          // Add each variant as a separate product
          for (const variant of variants) {
            if (filters?.hasVariantsOnly && !item.has_variants) continue;

            products.push({
              id: variant.id,
              tenantId: item.tenant_id,
              sku: variant.sku,
              name: `${item.name} - ${variant.variant_name}`,
              description: item.description || undefined,
              priceCents: variant.price_cents || Math.round(Number(item.price) * 100) || 0,
              stock: variant.stock,
              brand: item.brand,
              categoryPath: item.category_path,
              gtin: item.gtin || undefined,
              imageUrl: item.image_url || undefined,
              hasVariants: true,
              variantType: 'product_variant',
              variantId: variant.id,
              variantName: variant.variant_name,
              variantAttributes: variant.attributes,
              parentItem: {
                id: item.id,
                name: item.name,
                sku: item.sku
              },
              // Add enriched content fields
              features: item.features || undefined,
              specifications: (item.specifications as Record<string, any>) || undefined,
              enhanced_description: item.enhanced_description || undefined,
              license_type: item.license_type || undefined,
              access_duration_days: item.access_duration_days || undefined,
              download_limit: item.download_limit || undefined,
              createdAt: variant.created_at,
              updatedAt: variant.updated_at,
              metadata: {
                ...(item.metadata as Record<string, any> || {}),
                legacyItemId: item.id
              }
            });
          }
        } else {
          // Add parent item (if not filtering variants only)
          if (!filters?.hasVariantsOnly) {
            products.push({
              id: item.id,
              tenantId: item.tenant_id,
              sku: item.sku,
              name: item.name,
              description: item.description || undefined,
              priceCents: Math.round(Number(item.price) * 100) || 0,
              stock: item.stock,
              brand: item.brand,
              categoryPath: item.category_path,
              gtin: item.gtin || undefined,
              imageUrl: item.image_url || undefined,
              hasVariants: item.has_variants || false,
              variantType: 'parent_item',
              // Add enriched content fields
              features: item.features || undefined,
              specifications: (item.specifications as Record<string, any>) || undefined,
              enhanced_description: item.enhanced_description || undefined,
              license_type: item.license_type || undefined,
              access_duration_days: item.access_duration_days || undefined,
              download_limit: item.download_limit || undefined,
              createdAt: item.created_at,
              updatedAt: item.updated_at,
              metadata: item.metadata as Record<string, any> || undefined
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.info(`Propagation products loaded: ${products.length} items in ${duration}ms`);

      return products;
    } catch (error) {
      logger.error('Failed to get products for propagation:', { region: 'unknown' });
      throw new Error(`Failed to get products for propagation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Propagate products to target system
   */
  async propagateProducts(request: BulkPropagationRequest): Promise<PropagationResult> {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ productId: string; variantId?: string; error: string }> = [];

    try {
      logger.info(`Starting propagation: operation=${request.operation}, target=${request.target.type}`);

      // Get products for propagation
      const products = await this.getProductsForPropagation(request);

      if (products.length === 0) {
        logger.info('No products found for propagation');
        return {
          success: true,
          propagatedCount: 0,
          errorCount: 0,
          errors: [],
          details: {
            target: request.target,
            operation: request.operation,
            duration: Date.now() - startTime
          }
        };
      }

      // Route to appropriate propagation handler
      switch (request.target.type) {
        case 'inventory_transfer':
          return this.handleInventoryTransferPropagation(request, products);
        
        case 'square_sync':
          return this.handleSquareSyncPropagation(request, products);
        
        case 'gmc_sync':
          return this.handleGMCSyncPropagation(request, products);
        
        case 'bulk_operation':
          return this.handleBulkOperationPropagation(request, products);
        
        default:
          throw new Error(`Unsupported propagation target: ${request.target.type}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Propagation failed:', { region: 'unknown' });
      
      return {
        success: false,
        propagatedCount: successCount,
        errorCount: errorCount + 1,
        errors: [{
          productId: 'system',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        details: {
          target: request.target,
          operation: request.operation,
          duration
        }
      };
    }
  }

  /**
   * Handle inventory transfer propagation
   */
  private async handleInventoryTransferPropagation(
    request: BulkPropagationRequest,
    products: PropagationProduct[]
  ): Promise<PropagationResult> {
    const startTime = Date.now();
    logger.info(`Handling inventory transfer propagation for ${products.length} products`);
    
    // The inventory transfer system is already variant-aware through our previous work
    // This handler ensures compatibility with the unified propagation interface
    
    try {
      // Validate products for transfer
      const validProducts = products.filter(p => p.stock > 0);
      const invalidProducts = products.filter(p => p.stock <= 0);
      
      logger.info(`Valid products for transfer: ${validProducts.length}, Invalid: ${invalidProducts.length}`);

      return {
        success: invalidProducts.length === 0,
        propagatedCount: validProducts.length,
        errorCount: invalidProducts.length,
        errors: invalidProducts.map(p => ({
          productId: p.id,
          variantId: p.variantId,
          error: 'Insufficient stock for transfer'
        })),
        details: {
          target: request.target,
          operation: request.operation,
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      return {
        success: false,
        propagatedCount: 0,
        errorCount: products.length,
        errors: [{
          productId: 'system',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        details: {
          target: request.target,
          operation: request.operation,
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Handle Square sync propagation (variant-aware)
   */
  private async handleSquareSyncPropagation(
    request: BulkPropagationRequest,
    products: PropagationProduct[]
  ): Promise<PropagationResult> {
    const startTime = Date.now();
    logger.info(`Handling Square sync propagation for ${products.length} products`);
    
    try {
      // Import here to avoid circular dependencies
      const { VariantAwareSquareSync } = await import('./square/VariantAwareSquareSync');
      
      const squareSync = new VariantAwareSquareSync({
        tenantId: request.tenantId,
        integrationId: request.target.targetId || 'default',
        includeVariants: true,
        syncStock: true,
        syncPrices: true
      });

      return await squareSync.batchSync(products);
    } catch (error) {
      return {
        success: false,
        propagatedCount: 0,
        errorCount: products.length,
        errors: [{
          productId: 'system',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        details: {
          target: request.target,
          operation: request.operation,
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Handle Google Merchant Center sync propagation (variant-aware)
   */
  private async handleGMCSyncPropagation(
    request: BulkPropagationRequest,
    products: PropagationProduct[]
  ): Promise<PropagationResult> {
    const startTime = Date.now();
    logger.info(`Handling GMC sync propagation for ${products.length} products`);
    
    try {
      // Import here to avoid circular dependencies
      const { VariantAwareGMCSync } = await import('./VariantAwareGMCSync');
      
      // Get tenant's website URL for GMC
      const tenant = await prisma.tenants.findUnique({
        where: { id: request.tenantId },
        select: { metadata: true }
      });

      const tenantMetadata = tenant?.metadata as Record<string, any> || {};
      const websiteUrl = tenantMetadata?.website_url;

      if (!websiteUrl) {
        throw new Error('Tenant website URL not configured for GMC sync');
      }

      const gmcSync = new VariantAwareGMCSync({
        tenantId: request.tenantId,
        websiteUrl: websiteUrl,
        includeVariants: true,
        syncStock: true,
        syncPrices: true
      });

      return await gmcSync.batchSync(products);
    } catch (error) {
      return {
        success: false,
        propagatedCount: 0,
        errorCount: products.length,
        errors: [{
          productId: 'system',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        details: {
          target: request.target,
          operation: request.operation,
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Handle bulk operations propagation
   */
  private async handleBulkOperationPropagation(
    request: BulkPropagationRequest,
    products: PropagationProduct[]
  ): Promise<PropagationResult> {
    const startTime = Date.now();
    logger.info(`Handling bulk operation propagation for ${products.length} products`);
    
    try {
      // Import here to avoid circular dependencies
      const { VariantBulkOperationsService } = await import('./VariantBulkOperationsService');
      
      const bulkService = VariantBulkOperationsService.getInstance();
      
      // Extract variant IDs for bulk operations
      const variantIds = products
        .filter(p => p.variantType === 'product_variant')
        .map(p => p.id);

      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ productId: string; variantId?: string; error: string }> = [];

      if (request.options?.updateStockOnly) {
        // Handle bulk stock updates
        for (const product of products) {
          try {
            if (product.variantType === 'product_variant') {
              await bulkService.bulkUpdateStock({
                variant_ids: [product.id],
                stock: product.stock,
                operation: 'set'
              });
            }
            successCount++;
          } catch (error) {
            errorCount++;
            errors.push({
              productId: product.id,
              variantId: product.variantId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      } else if (request.options?.updatePriceOnly) {
        // Handle bulk price updates
        for (const product of products) {
          try {
            if (product.variantType === 'product_variant') {
              await bulkService.bulkUpdatePricing({
                variant_ids: [product.id],
                price_cents: product.priceCents
              });
            }
            successCount++;
          } catch (error) {
            errorCount++;
            errors.push({
              productId: product.id,
              variantId: product.variantId,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      } else {
        // General bulk operation
        successCount = products.length;
      }

      return {
        success: errorCount === 0,
        propagatedCount: successCount,
        errorCount,
        errors,
        details: {
          target: request.target,
          operation: request.operation,
          duration: Date.now() - startTime
        }
      };
    } catch (error) {
      return {
        success: false,
        propagatedCount: 0,
        errorCount: products.length,
        errors: [{
          productId: 'system',
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        details: {
          target: request.target,
          operation: request.operation,
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Generate universal product slug for propagation (using new UPC/LPC system)
   */
  generateProductSlug(product: PropagationProduct): string {
    const { generateProductSlug } = require('../lib/id-generator');
    
    return generateProductSlug({
      brand: product.brand || 'unknown',
      name: product.name || 'unknown',
      category: product.categoryPath?.[0] || 'general',
      categoryPath: product.categoryPath,
      gtin: product.gtin,
      sku: product.sku,
      itemId: product.id
    });
  }

  /**
   * Generate variant-specific slug for propagation
   */
  generateVariantSlug(product: PropagationProduct): string {
    if (!product.hasVariants || product.variantType !== 'product_variant') {
      return this.generateProductSlug(product);
    }

    const parentSlug = this.generateProductSlug({
      ...product,
      name: product.parentItem?.name || product.name,
      id: product.parentItem?.id || product.id
    });
    
    // Add variant attributes to slug
    const attrString = product.variantAttributes 
      ? Object.entries(product.variantAttributes)
          .map(([key, value]) => `${key}-${value}`)
          .join('-')
      : 'variant';
    
    let variantSlug = `${parentSlug}-${attrString}`;
    
    // Clean up the slug
    variantSlug = variantSlug
      .replace(/\s+/g, '-')
      .replace(/_/g, '-')
      .replace(/-+/g, '-')
      .replace(/--/g, '-')
      .toLowerCase();
    
    // Add variant name suffix for uniqueness
    if (product.variantName) {
      variantSlug += `-${product.variantName.toLowerCase().replace(/\s+/g, '-').slice(0, 10)}`;
    }
    
    return variantSlug;
  }
}

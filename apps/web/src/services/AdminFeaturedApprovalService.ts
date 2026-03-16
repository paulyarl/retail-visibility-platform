/**
 * Admin Featured Approval Service
 * 
 * Handles API calls for tenant and product approval workflows
 * Extends AdminApiSingleton for proper caching and context management
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface PendingTenant {
  id: string;
  name: string;
  subscription_tier: string;
  subscription_status: string;
  created_at: string;
  featured_access_approved?: boolean;
  featured_access_approved_by?: string;
  featured_access_approved_at?: string;
  featured_access_rejection_reason?: string;
  user_tenants: Array<{
    users: {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
    };
  }>;
  featured_products: Array<any>;
}

export interface PendingProduct {
  id: string;
  inventory_items: {
    id: string;
    name: string;
    sku: string;
    price_cents: number;
    image_url?: string;
  };
  tenants: {
    id: string;
    name: string;
    subscription_tier: string;
    subscription_status?: string;
  };
  featured_type: string;
  featured_priority: number;
  featured_at: string;
  featured_expires_at?: string;
  auto_unfeature: boolean;
  is_active: boolean;
  bucket_type: string;
  shop_scope_id?: string;
  shops_priority: number;
  admin_approved?: boolean;
  approved_by?: string;
  approved_at?: string;
}

export class AdminFeaturedApprovalService extends AdminApiSingleton {
  private static instance: AdminFeaturedApprovalService;

  private constructor() {
    super('AdminFeaturedApprovalService');
  }

  static getInstance(): AdminFeaturedApprovalService {
    if (!AdminFeaturedApprovalService.instance) {
      AdminFeaturedApprovalService.instance = new AdminFeaturedApprovalService();
    }
    return AdminFeaturedApprovalService.instance;
  }

  /**
   * Get all tenants with featured access status
   */
  async getAllTenantsWithFeaturedAccessStatus(): Promise<PendingTenant[]> {
    const result = await this.makeDefaultRequest<{ tenants: PendingTenant[] }>(
      '/api/featured-products/tenants/all-with-featured-access-status',
      {},
      'admin-all-tenants-featured-access'
    );
    return result.data.tenants || [];
  }

  /**
   * Get tenants pending featured access approval
   */
  async getPendingTenants(): Promise<PendingTenant[]> {
    const result = await this.makeDefaultRequest<{ pendingTenants: PendingTenant[] }>(
      '/api/featured-products/tenants/pending-featured-access',
      {},
      'admin-approval-pending-tenants'
    );
    return result.data.pendingTenants || [];
  }

  /**
   * Approve tenant for featured access
   */
  async approveTenant(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<{ tenant: any }>(
      `/api/featured-products/tenants/${tenantId}/approve-featured-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `admin-approval-tenant-${tenantId}`
    );
    if (!result.success) {
      console.log(`Failed to approve tenant: ${result.error}`);
      return null;
    }
    
    // Invalidate relevant caches
    await this.invalidateCache('admin-all-tenants-featured-access');
    await this.invalidateCache('admin-approval-pending-products');
    
    return result.data?.tenant;
  }

  /**
   * Reject tenant for featured access
   */
  async rejectTenant(tenantId: string, reason?: string): Promise<any> {
    const result = await this.makeDefaultRequest<{ tenant: any }>(
      `/api/featured-products/tenants/${tenantId}/reject-featured-access`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
      `admin-approval-tenant-${tenantId}`
    );
    if (!result.success) {
      console.log(`Failed to reject tenant: ${result.error}`);
      return null;
    }
    
    // Invalidate relevant caches
    await this.invalidateCache('admin-all-tenants-featured-access');
    await this.invalidateCache('admin-approval-pending-products');
    
    return result.data?.tenant;
  }

  /**
   * Get all featured products (both approved and rejected)
   */
  async getAllFeaturedProducts(): Promise<PendingProduct[]> {
    const result = await this.makeDefaultRequest<{ featuredProducts: any[] }>(
      '/api/featured-products/all-featured-products',
      {},
      'admin-all-featured-products'
    );
    
    if (!result.success || !result.data?.featuredProducts) {
      return [];
    }
    
    // Transform the data to match PendingProduct interface
    const allProducts: PendingProduct[] = [];
    
    result.data.featuredProducts.forEach((product: any) => {
      if (product.inventory_items) {
        allProducts.push({
          id: product.id,
          inventory_items: {
            id: product.inventory_items.id,
            name: product.inventory_items.name,
            sku: product.inventory_items.sku,
            price_cents: product.inventory_items.price_cents,
            image_url: product.inventory_items.image_url
          },
          tenants: {
            id: product.tenant_id,
            name: product.tenants?.name || 'Unknown Tenant',
            subscription_tier: product.tenants?.subscription_tier || 'unknown'
          },
          featured_type: product.featured_type,
          featured_priority: product.featured_priority,
          featured_at: product.featured_at,
          featured_expires_at: product.featured_expires_at,
          auto_unfeature: product.auto_unfeature,
          is_active: product.is_active,
          bucket_type: product.bucket_type,
          shop_scope_id: product.shop_scope_id,
          shops_priority: product.shops_priority,
          admin_approved: product.admin_approved,
          approved_by: product.approved_by,
          approved_at: product.approved_at
        });
      }
    });
    
    return allProducts;
  }

  /**
   * Get pending products for approval
   */
  async getPendingProducts(): Promise<PendingProduct[]> {
    const result = await this.makeDefaultRequest<{ pendingTenants: any[] }>(
      '/api/featured-products/tenants/pending-featured-access',
      {},
      'admin-approval-pending-products'
    );
    
    if (!result.success || !result.data?.pendingTenants) {
      return [];
    }
    
    // Extract pending products from all tenants
    const pendingProducts: PendingProduct[] = [];
    
    result.data.pendingTenants.forEach((tenant: any) => {
      if (tenant.featured_products && Array.isArray(tenant.featured_products)) {
        tenant.featured_products.forEach((product: any) => {
          // Only include products that are not admin_approved
          if (!product.admin_approved && product.is_active) {
            pendingProducts.push({
              id: product.id,
              inventory_items: {
                id: product.inventory_item_id,
                name: product.name || '',
                sku: product.sku || '',
                price_cents: product.price_cents || 0,
                image_url: product.image_url
              },
              tenants: {
                id: product.tenant_id,
                name: tenant.name,
                subscription_tier: tenant.subscription_tier
              },
              featured_type: product.featured_type,
              featured_priority: product.featured_priority || 0,
              featured_at: product.featured_at,
              featured_expires_at: product.featured_expires_at || null,
              auto_unfeature: product.auto_unfeature || true,
              is_active: product.is_active || true,
              bucket_type: product.bucket_type || 'store_selection',
              shop_scope_id: product.shop_scope_id || null,
              shops_priority: product.shops_priority || 0,
              admin_approved: product.admin_approved || false,
              approved_by: product.approved_by || null,
              approved_at: product.approved_at || null
            });
          }
        });
      }
    });
    
    return pendingProducts;
  }

  /**
   * Approve a product
   */
  async approveProduct(productId: string): Promise<any> {
    console.log('[AdminFeaturedApprovalService] Approving product:', productId);
    const result = await this.makeDefaultRequest<{ featuredProduct: any }>(
      `/api/featured-products/${productId}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
      `admin-approval-product-${productId}`
    );
    console.log('[AdminFeaturedApprovalService] Approve result:', result);
    console.log('[AdminFeaturedApprovalService] Result data:', result.data);
    
    if (!result.success) {
      console.log(`Failed to approve product: ${result.error}`);
      return null;
    }
    
    // The API returns { message, featuredProduct } 
    // makeDefaultRequest wraps it in result.data
    const featuredProduct = result.data?.featuredProduct;
    console.log('[AdminFeaturedApprovalService] Extracted featuredProduct:', featuredProduct);
    
    // Invalidate relevant caches
    await this.invalidateCache('admin-approval-pending-products');
    
    return featuredProduct;
  }

  /**
   * Reject a product
   */
  async rejectProduct(productId: string, reason?: string): Promise<any> {
    console.log('[AdminFeaturedApprovalService] Rejecting product:', productId, 'reason:', reason);
    const result = await this.makeDefaultRequest<{ featuredProduct: any }>(
      `/api/featured-products/${productId}/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      },
      `admin-rejection-product-${productId}`
    );
    console.log('[AdminFeaturedApprovalService] Reject result:', result);
    console.log('[AdminFeaturedApprovalService] Result data:', result.data);
    console.log('[AdminFeaturedApprovalService] Result success:', result.success);
    
    if (!result.success) {
      console.log(`Failed to reject product: ${result.error}`);
      return null;
    }
    
    // The API returns { message, featuredProduct, reason } 
    // makeDefaultRequest wraps it in result.data
    const featuredProduct = result.data?.featuredProduct;
    console.log('[AdminFeaturedApprovalService] Extracted featuredProduct:', featuredProduct);
    
    // Invalidate relevant caches
    await this.invalidateCache('admin-approval-pending-products');
    
    return featuredProduct;
  }
}

// Export singleton instance
export default AdminFeaturedApprovalService.getInstance();

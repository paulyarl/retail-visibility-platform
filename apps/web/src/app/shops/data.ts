import { tenantInfoService } from '@/services/TenantInfoService';
import { tenantStorefrontService, StorefrontProduct } from '@/services/TenantStorefrontService';
import { Category } from '@/services/StorefrontService';
import { clientLogger } from '@/lib/client-logger';

interface Shop {
  id: string;
  name: string;
  slug: string;
  business_name: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  phone?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  categories?: string[];
  description?: string;
  hours?: any;
  is_featured?: boolean;
  featured_until?: string;
  distance?: number;
  created_at?: string;
  updated_at?: string;
}

interface TenantData {
  tenant: {
    id: string;
    businessName: string;
    slug: string;
    logo?: string;
    description?: string;
    website?: string;
  };
  products: StorefrontProduct[];
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    productCount: number;
  }>;
  featuredProducts: StorefrontProduct[];
  stats: {
    totalProducts: number;
    totalCategories: number;
    featuredCount: number;
  };
}

export async function getTenantWithProducts(id: string): Promise<TenantData | null> {
  try {
    // Get tenant info
    const tenantInfo = await tenantInfoService.getCompleteTenantInfo(id);
    if (!tenantInfo || !tenantInfo.tenant) {
      return null;
    }

    const tenant = tenantInfo.tenant;

    // Get products and categories from tenant-aware storefront service
    const storefrontData = await tenantStorefrontService.getStorefrontProducts(id);
    const products = storefrontData.items || [];
    const featuredProducts = products.filter((p: any) => p.featured);

    // Get categories
    let categories: Category[] = [];
    let uncategorizedCount = 0;

    try {
      // Get product counts per category from tenant-aware storefront service
      const storefrontCategories = await tenantStorefrontService.getStorefrontCategories(id);
      const rawCategories = storefrontCategories.categories || [];
      uncategorizedCount = storefrontCategories.uncategorizedCount || 0;

      // Convert storefront categories to the expected format
      categories = rawCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        productCount: cat.count,
        googleCategoryId: cat.googleCategoryId,
        category_type: 'platform', // All storefront categories are platform categories
      }));
    } catch (e) {
      clientLogger.error('Failed to fetch categories:', { detail: e });
    }

    // Calculate stats
    const stats = {
      totalProducts: products.length,
      totalCategories: categories.length,
      featuredCount: featuredProducts.length
    };

    return {
      tenant,
      products,
      categories,
      featuredProducts,
      stats
    };
  } catch (error) {
    clientLogger.error('Error fetching tenant with products:', { detail: error });
    return null;
  }
}

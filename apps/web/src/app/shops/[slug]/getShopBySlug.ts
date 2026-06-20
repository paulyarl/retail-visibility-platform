import { shopsService } from '@/services/ShopsService';

interface ShopData {
  id: string;
  name: string;
  slug: string;
  business_name?: string;
  imageUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  location?: string;
  phone?: string;
  email?: string;
  website?: string;
  social_links?: any;
  default_gateway_type?: string;
  has_active_payment_gateway?: boolean;
  rating?: number;
  rating_count?: number;
  productCount: number;
  is_published: boolean;
  primary_category?: string;
  created_at: string;
}

interface ShopResponse {
  success: boolean;
  data: {
    success: boolean;
    data: ShopData;
  };
}

export type { ShopData, ShopResponse };

export async function getShopBySlug(identifier: string): Promise<ShopResponse | null> {
  try {
    const shop = await shopsService.getShopByIdentifier(identifier);

    if (!shop) {
      return null;
    }

    return {
      success: true,
      data: {
        success: true,
        data: shop as unknown as ShopData
      }
    };
  } catch (error) {
    console.error('Error fetching shop:', error);
    return null;
  }
}

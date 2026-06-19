/**
 * Scope Request Builder Service
 * Builds scope-aware API URLs from filter parameters
 * Phase 5 UI Implementation
 */

export type ScopeType = 'global' | 'category' | 'location';
export type BucketType = 'trending' | 'new' | 'sale' | 'seasonal' | 'staff' | 'selection' | 'random';
export type CategoryType = 'product' | 'shop' | 'both';

export interface ScopeParams {
  scope: ScopeType;
  category?: CategoryParams;
  location?: LocationParams;
}

export interface CategoryParams {
  productName?: string;
  productSlug?: string;
  productId?: string;
  googleProductId?: string;
  shopCategoryName?: string;
  shopCategoryId?: string;
  shopGoogleCategoryId?: string;
  categoryType?: CategoryType;
}

export interface LocationParams {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class ScopeRequestBuilder {
  private get apiBaseUrl(): string {
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  }

  constructor(apiBaseUrl?: string) {
    // For backward compatibility, but we'll use the getter for dynamic resolution
  }

  /**
   * Build URL for scope-aware product discovery
   */
  buildProductUrl(bucketType: BucketType, scope: ScopeParams, limit?: number): string {
    const validation = this.validateScope(scope);
    if (!validation.valid) {
      throw new Error(`Invalid scope parameters: ${validation.errors.join(', ')}`);
    }

    let url = `${this.apiBaseUrl}/api/public/shops`;
    const params = new URLSearchParams();

    // Add limit if provided
    if (limit) {
      params.set('limit', limit.toString());
    }

    switch (scope.scope) {
      case 'global':
        url += `/global/${bucketType}`;
        break;

      case 'category':
        url += `/category/${bucketType}`;
        if (scope.category) {
          this.addCategoryParams(params, scope.category);
        }
        break;

      case 'location':
        url += `/location/${bucketType}`;
        if (scope.location) {
          this.addLocationParams(params, scope.location);
        }
        break;

      default:
        throw new Error(`Unknown scope type: ${scope.scope}`);
    }

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Build URL for nearby shops
   */
  buildNearbyShopsUrl(location: LocationParams, options?: { limit?: number; minProducts?: number }): string {
    if (!location.latitude || !location.longitude) {
      throw new Error('Latitude and longitude are required for nearby shops');
    }

    const url = `${this.apiBaseUrl}/api/public/shops/nearby`;
    const params = new URLSearchParams();

    params.set('latitude', location.latitude.toString());
    params.set('longitude', location.longitude.toString());

    if (location.radius) {
      params.set('radius', location.radius.toString());
    }

    if (options?.limit) {
      params.set('limit', options.limit.toString());
    }

    if (options?.minProducts) {
      params.set('minProducts', options.minProducts.toString());
    }

    return `${url}?${params.toString()}`;
  }

  /**
   * Build URL for category aggregation
   */
  buildCategoriesUrl(options?: { limit?: number; minProducts?: number }): string {
    const url = `${this.apiBaseUrl}/api/public/shops/categories`;
    const params = new URLSearchParams();

    if (options?.limit) {
      params.set('limit', options.limit.toString());
    }

    if (options?.minProducts) {
      params.set('minProducts', options.minProducts.toString());
    }

    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Add category parameters to URLSearchParams
   */
  private addCategoryParams(params: URLSearchParams, category: CategoryParams): void {
    if (category.productName) {
      params.set('category[productName]', category.productName);
    }
    if (category.productSlug) {
      params.set('category[productSlug]', category.productSlug);
    }
    if (category.productId) {
      params.set('category[productId]', category.productId);
    }
    if (category.googleProductId) {
      params.set('category[googleProductId]', category.googleProductId);
    }
    if (category.shopCategoryName) {
      params.set('category[shopCategoryName]', category.shopCategoryName);
    }
    if (category.shopCategoryId) {
      params.set('category[shopCategoryId]', category.shopCategoryId);
    }
    if (category.shopGoogleCategoryId) {
      params.set('category[shopGoogleCategoryId]', category.shopGoogleCategoryId);
    }
    if (category.categoryType) {
      params.set('category[categoryType]', category.categoryType);
    }
  }

  /**
   * Add location parameters to URLSearchParams
   */
  private addLocationParams(params: URLSearchParams, location: LocationParams): void {
    // Prefer coordinates for radius search
    if (location.latitude !== undefined && location.longitude !== undefined) {
      params.set('location[latitude]', location.latitude.toString());
      params.set('location[longitude]', location.longitude.toString());
    }
    
    // Address-based filtering (no radius)
    if (location.city) {
      params.set('location[city]', location.city);
    }
    if (location.state) {
      params.set('location[state]', location.state);
    }
    if (location.zip) {
      params.set('location[zip]', location.zip);
    }
    if (location.country) {
      params.set('location[country]', location.country);
    }
    
    // Radius (only with coordinates)
    if (location.radius && location.latitude !== undefined && location.longitude !== undefined) {
      params.set('location[radius]', location.radius.toString());
    }
  }

  /**
   * Validate scope parameters
   */
  validateScope(scope: ScopeParams): ValidationResult {
    const errors: string[] = [];

    if (!scope.scope) {
      errors.push('Scope type is required');
      return { valid: false, errors };
    }

    switch (scope.scope) {
      case 'global':
        // No additional validation needed
        break;

      case 'category':
        if (!scope.category) {
          errors.push('Category parameters are required for category scope');
        } else {
          const hasProductFilter = scope.category.productName || scope.category.productSlug || 
                                   scope.category.productId || scope.category.googleProductId;
          const hasShopFilter = scope.category.shopCategoryName || scope.category.shopCategoryId || 
                               scope.category.shopGoogleCategoryId;
          
          if (!hasProductFilter && !hasShopFilter) {
            errors.push('At least one category filter (product or shop) is required');
          }
        }
        break;

      case 'location':
        if (!scope.location) {
          errors.push('Location parameters are required for location scope');
        } else {
          const hasCoordinates = scope.location.latitude !== undefined && scope.location.longitude !== undefined;
          const hasAddress = scope.location.city || scope.location.state || scope.location.zip;
          
          if (!hasCoordinates && !hasAddress) {
            errors.push('Either coordinates (latitude/longitude) or address (city/state/zip) is required');
          }
        }
        break;

      default:
        errors.push(`Invalid scope type: ${scope.scope}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Parse scope parameters from URL search params
   */
  parseScopeFromUrl(searchParams: URLSearchParams): ScopeParams {
    const scope = (searchParams.get('scope') || 'global') as ScopeType;

    if (scope === 'category') {
      return {
        scope: 'category',
        category: {
          productName: searchParams.get('category[productName]') || undefined,
          productSlug: searchParams.get('category[productSlug]') || undefined,
          productId: searchParams.get('category[productId]') || undefined,
          googleProductId: searchParams.get('category[googleProductId]') || undefined,
          shopCategoryName: searchParams.get('category[shopCategoryName]') || undefined,
          shopCategoryId: searchParams.get('category[shopCategoryId]') || undefined,
          shopGoogleCategoryId: searchParams.get('category[shopGoogleCategoryId]') || undefined,
          categoryType: (searchParams.get('category[categoryType]') as CategoryType) || undefined,
        }
      };
    }

    if (scope === 'location') {
      const latitude = searchParams.get('location[latitude]');
      const longitude = searchParams.get('location[longitude]');
      const radius = searchParams.get('location[radius]');

      return {
        scope: 'location',
        location: {
          city: searchParams.get('location[city]') || undefined,
          state: searchParams.get('location[state]') || undefined,
          zip: searchParams.get('location[zip]') || undefined,
          country: searchParams.get('location[country]') || undefined,
          latitude: latitude ? parseFloat(latitude) : undefined,
          longitude: longitude ? parseFloat(longitude) : undefined,
          radius: radius ? parseInt(radius) : undefined,
        }
      };
    }

    return { scope: 'global' };
  }

  /**
   * Convert scope parameters to URL search params
   */
  scopeToUrlParams(scope: ScopeParams): URLSearchParams {
    const params = new URLSearchParams();
    params.set('scope', scope.scope);

    if (scope.category) {
      this.addCategoryParams(params, scope.category);
    }

    if (scope.location) {
      this.addLocationParams(params, scope.location);
    }

    return params;
  }
}

// Export singleton instance
export const scopeRequestBuilder = new ScopeRequestBuilder();

// Export default
export default ScopeRequestBuilder;

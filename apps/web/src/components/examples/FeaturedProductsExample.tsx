"use client";

import { useEffect, useState } from 'react';
import { featuredProductsSingleton, FeaturedProduct } from '@/providers/data/FeaturedProductsSingleton';

/**
 * Example: Single API Call with Component Props Distribution
 * 
 * This component makes ONE API call to get all featured products,
 * then distributes them as props to individual bucket components.
 */
export function FeaturedProductsPage({ tenantId }: { tenantId: string }) {
  const [featuredData, setFeaturedData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFeaturedProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // SINGLE API CALL - gets all featured products divided by type
        const data = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20);
        setFeaturedData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load featured products');
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) {
      loadFeaturedProducts();
    }
  }, [tenantId]);

  if (loading) return <div>Loading featured products...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!featuredData) return <div>No featured products available</div>;

  return (
    <div className="featured-products-page">
      <h2>Featured Products</h2>
      
      {/* Individual bucket components - each gets its specific products as props */}
      
      {featuredData.staffPick.length > 0 && (
        <StaffPickBucket 
          products={featuredData.staffPick} 
          totalCount={featuredData.bucketCounts.staff_pick}
        />
      )}
      
      {featuredData.seasonal.length > 0 && (
        <SeasonalBucket 
          products={featuredData.seasonal} 
          totalCount={featuredData.bucketCounts.seasonal}
        />
      )}
      
      {featuredData.sale.length > 0 && (
        <SaleBucket 
          products={featuredData.sale} 
          totalCount={featuredData.bucketCounts.sale}
        />
      )}
      
      {featuredData.newArrival.length > 0 && (
        <NewArrivalBucket 
          products={featuredData.newArrival} 
          totalCount={featuredData.bucketCounts.new_arrival}
        />
      )}
      
      {featuredData.storeSelection.length > 0 && (
        <StoreSelectionBucket 
          products={featuredData.storeSelection} 
          totalCount={featuredData.bucketCounts.store_selection}
        />
      )}
      
      {/* Summary */}
      <div className="featured-summary">
        <p>Total Featured Products: {featuredData.totalCount}</p>
        <div className="bucket-stats">
          {Object.entries(featuredData.bucketCounts).map(([type, count]) => (
            <span key={type} className="bucket-stat">
              {type}: {Number(count)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual Bucket Components - each receives its specific products as props
 */
function StaffPickBucket({ products, totalCount }: { products: FeaturedProduct[], totalCount: number }) {
  return (
    <div className="staff-pick-bucket">
      <h3>⭐ Staff Picks ({totalCount})</h3>
      <div className="products-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function SeasonalBucket({ products, totalCount }: { products: FeaturedProduct[], totalCount: number }) {
  return (
    <div className="seasonal-bucket">
      <h3>🍂 Seasonal ({totalCount})</h3>
      <div className="products-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function SaleBucket({ products, totalCount }: { products: FeaturedProduct[], totalCount: number }) {
  return (
    <div className="sale-bucket">
      <h3>💰 Sale ({totalCount})</h3>
      <div className="products-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function NewArrivalBucket({ products, totalCount }: { products: FeaturedProduct[], totalCount: number }) {
  return (
    <div className="new-arrival-bucket">
      <h3>✨ New Arrivals ({totalCount})</h3>
      <div className="products-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function StoreSelectionBucket({ products, totalCount }: { products: FeaturedProduct[], totalCount: number }) {
  return (
    <div className="store-selection-bucket">
      <h3>🏪 Store Selection ({totalCount})</h3>
      <div className="products-grid">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: FeaturedProduct }) {
  return (
    <div className="product-card">
      <img src={product.imageUrl} alt={product.name} />
      <h4>{product.name}</h4>
      <p>${(product.priceCents / 100).toFixed(2)}</p>
      {product.salePriceCents && (
        <p className="sale-price">Sale: ${(product.salePriceCents / 100).toFixed(2)}</p>
      )}
    </div>
  );
}

/**
 * API Response Structure (what the single API call returns):
 * 
 * {
 *   "success": true,
 *   "data": {
 *     "staffPick": [...products],
 *     "seasonal": [...products],
 *     "sale": [...products],
 *     "newArrival": [...products],
 *     "storeSelection": [...products],
 *     "totalCount": 45,
 *     "bucketCounts": {
 *       "staff_pick": 12,
 *       "seasonal": 8,
 *       "sale": 15,
 *       "new_arrival": 6,
 *       "store_selection": 4
 *     }
 *   }
 * }
 * 
 * Benefits:
 * ✅ Single API call instead of 5 separate calls
 * ✅ Automatic caching for 15 minutes
 * ✅ Clean component props distribution
 * ✅ No duplicate products (each product appears in only one bucket)
 * ✅ Easy to add/remove bucket components
 * ✅ Consistent with existing ProductSingleton architecture
 */

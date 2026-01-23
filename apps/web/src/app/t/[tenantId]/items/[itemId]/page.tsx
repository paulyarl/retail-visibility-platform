'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, Badge, Button, Modal, ModalFooter } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import SyncStatusIndicator from '@/components/items/SyncStatusIndicator';
import { QRCodeModal } from '@/components/items/QRCodeModal';
import EditItemModal from '@/components/items/EditItemModal';
import ItemPhotoGallery from '@/components/items/ItemPhotoGallery';
import { Item as ItemType } from '@/services/itemsDataService';
import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
import ProductCategoryContext from '@/components/products/ProductCategoryContext';

interface ItemDetailPageProps {
  params: Promise<{
    tenantId: string;
    itemId: string;
  }>;
}

interface EnrichedItem extends ItemType {
  // Enriched barcode data
  upc?: string;
  gtin?: string;
  mpn?: string;
  
  // Nutrition & dietary
  nutritionFacts?: {
    servingSize?: string;
    calories?: number;
    totalFat?: string;
    saturatedFat?: string;
    transFat?: string;
    cholesterol?: string;
    sodium?: string;
    totalCarbohydrate?: string;
    dietaryFiber?: string;
    sugars?: string;
    protein?: string;
    [key: string]: any;
  };
  allergens?: string[];
  ingredients?: string;
  dietaryInfo?: string[];
  nutriScore?: string;
  
  // Physical attributes
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  weight?: {
    value?: number;
    unit?: string;
  };
  
  // Additional specs
  specifications?: Record<string, any>;
  environmentalInfo?: string[];
}

interface Photo {
  id: string;
  url: string;
  position: number;
  alt?: string;
  caption?: string;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { tenantId, itemId } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<EnrichedItem | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);

  useEffect(() => {
    loadItemData();
    loadCategoryData();
  }, [itemId]);

  const handleSaveItem = async (updatedItem: ItemType) => {
    try {
      const response = await api.put(`/api/items/${itemId}`, updatedItem);
      if (!response.ok) throw new Error('Failed to update item');
      
      // Reload item data to show updated values
      await loadItemData();
    } catch (err) {
      console.error('Error updating item:', err);
      throw err;
    }
  };

  const loadItemData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch item details
      const itemRes = await api.get(`/api/items/${itemId}`);
      if (!itemRes.ok) throw new Error('Failed to load item');
      const itemData = await itemRes.json();
      
      // Extract enriched fields from metadata if present
      const metadata = itemData.metadata || {};
      const enrichedFields: any = {};
      
      // Extract AI-generated enriched content from metadata
      if (metadata.enhancedDescription) {
        enrichedFields.marketingDescription = metadata.enhancedDescription;
      }
      if (metadata.features && Array.isArray(metadata.features)) {
        enrichedFields.environmentalInfo = metadata.features; // Reuse environmentalInfo for features display
      }
      if (metadata.specifications && typeof metadata.specifications === 'object') {
        enrichedFields.specifications = {
          ...(itemData.specifications || {}),
          ...metadata.specifications
        };
      }

      // Extract barcode enrichment data from metadata
      if (metadata.nutrition) {
        // Extract nutrition facts
        const nutrition = metadata.nutrition;
        enrichedFields.nutritionFacts = {};

        if (nutrition.per_100g) {
          // Map OpenFoodFacts nutrition data to frontend format
          const per100g = nutrition.per_100g;
          enrichedFields.nutritionFacts = {
            servingSize: nutrition.serving_size || 'Per 100g',
            calories: per100g['energy-kcal_100g'] || per100g.energy_kcal || per100g.energy,
            totalFat: per100g.fat_100g ? `${per100g.fat_100g}g` : per100g.fat,
            saturatedFat: per100g['saturated-fat_100g'] ? `${per100g['saturated-fat_100g']}g` : per100g.saturated_fat,
            transFat: per100g['trans-fat_100g'] ? `${per100g['trans-fat_100g']}g` : per100g.trans_fat,
            cholesterol: per100g.cholesterol_100g ? `${per100g.cholesterol_100g}mg` : per100g.cholesterol,
            sodium: per100g.sodium_100g ? `${per100g.sodium_100g}mg` : per100g.sodium,
            totalCarbohydrate: per100g.carbohydrates_100g ? `${per100g.carbohydrates_100g}g` : per100g.carbohydrates,
            dietaryFiber: per100g.fiber_100g ? `${per100g.fiber_100g}g` : per100g.fiber,
            sugars: per100g.sugars_100g ? `${per100g.sugars_100g}g` : per100g.sugars,
            protein: per100g.proteins_100g ? `${per100g.proteins_100g}g` : per100g.proteins,
          };
        }

        // Extract Nutri-Score if available
        if (nutrition.grade || nutrition.nutrition_grade_fr) {
          enrichedFields.nutriScore = nutrition.grade || nutrition.nutrition_grade_fr;
        }
      }

      // Extract ingredients
      if (metadata.ingredients) {
        if (typeof metadata.ingredients === 'string') {
          enrichedFields.ingredients = metadata.ingredients;
        } else if (Array.isArray(metadata.ingredients)) {
          enrichedFields.ingredients = metadata.ingredients.join(', ');
        }
      }

      // Extract allergens
      if (metadata.allergens) {
        if (typeof metadata.allergens === 'string') {
          enrichedFields.allergens = metadata.allergens.split(',').map((a: string) => a.trim());
        } else if (Array.isArray(metadata.allergens)) {
          enrichedFields.allergens = metadata.allergens;
        }
      }

      // Extract allergens tags (additional allergens)
      if (metadata.allergens_tags && Array.isArray(metadata.allergens_tags)) {
        enrichedFields.allergens = enrichedFields.allergens || [];
        enrichedFields.allergens = [...new Set([...enrichedFields.allergens, ...metadata.allergens_tags])];
      }

      // Extract dietary information from ingredients analysis
      if (metadata.ingredients_analysis) {
        const analysis = metadata.ingredients_analysis;
        enrichedFields.dietaryInfo = [];

        if (analysis.vegan) enrichedFields.dietaryInfo.push('Vegan');
        if (analysis.vegetarian) enrichedFields.dietaryInfo.push('Vegetarian');
        if (analysis.palm_oil_free) enrichedFields.dietaryInfo.push('Palm Oil Free');
      }

      // Extract environmental information
      if (metadata.environmental) {
        const env = metadata.environmental;
        enrichedFields.environmentalInfo = enrichedFields.environmentalInfo || [];

        if (env.ecoscore_grade) {
          enrichedFields.environmentalInfo.push(`Eco-Score: ${env.ecoscore_grade.toUpperCase()}`);
        }
        if (env.carbon_footprint) {
          enrichedFields.environmentalInfo.push(`Carbon Footprint: ${env.carbon_footprint}g CO₂`);
        }
      }

      // Extract Nova group (food processing level)
      if (metadata.nova_group) {
        enrichedFields.environmentalInfo = enrichedFields.environmentalInfo || [];
        enrichedFields.environmentalInfo.push(`Processing Level: NOVA ${metadata.nova_group}`);
      }

      // Extract product identifiers
      if (metadata.barcode) enrichedFields.upc = metadata.barcode;
      if (metadata.ean) enrichedFields.gtin = metadata.ean;
      if (metadata.mpn) enrichedFields.mpn = metadata.mpn;

      // Extract physical attributes
      if (metadata.specifications) {
        const specs = metadata.specifications;
        if (specs.weight || specs.length || specs.width || specs.height) {
          enrichedFields.weight = specs.weight ? { value: specs.weight, unit: 'g' } : undefined;
          enrichedFields.dimensions = specs.length ? {
            length: specs.length,
            width: specs.width,
            height: specs.height,
            unit: 'cm'
          } : undefined;
        }
      }

      // Extract completeness score
      if (metadata.completeness) {
        enrichedFields.completeness = metadata.completeness;
      }
      
      // Normalize the item data to match frontend expectations
      const normalizedItem = {
        ...itemData,
        ...enrichedFields,
        status: itemData.itemStatus || itemData.item_status || itemData.status || 'active',
        condition: itemData.condition === 'brand_new' ? 'new' : itemData.condition,
        tenantCategory: itemData.tenantCategory,
        tenantCategoryId: itemData.tenantCategoryId || itemData.directory_category_id,
      };
      
      console.log('[ItemDetailPage] Loaded item:', {
        id: normalizedItem.id,
        status: normalizedItem.status,
        tenantCategory: normalizedItem.tenantCategory,
        tenantCategoryId: normalizedItem.tenantCategoryId,
      });
      setItem(normalizedItem);

      // Fetch photos
      const photosRes = await api.get(`/api/items/${itemId}/photos`);
      if (photosRes.ok) {
        const photosData = await photosRes.json();
        setPhotos(Array.isArray(photosData) ? photosData : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryData = async () => {
    try {
      // Fetch categories for this tenant
      const categoriesRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/storefront/${tenantId}/categories`);
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);
        
        // Calculate total products
        const total = categoriesData.categories.reduce((sum: number, cat: any) => sum + cat.count, 0) + (categoriesData.uncategorizedCount || 0);
        setTotalProducts(total);
      }
    } catch (err) {
      console.error('Failed to load category data:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
            <p className="text-neutral-600 dark:text-neutral-400">Loading item...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">{error || 'Item not found'}</p>
            <Button
              variant="ghost"
              onClick={() => router.push(`/t/${tenantId}/items`)}
              className="mt-4"
            >
              Back to Items
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const displayPhotos = photos.length > 0 ? photos : (item.imageUrl ? [{ id: 'primary', url: item.imageUrl, position: 0 }] : []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-800">
      <PageHeader
        title={item.name}
        description={`SKU: ${item.sku}`}
        icon={Icons.Inventory}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button & Actions */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push(`/t/${tenantId}/items`)}
            className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Items
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPhotoGallery(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Manage Photos
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Item
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photos */}
          <div className="space-y-4 lg:col-span-2">
            <Card data-section="photos">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                  Photos ({displayPhotos.length})
                </h2>

                {displayPhotos.length > 0 ? (
                  <>
                    {/* Main Photo */}
                    <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden mb-4">
                      <img
                        src={displayPhotos[selectedPhotoIndex]?.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Thumbnail Carousel */}
                    {displayPhotos.length > 1 && (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                        {displayPhotos.map((photo, index) => (
                          <button
                            key={photo.id}
                            onClick={() => setSelectedPhotoIndex(index)}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              selectedPhotoIndex === index
                                ? 'border-primary-600 ring-2 ring-primary-200'
                                : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-400'
                            }`}
                          >
                            <img
                              src={photo.url}
                              alt={`${item.name} ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto text-neutral-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-neutral-500">No photos</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-4">
            {/* Category Context Widget */}
            {item.tenantCategory && categories.length > 0 && (
              <ProductCategoryContext
                tenantId={tenantId}
                currentCategory={categories.find(cat => cat.slug === item.tenantCategory?.slug) || categories[0]}
                allCategories={categories}
                totalProducts={totalProducts}
              />
            )}
            {/* Status & Badges */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={item.status === 'active' ? 'success' : item.status === 'syncing' ? 'info' : item.status === 'draft' ? 'info' : 'default'}>
                    {item.status === 'active' ? 'Active' : item.status === 'syncing' ? 'Syncing' : item.status === 'draft' ? 'Draft' : item.status === 'inactive' ? 'Inactive' : 'Archived'}
                  </Badge>
                  <Badge variant={item.visibility === 'public' ? 'info' : 'default'}>
                    {item.visibility === 'public' ? 'Public' : 'Private'}
                  </Badge>
                </div>

                <SyncStatusIndicator
                  itemStatus={item.status}
                  visibility={item.visibility}
                  tenantCategoryId={item.tenantCategoryId}
                  showDetails={true}
                />
              </CardContent>
            </Card>

            {/* Category Info */}
            {item.tenantCategory && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Category
                  </h2>
                  <div className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium rounded-lg border border-blue-200 dark:border-blue-800">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span>{item.tenantCategory.name}</span>
                    {item.tenantCategory.googleCategoryId && (
                      <span className="text-blue-600 dark:text-blue-400 font-mono text-xs" title="Google Category ID">
                        ({item.tenantCategory.googleCategoryId})
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Basic Info */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                  Basic Information
                </h2>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">SKU</dt>
                    <dd className="text-base text-neutral-900 dark:text-white font-mono">{item.sku}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Name</dt>
                    <dd className="text-base text-neutral-900 dark:text-white">{item.name}</dd>
                  </div>
                  {item.brand && (
                    <div>
                      <dt className="text-sm font-medium text-neutral-500">Brand</dt>
                      <dd className="text-base text-neutral-900 dark:text-white">{item.brand}</dd>
                    </div>
                  )}
                  {item.manufacturer && (
                    <div>
                      <dt className="text-sm font-medium text-neutral-500">Manufacturer</dt>
                      <dd className="text-base text-neutral-900 dark:text-white">{item.manufacturer}</dd>
                    </div>
                  )}
                  {item.condition && (
                    <div>
                      <dt className="text-sm font-medium text-neutral-500">Condition</dt>
                      <dd className="text-base text-neutral-900 dark:text-white">
                        {item.condition === 'new' ? 'New' : item.condition === 'used' ? 'Used' : 'Refurbished'}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Price</dt>
                    <dd className="text-2xl font-bold text-neutral-900 dark:text-white">
                      ${(item.price ?? 0).toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Stock</dt>
                    <dd className={`text-base font-semibold ${item.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.stock} {item.stock === 1 ? 'unit' : 'units'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Product Identifiers */}
            {(item.upc || item.gtin || item.mpn) && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Product Identifiers
                  </h2>
                  <dl className="space-y-2 text-sm">
                    {item.upc && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">UPC</dt>
                        <dd className="text-neutral-900 dark:text-white font-mono">{item.upc}</dd>
                      </div>
                    )}
                    {item.gtin && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">GTIN</dt>
                        <dd className="text-neutral-900 dark:text-white font-mono">{item.gtin}</dd>
                      </div>
                    )}
                    {item.mpn && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">MPN</dt>
                        <dd className="text-neutral-900 dark:text-white font-mono">{item.mpn}</dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {item.description && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Description
                  </h2>
                  <p className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Ingredients */}
            {item.ingredients && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Ingredients
                  </h2>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    {item.ingredients}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Nutrition Facts */}
            {item.nutritionFacts && Object.keys(item.nutritionFacts).length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      Nutrition Facts
                    </h2>
                    {item.nutriScore && (
                      <Badge variant="info" className="text-sm">
                        Nutri-Score: {item.nutriScore}
                      </Badge>
                    )}
                  </div>
                  <div className="border-2 border-neutral-900 dark:border-white p-4 space-y-2">
                    {item.nutritionFacts.servingSize && (
                      <div className="border-b-8 border-neutral-900 dark:border-white pb-2">
                        <p className="text-sm font-semibold">Serving Size: {item.nutritionFacts.servingSize}</p>
                      </div>
                    )}
                    {item.nutritionFacts.calories !== undefined && (
                      <div className="border-b-4 border-neutral-900 dark:border-white pb-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">Calories</span>
                          <span className="font-bold text-2xl">{item.nutritionFacts.calories}</span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1 text-sm">
                      {item.nutritionFacts.totalFat && (
                        <div className="flex justify-between border-b border-neutral-300 dark:border-neutral-600 py-1">
                          <span className="font-semibold">Total Fat</span>
                          <span>{item.nutritionFacts.totalFat}</span>
                        </div>
                      )}
                      {item.nutritionFacts.saturatedFat && (
                        <div className="flex justify-between pl-4 py-1">
                          <span>Saturated Fat</span>
                          <span>{item.nutritionFacts.saturatedFat}</span>
                        </div>
                      )}
                      {item.nutritionFacts.transFat && (
                        <div className="flex justify-between pl-4 py-1">
                          <span>Trans Fat</span>
                          <span>{item.nutritionFacts.transFat}</span>
                        </div>
                      )}
                      {item.nutritionFacts.cholesterol && (
                        <div className="flex justify-between border-b border-neutral-300 dark:border-neutral-600 py-1">
                          <span className="font-semibold">Cholesterol</span>
                          <span>{item.nutritionFacts.cholesterol}</span>
                        </div>
                      )}
                      {item.nutritionFacts.sodium && (
                        <div className="flex justify-between border-b border-neutral-300 dark:border-neutral-600 py-1">
                          <span className="font-semibold">Sodium</span>
                          <span>{item.nutritionFacts.sodium}</span>
                        </div>
                      )}
                      {item.nutritionFacts.totalCarbohydrate && (
                        <div className="flex justify-between border-b border-neutral-300 dark:border-neutral-600 py-1">
                          <span className="font-semibold">Total Carbohydrate</span>
                          <span>{item.nutritionFacts.totalCarbohydrate}</span>
                        </div>
                      )}
                      {item.nutritionFacts.dietaryFiber && (
                        <div className="flex justify-between pl-4 py-1">
                          <span>Dietary Fiber</span>
                          <span>{item.nutritionFacts.dietaryFiber}</span>
                        </div>
                      )}
                      {item.nutritionFacts.sugars && (
                        <div className="flex justify-between pl-4 py-1">
                          <span>Sugars</span>
                          <span>{item.nutritionFacts.sugars}</span>
                        </div>
                      )}
                      {item.nutritionFacts.protein && (
                        <div className="flex justify-between border-t-4 border-neutral-900 dark:border-white pt-2 mt-2">
                          <span className="font-semibold">Protein</span>
                          <span>{item.nutritionFacts.protein}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Allergens & Dietary */}
            {((item.allergens && item.allergens.length > 0) || (item.dietaryInfo && item.dietaryInfo.length > 0)) && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Allergens & Dietary Information
                  </h2>
                  {item.allergens && item.allergens.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                        ⚠️ Contains Allergens:
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {item.allergens.map((allergen, idx) => (
                          <Badge key={idx} variant="default" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            {allergen}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.dietaryInfo && item.dietaryInfo.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                        Dietary Information:
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {item.dietaryInfo.map((info, idx) => (
                          <Badge key={idx} variant="success">
                            {info}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Physical Attributes */}
            {(item.dimensions || item.weight) && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Physical Attributes
                  </h2>
                  <dl className="space-y-2 text-sm">
                    {item.dimensions && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">Dimensions</dt>
                        <dd className="text-neutral-900 dark:text-white">
                          {item.dimensions.length} × {item.dimensions.width} × {item.dimensions.height} {item.dimensions.unit}
                        </dd>
                      </div>
                    )}
                    {item.weight && (
                      <div className="flex justify-between">
                        <dt className="text-neutral-500">Weight</dt>
                        <dd className="text-neutral-900 dark:text-white">
                          {item.weight.value} {item.weight.unit}
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Specifications */}
            {item.specifications && Object.keys(item.specifications).length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Specifications
                  </h2>
                  <dl className="space-y-2 text-sm">
                    {Object.entries(item.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <dt className="text-neutral-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                        <dd className="text-neutral-900 dark:text-white">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}

            {/* Key Features */}
            {item.environmentalInfo && item.environmentalInfo.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    ✨ Key Features
                  </h2>
                  <ul className="space-y-2 text-sm">
                    {item.environmentalInfo.map((info, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                        <span className="text-neutral-700 dark:text-neutral-300">{info}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Category */}
            {item.categoryPath && item.categoryPath.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    Category
                  </h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {item.categoryPath.join(' > ')}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                  Metadata
                </h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Item ID</dt>
                    <dd className="text-neutral-900 dark:text-white font-mono">{item.id}</dd>
                  </div>
                  {item.createdAt && (
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">Created</dt>
                      <dd className="text-neutral-900 dark:text-white">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                  {item.updatedAt && (
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">Last Updated</dt>
                      <dd className="text-neutral-900 dark:text-white">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                  Quick Actions
                </h2>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="primary"
                    onClick={() => window.open(`/products/${item.id}`, '_blank')}
                    className="w-full"
                    disabled={item.status !== 'active' || item.visibility !== 'public'}
                    title={
                      item.status !== 'active' || item.visibility !== 'public'
                        ? 'Item must be active and public to view public page'
                        : 'View public page'
                    }
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View Public Page
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => router.push(`/t/${tenantId}/scan?mode=enrich&itemId=${item.id}&sku=${encodeURIComponent(item.sku)}`)}
                    className="w-full"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Enrich with Scanner
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (() => {
        return (
          <QRCodeModal
            isOpen={showQRModal}
            productUrl={`${window.location.origin}/products/${item.id}`}
            productName={item.name}
            onClose={() => setShowQRModal(false)}
            tenantId={tenantId}
          />
        );
      })()}

      {/* Edit Item Modal */}
      <EditItemModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        item={item ? {
          id: item.id,
          sku: item.sku,
          name: item.name,
          description: item.description,
          brand: item.brand,
          manufacturer: item.manufacturer,
          condition: item.condition,
          price: item.price,
          stock: item.stock,
          status: item.status,
          itemStatus: item.itemStatus,
          visibility: item.visibility,
          categoryPath: item.categoryPath,
          tenantCategoryId: item.tenantCategoryId,
          tenantCategory: item.tenantCategory,
          imageUrl: item.imageUrl,
          images: item.images,
          metadata: item.metadata,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        } : null}
        onSave={handleSaveItem}
      />

      {/* Photo Gallery Modal */}
      {showPhotoGallery && item && (
        <Modal
          isOpen={showPhotoGallery}
          onClose={() => setShowPhotoGallery(false)}
          title={`Photos - ${item.name}`}
          size="xl"
        >
          <ItemPhotoGallery
            item={{ id: item.id, sku: item.sku, name: item.name }}
            tenantId={tenantId}
            onUpdate={loadItemData}
          />
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowPhotoGallery(false)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

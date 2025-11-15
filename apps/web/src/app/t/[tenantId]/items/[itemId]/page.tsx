'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import SyncStatusIndicator from '@/components/items/SyncStatusIndicator';
import { QRCodeModal } from '@/components/items/QRCodeModal';

interface ItemDetailPageProps {
  params: Promise<{
    tenantId: string;
    itemId: string;
  }>;
}

interface Photo {
  id: string;
  url: string;
  position: number;
  alt?: string;
  caption?: string;
}

interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive' | 'syncing';
  visibility: 'public' | 'private';
  categoryPath?: string[];
  imageUrl?: string;
  brand?: string;
  manufacturer?: string;
  
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
  
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export default function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { tenantId, itemId } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    loadItemData();
  }, [itemId]);

  const loadItemData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch item details
      const itemRes = await api.get(`/api/items/${itemId}`);
      if (!itemRes.ok) throw new Error('Failed to load item');
      const itemData = await itemRes.json();
      
      // Normalize the item data to match frontend expectations
      const normalizedItem = {
        ...itemData,
        status: itemData.itemStatus || itemData.status || 'inactive',
      };
      
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

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
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
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title={item.name}
        description={`SKU: ${item.sku}`}
        icon={Icons.Inventory}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.push(`/t/${tenantId}/items`)}
            className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Items
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Photos */}
          <div className="space-y-4">
            <Card>
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
            {/* Status & Badges */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={item.status === 'active' ? 'success' : item.status === 'syncing' ? 'info' : 'default'}>
                    {item.status}
                  </Badge>
                  <Badge variant={item.visibility === 'public' ? 'info' : 'default'}>
                    {item.visibility}
                  </Badge>
                </div>

                <SyncStatusIndicator
                  itemStatus={item.status}
                  visibility={item.visibility}
                  categoryPath={item.categoryPath}
                  showDetails={true}
                />
              </CardContent>
            </Card>

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
                  <div>
                    <dt className="text-sm font-medium text-neutral-500">Price</dt>
                    <dd className="text-2xl font-bold text-neutral-900 dark:text-white">
                      ${(item.price * 100).toFixed(2)}
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

            {/* Environmental Info */}
            {item.environmentalInfo && item.environmentalInfo.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                    🌱 Environmental Information
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
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View Public Page
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setShowQRModal(true)}
                    className="w-full"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Generate QR Code
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
      {showQRModal && (
        <QRCodeModal
          isOpen={showQRModal}
          productUrl={`${window.location.origin}/products/${item.id}`}
          productName={item.name}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </div>
  );
}

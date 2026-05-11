'use client';

import { use, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SetTenantId from "@/components/client/SetTenantId";
import ItemCreationWizard from "@/components/inventory/wizards/ItemCreationWizard";
import CartButton from "@/components/inventory/CartButton";
import ItemPickerModal from "@/components/inventory/ItemPickerModal";
import { inventoryQueueService } from '@/services/InventoryQueueSingletonService';
import { itemsService } from '@/services/ItemsSingletonService';
import { Button } from '@mantine/core';
import { Edit, Plus } from 'lucide-react';

export default function CreateItemPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  // Get URL search params to check for editing mode
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get('productId');
  const isEditing = !!productId;
  const [showItemPicker, setShowItemPicker] = useState(false);

  const { tenantId } = use(params);

  const handleSelectItem = (itemId: string) => {
    // Navigate to edit mode with selected item
    router.push(`/t/${tenantId}/items/create?productId=${itemId}`);
  };

  const handleAddToQueue = async (productData: any) => {
    if (!tenantId) return;

    try {
      // Call the service to add item to queue
      await inventoryQueueService.addToQueue(tenantId, [productData], 'normal');

      // Update local storage for CartButton count
      const currentCount = localStorage.getItem(`queue-${tenantId}`) || '0';
      localStorage.setItem(`queue-${tenantId}`, (parseInt(currentCount) + 1).toString());

      // Show success message
      alert('Product added to queue! You can process it later from the queue button in the top-right corner.');
    } catch (error) {
      console.error('Failed to add item to queue:', error);
      alert('Failed to add product to queue. Please try again.');
    }
  };

  const handleComplete = async (productData: any) => {
    if (!tenantId) return;

    try {
      console.log('[CreateItemPage] Processing product:', isEditing ? 'UPDATE' : 'CREATE', productData);

      // Extract step data
      const basicInfo = productData.basicInfo || {};
      const productType = productData.productType || {};
      const pricing = productData.pricing || {};
      const content = productData.content || {};
      const media = productData.media || {};
      const organization = productData.organization || {};
      const review = productData.review || {};

      // Transform wizard data to API format matching inventory_items table schema
      const apiPayload = {
        // Required fields
        tenant_id: tenantId,
        name: basicInfo.name || '',
        brand: basicInfo.brand || 'Unknown',
        title: basicInfo.name || '', // title defaults to name

        // Identifiers
        sku: productType.sku || undefined, // Let API auto-generate if empty
        mpn: basicInfo.mpn || null,
        gtin: basicInfo.gtin || null,

        // Product type and variants
        product_type: productType.type || 'physical',
        has_variants: productType.hasVariants || false,
        variants: productType.variants || [],

        // Pricing (convert cents to dollars for 'price', keep cents for 'price_cents')
        price_cents: pricing.listPrice || 0,
        price: (pricing.listPrice || 0) / 100,
        sale_price_cents: pricing.salePrice || null,

        // Payment gateway
        payment_gateway_type: pricing.gatewaySelection?.gateway_type || null,
        payment_gateway_id: pricing.gatewaySelection?.gateway_id || null,

        // Stock and availability
        stock: productType.stockQuantity || 0,
        availability: (productType.stockQuantity || 0) > 0 ? 'in_stock' : 'out_of_stock',

        // Condition and manufacturer
        condition: basicInfo.condition || 'brand_new',
        manufacturer: basicInfo.manufacturer || null,

        // Content
        description: content.description || '',
        marketing_description: content.enhancedDescription || null,

        // Media - images are already uploaded to Supabase during wizard
        // Only use URLs that are NOT base64 dataUrls (must be real Supabase URLs)
        image_url: media.primaryImage?.url?.startsWith('http') 
          ? media.primaryImage.url 
          : null,
        image_gallery: (media.galleryImages || [])
          .map((img: any) => img.url)
          .filter((url: string) => url?.startsWith('http')),

        // Video support (store in metadata for now, could be dedicated column later)
        // video_urls: media.videoUrl ? [media.videoUrl] : [],

        // Category and organization
        directory_category_id: organization.categoryId?.startsWith('itemcat-') || organization.categoryId?.startsWith('scid-')
          ? organization.categoryId
          : null,
        category_path: organization.categoryPath ? [organization.categoryPath] : [],

        // Tags and SEO
        tags: [...(organization.tags || []), ...(content.tags || [])],
        seo_title: organization.seoTitle || content.seoTitle || null,
        seo_description: organization.seoDescription || content.seoDescription || null,

        // Inventory settings (store in metadata)
        track_inventory: organization.inventorySettings?.trackInventory ?? true,
        allow_backorder: organization.inventorySettings?.allowBackorder ?? false,
        low_stock_threshold: organization.inventorySettings?.lowStockThreshold || 5,

        // Digital product fields
        digital_delivery_method: productType.digitalProduct?.deliveryMethod || null,
        digital_assets: productType.digitalProduct?.assets || null,
        license_type: productType.digitalProduct?.licenseType || null,
        access_duration_days: productType.digitalProduct?.accessDurationDays || null,
        download_limit: productType.digitalProduct?.downloadLimit || null,

        // Featuring
        is_featured: organization.organizationSettings?.featured || false,
        featured_priority: organization.organizationSettings?.priority || 0,
        featured_type: review.featuringOptions?.featuredTypes?.[0] || 'store_selection',

        // Status and visibility
        item_status: basicInfo.status === 'active' ? 'active' : 'active', // Default to active
        visibility: organization.organizationSettings?.visibility || 'public',

        // Metadata for additional fields
        metadata: {
          features: content.features || [],
          specifications: content.specifications || {},
          variantConfig: productType.variantConfig || {},
          variantMedia: media.variantMedia || {},
          inventorySettings: organization.inventorySettings || {},
          organizationSettings: organization.organizationSettings || {},
          publishingOptions: review.publishingOptions || {},
          featuringOptions: review.featuringOptions || {},
          videoUrl: media.videoUrl || null,
          videoThumbnail: media.videoThumbnail || null,
        },
      };

      console.log('[CreateItemPage] API payload:', apiPayload);

      // Use service methods for create/update
      let result;
      if (isEditing && productId) {
        result = await itemsService.updateItem(productId, apiPayload as any, tenantId);
      } else {
        result = await itemsService.createItem(apiPayload as any, tenantId);
      }

      if (!result) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} product`);
      }
      console.log(`[CreateItemPage] Product ${isEditing ? 'updated' : 'created'} successfully:`, result);

      // Only link photos for new items (existing items already have photos linked)
      if (!isEditing) {
        // Link photos to item in photo_assets table
        const itemId = result.id;
        if (itemId) {
          // Link primary image (already uploaded to Supabase)
          if (media.primaryImage?.url) {
            try {
              await itemsService.uploadPhoto(itemId, {
                tenantId,
                dataUrl: media.primaryImage.url, // Pass URL - backend will handle it
                contentType: media.primaryImage.type || 'image/jpeg',
              });
              console.log('[CreateItemPage] Primary image linked');
            } catch (uploadError) {
              console.error('[CreateItemPage] Failed to link primary image:', uploadError);
            }
          }

          // Link gallery images (already uploaded to Supabase)
          if (media.galleryImages?.length > 0) {
            for (const img of media.galleryImages) {
              if (img.url) {
                try {
                  await itemsService.uploadPhoto(itemId, {
                    tenantId,
                    dataUrl: img.url, // Pass URL - backend will handle it
                    contentType: img.type || 'image/jpeg',
                  });
                } catch (uploadError) {
                  console.error('[CreateItemPage] Failed to link gallery image:', uploadError);
                }
              }
            }
            console.log(`[CreateItemPage] ${media.galleryImages.length} gallery images linked`);
          }
        }
      }

      // Clear draft
      localStorage.removeItem(`item-creation-draft-${tenantId}`);

      // Redirect to items page
      router.push(`/t/${tenantId}/items?${isEditing ? 'updated' : 'created'}=true`);
    } catch (error) {
      console.error('[CreateItemPage] Failed to process product:', error);
      alert(`Failed to ${isEditing ? 'update' : 'create'} product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="container mx-auto py-8">
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      
      {/* Header with Edit Button */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit Product' : 'Create New Product'}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="subtle"
            leftSection={<Edit className="w-4 h-4" />}
            onClick={() => setShowItemPicker(true)}
          >
            Edit Existing
          </Button>
          {isEditing && (
            <Button
              variant="subtle"
              leftSection={<Plus className="w-4 h-4" />}
              onClick={() => router.push(`/t/${tenantId}/items/create`)}
            >
              New Product
            </Button>
          )}
        </div>
      </div>

      <ItemCreationWizard
        tenantId={tenantId}
        productId={productId || undefined}
        allowStepJumping={isEditing} // Enable step jumping only during editing
        onAddToQueue={handleAddToQueue}
        onComplete={handleComplete}
        onCancel={() => {
          console.log('Wizard cancelled');
          router.push(`/t/${tenantId}/items`);
        }}
      />
      <CartButton tenantId={tenantId} />

      {/* Item Picker Modal */}
      <ItemPickerModal
        isOpen={showItemPicker}
        onClose={() => setShowItemPicker(false)}
        onSelect={handleSelectItem}
        tenantId={tenantId}
      />
    </div>
  );
}

/*
SERVER-SIDE CACHING ALIGNMENT:
================================

✅ Singleton Services Integration:
- CategoryService (1 hour cache) → /api/inventory/categories
- InventorySingletonService (5 min cache) → /api/inventory/products  
- Tenant limits (5 min cache) → /api/inventory/tenant-limits

✅ Cache Strategy:
- Server-side: Singleton services with TTL
- API routes: Cache-Control headers
- Client-side: fetch with next: { revalidate }

✅ Performance Benefits:
- Reduced database load via singleton caching
- Fast API responses with proper cache headers
- Client-side revalidation aligned with server TTL
- Metrics and logging from singleton services

✅ Cache Headers:
- Categories: s-maxage=3600, stale-while-revalidate=300
- Products/Limits: s-maxage=300, stale-while-revalidate=60
- Error responses: no-cache

✅ API Route Structure:
/api/inventory/
├── categories/route.ts (CategoryService)
├── tenant-limits/route.ts (Tenant limits)
└── products/route.ts (InventorySingletonService)
*/

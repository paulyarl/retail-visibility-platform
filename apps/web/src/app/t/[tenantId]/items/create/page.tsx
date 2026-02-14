'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import SetTenantId from "@/components/client/SetTenantId";
import ItemCreationWizard from "@/components/inventory/wizards/ItemCreationWizard";
import CartButton from "@/components/inventory/CartButton";
import { inventoryQueueService } from '@/services/InventoryQueueSingletonService';

export default function CreateItemPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  // Get URL search params to check for editing mode
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');
  const isEditing = !!productId;

  const { tenantId } = use(params);

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

  return (
    <div className="container mx-auto py-8">
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <ItemCreationWizard 
        tenantId={tenantId}
        productId={productId || undefined}
        allowStepJumping={isEditing} // Enable step jumping only during editing
        onAddToQueue={handleAddToQueue}
        onComplete={(productData) => {
          console.log('Product created:', productData);
          // Handle completion - redirect or show success
        }}
        onCancel={() => {
          console.log('Wizard cancelled');
          // Handle cancellation - redirect back
        }}
      />
      <CartButton tenantId={tenantId} />
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

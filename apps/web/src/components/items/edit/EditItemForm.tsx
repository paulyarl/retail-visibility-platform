'use client';

import { useEffect } from 'react';
import { Alert, Button } from '@/components/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import CategoryAssignmentModal from '../CategoryAssignmentModal';
import { useItemFormState } from './useItemFormState';
import { useVariantManagement } from './useVariantManagement';
import { GeneralTab, PricingTab, ContentTab, CategoryTab, VariantsTab, DigitalTab } from './TabPanels';
import { SupplierMatchSection } from '../wholesale/SupplierMatchSection';
import { EditItemModalProps } from './types';

function getTenantIdFromUrl(): string | null {
  try {
    const m = window.location.pathname.match(/\/t\/([^/]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export default function EditItemForm({
  isOpen,
  onClose,
  item,
  onSave,
  onItemUpdated,
}: EditItemModalProps) {
  const form = useItemFormState(isOpen, item, onSave, onItemUpdated);
  const variants = useVariantManagement(isOpen, item, form.tenantId);
  const ffQuick = useFeatureFlag('FF_CATEGORY_QUICK_ACTIONS');

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || !ffQuick) return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const tid = getTenantIdFromUrl();
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (tid) window.location.href = `/t/${tid}/categories`;
      }
      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        if (tid) window.location.href = `/t/${tid}/feed-validation`;
      }
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        form.handleSave(
          variants.hasVariants,
          variants.variants,
          variants.detectVariantChanges,
          onItemUpdated,
          onClose,
          onSave,
          item,
        );
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, ffQuick, item, form, variants, onItemUpdated, onClose, onSave]);

  const tabProps = {
    values: {
      sku: form.sku, name: form.name, brand: form.brand,
      manufacturer: form.manufacturer, condition: form.condition,
      mpn: form.mpn, gtin: form.gtin, price: form.price, salePrice: form.salePrice,
      stock: form.stock, description: form.description,
      enhancedDescription: form.enhancedDescription, features: form.features,
      specifications: form.specifications, status: form.status,
      tenantCategoryId: form.tenantCategoryId, gatewaySelection: form.gatewaySelection,
      productType: form.productType, digitalProductData: form.digitalProductData,
      showCategorySelector: form.showCategorySelector,
      gtinEnriching: form.gtinEnriching,
    },
    setters: {
      setSku: form.setSku, setName: form.setName, setBrand: form.setBrand,
      setManufacturer: form.setManufacturer, setCondition: form.setCondition,
      setMpn: form.setMpn, setGtin: form.setGtin, setPrice: form.setPrice, setSalePrice: form.setSalePrice,
      setStock: form.setStock, setDescription: form.setDescription,
      setEnhancedDescription: form.setEnhancedDescription, setFeatures: form.setFeatures,
      setSpecifications: form.setSpecifications, setStatus: form.setStatus,
      setTenantCategoryId: form.setTenantCategoryId, setGatewaySelection: form.setGatewaySelection,
      setProductType: form.setProductType, setDigitalProductData: form.setDigitalProductData,
      setShowCategorySelector: form.setShowCategorySelector,
    },
    saving: form.saving,
    item,
    tenantId: form.tenantId,
  };

  const handleSave = () => {
    form.handleSave(
      variants.hasVariants,
      variants.variants,
      variants.detectVariantChanges,
      onItemUpdated,
      onClose,
      onSave,
      item,
    );
  };

  return (
    <>
      {form.error && (
        <Alert variant="error" title="Error" onClose={() => form.setError(null)} className="mb-4">
          {form.error}
        </Alert>
      )}

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="digital">Digital</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="focus:outline-none">
          <GeneralTab {...tabProps} onGtinEnrich={form.handleGtinEnrich} />
          {form.productType === 'physical' && form.tenantId && (
            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <SupplierMatchSection tenantId={form.tenantId} gtin={form.gtin || null} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="focus:outline-none">
          <PricingTab {...tabProps} />
        </TabsContent>

        <TabsContent value="content" className="focus:outline-none">
          <ContentTab {...tabProps} />
        </TabsContent>

        <TabsContent value="category" className="focus:outline-none">
          <CategoryTab {...tabProps} />
        </TabsContent>

        <TabsContent value="variants" className="focus:outline-none">
          <VariantsTab
            {...tabProps}
            hasVariants={variants.hasVariants}
            setHasVariants={variants.setHasVariants}
            variants={variants.variants}
            setVariants={variants.setVariants}
            attributeTypes={variants.attributeTypes}
            setAttributeTypes={variants.setAttributeTypes}
            variantsLoading={variants.variantsLoading}
          />
        </TabsContent>

        <TabsContent value="digital" className="focus:outline-none">
          <DigitalTab {...tabProps} />
        </TabsContent>
      </Tabs>

      {/* Quick Actions (feature-flagged) */}
      {ffQuick && (
        <div className="mt-4 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-neutral-600">
              <span className="font-medium">Quick Actions</span>
              <span className="ml-2">Alt+G: Align • Alt+V: Validate • Alt+S: Save</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const tid = getTenantIdFromUrl();
                  if (tid) window.location.href = `/t/${tid}/categories`;
                }}
              >
                Align Category
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const tid = getTenantIdFromUrl();
                  if (tid) window.location.href = `/t/${tid}/feed-validation`;
                }}
              >
                Validate Feed
              </Button>
              <Button onClick={handleSave} disabled={form.saving}>
                Save & Return
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save Bar */}
      <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <Button variant="ghost" onClick={() => form.handleClose(onClose)} disabled={form.saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={form.saving} disabled={form.saving}>
          {form.saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Category Assignment Modal */}
      {form.showCategorySelector && item && (
        <CategoryAssignmentModal
          item={item}
          onSave={async (_itemId, categoryId) => {
            form.setTenantCategoryId(categoryId);
            form.setShowCategorySelector(false);
          }}
          onClose={() => form.setShowCategorySelector(false)}
        />
      )}
    </>
  );
}

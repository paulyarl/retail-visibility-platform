'use client';

import { useState, useEffect } from 'react';
import { Item } from '@/services/itemsDataService';
import { useVariantsSingleton } from '@/lib/singletons/VariantsSingleton';
import { VariantChange } from './types';

function extractAttributeTypes(variants: any[]): string[] {
  const attributeTypes = new Set<string>();
  variants.forEach(variant => {
    if (variant.attributes && typeof variant.attributes === 'object') {
      Object.keys(variant.attributes).forEach(key => {
        attributeTypes.add(key.toLowerCase());
      });
    }
  });
  return Array.from(attributeTypes).sort();
}

export interface UseVariantManagementReturn {
  hasVariants: boolean;
  setHasVariants: (v: boolean) => void;
  variants: any[];
  setVariants: (v: any[]) => void;
  originalVariants: any[];
  attributeTypes: string[];
  setAttributeTypes: (v: string[]) => void;
  variantsLoading: boolean;
  detectVariantChanges: () => VariantChange[];
}

export function useVariantManagement(
  isOpen: boolean,
  item: Item | null,
  tenantId: string | null,
): UseVariantManagementReturn {
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<any[]>([]);
  const [originalVariants, setOriginalVariants] = useState<any[]>([]);
  const [attributeTypes, setAttributeTypes] = useState<string[]>(['size', 'color']);
  const [variantsLoading, setVariantsLoading] = useState(false);

  const { actions: variantsActions } = useVariantsSingleton(tenantId || '');

  // Initialize variants state when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (item) {
      setHasVariants((item as any).has_variants || false);

      const itemVariants = (item as any).variants;
      if (itemVariants && Array.isArray(itemVariants) && itemVariants.length > 0) {
        setVariants(itemVariants);
        setOriginalVariants(JSON.parse(JSON.stringify(itemVariants)));
        setHasVariants(true);
        setVariantsLoading(false);
        const extractedTypes = extractAttributeTypes(itemVariants);
        if (extractedTypes.length > 0) {
          setAttributeTypes(extractedTypes);
        }
      } else if (item.id && tenantId) {
        setVariantsLoading(true);
        variantsActions.fetchItemVariants(item.id)
          .then(result => {
            if (result.success && result.variants) {
              setVariants(result.variants);
              setOriginalVariants(JSON.parse(JSON.stringify(result.variants)));
              setHasVariants(result.variants.length > 0);
              const extractedTypes = extractAttributeTypes(result.variants);
              if (extractedTypes.length > 0) {
                setAttributeTypes(extractedTypes);
              }
            } else {
              setVariants([]);
              setHasVariants(false);
              setAttributeTypes(['size', 'color']);
            }
          })
          .catch(() => {
            setVariants([]);
            setHasVariants(false);
            setAttributeTypes(['size', 'color']);
          })
          .finally(() => {
            setVariantsLoading(false);
          });
      } else {
        setVariants([]);
        setVariantsLoading(false);
        setAttributeTypes(['size', 'color']);
      }
    } else {
      setHasVariants(false);
      setVariants([]);
      setOriginalVariants([]);
      setVariantsLoading(false);
      setAttributeTypes(['size', 'color']);
    }
  }, [isOpen, item, tenantId, variantsActions]);

  const detectVariantChanges = (): VariantChange[] => {
    const changes: VariantChange[] = [];
    const originalIds = new Set(originalVariants.map(v => v.id));
    const currentIds = new Set(variants.map(v => v.id));

    originalIds.forEach(id => {
      if (!currentIds.has(id)) {
        changes.push({ action: 'delete', variantId: id });
      }
    });

    variants.forEach(variant => {
      if (!variant.id) {
        changes.push({
          action: 'create',
          data: {
            variant_name: variant.variant_name,
            sku: variant.sku,
            price_cents: variant.price_cents,
            sale_price_cents: variant.sale_price_cents,
            stock: variant.stock,
            attributes: variant.attributes,
          },
        });
      }
    });

    variants.forEach(variant => {
      if (variant.id && originalIds.has(variant.id)) {
        changes.push({
          action: 'update',
          variantId: variant.id,
          data: {
            variant_name: variant.variant_name,
            sku: variant.sku,
            price_cents: variant.price_cents,
            sale_price_cents: variant.sale_price_cents,
            stock: variant.stock,
            attributes: variant.attributes,
          },
        });
      }
    });

    return changes;
  };

  return {
    hasVariants,
    setHasVariants,
    variants,
    setVariants,
    originalVariants,
    attributeTypes,
    setAttributeTypes,
    variantsLoading,
    detectVariantChanges,
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Item } from '@/services/itemsDataService';
import { generateSKU, generateTenantKey } from '@/lib/sku-generator';
import { ContentBlocks, contentBlocksSchema } from '@/components/products/content-blocks';
import { useVariantsSingleton } from '@/lib/singletons/VariantsSingleton';
import { ProductType } from '../ProductTypeSelector';
import { DigitalProductData } from '../DigitalProductConfig';
import SupplierImportService, { type BarcodeEnrichment } from '@/services/SupplierImportService';
import {
  ItemFormValues,
  ItemFormSetters,
  ItemStatus,
  ItemCondition,
  GatewaySelection,
} from './types';

export interface UseItemFormStateReturn extends ItemFormValues, ItemFormSetters {
  saving: boolean;
  error: string | null;
  setError: (v: string | null) => void;
  showCategorySelector: boolean;
  setShowCategorySelector: (v: boolean) => void;
  tenantId: string | null;
  gtinEnriching: boolean;
  gtinEnrichment: BarcodeEnrichment | null;
  handleGtinEnrich: () => Promise<void>;
  variantsActions: ReturnType<typeof useVariantsSingleton>['actions'];
  handleSave: (
    hasVariants: boolean,
    variants: any[],
    detectVariantChanges: () => any[],
    onItemUpdated: (() => void) | undefined,
    onClose: (() => void) | undefined,
    onSave: (item: Item) => Promise<Item>,
    item: Item | null,
  ) => Promise<void>;
  handleClose: (onClose: () => void) => void;
}

function getTenantIdFromUrl(): string | null {
  try {
    const m = window.location.pathname.match(/\/t\/([^/]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function parseContentBlocks(raw: unknown): ContentBlocks | undefined {
  if (!raw) return undefined;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const result = contentBlocksSchema.safeParse(parsed);
    if (result.success) return result.data;
  } catch {
    // ignore invalid content_blocks data
  }
  return undefined;
}

const DEFAULT_DIGITAL: DigitalProductData = {
  deliveryMethod: 'direct_download',
  assets: [],
  licenseType: 'personal',
  accessDurationDays: null,
  downloadLimit: null,
};


export function useItemFormState(
  isOpen: boolean,
  item: Item | null,
  _onSave: (item: Item) => Promise<Item>,
  _onItemUpdated?: () => void,
): UseItemFormStateReturn {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [condition, setCondition] = useState<ItemCondition>('new');
  const [mpn, setMpn] = useState('');
  const [gtin, setGtin] = useState('');
  const [gtinEnriching, setGtinEnriching] = useState(false);
  const [gtinEnrichment, setGtinEnrichment] = useState<BarcodeEnrichment | null>(null);
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [enhancedDescription, setEnhancedDescription] = useState('');
  const [contentBlocks, setContentBlocks] = useState<ContentBlocks | undefined>(undefined);
  const [features, setFeatures] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [status, setStatus] = useState<ItemStatus>('draft');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantCategoryId, setTenantCategoryId] = useState('');
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [gatewaySelection, setGatewaySelection] = useState<GatewaySelection>({
    gateway_type: null,
    gateway_id: null,
  });
  const [productType, setProductType] = useState<ProductType>('physical');
  const [digitalProductData, setDigitalProductData] = useState<DigitalProductData>(DEFAULT_DIGITAL);

  const tenantId = getTenantIdFromUrl();
  const { actions: variantsActions } = useVariantsSingleton(tenantId || '');

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      setSku(item.sku || '');
      setName(item.name || '');
      setBrand(item.brand || '');
      setManufacturer(item.manufacturer || '');
      setCondition(((item as any).condition === 'brand_new' ? 'new' : (item as any).condition) || 'new');
      setMpn((item as any).mpn || '');
      setGtin((item as any).gtin || (item as any).barcode || '');
      setGtinEnrichment(null);
      setPrice(item.price ? item.price.toFixed(2) : '');
      setSalePrice((item as any).salePriceCents ? ((item as any).salePriceCents / 100).toFixed(2) : '');
      setStock(item.stock?.toString() || '');
      setDescription(item.description || '');
      const metadata = (item as any).metadata || {};
      setEnhancedDescription(metadata.enhancedDescription || '');
      setContentBlocks(parseContentBlocks(metadata.content_blocks ?? metadata.contentBlocks));
      setFeatures(Array.isArray(metadata.features) ? metadata.features.join('\n') : '');
      setSpecifications(metadata.specifications ? JSON.stringify(metadata.specifications, null, 2) : '');
      const currentStatus = item.itemStatus || item.status || 'draft';
      const mappedStatus = currentStatus === 'inactive' ? 'archived' : currentStatus;
      setStatus((mappedStatus === 'draft' || mappedStatus === 'active' || mappedStatus === 'archived') ? mappedStatus : 'draft');
      setTenantCategoryId(item.tenantCategoryId || '');
      setGatewaySelection({
        gateway_type: (item as any).payment_gateway_type || null,
        gateway_id: (item as any).payment_gateway_id || null,
      });
      setProductType((item as any).product_type || 'physical');
      if ((item as any).product_type === 'digital' || (item as any).product_type === 'hybrid') {
        setDigitalProductData({
          deliveryMethod: (item as any).digital_delivery_method || 'direct_download',
          assets: (item as any).digital_assets || [],
          licenseType: (item as any).license_type || 'personal',
          accessDurationDays: (item as any).access_duration_days || null,
          downloadLimit: (item as any).download_limit || null,
        });
      }
    } else {
      setSku('');
      setName('');
      setBrand('');
      setManufacturer('');
      setCondition('new');
      setMpn('');
      setGtin('');
      setGtinEnrichment(null);
      setPrice('');
      setSalePrice('');
      setStock('0');
      setDescription('');
      setEnhancedDescription('');
      setContentBlocks(undefined);
      setFeatures('');
      setSpecifications('');
      setStatus('active');
      setTenantCategoryId('');
      setGatewaySelection({ gateway_type: null, gateway_id: null });
      setProductType('physical');
      setDigitalProductData(DEFAULT_DIGITAL);
      setSaving(false);
      setError(null);
      setShowCategorySelector(false);
    }
  }, [item]);

  // Reset transient state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSaving(false);
      setError(null);
      setShowCategorySelector(false);
    }
  }, [isOpen]);

  // Auto-adjust stock for digital products (new items only)
  useEffect(() => {
    if (item) return;
    if (productType === 'digital' || productType === 'hybrid') {
      setStock('9999');
    } else if (productType === 'physical') {
      setStock('0');
    }
  }, [productType, item]);

  const handleGtinEnrich = useCallback(async () => {
    const tid = getTenantIdFromUrl();
    if (!tid || !gtin.trim()) return;
    setGtinEnriching(true);
    setError(null);
    try {
      const enrichment = await SupplierImportService.enrichBarcode(tid, gtin.trim());
      if (enrichment) {
        setGtinEnrichment(enrichment);
        if (enrichment.name && !name.trim()) setName(enrichment.name);
        if (enrichment.brand && !brand.trim()) setBrand(enrichment.brand);
        if (enrichment.description && !description.trim()) setDescription(enrichment.description);
        if (enrichment.priceCents && !price.trim()) {
          setPrice((enrichment.priceCents / 100).toFixed(2));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enrich barcode');
    } finally {
      setGtinEnriching(false);
    }
  }, [gtin, name, brand, description, price]);

  const handleSave = useCallback(async (
    hasVariants: boolean,
    variants: any[],
    detectVariantChanges: () => any[],
    onItemUpdatedCb: (() => void) | undefined,
    onCloseCb: (() => void) | undefined,
    onSaveCb: (item: Item) => Promise<Item>,
    itemRef: Item | null,
  ) => {
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    let finalSku = sku.trim();
    if (!finalSku) {
      const tid = getTenantIdFromUrl();
      finalSku = generateSKU({
        tenantKey: tid ? generateTenantKey(tid) : undefined,
        productType: productType,
        deliveryMethod: productType === 'digital' || productType === 'hybrid'
          ? digitalProductData.deliveryMethod
          : undefined,
        accessControl: productType === 'digital' || productType === 'hybrid'
          ? digitalProductData.licenseType
          : undefined,
      });
      setSku(finalSku);
    }

    setSaving(true);
    setError(null);

    try {
      const metadata: any = {};
      if (enhancedDescription.trim()) metadata.enhancedDescription = enhancedDescription.trim();
      if (features.trim()) {
        metadata.features = features.split('\n').map((f: string) => f.trim()).filter((f: string) => f.length > 0);
      }
      if (specifications.trim()) {
        try {
          metadata.specifications = JSON.parse(specifications);
        } catch {
          const specs: any = {};
          specifications.split('\n').forEach((line: string) => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
              specs[key.trim()] = valueParts.join(':').trim();
            }
          });
          if (Object.keys(specs).length > 0) metadata.specifications = specs;
        }
      }

      if (contentBlocks && contentBlocks.blocks.length > 0) {
        metadata.content_blocks = contentBlocks;
      }

      const updatedItem = {
        ...(itemRef || {}),
        sku: finalSku,
        name: name.trim(),
        brand: brand.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        condition: condition,
        mpn: mpn.trim() || undefined,
        gtin: gtin.trim() || undefined,
        price_cents: price ? Math.round(parseFloat(price) * 100) : 0,
        price: price ? parseFloat(price) : undefined,
        sale_price_cents: salePrice ? Math.round(parseFloat(salePrice) * 100) : undefined,
        stock: stock ? parseInt(stock) : 0,
        description: description.trim() || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        itemStatus: status === 'draft' ? 'active' : status,
        item_status: status === 'draft' ? 'active' : status,
        tenantCategoryId: tenantCategoryId || null,
        tenantId: getTenantIdFromUrl() || undefined,
        payment_gateway_type: gatewaySelection.gateway_type,
        payment_gateway_id: gatewaySelection.gateway_id,
        ...(!itemRef?.id && hasVariants && variants.length > 0 ? {
          has_variants: true,
          variants: variants.map((v: any) => ({
            variant_name: v.variant_name,
            sku: v.sku || '',
            price_cents: v.price_cents,
            stock: v.stock,
            attributes: v.attributes,
          })),
        } : {
          has_variants: hasVariants,
        }),
        product_type: productType,
        ...(productType === 'digital' || productType === 'hybrid' ? {
          digital_delivery_method: digitalProductData.deliveryMethod,
          digital_assets: digitalProductData.assets,
          license_type: digitalProductData.licenseType,
          access_duration_days: digitalProductData.accessDurationDays,
          download_limit: digitalProductData.downloadLimit,
        } : {}),
        ...(gtin.trim() ? { gtin: gtin.trim() } : {}),
        ...(gtinEnrichment ? { enrichment_source: gtinEnrichment.source } : {}),
      } as Item & {
        has_variants?: boolean;
        variants?: Array<{
          variant_name: string;
          sku: string;
          price_cents: number;
          stock: number;
          attributes: Record<string, string>;
        }>;
        product_type?: string;
        digital_delivery_method?: string;
        digital_assets?: any[];
        license_type?: string;
        access_duration_days?: number;
        download_limit?: number;
      };

      const savedItem = await onSaveCb(updatedItem);

      // Save variants for existing items
      if (hasVariants && updatedItem.id && itemRef?.id) {
        try {
          const tid = getTenantIdFromUrl();
          if (tid) {
            const variantOperations = detectVariantChanges();
            if (variantOperations.length > 0) {
              const result = await variantsActions.bulkVariantOperations(variantOperations, updatedItem.id);
              if (!result.success) {
                throw new Error(result.error || 'Failed to update variants');
              }
            }
          }
        } catch (err: any) {
          setError(err.message || 'Failed to update variants');
          return;
        }
      }

      if (onItemUpdatedCb) {
        onItemUpdatedCb();
      }
      if (onCloseCb) {
        onCloseCb();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  }, [sku, name, brand, manufacturer, condition, mpn, gtin, gtinEnrichment, price, salePrice, stock, description, enhancedDescription, contentBlocks, features, specifications, status, tenantCategoryId, gatewaySelection, productType, digitalProductData, variantsActions]);

  const handleClose = useCallback((onClose: () => void) => {
    if (!saving) {
      setError(null);
      onClose();
    }
  }, [saving]);

  return {
    sku, name, brand, manufacturer, condition, mpn, gtin, price, salePrice, stock,
    description, enhancedDescription, contentBlocks, features, specifications, status,
    tenantCategoryId, gatewaySelection, productType, digitalProductData,
    saving, error, showCategorySelector, tenantId,
    gtinEnriching, gtinEnrichment, handleGtinEnrich,
    setSku, setName, setBrand, setManufacturer, setCondition, setMpn, setGtin,
    setPrice, setSalePrice, setStock, setDescription, setEnhancedDescription, setContentBlocks,
    setFeatures, setSpecifications, setStatus, setTenantCategoryId,
    setGatewaySelection, setProductType, setDigitalProductData,
    setError, setShowCategorySelector, variantsActions,
    handleSave, handleClose,
  };
}

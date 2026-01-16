import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Modal, ModalFooter, Button, Input, Alert } from '@/components/ui';
import { useFeatureFlag } from '@/lib/featureFlags';
import { apiRequest } from '@/lib/api';
import TenantCategorySelector from './TenantCategorySelector';
import PaymentGatewaySelector from '@/components/products/PaymentGatewaySelector';
import ProductTypeSelector, { ProductType } from './ProductTypeSelector';
import DigitalProductConfig, { DigitalProductData } from './DigitalProductConfig';
import ProductVariants, { ProductVariant } from './ProductVariants';
import { Item } from '@/services/itemsDataService';
import { generateSKU, generateTenantKey } from '@/lib/sku-generator';

// Helper component to display category name by ID
function CategoryNameDisplay({ categoryId }: { categoryId: string }) {
  const [categoryName, setCategoryName] = useState<string>('Loading...');
  const params = useParams();
  const tenantId = params.tenantId as string;

  useEffect(() => {
    async function fetchCategory() {
      try {
        const response = await apiRequest(`api/v1/tenants/${tenantId}/categories`);
        if (response.ok) {
          const result = await response.json();
          const category = result.data?.find((c: any) => c.id === categoryId);
          if (category) {
            setCategoryName(category.name);
            if (category.googleCategoryId) {
              setCategoryName(`${category.name} (${category.googleCategoryId})`);
            }
          }
        }
      } catch (error) {
        setCategoryName('Unknown category');
      }
    }
    fetchCategory();
  }, [categoryId, tenantId]);

  return <span className="font-medium">{categoryName}</span>;
}

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onSave: (item: Item) => Promise<void>;
}

export default function EditItemModal({ isOpen, onClose, item, onSave }: EditItemModalProps) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [condition, setCondition] = useState<'new' | 'used' | 'refurbished'>('new');
  const [mpn, setMpn] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('');
  const [description, setDescription] = useState('');
  const [enhancedDescription, setEnhancedDescription] = useState('');
  const [features, setFeatures] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantCategoryId, setTenantCategoryId] = useState<string>('');
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [gatewaySelection, setGatewaySelection] = useState<{
    gateway_type: string | null;
    gateway_id: string | null;
  }>({ gateway_type: null, gateway_id: null });
  const [productType, setProductType] = useState<ProductType>('physical');
  const [digitalProductData, setDigitalProductData] = useState<DigitalProductData>({
    deliveryMethod: 'direct_download',
    assets: [],
    licenseType: 'personal',
    accessDurationDays: null,
    downloadLimit: null,
  });
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  // Feature flag: sticky quick actions footer
  const ffQuick = useFeatureFlag('FF_CATEGORY_QUICK_ACTIONS');

  // Simple analytics logger
  function logQa(event: string, payload?: Record<string, any>) {
    try {
      console.debug(`[qa_footer_${event}]`, { itemId: item?.id, sku: item?.sku, ...payload });
    } catch {}
  }

  function getTenantIdFromUrl(): string | null {
    try {
      const m = window.location.pathname.match(/\/t\/([^/]+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      setSku(item.sku || '');
      setName(item.name || '');
      setBrand(item.brand || '');
      setManufacturer(item.manufacturer || '');
      setCondition(((item as any).condition === 'brand_new' ? 'new' : (item as any).condition) || 'new');
      setMpn((item as any).mpn || '');
      setPrice(item.price ? item.price.toFixed(2) : '');
      setSalePrice((item as any).salePriceCents ? ((item as any).salePriceCents / 100).toFixed(2) : '');
      setStock(item.stock?.toString() || '');
      setDescription(item.description || '');
      // Extract enriched fields from metadata
      const metadata = (item as any).metadata || {};
      setEnhancedDescription(metadata.enhancedDescription || '');
      setFeatures(Array.isArray(metadata.features) ? metadata.features.join('\n') : '');
      setSpecifications(metadata.specifications ? JSON.stringify(metadata.specifications, null, 2) : '');
      // Map 'inactive' to 'archived' since we no longer have an Inactive button
      const currentStatus = item.itemStatus || item.status || 'draft';
      const mappedStatus = currentStatus === 'inactive' ? 'archived' : currentStatus;
      setStatus((mappedStatus === 'draft' || mappedStatus === 'active' || mappedStatus === 'archived') ? mappedStatus : 'draft');
      setTenantCategoryId(item.tenantCategoryId || '');
      setGatewaySelection({
        gateway_type: (item as any).payment_gateway_type || null,
        gateway_id: (item as any).payment_gateway_id || null
      });
      
      // Load product type and digital product data
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

      // Load variants if item has them
      setHasVariants((item as any).has_variants || false);
      if ((item as any).has_variants && item.id) {
        const tenantId = getTenantIdFromUrl();
        if (tenantId) {
          // Fetch variants from API
          apiRequest(`api/items/${item.id}/variants`)
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                setVariants(data.variants || []);
              }
            })
            .catch((error) => {
              console.error('Failed to load variants:', error);
            });
        }
      } else {
        setVariants([]);
      }
    } else {
      // Reset form for new item creation
      setSku('');
      setName('');
      setBrand('');
      setManufacturer('');
      setCondition('new');
      setMpn('');
      setPrice('');
      setSalePrice('');
      setStock('0'); // Will be updated when product type changes
      setDescription('');
      setEnhancedDescription('');
      setFeatures('');
      setSpecifications('');
      setStatus('active');
      setTenantCategoryId('');
      setGatewaySelection({ gateway_type: null, gateway_id: null });
      setProductType('physical');
      setDigitalProductData({
        deliveryMethod: 'direct_download',
        assets: [],
        licenseType: 'personal',
        accessDurationDays: null,
        downloadLimit: null,
      });
    }
  }, [item]);

  // Auto-adjust stock quantity for digital products
  useEffect(() => {
    // Only auto-adjust for new items (not editing existing)
    if (item) return;
    
    if (productType === 'digital' || productType === 'hybrid') {
      // Digital products have unlimited availability
      setStock('9999');
    } else if (productType === 'physical') {
      // Reset to 0 for physical products
      setStock('0');
    }
  }, [productType, item]);

  // Keyboard shortcuts when modal open and flag enabled
  useEffect(() => {
    if (!isOpen || !ffQuick) return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const tid = getTenantIdFromUrl();
      // Alt+G → Align Category (navigate to Categories)
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        logQa('shortcut_align_category');
        if (tid) window.location.href = `/t/${tid}/categories`;
      }
      // Alt+V → Validate Feed
      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        logQa('shortcut_validate_feed');
        if (tid) window.location.href = `/t/${tid}/feed-validation`;
      }
      // Alt+S → Save & Return
      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        logQa('shortcut_save_return');
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, ffQuick, item, sku, name, brand, manufacturer, price, stock, description]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    // Auto-generate SKU if empty
    let finalSku = sku.trim();
    if (!finalSku) {
      const tenantId = getTenantIdFromUrl();
      finalSku = generateSKU({
        tenantKey: tenantId ? generateTenantKey(tenantId) : undefined,
        productType: productType,
        deliveryMethod: productType === 'digital' || productType === 'hybrid' 
          ? digitalProductData.deliveryMethod 
          : undefined,
        accessControl: productType === 'digital' || productType === 'hybrid'
          ? digitalProductData.licenseType
          : undefined,
      });
      setSku(finalSku); // Update the form field
    }

    setSaving(true);
    setError(null);

    try {
      // Build metadata with enriched fields
      const metadata: any = {};
      if (enhancedDescription.trim()) metadata.enhancedDescription = enhancedDescription.trim();
      if (features.trim()) {
        metadata.features = features.split('\n').map(f => f.trim()).filter(f => f.length > 0);
      }
      if (specifications.trim()) {
        try {
          metadata.specifications = JSON.parse(specifications);
        } catch (e) {
          // If JSON parsing fails, treat as key-value pairs
          const specs: any = {};
          specifications.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
              specs[key.trim()] = valueParts.join(':').trim();
            }
          });
          if (Object.keys(specs).length > 0) metadata.specifications = specs;
        }
      }

      const updatedItem = {
        ...(item || {}),
        sku: finalSku,
        name: name.trim(),
        brand: brand.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        condition: condition,
        mpn: mpn.trim() || undefined,
        price_cents: price ? Math.round(parseFloat(price) * 100) : 0, // Convert dollars to cents
        price: price ? parseFloat(price) : undefined, // Keep for display
        salePriceCents: salePrice ? Math.round(parseFloat(salePrice) * 100) : undefined,
        stock: stock ? parseInt(stock) : 0,
        description: description.trim() || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        itemStatus: status === 'draft' ? 'active' : status, // Map draft to active for API, send as itemStatus
        item_status: status === 'draft' ? 'active' : status, // Also send snake_case version for backend
        tenantCategoryId: tenantCategoryId || null,
        payment_gateway_type: gatewaySelection.gateway_type,
        payment_gateway_id: gatewaySelection.gateway_id,
        // Digital product fields
        product_type: productType,
        ...(productType === 'digital' || productType === 'hybrid' ? {
          digital_delivery_method: digitalProductData.deliveryMethod,
          digital_assets: digitalProductData.assets,
          license_type: digitalProductData.licenseType,
          access_duration_days: digitalProductData.accessDurationDays,
          download_limit: digitalProductData.downloadLimit,
        } : {}),
      } as Item;

      await onSave(updatedItem);

      // Save variants if enabled and item has been created
      if (hasVariants && variants.length > 0 && updatedItem.id) {
        try {
          const tenantId = getTenantIdFromUrl();
          if (tenantId) {
            // Auto-generate SKUs for variants without SKUs
            const variantsWithSkus = variants.map((v, index) => {
              if (!v.sku || !v.sku.trim()) {
                // Generate variant SKU: ParentSKU-AttributeValues
                const attrValues = Object.values(v.attributes)
                  .filter(val => val)
                  .map(val => val.toUpperCase().substring(0, 3))
                  .join('-');
                return {
                  ...v,
                  sku: `${finalSku}-${attrValues || `VAR${index + 1}`}`,
                };
              }
              return v;
            });

            // Separate new variants (no id) from existing variants (has id)
            const newVariants = variantsWithSkus.filter(v => !v.id);
            const existingVariants = variantsWithSkus.filter(v => v.id);

            // Create new variants
            if (newVariants.length > 0) {
              const createResponse = await apiRequest(
                `api/items/${updatedItem.id}/variants/bulk`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ variants: newVariants }),
                }
              );

              if (!createResponse.ok) {
                const error = await createResponse.json();
                throw new Error(error.error || 'Failed to create variants');
              }
            }

            // Update existing variants
            for (const variant of existingVariants) {
              const updateResponse = await apiRequest(
                `api/variants/${variant.id}`,
                {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(variant),
                }
              );

              if (!updateResponse.ok) {
                const error = await updateResponse.json();
                throw new Error(error.error || `Failed to update variant ${variant.variant_name}`);
              }
            }
          }
        } catch (variantError) {
          console.error('Failed to save variants:', variantError);
          setError('Item saved, but failed to save variants. Please try editing the item again.');
          setSaving(false);
          return;
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError(null);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={item ? "Edit Item" : "Add New Item"}
      description={item ? "Update item details" : "Create a new item"}
      size="md"
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" title="Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Status Toggle */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Item Status
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatus('draft')}
              disabled={saving}
              className={`px-3 py-2 rounded-lg border-2 transition-all ${
                status === 'draft'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">✏️</span>
                <span className="text-xs font-medium">Draft</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatus('active')}
              disabled={saving}
              className={`px-3 py-2 rounded-lg border-2 transition-all ${
                status === 'active'
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">✓</span>
                <span className="text-xs font-medium">Active</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatus('archived')}
              disabled={saving}
              className={`px-3 py-2 rounded-lg border-2 transition-all ${
                status === 'archived'
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">📦</span>
                <span className="text-xs font-medium">Archived</span>
              </div>
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            {status === 'draft' && '✏️ Draft - Review before activating (will not sync)'}
            {status === 'active' && '✓ Active - Will sync to Google if public and has a category'}
            {status === 'archived' && '📦 Archived - Preserved but will not sync to Google'}
          </p>
        </div>

        {/* Product Type Selector */}
        <ProductTypeSelector
          value={productType}
          onChange={setProductType}
          disabled={saving}
        />

        {/* Digital Product Configuration */}
        {(productType === 'digital' || productType === 'hybrid') && (
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Digital Product Settings
            </h3>
            <DigitalProductConfig
              value={digitalProductData}
              onChange={setDigitalProductData}
              disabled={saving}
            />
          </div>
        )}

        {/* Product Variants Section */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Product Variations
              </h3>
              <p className="text-sm text-neutral-600 mt-1">
                Offer different options like sizes, colors, or configurations
              </p>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={(e) => setHasVariants(e.target.checked)}
                disabled={saving}
                className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
              />
              <span className="ml-2 text-sm font-medium text-neutral-700">
                Enable Variants
              </span>
            </label>
          </div>
          
          {hasVariants && (
            <ProductVariants
              parentItemId={item?.id}
              tenantId={getTenantIdFromUrl() || ''}
              variants={variants}
              onChange={setVariants}
              disabled={saving}
            />
          )}
        </div>

        {/* SKU Field */}
        <div>
          <Input
            label="SKU (Optional)"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Leave empty to auto-generate"
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            {sku.trim() ? (
              'Unique product identifier'
            ) : (
              <span className="text-blue-600">
                ✨ Will auto-generate with tenant prefix, product type, delivery method, and access control
              </span>
            )}
          </p>
        </div>

        {/* Name Field */}
        <div>
          <Input
            label="Product Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Organic Honey 12oz"
            required
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Display name for the product
          </p>
        </div>

      {/* Brand Field */}
      <Input
        label="Brand"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
        placeholder="e.g., Nike, Apple, Local Farms..."
        disabled={saving}
        helperText="Product brand or maker"
      />

      {/* Manufacturer Field - Only for Physical/Hybrid */}
      {productType !== 'digital' && (
        <Input
          label="Manufacturer"
          value={manufacturer}
          onChange={(e) => setManufacturer(e.target.value)}
          placeholder="e.g., Nike Inc., Apple Inc..."
          disabled={saving}
          helperText="Company that manufactures the product (optional)"
        />
      )}

      {/* Condition Field - Only for Physical/Hybrid */}
      {productType !== 'digital' && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Condition
          </label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as 'new' | 'used' | 'refurbished')}
            disabled={saving}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed"
          >
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="refurbished">Refurbished</option>
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            Product condition (required by Google Shopping)
          </p>
        </div>
      )}

      {/* MPN Field - Only for Physical/Hybrid */}
      {productType !== 'digital' && (
        <Input
          label="MPN (Manufacturer Part Number)"
          value={mpn}
          onChange={(e) => setMpn(e.target.value)}
          placeholder="e.g., SKU123, PART-456..."
          disabled={saving}
          helperText="Manufacturer's part number (optional, helps with Google Shopping)"
        />
      )}

      {/* List Price Field */}
      <div>
        <Input
          label="List Price (Regular Price)"
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g., 12.99"
          disabled={saving}
        />
        <p className="text-xs text-neutral-500 mt-1">
          Regular price in dollars
        </p>
      </div>

        {/* Sale Price Field */}
        <div>
          <Input
            label="Sale Price (Optional)"
            type="number"
            step="0.01"
            min="0"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="e.g., 9.99"
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Discounted price (leave empty if not on sale)
          </p>
          {salePrice && price && parseFloat(salePrice) >= parseFloat(price) && (
            <p className="text-xs text-red-600 mt-1">
              ⚠️ Sale price must be less than list price
            </p>
          )}
        </div>

        {/* Stock Field - Only for physical and hybrid products */}
        {productType !== 'digital' && (
          <div>
            <Input
              label="Stock Quantity"
              type="number"
              step="1.0"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="e.g., 100"
              disabled={saving}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Available quantity in inventory
            </p>
          </div>
        )}

        {/* Description Field */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Premium organic honey sourced from local beekeepers..."
            disabled={saving}
            rows={3}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Short 1-2 sentence description
          </p>
        </div>

        {/* Enhanced Description Field */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Enhanced Description <span className="text-neutral-400">(AI-generated)</span>
          </label>
          <textarea
            value={enhancedDescription}
            onChange={(e) => setEnhancedDescription(e.target.value)}
            placeholder="Detailed 2-3 paragraph marketing description..."
            disabled={saving}
            rows={5}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Detailed marketing copy for product pages (optional)
          </p>
        </div>

        {/* Key Features Field */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Key Features <span className="text-neutral-400">(AI-generated)</span>
          </label>
          <textarea
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="One feature per line&#10;Another great feature&#10;Third amazing feature"
            disabled={saving}
            rows={4}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed font-mono text-sm"
          />
          <p className="text-xs text-neutral-500 mt-1">
            One feature per line - displayed with checkmarks
          </p>
        </div>

        {/* Specifications Field */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Specifications <span className="text-neutral-400">(AI-generated)</span>
          </label>
          <textarea
            value={specifications}
            onChange={(e) => setSpecifications(e.target.value)}
            placeholder='JSON format:&#10;{&#10;  "size": "12 oz",&#10;  "weight": "1.5 lbs",&#10;  "material": "Glass"&#10;}'
            disabled={saving}
            rows={6}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed font-mono text-sm"
          />
          <p className="text-xs text-neutral-500 mt-1">
            JSON format or key:value pairs (one per line)
          </p>
        </div>

        {/* Photo Section */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Product Photo
          </label>
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            {item?.imageUrl ? (
              <div className="space-y-2">
                <div className="aspect-square w-32 mx-auto bg-white dark:bg-neutral-900 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-center text-neutral-600 dark:text-neutral-400">
                  Current product photo
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <svg className="w-12 h-12 mx-auto text-neutral-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-neutral-500">No photo</p>
              </div>
            )}
          </div>
        </div>

        {/* Category Section */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Product Category
          </label>
          <div className="space-y-3">
            {/* Current Category Display */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Current Category
                  </p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {item?.tenantCategory ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {item.tenantCategory.name}
                        {item.tenantCategory.googleCategoryId && (
                          <span className="text-xs">({item.tenantCategory.googleCategoryId})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-neutral-500 italic">No category assigned</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Selected Category Display - Shows pending change */}
            {tenantCategoryId && tenantCategoryId !== (item?.tenantCategoryId || '') && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800 animate-pulse">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                      Selected Category (pending save)
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      <CategoryNameDisplay categoryId={tenantCategoryId} />
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      ✓ Click "Save Changes" to apply this category
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Category Selection */}
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCategorySelector(!showCategorySelector)}
                disabled={saving}
                className="w-full"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {showCategorySelector ? 'Hide Category Selection' : 'Change Category'}
              </Button>

              {showCategorySelector && (
                <div className="mt-3 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <TenantCategorySelector
                    selectedCategoryId={tenantCategoryId}
                    onSelect={(categoryId) => {
                      setTenantCategoryId(categoryId);
                      setShowCategorySelector(false);
                    }}
                    onCancel={() => setShowCategorySelector(false)}
                  />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            Assign a category to organize your products. Categories with Google IDs will sync to Google Shopping.
          </p>
        </div>

        {/* Payment Gateway Section */}
        <div>
          <PaymentGatewaySelector
            tenantId={getTenantIdFromUrl() || ''}
            value={gatewaySelection}
            onChange={setGatewaySelection}
            disabled={saving}
          />
        </div>

        {/* Current Values Display - Only show when editing existing item */}
        {item && (
          <div className="p-4 bg-neutral-50 rounded-lg">
            <p className="text-sm font-medium text-neutral-700 mb-2">Current Values</p>
            <div className="space-y-1 text-sm text-neutral-600">
              <p><span className="font-medium">SKU:</span> {item.sku}</p>
              <p><span className="font-medium">Name:</span> {item.name}</p>
              {item.brand && (
                <p><span className="font-medium">Brand:</span> {item.brand}</p>
              )}
              {item.manufacturer && (
                <p><span className="font-medium">Manufacturer:</span> {item.manufacturer}</p>
              )}
              {item.price !== undefined && (
                <p><span className="font-medium">Price:</span> ${(item.price ?? 0).toFixed(2)}</p>
              )}
              {item.stock !== undefined && (
                <p><span className="font-medium">Stock:</span> {item.stock}</p>
              )}
              <p><span className="font-medium">Category:</span> {item.tenantCategory ? item.tenantCategory.name : 'None'}</p>
              {item.description && (
                <p><span className="font-medium">Description:</span> {item.description.substring(0, 100)}{item.description.length > 100 ? '...' : ''}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Quick Actions Footer (gated) */}
      {ffQuick && (
        <div className="mt-4 border-t pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-neutral-600">
              <span className="font-medium">Quick Actions</span>
              <span className="ml-2">Alt+G: Align • Alt+V: Validate • Alt+S: Save & Return</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  logQa('click_align_category');
                  const tid = getTenantIdFromUrl();
                  if (tid) window.location.href = `/t/${tid}/categories`;
                }}
              >
                Align Category
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  logQa('click_preview_skus');
                  const tid = getTenantIdFromUrl();
                  if (tid) window.location.href = `/t/${tid}/items`;
                }}
              >
                Preview SKUs
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  logQa('click_validate_feed');
                  const tid = getTenantIdFromUrl();
                  if (tid) window.location.href = `/t/${tid}/feed-validation`;
                }}
              >
                Validate Feed
              </Button>
              <Button
                onClick={() => {
                  logQa('click_save_return');
                  handleSave();
                }}
                disabled={saving}
              >
                Save & Return
              </Button>
            </div>
          </div>
        </div>
      )}

      <ModalFooter>
        <Button variant="ghost" onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

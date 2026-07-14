'use client';

import { Input, Button } from '@/components/ui';
import { useProductTypeCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import ProductTypeSelector from '../ProductTypeSelector';
import DigitalProductConfig from '../DigitalProductConfig';
import PaymentGatewaySelector from '@/components/products/PaymentGatewaySelector';
import CategoryNameDisplay from '@/components/items/CategoryNameDisplay';
import { Item } from '@/services/itemsDataService';
import {
  ItemFormValues,
  ItemFormSetters,
  ItemStatus,
  ItemCondition,
} from './types';

interface TabProps {
  values: ItemFormValues;
  setters: ItemFormSetters;
  saving: boolean;
  item: Item | null;
  tenantId: string | null;
}

interface GeneralTabProps extends TabProps {
  onGtinEnrich?: () => Promise<void>;
}

// ── General Tab ──────────────────────────────────────────────────────────

export function GeneralTab({ values, setters, saving, onGtinEnrich, tenantId }: GeneralTabProps) {
  const productTypeCap = useProductTypeCapability(tenantId);

  return (
    <div className="space-y-4">
      {/* Status Toggle */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Item Status
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['draft', 'active', 'archived'] as ItemStatus[]).map((s) => {
            const colors: Record<ItemStatus, string> = {
              draft: 'blue',
              active: 'green',
              archived: 'amber',
            };
            const icons: Record<ItemStatus, string> = { draft: '✏️', active: '✓', archived: '📦' };
            const labels: Record<ItemStatus, string> = { draft: 'Draft', active: 'Active', archived: 'Archived' };
            const c = colors[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => setters.setStatus(s)}
                disabled={saving}
                className={`px-3 py-2 rounded-lg border-2 transition-all ${
                  values.status === s
                    ? `border-${c}-600 bg-${c}-600 text-white`
                    : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 bg-white dark:bg-neutral-800'
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg">{icons[s]}</span>
                  <span className="text-xs font-medium">{labels[s]}</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          {values.status === 'draft' && '✏️ Draft - Review before activating (will not sync)'}
          {values.status === 'active' && '✓ Active - Will sync to Google if public and has a category'}
          {values.status === 'archived' && '📦 Archived - Preserved but will not sync to Google'}
        </p>
      </div>

      {/* Product Type Selector */}
      <ProductTypeSelector
        value={values.productType}
        onChange={setters.setProductType}
        disabled={saving}
        allowedTypes={productTypeCap.data?.allowedTypes}
        effectiveTypes={productTypeCap.data?.effectiveTypes}
      />

      {/* SKU */}
      <div>
        <Input
          label="SKU (Optional)"
          value={values.sku}
          onChange={(e) => setters.setSku(e.target.value)}
          placeholder="Leave empty to auto-generate"
          disabled={saving}
        />
        <p className="text-xs text-neutral-500 mt-1">
          {values.sku.trim() ? (
            'Unique product identifier'
          ) : (
            <span className="text-blue-600">
              ✨ Will auto-generate with tenant prefix, product type, delivery method, and access control
            </span>
          )}
        </p>
      </div>

      {/* Name */}
      <div>
        <Input
          label="Product Name"
          value={values.name}
          onChange={(e) => setters.setName(e.target.value)}
          placeholder="e.g., Organic Honey 12oz"
          required
          disabled={saving}
        />
        <p className="text-xs text-neutral-500 mt-1">Display name for the product</p>
      </div>

      {/* Brand */}
      <Input
        label="Brand"
        value={values.brand}
        onChange={(e) => setters.setBrand(e.target.value)}
        placeholder="e.g., Nike, Apple, Local Farms..."
        disabled={saving}
        helperText="Product brand or maker"
      />

      {/* Manufacturer — physical/hybrid only */}
      {values.productType !== 'digital' && (
        <Input
          label="Manufacturer"
          value={values.manufacturer}
          onChange={(e) => setters.setManufacturer(e.target.value)}
          placeholder="e.g., Nike Inc., Apple Inc..."
          disabled={saving}
          helperText="Company that manufactures the product (optional)"
        />
      )}

      {/* Condition — physical/hybrid only */}
      {values.productType !== 'digital' && (
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Condition</label>
          <select
            value={values.condition}
            onChange={(e) => setters.setCondition(e.target.value as ItemCondition)}
            disabled={saving}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed"
          >
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="refurbished">Refurbished</option>
          </select>
          <p className="text-xs text-neutral-500 mt-1">Product condition (required by Google Shopping)</p>
        </div>
      )}

      {/* MPN — physical/hybrid only */}
      {values.productType !== 'digital' && (
        <Input
          label="MPN (Manufacturer Part Number)"
          value={values.mpn}
          onChange={(e) => setters.setMpn(e.target.value)}
          placeholder="e.g., SKU123, PART-456..."
          disabled={saving}
          helperText="Manufacturer's part number (optional, helps with Google Shopping)"
        />
      )}

      {/* GTIN/Barcode — physical/hybrid only */}
      {values.productType !== 'digital' && (
        <div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="GTIN / Barcode"
                value={values.gtin}
                onChange={(e) => setters.setGtin(e.target.value)}
                placeholder="e.g., 00843154000127"
                disabled={saving || values.gtinEnriching}
                helperText="Scan or enter a UPC/EAN/GTIN barcode"
              />
            </div>
            {onGtinEnrich && (
              <Button
                type="button"
                variant="secondary"
                onClick={onGtinEnrich}
                disabled={saving || values.gtinEnriching || !values.gtin.trim()}
                className="mb-6"
              >
                {values.gtinEnriching ? 'Enriching...' : 'Enrich'}
              </Button>
            )}
          </div>
          {values.gtinEnriching && (
            <p className="text-xs text-blue-600 mt-1">
              Looking up barcode data...
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pricing & Inventory Tab ──────────────────────────────────────────────

export function PricingTab({ values, setters, saving, tenantId }: TabProps) {
  return (
    <div className="space-y-4">
      <div>
        <Input
          label="List Price (Regular Price)"
          type="number"
          step="0.01"
          min="0"
          value={values.price}
          onChange={(e) => setters.setPrice(e.target.value)}
          placeholder="e.g., 12.99"
          disabled={saving}
        />
        <p className="text-xs text-neutral-500 mt-1">Regular price in dollars</p>
      </div>

      <div>
        <Input
          label="Sale Price (Optional)"
          type="number"
          step="0.01"
          min="0"
          value={values.salePrice}
          onChange={(e) => setters.setSalePrice(e.target.value)}
          placeholder="e.g., 9.99"
          disabled={saving}
        />
        <p className="text-xs text-neutral-500 mt-1">Discounted price (leave empty if not on sale)</p>
        {values.salePrice && values.price && parseFloat(values.salePrice) >= parseFloat(values.price) && (
          <p className="text-xs text-red-600 mt-1">⚠️ Sale price must be less than list price</p>
        )}
      </div>

      {values.productType !== 'digital' && (
        <div>
          <Input
            label="Stock Quantity"
            type="number"
            step="1.0"
            min="0"
            value={values.stock}
            onChange={(e) => setters.setStock(e.target.value)}
            placeholder="e.g., 100"
            disabled={saving}
          />
          <p className="text-xs text-neutral-500 mt-1">Available quantity in inventory</p>
        </div>
      )}

      <PaymentGatewaySelector
        tenantId={tenantId || ''}
        value={values.gatewaySelection}
        onChange={setters.setGatewaySelection}
        disabled={saving}
      />
    </div>
  );
}

// ── Content Tab ──────────────────────────────────────────────────────────

export function ContentTab({ values, setters, saving }: TabProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Description</label>
        <textarea
          value={values.description}
          onChange={(e) => setters.setDescription(e.target.value)}
          placeholder="e.g., Premium organic honey sourced from local beekeepers..."
          disabled={saving}
          rows={3}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-neutral-500 mt-1">Short 1-2 sentence description</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Enhanced Description <span className="text-neutral-400">(AI-generated)</span>
        </label>
        <textarea
          value={values.enhancedDescription}
          onChange={(e) => setters.setEnhancedDescription(e.target.value)}
          placeholder="Detailed 2-3 paragraph marketing description..."
          disabled={saving}
          rows={5}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-neutral-500 mt-1">Detailed marketing copy for product pages (optional)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Key Features <span className="text-neutral-400">(AI-generated)</span>
        </label>
        <textarea
          value={values.features}
          onChange={(e) => setters.setFeatures(e.target.value)}
          placeholder="One feature per line&#10;Another great feature&#10;Third amazing feature"
          disabled={saving}
          rows={4}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed font-mono text-sm"
        />
        <p className="text-xs text-neutral-500 mt-1">One feature per line - displayed with checkmarks</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Specifications <span className="text-neutral-400">(AI-generated)</span>
        </label>
        <textarea
          value={values.specifications}
          onChange={(e) => setters.setSpecifications(e.target.value)}
          placeholder='JSON format:&#10;{&#10;  "size": "12 oz",&#10;  "weight": "1.5 lbs",&#10;  "material": "Glass"&#10;}'
          disabled={saving}
          rows={6}
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-neutral-100 disabled:cursor-not-allowed font-mono text-sm"
        />
        <p className="text-xs text-neutral-500 mt-1">JSON format or key:value pairs (one per line)</p>
      </div>
    </div>
  );
}

// ── Category Tab ─────────────────────────────────────────────────────────

export function CategoryTab({ values, setters, saving, item }: TabProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Product Category (Google Shopping)
        </label>
        <div className="space-y-3">
          {/* Current Category Display */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Current Category</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                  {item?.tenantCategory ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-md border border-blue-200 dark:border-blue-800">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {typeof item.tenantCategory === 'string' ? item.tenantCategory : item.tenantCategory?.name || ''}
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

          {/* Pending Category Change */}
          {values.tenantCategoryId && values.tenantCategoryId !== (item?.tenantCategoryId || '') && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800 animate-pulse">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-200">Selected Category (pending save)</p>
                  <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                    <div className="border border-green-300 dark:border-green-700 rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
                      <CategoryNameDisplay categoryId={values.tenantCategoryId} />
                    </div>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Click "Save Changes" to apply this category</p>
                </div>
              </div>
            </div>
          )}

          {/* Category Selection Button */}
          <Button
            type="button"
            onClick={() => setters.setShowCategorySelector(!values.showCategorySelector)}
            disabled={saving}
            className="w-full"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Change Category
          </Button>
        </div>
        <p className="text-xs text-neutral-500 mt-2">
          Assign a Google Product Category for Google Shopping sync. Categories help organize your products and ensure proper placement on Google.
        </p>
      </div>

      {/* Photo Placeholder */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Product Photos</label>
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
            Photo management available on item detail page after saving
          </p>
          {item?.imageUrl ? (
            <div className="space-y-2">
              <div className="aspect-square w-32 mx-auto bg-white dark:bg-neutral-900 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <p className="text-xs text-center text-neutral-600 dark:text-neutral-400">Primary photo</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <svg className="w-12 h-12 mx-auto text-neutral-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-neutral-500">No photos yet</p>
              <p className="text-xs text-neutral-400 mt-1">Add photos after creating the item</p>
            </div>
          )}
        </div>
      </div>

      {/* Current Values (edit mode only) */}
      {item && (
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Current Values</p>
          <div className="space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            <p><span className="font-medium">SKU:</span> {item.sku}</p>
            <p><span className="font-medium">Name:</span> {item.name}</p>
            {item.brand && <p><span className="font-medium">Brand:</span> {item.brand}</p>}
            {item.manufacturer && <p><span className="font-medium">Manufacturer:</span> {item.manufacturer}</p>}
            {item.price !== undefined && <p><span className="font-medium">Price:</span> ${(item.price ?? 0).toFixed(2)}</p>}
            {item.stock !== undefined && <p><span className="font-medium">Stock:</span> {item.stock}</p>}
            <p><span className="font-medium">Category:</span> {item.tenantCategory ? (typeof item.tenantCategory === 'string' ? item.tenantCategory : item.tenantCategory?.name || '') : 'None'}</p>
            {item.description && <p><span className="font-medium">Description:</span> {item.description.substring(0, 100)}{item.description.length > 100 ? '...' : ''}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Variants Tab ─────────────────────────────────────────────────────────

import ProductVariants from '../ProductVariants';

interface VariantsTabProps extends TabProps {
  hasVariants: boolean;
  setHasVariants: (v: boolean) => void;
  variants: any[];
  setVariants: (v: any[]) => void;
  attributeTypes: string[];
  setAttributeTypes: (v: string[]) => void;
  variantsLoading: boolean;
}

export function VariantsTab({
  values, setters, saving, item, tenantId,
  hasVariants, setHasVariants, variants, setVariants,
  attributeTypes, setAttributeTypes, variantsLoading,
}: VariantsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">Product Variations</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
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
          <span className="ml-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">Enable Variants</span>
        </label>
      </div>

      {variantsLoading && (
        <div className="text-center py-4">
          <p className="text-sm text-neutral-500">Loading variants...</p>
        </div>
      )}

      {hasVariants && !variantsLoading && (
        <ProductVariants
          parentItemId={item?.id}
          tenantId={tenantId || ''}
          variants={variants}
          onChange={setVariants}
          disabled={saving}
          attributeTypes={attributeTypes}
          onAttributeTypesChange={setAttributeTypes}
        />
      )}

      {!hasVariants && !variantsLoading && (
        <div className="text-center py-8 text-neutral-500">
          <p className="text-sm">Enable variants to offer different sizes, colors, or configurations</p>
        </div>
      )}
    </div>
  );
}

// ── Digital Tab ──────────────────────────────────────────────────────────

export function DigitalTab({ values, setters, saving }: TabProps) {
  if (values.productType !== 'digital' && values.productType !== 'hybrid') {
    return (
      <div className="text-center py-8 text-neutral-500">
        <p className="text-sm">Digital product settings are only available for digital or hybrid product types</p>
        <p className="text-xs mt-1">Change the product type on the General tab to enable digital settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-4">
          Digital Product Settings
        </h3>
        <DigitalProductConfig
          value={values.digitalProductData}
          onChange={setters.setDigitalProductData}
          disabled={saving}
        />
      </div>
    </div>
  );
}

'use client';

/**
 * Product Adoption Modal
 * 
 * Handles the adoption flow for adding global catalog products to a tenant's inventory.
 * Features:
 * - UPC verification for duplicate detection
 * - Price and inventory settings
 * - Category mapping
 */

import { useState } from 'react';
import {
  X,
  Package,
  CheckCircle,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';
import { Button, Modal, TextInput, NumberInput, Textarea, Select } from '@mantine/core';
import { Badge } from '@/components/ui/Badge';
import { GlobalProduct, globalCatalogService } from '@/services/GlobalCatalogService';
import { productSlugService } from '@/services/ProductSlugService';

interface ProductAdoptionModalProps {
  product: GlobalProduct;
  tenantId: string;
  onClose: () => void;
  onAdopted: (product: GlobalProduct) => void;
}

export default function ProductAdoptionModal({
  product,
  tenantId,
  onClose,
  onAdopted
}: ProductAdoptionModalProps) {
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Form state
  const [price, setPrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [sku, setSku] = useState<string>(product.universal_sku || '');
  const [description, setDescription] = useState<string>(product.description || '');
  
  // UPC verification
  const [upcStatus, setUpcStatus] = useState<'checking' | 'available' | 'duplicate' | 'none'>(
    product.gtin_upc ? 'checking' : 'none'
  );

  // Check for existing products with same UPC
  useState(() => {
    const checkUPC = async () => {
      if (!product.gtin_upc) return;
      
      try {
        const existing = await productSlugService.slugExists(product.product_slug);
        setUpcStatus(existing ? 'duplicate' : 'available');
      } catch (err) {
        console.error('[ProductAdoptionModal] Error checking UPC:', err);
        setUpcStatus('available'); // Allow adoption if check fails
      }
    };
    
    checkUPC();
  });

  const handleAdopt = async () => {
    setAdopting(true);
    setError(null);
    
    try {
      // Use service to adopt product
      const result = await globalCatalogService.adoptProduct({
        tenantId,
        globalProductId: product.id,
        productSlug: product.product_slug,
        universalSku: product.universal_sku,
        priceCents: Math.round(price * 100),
        stock,
        sku,
        description
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to adopt product');
      }
      
      setSuccess(true);
      setTimeout(() => {
        onAdopted(product);
      }, 1500);
    } catch (err: any) {
      console.error('[ProductAdoptionModal] Error adopting product:', err);
      setError(err.message || 'Failed to adopt product');
    } finally {
      setAdopting(false);
    }
  };

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title="Adopt Product from Global Catalog"
      size="lg"
    >
      {success ? (
        <div className="text-center py-8">
          <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-semibold">Product Adopted Successfully!</h3>
          <p className="text-gray-500 mt-2">
            {product.name} has been added to your inventory
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Product Preview */}
          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-24 h-24 bg-gray-200 rounded-md overflow-hidden flex-shrink-0">
              {product.images?.[0]?.url ? (
                <img
                  src={product.images[0].url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-sm text-gray-500">{product.brand}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{product.category_path?.[0] || 'General'}</Badge>
                {product.gtin_upc && (
                  <Badge variant="secondary">UPC: {product.gtin_upc}</Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Universal SKU: {product.universal_sku}
              </p>
            </div>
          </div>

          {/* UPC Status */}
          {product.gtin_upc && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              upcStatus === 'duplicate' ? 'bg-amber-50' :
              upcStatus === 'available' ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              {upcStatus === 'checking' && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-600">Checking for duplicates...</span>
                </>
              )}
              {upcStatus === 'available' && (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-700">No duplicate products found</span>
                </>
              )}
              {upcStatus === 'duplicate' && (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-amber-700">
                    A product with this UPC may already exist in your inventory
                  </span>
                </>
              )}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <TextInput
              label="SKU"
              description="Your internal SKU for this product"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g., PROD-001"
            />

            <div className="grid grid-cols-2 gap-4">
              <NumberInput
                label="Price ($)"
                description="Selling price"
                value={price}
                onChange={(val) => setPrice(Number(val) || 0)}
                min={0}
                step={0.01}
              />
              <NumberInput
                label="Initial Stock"
                description="Quantity in stock"
                value={stock}
                onChange={(val) => setStock(Number(val) || 0)}
                min={0}
              />
            </div>

            <Textarea
              label="Description"
              description="Custom description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add any additional details..."
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAdopt}
              loading={adopting}
              disabled={!sku || price <= 0}
            >
              {adopting ? 'Adopting...' : 'Adopt Product'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

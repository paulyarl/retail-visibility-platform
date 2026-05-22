'use client';

import React, { useState } from 'react';
import { Modal, Button, Text, Group, Stack, Divider, Badge } from '@mantine/core';
import { X, Package, Check } from 'lucide-react';
import ProductVariantSelector from './ProductVariantSelector';
import { useCommerceCapability, usePaymentGatewayCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface VariantPopupModalProps {
  opened: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    title?: string;
    // Parent product fields (used when no variants)
    priceCents?: number;
    salePriceCents?: number;
    stock?: number;
    sku?: string;
    // Variant fields
    variants?: Array<{
      id: string;
      sku: string;
      variant_name: string;
      price_cents: number;
      sale_price_cents?: number;
      stock: number;
      image_url?: string;
      attributes: Record<string, string>;
      sort_order?: number;
      is_active?: boolean;
      is_on_sale?: boolean;
      discount_percentage?: number;
    }>;
    imageUrl?: string;
    currency: string;
    hasActivePaymentGateway?: boolean;
  };
  onVariantSelect?: (variant: any) => void;
  onProductSelect?: (product: any) => void;
  tenantName?: string;
  hasActivePaymentGateway?: boolean;
  tenantId?: string;
}

export default function VariantPopupModal({
  opened,
  onClose,
  product,
  onVariantSelect,
  onProductSelect,
  tenantName,
  hasActivePaymentGateway = false,
  tenantId
}: VariantPopupModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Check if product has variants
  const hasVariants = product.variants && product.variants.length > 0;

  const handleVariantChange = (variant: any) => {
    setSelectedVariant(variant);
  };

  const handleSelect = () => {
    setIsAddingToCart(true);
    
    if (hasVariants && selectedVariant && onVariantSelect) {
      onVariantSelect(selectedVariant);
    } else if (onProductSelect) {
      onProductSelect(product);
    }
    
    setTimeout(() => {
      setIsAddingToCart(false);
      onClose();
    }, 1000);
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  // Calculate current price/stock based on mode
  const currentPrice = hasVariants 
    ? (selectedVariant ? (selectedVariant.sale_price_cents || selectedVariant.price_cents) : (product.variants?.[0]?.sale_price_cents || product.variants?.[0]?.price_cents || 0))
    : (product.salePriceCents || product.priceCents || 0);
  const currentStock = hasVariants 
    ? (selectedVariant ? selectedVariant.stock : product.variants?.[0]?.stock || 0)
    : (product.stock || 0);
  const currentSku = hasVariants
    ? (selectedVariant?.sku || product.variants?.[0]?.sku)
    : product.sku;

  // Determine if cart is available - use modal prop first, then product field
  const hasGateway = hasActivePaymentGateway || product.hasActivePaymentGateway;

  // Capability-aware commerce and payment gateway resolution
  const commerceCap = useCommerceCapability(tenantId || null);
  const paymentCap = usePaymentGatewayCapability(tenantId || null);
  const commerceEnabled = commerceCap.data?.enabled ?? true;
  const gatewayCapEnabled = paymentCap.data?.enabled ?? true;
  const commerceDisabled = !!((commerceCap.data && !commerceCap.data.enabled) || (paymentCap.data && !paymentCap.data.enabled));
  const canAddToCart = hasGateway && commerceEnabled && gatewayCapEnabled;

  // Determine if button should be disabled
  const isButtonDisabled = commerceDisabled || (hasVariants ? (!selectedVariant || currentStock <= 0) : (currentStock <= 0));

  // Check if on sale
  const isOnSale = hasVariants
    ? (selectedVariant?.sale_price_cents && selectedVariant.sale_price_cents < selectedVariant.price_cents)
    : (product.salePriceCents && product.salePriceCents < (product.priceCents || 0));

  const originalPrice = hasVariants
    ? (selectedVariant?.price_cents || product.variants?.[0]?.price_cents || 0)
    : (product.priceCents || 0);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={
        <Group justify="space-between">
          <Text fw={600}>{hasVariants ? 'Select Options' : 'Product Details'}</Text>
          <Button variant="subtle" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </Group>
      }
    >
      <Stack gap="md">
        {/* Product Info */}
        <Group gap="md">
          {product.imageUrl && (
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
              <img
                src={hasVariants ? (selectedVariant?.image_url || product.imageUrl) : product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <Text fw={600} size="lg">{product.title || product.name}</Text>
            {tenantName && (
              <Text size="sm" c="dimmed">by {tenantName}</Text>
            )}
            <Group gap="xs" mt="xs">
              {hasVariants ? (
                <Badge color="blue" variant="light">
                  {product.variants?.length || 0} Options
                </Badge>
              ) : (
                <Badge color="blue" variant="light">
                  Single Item
                </Badge>
              )}
              {currentStock > 0 ? (
                <Badge color="green" variant="light">
                  In Stock ({currentStock})
                </Badge>
              ) : (
                <Badge color="red" variant="light">
                  Out of Stock
                </Badge>
              )}
            </Group>
          </div>
        </Group>

        <Divider />

        {/* Variant Selector - Only show if variants exist */}
        {hasVariants && product.variants && (
          <div>
            <Text fw={500} mb="sm">Choose Options:</Text>
            <ProductVariantSelector
              variants={product.variants}
              onVariantChange={handleVariantChange}
              selectedVariant={selectedVariant}
              className="mt-2"
            />
          </div>
        )}

        {/* Price Display - Shows for both variant and non-variant products */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <Group justify="space-between">
            <div>
              <Text size="sm" fw={500}>
                {hasVariants 
                  ? (selectedVariant ? selectedVariant.variant_name : 'Select an option')
                  : 'Price'}
              </Text>
              {currentSku && (
                <Text size="xs" c="dimmed">SKU: {currentSku}</Text>
              )}
            </div>
            <div className="text-right">
              {/* Sale price display - same logic as before */}
              {isOnSale ? (
                <>
                  <Text size="lg" fw={600} c="red">
                    {product.currency} {formatPrice(currentPrice)}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ textDecoration: 'line-through' }}>
                    {product.currency} {formatPrice(originalPrice)}
                  </Text>
                  <Badge size="xs" color="red" className="ml-1">
                    {Math.round((1 - currentPrice / originalPrice) * 100)}% OFF
                  </Badge>
                </>
              ) : (
                <Text size="lg" fw={600}>
                  {product.currency} {formatPrice(currentPrice)}
                </Text>
              )}
            </div>
          </Group>
          
          {/* Show attributes for selected variant */}
          {hasVariants && selectedVariant && Object.entries(selectedVariant.attributes || {}).length > 0 && (
            <div className="mt-2">
              <Text size="xs" c="dimmed" mb="xs">Attributes:</Text>
              <div className="flex flex-wrap gap-1">
                {Object.entries(selectedVariant.attributes || {}).map(([key, value]: [string, any]) => (
                  <Badge key={key} variant="light" size="xs">
                    {key}: {String(value)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <Group justify="space-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSelect}
            disabled={isButtonDisabled}
            loading={isAddingToCart}
            variant='gradient'
            style={{color:'white'}}
            color="blue"
          >
            {isAddingToCart ? (
              <>
                <Check size={16} />
                <span>Added!</span>
              </>
            ) : (
              <>
                <Package size={16} />
                <span>{canAddToCart ? 'Add to Cart' : commerceDisabled ? 'Commerce Unavailable' : 'View Details'}</span>
              </>
            )}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

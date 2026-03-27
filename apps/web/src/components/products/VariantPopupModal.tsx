'use client';

import React, { useState } from 'react';
import { Modal, Button, Text, Group, Stack, Divider, Badge } from '@mantine/core';
import { X, Package, Check } from 'lucide-react';
import ProductVariantSelector from './ProductVariantSelector';

interface VariantPopupModalProps {
  opened: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    title?: string;
    variants: Array<{
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
  onVariantSelect: (variant: any) => void;
  tenantName?: string;
  hasActivePaymentGateway?: boolean;
}

export default function VariantPopupModal({
  opened,
  onClose,
  product,
  onVariantSelect,
  tenantName,
  hasActivePaymentGateway = false
}: VariantPopupModalProps) {
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const handleVariantChange = (variant: any) => {
    setSelectedVariant(variant);
  };

  const handleSelectVariant = () => {
    if (selectedVariant) {
      setIsAddingToCart(true);
      onVariantSelect(selectedVariant);
      setTimeout(() => {
        setIsAddingToCart(false);
        onClose();
      }, 1000);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  const currentPrice = selectedVariant ? selectedVariant.price_cents : product.variants?.[0]?.price_cents || 0;
  const currentStock = selectedVariant ? selectedVariant.stock : product.variants?.[0]?.stock || 0;

  // Determine if button should be disabled
  const isButtonDisabled = !selectedVariant || currentStock <= 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      title={
        <Group justify="space-between">
          <Text fw={600}>Select Variant</Text>
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
                src={selectedVariant?.image_url || product.imageUrl}
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
              <Badge color="blue" variant="light">
                {product.variants?.length || 0} Options
              </Badge>
              {currentStock > 0 ? (
                <Badge color="green" variant="light">
                  In Stock
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

        {/* Variant Selector */}
        {product.variants && product.variants.length > 0 && (
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

        <Divider />

        {/* Selected Variant Info */}
        {selectedVariant && (
          <div>
            <Text fw={500} mb="xs">Selected Variant:</Text>
            <div className="p-3 bg-gray-50 rounded-lg">
              <Group justify="space-between">
                <div>
                  <Text size="sm" fw={500}>{selectedVariant.variant_name}</Text>
                  <Text size="xs" c="dimmed">SKU: {selectedVariant.sku}</Text>
                </div>
                <div className="text-right">
                  <Text size="lg" fw={600}>
                    {product.currency} {formatPrice(currentPrice)}
                  </Text>
                  {selectedVariant.sale_price_cents && (
                    <Text size="xs" c="dimmed" style={{ textDecoration: 'line-through' }}>
                      {product.currency} {formatPrice(selectedVariant.sale_price_cents)}
                    </Text>
                  )}
                </div>
              </Group>
              {Object.entries(selectedVariant.attributes || {}).length > 0 && (
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
          </div>
        )}

        {/* Action Buttons */}
        <Group justify="space-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSelectVariant}
            disabled={isButtonDisabled}
            loading={isAddingToCart}
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
                <span>{product.hasActivePaymentGateway ? 'Add to Cart' : 'View Details'}</span>
              </>
            )}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

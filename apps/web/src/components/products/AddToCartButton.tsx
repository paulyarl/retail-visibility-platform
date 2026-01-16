'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMultiCart } from '@/hooks/useMultiCart';
import { Button } from '@/components/ui/Button';
import { ShoppingCart, Check, ArrowRight } from 'lucide-react';

interface ProductVariant {
  id: string;
  sku: string;
  variant_name: string;
  price_cents: number;
  sale_price_cents?: number;
  stock: number;
  attributes: Record<string, string>;
}

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    sku: string;
    priceCents: number;
    salePriceCents?: number;
    imageUrl?: string;
    stock?: number;
    tenantId: string;
    tenantLogo?: string;
    payment_gateway_type?: string | null;
    payment_gateway_id?: string | null;
    has_variants?: boolean;
  };
  variant?: ProductVariant | null; // Selected variant if product has variants
  tenantName: string;
  tenantLogo?: string;
  quantity?: number;
  className?: string;
  hasActivePaymentGateway?: boolean; // Simple boolean from MV - does tenant have payment gateway?
  defaultGatewayType?: string; // Tenant's default gateway type (no hardcoded fallback)
}

export function AddToCartButton({ 
  product, 
  variant,
  tenantName, 
  tenantLogo,
  quantity = 1, 
  className,
  hasActivePaymentGateway = false, // Default to false if not provided
  defaultGatewayType // No default fallback - must come from tenant
}: AddToCartButtonProps) {
  const router = useRouter();
  const { addToCart, getCartByGateway } = useMultiCart();
  const [added, setAdded] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [addedToGateway, setAddedToGateway] = useState<string | null>(null);

  const handleAddToCart = async () => {
    // Validate variant selection if product has variants
    if (product.has_variants && !variant) {
      alert('Please select all product options before adding to cart.');
      return;
    }

    // Determine gateway type: product's assignment > tenant's default (no hardcoded fallback)
    const gatewayType = product.payment_gateway_type || defaultGatewayType;
    
    // If no gateway type available, cannot add to cart
    if (!gatewayType) {
      alert('Unable to add to cart: No payment gateway configured for this tenant.');
      return;
    }
    
    // Use variant data if available, otherwise use product data
    const itemSku = variant?.sku || product.sku;
    const itemStock = variant?.stock ?? product.stock;
    const itemPriceCents = variant?.price_cents || product.priceCents;
    const itemSalePriceCents = variant?.sale_price_cents || product.salePriceCents;
    
    // Check if adding this quantity would exceed available stock
    const cart = getCartByGateway(product.tenantId, gatewayType);
    const existingItem = cart?.cart.items.find(
      item => item.product_id === product.id && item.variant_id === variant?.id
    );
    const currentCartQuantity = existingItem?.quantity || 0;
    const totalQuantity = currentCartQuantity + quantity;

    if (itemStock !== undefined && totalQuantity > itemStock) {
      alert(`Cannot add ${quantity} more. Only ${itemStock - currentCartQuantity} available (${currentCartQuantity} already in cart).`);
      return;
    }

    const effectivePrice = itemSalePriceCents || itemPriceCents;
    const isOnSale = Boolean(itemSalePriceCents && itemSalePriceCents < itemPriceCents);
    
    // Calculate pricing fields based on sale status
    const listPriceCents = isOnSale ? product.priceCents : undefined;
    const discountCents = isOnSale ? (product.priceCents - product.salePriceCents!) * quantity : undefined;

    // Add to gateway-specific cart
    await addToCart(product.tenantId, tenantName, gatewayType, {
      product_id: product.id,
      product_name: product.name,
      product_sku: itemSku,
      quantity,
      price_cents: effectivePrice,
      list_price_cents: listPriceCents,
      discount_cents: discountCents,
      product_image: product.imageUrl,
      // Variant information
      variant_id: variant?.id,
      variant_name: variant?.variant_name,
      variant_attributes: variant?.attributes,
      gateway_id: product.payment_gateway_id || undefined,
    }, product.tenantLogo || tenantLogo);

    setAdded(true);
    setShowSuccess(true);
    setAddedToGateway(gatewayType);
    setTimeout(() => {
      setAdded(false);
      setShowSuccess(false);
      setAddedToGateway(null);
    }, 3000);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/carts');
  };

  // Simple check: if tenant doesn't have payment gateway, don't show button
  if (!hasActivePaymentGateway) {
    return null;
  }

  const isOutOfStock = product.stock !== undefined && product.stock <= 0;

  if (isOutOfStock) {
    return (
      <Button disabled className={className}>
        Out of Stock
      </Button>
    );
  }

  const gatewayType = product.payment_gateway_type || defaultGatewayType || '';
  const cart = gatewayType ? getCartByGateway(product.tenantId, gatewayType) : null;
  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const gatewayLabel = gatewayType === 'square' ? 'Square' : gatewayType === 'paypal' ? 'PayPal' : gatewayType;

  return (
    <div className={className}>
      {/* Success Banner */}
      {showSuccess && cart && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1">
              <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900 text-sm">Added to {gatewayLabel} cart!</p>
                <p className="text-xs text-green-700 mt-0.5">
                  {cart?.item_count || 0} {cart?.item_count === 1 ? 'item' : 'items'} • {formatCurrency(cart?.total_cents || 0)}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/carts/checkout`)}
              className="text-green-700 hover:text-green-800 hover:bg-green-100 flex-shrink-0"
            >
              View Cart
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={handleAddToCart}
          variant="outline"
          className={`bg-white text-gray-900 ${added ? 'border-green-600' : 'border-gray-300 hover:border-gray-400'}`}
        >
          {added ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Added to Cart
            </>
          ) : (
            <>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Add to Cart
            </>
          )}
        </Button>
        <Button 
          onClick={handleBuyNow} 
          variant="outline"
          className="bg-white text-gray-900 border-gray-300 hover:border-gray-400"
        >
          Buy Now
        </Button>
      </div>
    </div>
  );
}

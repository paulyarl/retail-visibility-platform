"use client";

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, Badge, Button, Text, Group, Stack, ActionIcon, Tooltip, Modal } from '@mantine/core';
import { 
  Star, 
  Heart, 
  ShoppingCart, 
  Eye, 
  ChevronLeft, 
  ChevronRight,
  Package,
  Download,
  Shield
} from 'lucide-react';
import { PriceDisplay } from './PriceDisplay';
import { AddToCartButton } from './AddToCartButton';
import VariantPopupModal from './VariantPopupModal';

// Enhanced product interface matching the new API response
export interface EnhancedProductData {
  id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  manufacturer?: string;
  condition?: string;
  description?: string;
  price: number;
  priceCents: number;
  salePriceCents?: number;
  listPriceCents?: number;
  currency: string;
  stock: number;
  availability: 'in_stock' | 'out_of_stock' | 'preorder';
  imageUrl?: string;
  imageGallery?: Array<{
    id: string;
    url: string;
    position: number;
    alt?: string;
    caption?: string;
    variant_id?: string;
    createdAt: string;
    isPrimary: boolean;
  }>;
  variants?: Array<{
    id: string;
    sku: string;
    variant_name: string;
    price_cents: number;
    sale_price_cents?: number;
    stock: number;
    image_url?: string;
    attributes: Record<string, any>;
    sort_order: number;
    is_active: boolean;
    is_on_sale: boolean;
    discount_percentage: number;
  }>;
  hasVariants?: boolean;
  productType?: 'physical' | 'digital' | 'hybrid';
  digitalDeliveryMethod?: string;
  digitalAssets?: any[];
  licenseType?: string;
  accessDurationDays?: number;
  downloadLimit?: number;
  isFeatured?: boolean;
  featuredTypes?: string[];
  productRating?: number;
  product_review_count?: number;
  tenantId: string;
  hasActivePaymentGateway?: boolean;
  // Additional fields from API
  metadata?: any;
  categoryName?: string;
  categorySlug?: string;
  createdAt?: string;
  updatedAt?: string;
  isOnSale?: boolean;
  discountPercentage?: string | number;
}

interface EnhancedStorefrontProductCardProps {
  product: EnhancedProductData;
  tenantId: string;
  tenantSlug?: string;
  variant?: 'grid' | 'list' | 'compact' | 'featured';
  showGallery?: boolean;
  showVariants?: boolean;
  maxGalleryImages?: number;
  maxVariants?: number;
  className?: string;
  onImageClick?: (imageUrl: string) => void;
  onVariantClick?: (variant: any) => void;
}

export default function EnhancedStorefrontProductCard({
  product,
  tenantId,
  tenantSlug,
  variant = 'grid',
  showGallery = true,
  showVariants = true,
  maxGalleryImages = 3,
  maxVariants = 2,
  className = '',
  onImageClick,
  onVariantClick,
}: EnhancedStorefrontProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);

  // Get display images
  const getDisplayImages = () => {
    if (!showGallery || !product.imageGallery?.length) {
      return product.imageUrl ? [product.imageUrl] : [];
    }
    return product.imageGallery.map(img => img.url);
  };

  const displayImages = getDisplayImages();
  const currentImage = displayImages[currentImageIndex] || displayImages[0] || '';

  // Get display variants
  const getDisplayVariants = () => {
    if (!showVariants || !product.variants?.length) return [];
    return product.variants.slice(0, maxVariants);
  };

  const displayVariants = getDisplayVariants();

  // Default variant click handler - opens variant popup modal
  const handleVariantClick = (variant: any) => {
    if (onVariantClick) {
      onVariantClick(variant);
    } else {
      // Default behavior: open variant popup modal
      setShowVariantModal(true);
    }
  };

  // Navigation handlers
  const handlePrevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? displayImages.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === displayImages.length - 1 ? 0 : prev + 1
    );
  };

  // Product URL
  const productUrl = tenantSlug 
    ? `/t/${tenantSlug}/items/${product.id}`
    : `/products/${product.id}`;

  // Badge styles for featured types
  const getFeaturedBadgeStyle = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-red-500 text-white';
      case 'new_arrival': return 'bg-green-500 text-white';
      case 'staff_pick': return 'bg-purple-500 text-white';
      case 'seasonal': return 'bg-orange-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  // Render different card variants
  const renderCardContent = () => {
    switch (variant) {
      case 'compact':
        return (
          <Group gap="sm" className="p-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
              {currentImage && (
                <Image
                  src={currentImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Text size="sm" fw={500} lineClamp={1}>{product.name}</Text>
              <PriceDisplay 
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
                variant="compact"
              />
              {displayVariants.length > 0 && (
                <Text size="xs" c="dimmed">
                  {displayVariants.length} variants
                </Text>
              )}
            </div>
          </Group>
        );

      case 'featured':
        return (
          <div className="relative">
            {/* Image Gallery */}
            <div className="relative h-48 bg-gray-100 rounded-t-lg overflow-hidden">
              {currentImage && (
                <Image
                  src={currentImage}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  onClick={() => onImageClick?.(currentImage)}
                />
              )}
              
              {/* Gallery Navigation */}
              {displayImages.length > 1 && (
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <ActionIcon
                    size="sm"
                    variant="filled"
                    bg="rgba(0,0,0,0.5)"
                    c="white"
                    onClick={handlePrevImage}
                  >
                    <ChevronLeft size={12} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    variant="filled"
                    bg="rgba(0,0,0,0.5)"
                    c="white"
                    onClick={handleNextImage}
                  >
                    <ChevronRight size={12} />
                  </ActionIcon>
                </div>
              )}

              {/* Image Counter */}
              {displayImages.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {currentImageIndex + 1}/{displayImages.length}
                </div>
              )}

              {/* Featured Badges */}
              {product.featuredTypes?.map((type) => (
                <Badge
                  key={type}
                  className={`absolute top-2 left-2 ${getFeaturedBadgeStyle(type)}`}
                  size="sm"
                >
                  {type.replace('_', ' ')}
                </Badge>
              ))}

              {/* Product Type Badge */}
              {product.productType && product.productType !== 'physical' && (
                <Badge
                  className="absolute top-2 left-2 bg-indigo-500 text-white"
                  size="sm"
                  leftSection={<Download size={10} />}
                >
                  {product.productType}
                </Badge>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <Text fw={600} size="lg" lineClamp={2} mb="sm">
                {product.name}
              </Text>
              
              {product.brand && (
                <Text size="sm" c="dimmed" mb="sm">
                  {product.brand}
                </Text>
              )}

              <PriceDisplay 
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
                variant="large"
              />

              {/* Variants Preview */}
              {displayVariants.length > 0 && (
                <div className="mb-3">
                  <Text size="sm" fw={500} mb="xs">
                    Popular Options:
                  </Text>
                  <Group gap="xs">
                    {displayVariants.map((variant) => (
                      <Badge
                        key={variant.id}
                        variant="light"
                        size="sm"
                        onClick={() => onVariantClick?.(variant)}
                        style={{ cursor: 'pointer' }}
                      >
                        {variant.variant_name}
                      </Badge>
                    ))}
                    {product.variants!.length > maxVariants && (
                      <Text size="xs" c="dimmed">
                        +{product.variants!.length - maxVariants} more
                      </Text>
                    )}
                  </Group>
                </div>
              )}

              {/* Digital Product Info */}
              {product.productType === 'digital' && (
                <Group gap="xs" mb="md">
                  {product.licenseType && (
                    <Tooltip label={`License: ${product.licenseType}`}>
                      <Badge variant="light" size="sm" leftSection={<Shield size={10} />}>
                        {product.licenseType}
                      </Badge>
                    </Tooltip>
                  )}
                  {product.accessDurationDays && (
                    <Tooltip label={`Access: ${product.accessDurationDays} days`}>
                      <Badge variant="light" size="sm">
                        {product.accessDurationDays} days
                      </Badge>
                    </Tooltip>
                  )}
                </Group>
              )}

              {/* Action Buttons */}
              <Group gap="sm">
                {product.variants && product.variants.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVariantModal(true)}
                    leftSection={<Package size={14} />}
                  >
                    {displayVariants.length > 1 ? 'Choose Options' : 'Select Option'}
                  </Button>
                )}
                <Button
                  component={Link}
                  href={productUrl}
                  variant="light"
                  size="sm"
                  flex={1}
                >
                  View Details
                </Button>
                {product.hasActivePaymentGateway && (
                  <AddToCartButton
                    product={{
                      id: product.id,
                      sku: product.sku,
                      name: product.name,
                      priceCents: product.priceCents,
                      salePriceCents: product.salePriceCents,
                      stock: product.stock,
                      imageUrl: product.imageUrl,
                      tenantId: product.tenantId,
                    }}
                    tenantName={tenantId} // Using tenantId as fallback since tenantName not available
                  />
                )}
              </Group>
            </div>
          </div>
        );

      default: // grid
        return (
          <div className="relative">
            {/* Image Gallery */}
            <div className="relative h-48 bg-gray-100 rounded-t-lg overflow-hidden">
              {currentImage && (
                <Image
                  src={currentImage}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-300 hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  onClick={() => onImageClick?.(currentImage)}
                />
              )}
              
              {/* Gallery Navigation */}
              {displayImages.length > 1 && isHovered && (
                <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 hover:opacity-100 transition-opacity">
                  <ActionIcon
                    variant="filled"
                    bg="rgba(0,0,0,0.5)"
                    c="white"
                    onClick={handlePrevImage}
                  >
                    <ChevronLeft size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="filled"
                    bg="rgba(0,0,0,0.5)"
                    c="white"
                    onClick={handleNextImage}
                  >
                    <ChevronRight size={16} />
                  </ActionIcon>
                </div>
              )}

              {/* Image Counter */}
              {displayImages.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {currentImageIndex + 1}/{displayImages.length}
                </div>
              )}

              {/* Featured Badges */}
              {product.featuredTypes?.map((type) => (
                <Badge
                  key={type}
                  className={`absolute top-2 left-2 ${getFeaturedBadgeStyle(type)}`}
                  size="sm"
                >
                  {type.replace('_', ' ')}
                </Badge>
              ))}

              {/* Product Type Badge */}
              {product.productType && product.productType !== 'physical' && (
                <Badge
                  className="absolute bottom-2 left-2 bg-indigo-500 text-white"
                  size="sm"
                  leftSection={<Download size={10} />}
                >
                  {product.productType}
                </Badge>
              )}

              {/* Sale Badge */}
              {product.isOnSale && (
                <Badge
                  className="absolute top-2 right-2 bg-red-500 text-white"
                  size="sm"
                >
                  Sale
                </Badge>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Product Name and Brand - Clickable */}
              <Link href={productUrl} className="block">
                <Text fw={500} lineClamp={2} mb="xs" className="hover:text-blue-600 transition-colors">
                  {product.name}
                </Text>
              </Link>
              
              {/* Brand and Manufacturer */}
              {(product.brand || product.manufacturer) && (
                <Group gap="xs" mb="xs">
                  {product.brand && (
                    <Text size="sm" c="dimmed">
                      {product.brand}
                    </Text>
                  )}
                  {product.manufacturer && product.manufacturer !== product.brand && (
                    <Text size="xs" c="dimmed">
                      by {product.manufacturer}
                    </Text>
                  )}
                </Group>
              )}

              {/* Condition */}
              {product.condition && product.condition !== 'brand_new' && (
                <Badge variant="light" size="xs" mb="xs">
                  {product.condition.replace('_', ' ')}
                </Badge>
              )}

              {/* Price Display */}
              <PriceDisplay 
                priceCents={product.priceCents}
                salePriceCents={product.salePriceCents}
              />

              {/* Rating */}
              {product.productRating && (
                <Group gap="xs" mb="xs">
                  <Star size={14} fill="#fbbf24" stroke="#fbbf24" />
                  <Text size="sm">{product.productRating.toFixed(1)}</Text>
                  {product.product_review_count && (
                    <Text size="xs" c="dimmed">
                      ({product.product_review_count})
                    </Text>
                  )}
                </Group>
              )}

              {/* Variants Preview */}
              {displayVariants.length > 0 && (
                <div className="mb-2">
                  <Text size="xs" c="dimmed" mb="xs">
                    {displayVariants.length} option{displayVariants.length > 1 ? 's' : ''}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    {displayVariants.map((variant) => (
                      <Badge
                        key={variant.id}
                        variant="light"
                        size="sm"
                        onClick={() => handleVariantClick(variant)}
                        style={{ cursor: 'pointer' }}
                        className="hover:bg-blue-100 transition-colors text-xs px-3 py-2"
                        title={`${variant.variant_name}: $${(variant.price_cents / 100).toFixed(2)}`}
                      >
                        {variant.variant_name}
                      </Badge>
                    ))}
                    {product.variants!.length > maxVariants && (
                      <Text size="xs" c="dimmed">
                        +{product.variants!.length - maxVariants}
                      </Text>
                    )}
                  </Group>
                  <Text size="xs" c="blue" className="hover:text-blue-600 transition-colors">
                    💡 Click options for details
                  </Text>
                </div>
              )}

              {/* Category */}
              {product.categoryName && (
                <Text size="xs" c="blue" mb="xs">
                  {product.categoryName}
                </Text>
              )}

              {/* Stock Status */}
              <Group gap="xs" mb="xs">
                <Text size="xs" c={product.stock > 0 ? 'green' : 'red'}>
                  {product.stock > 0 ? `In stock (${product.stock})` : 'Out of stock'}
                </Text>
                {product.availability === 'preorder' && (
                  <Badge variant="outline" size="xs">
                    Pre-order
                  </Badge>
                )}
              </Group>

              {/* Features from metadata */}
              {product.metadata?.features && Array.isArray(product.metadata.features) && product.metadata.features.length > 0 && (
                <div className="mb-2">
                  <Text size="xs" c="dimmed" mb="xs">
                    Key Features:
                  </Text>
                  <div className="space-y-1">
                    {product.metadata.features.slice(0, 2).map((feature: string, index: number) => (
                      <Text key={index} size="xs" c="dimmed" lineClamp={1}>
                        • {feature}
                      </Text>
                    ))}
                    {product.metadata.features.length > 2 && (
                      <Text size="xs" c="dimmed">
                        +{product.metadata.features.length - 2} more
                      </Text>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <Card
        className={`bg-white hover:shadow-md transition-shadow duration-200 ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {renderCardContent()}
      </Card>
      
      {/* Variant Popup Modal */}
      <VariantPopupModal
        opened={showVariantModal}
        onClose={() => setShowVariantModal(false)}
        product={{
          id: product.id,
          name: product.name,
          title: product.title,
          variants: product.variants || [],
          imageUrl: product.imageUrl,
          currency: product.currency || 'USD',
          hasActivePaymentGateway: product.hasActivePaymentGateway
        }}
        onVariantSelect={(variant) => {
          // Handle variant selection - could add to cart or navigate to product page with variant pre-selected
          if (onVariantClick) {
            onVariantClick(variant);
          } else {
            // Navigate to product page with pre-selected variant
            window.open(`${productUrl}?variant=${variant.id}`, '_blank');
          }
        }}
        hasActivePaymentGateway={product.hasActivePaymentGateway}
      />
    </>
  );
}

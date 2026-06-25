'use client';

import { StockStatusInfo } from '../type-sections/StockStatusInfo';
import { ShippingInfo } from '../type-sections/ShippingInfo';
import { ConditionInfo } from '../type-sections/ConditionInfo';
import { DigitalDownloadInfo } from '../type-sections/DigitalDownloadInfo';
import { LicenseInfo } from '../type-sections/LicenseInfo';
import { AccessDurationInfo } from '../type-sections/AccessDurationInfo';
import { ServiceBookingCTA } from '../type-sections/ServiceBookingCTA';
import { ServiceDurationInfo } from '../type-sections/ServiceDurationInfo';
import { ServiceAreaInfo } from '../type-sections/ServiceAreaInfo';

type ProductType = 'physical' | 'digital' | 'service' | 'hybrid';
type LayoutVariant = 'classic' | 'showcase' | 'quick-commerce';

interface ProductTypeSectionProps {
  product: any;
  productType?: ProductType;
  layoutVariant?: LayoutVariant;
  storefrontType?: string;
  currentStock?: number;
  currentAvailability?: string;
}

export function ProductTypeSection({
  product,
  productType,
  layoutVariant = 'classic',
  storefrontType,
  currentStock,
  currentAvailability,
}: ProductTypeSectionProps) {
  const resolvedType = productType || product.productType || 'physical';

  switch (resolvedType) {
    case 'physical':
      return (
        <div className="space-y-3">
          <StockStatusInfo
            product={product}
            currentStock={currentStock}
            currentAvailability={currentAvailability}
            layoutVariant={layoutVariant}
          />
          <ShippingInfo product={product} layoutVariant={layoutVariant} />
          <ConditionInfo product={product} layoutVariant={layoutVariant} />
        </div>
      );

    case 'digital':
      return (
        <div className="space-y-3">
          <DigitalDownloadInfo product={product} layoutVariant={layoutVariant} />
          <LicenseInfo product={product} layoutVariant={layoutVariant} />
          <AccessDurationInfo product={product} layoutVariant={layoutVariant} />
        </div>
      );

    case 'hybrid':
      return (
        <div className="space-y-3">
          <StockStatusInfo
            product={product}
            currentStock={currentStock}
            currentAvailability={currentAvailability}
            layoutVariant={layoutVariant}
          />
          <ShippingInfo product={product} layoutVariant={layoutVariant} />
          <ConditionInfo product={product} layoutVariant={layoutVariant} />
          <DigitalDownloadInfo product={product} layoutVariant={layoutVariant} />
          <LicenseInfo product={product} layoutVariant={layoutVariant} />
          <AccessDurationInfo product={product} layoutVariant={layoutVariant} />
        </div>
      );

    case 'service':
      return (
        <div className="space-y-3">
          <ServiceBookingCTA
            product={product}
            layoutVariant={layoutVariant}
            storefrontType={storefrontType}
          />
          <ServiceDurationInfo product={product} layoutVariant={layoutVariant} />
          <ServiceAreaInfo product={product} layoutVariant={layoutVariant} />
        </div>
      );

    default:
      return null;
  }
}

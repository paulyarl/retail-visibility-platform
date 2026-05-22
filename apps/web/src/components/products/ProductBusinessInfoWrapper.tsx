"use client";

import { useStorefrontCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import ProductBusinessInfoCollapsible from './ProductBusinessInfoCollapsible';

interface ProductBusinessInfoWrapperProps {
  product: any;
  tenant: any;
}

export default function ProductBusinessInfoWrapper({ product, tenant }: ProductBusinessInfoWrapperProps) {
  // Storefront capability-driven content control
  const storefrontCap = useStorefrontCapability(product.tenantId);
  const isStorefrontEnabled = storefrontCap.data?.enabled ?? true;
  const isRetailStore = storefrontCap.data?.type === 'retail' || storefrontCap.data?.type === 'both';
  const isOnlineStore = storefrontCap.data?.type === 'online' || storefrontCap.data?.type === 'both';
  const showsLocation = storefrontCap.data?.showsLocation ?? true;
  const showsMap = storefrontCap.data?.showsMap ?? true;
  const showsHours = storefrontCap.data?.showsHours ?? true;

  // Only show business info for retail stores or when location display is enabled
  if (!showsLocation || isOnlineStore) {
    return null;
  }

  return <ProductBusinessInfoCollapsible product={product} tenant={tenant} showHours={showsHours} showLocation={showsLocation} showsMap={showsMap} />;
}

"use client";

import { useState } from 'react';
import { useStorefrontCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { StorefrontOptionFlags } from '@/services/PublicStorefrontOptionsService';
import ProductBusinessInfoCollapsible from './ProductBusinessInfoCollapsible';

interface ProductBusinessInfoWrapperProps {
  product: any;
  tenant: any;
  initialOptFlags?: StorefrontOptionFlags | null; // Server-side resolved flags
}

export default function ProductBusinessInfoWrapper({ product, tenant, initialOptFlags }: ProductBusinessInfoWrapperProps) {
  // Storefront capability-driven content control
  const storefrontCap = useStorefrontCapability(product.tenantId);
  const isStorefrontEnabled = storefrontCap.data?.enabled ?? true;
  const isRetailStore = storefrontCap.data?.type === 'retail' || storefrontCap.data?.type === 'both';
  const isOnlineStore = storefrontCap.data?.type === 'online' || storefrontCap.data?.type === 'both';
  const isServiceStore = storefrontCap.data?.type === 'service' || storefrontCap.data?.type === 'both';

  // Storefront options capability flags — initialized from server-side fetch (no waterfall)
  const [optFlags] = useState<StorefrontOptionFlags | null>(initialOptFlags ?? null);

  const showsLocation = optFlags?.showLocationDisplay ?? true;
  const showsMap = optFlags?.showMapDisplay ?? true;
  const showsHours = optFlags?.showHoursDisplay ?? true;

  // Only show business info for retail stores or when location display is enabled
  if (!showsLocation || isOnlineStore) {
    return null;
  }

  return <ProductBusinessInfoCollapsible product={product} tenant={tenant} showHours={showsHours} showLocation={showsLocation} showsMap={showsMap} />;
}

'use client';

import { MapPin } from 'lucide-react';

interface ServiceAreaInfoProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ServiceAreaInfo({
  product,
  layoutVariant = 'classic',
}: ServiceAreaInfoProps) {
  const isCompact = layoutVariant === 'quick-commerce';
  const serviceArea = product.metadata?.serviceArea || product.metadata?.service_area;
  const travelRadius = product.metadata?.travelRadius || product.metadata?.travel_radius;
  const serviceLocation = product.metadata?.serviceLocation || product.metadata?.service_location;

  const hasAnyInfo = serviceArea || travelRadius || serviceLocation;

  if (!hasAnyInfo) return null;

  const isOnSite = serviceLocation === 'on_site' || serviceLocation === 'on-site';
  const isRemote = serviceLocation === 'remote';

  return (
    <div className={`flex items-start gap-2 ${isCompact ? 'text-xs' : 'text-sm'} text-neutral-600 dark:text-neutral-400`}>
      <MapPin size={isCompact ? 14 : 16} className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium">Service Area</p>
        {isOnSite && (
          <p className={isCompact ? 'text-xs' : 'text-xs'}>On-site service — we come to you</p>
        )}
        {isRemote && (
          <p className={isCompact ? 'text-xs' : 'text-xs'}>Remote service — delivered online</p>
        )}
        {serviceArea && (
          <p className={isCompact ? 'text-xs' : 'text-xs'}>Area: {serviceArea}</p>
        )}
        {travelRadius && (
          <p className={isCompact ? 'text-xs' : 'text-xs'}>Travel radius: {travelRadius} {typeof travelRadius === 'number' ? 'miles' : ''}</p>
        )}
      </div>
    </div>
  );
}

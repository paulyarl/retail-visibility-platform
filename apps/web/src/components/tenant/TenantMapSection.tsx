'use client';

import MapCard from './MapCard';
import { MapLocation } from '@/lib/map-utils';

interface TenantMapSectionProps {
  location: MapLocation;
  className?: string;
}

/**
 * Reusable map section component
 * Used on: Profile page, Storefront page, Product page
 */
export default function TenantMapSection({ location, className = '' }: TenantMapSectionProps) {
  if (!location.displayMap || !location.latitude || !location.longitude) {
    return null;
  }

  return (
    <div className={className}>
      <MapCard
        businessName={location.businessName}
        addressLine1={location.addressLine1}
        addressLine2={location.addressLine2}
        city={location.city}
        state={location.state}
        postalCode={location.postalCode}
        countryCode={location.countryCode}
        latitude={location.latitude}
        longitude={location.longitude}
        displayMap={true}
        privacyMode={location.privacyMode}
        editable={false}
      />
    </div>
  );
}

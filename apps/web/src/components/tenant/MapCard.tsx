"use client";

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Skeleton } from '@/components/ui';

export interface MapCardProps {
  businessName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
  displayMap: boolean;
  privacyMode?: 'precise' | 'neighborhood';
  onPrivacyModeChange?: (mode: 'precise' | 'neighborhood') => void;
  onToggleDisplay?: (enabled: boolean) => void;
  editable?: boolean;
}

export default function MapCard({
  businessName,
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
  countryCode,
  latitude,
  longitude,
  displayMap,
  privacyMode = 'precise',
  onPrivacyModeChange,
  onToggleDisplay,
  editable = false,
}: MapCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Build Google Maps URL for directions
  const mapsUrl = latitude && longitude
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${addressLine1}, ${city}, ${state} ${postalCode}`
      )}`;

  // Build embed URL (requires API key in production)
  const embedUrl = latitude && longitude
    ? `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || 'demo'}&q=${latitude},${longitude}&zoom=15`
    : null;

  if (!displayMap) {
    return null; // Hidden when disabled
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <CardTitle>Store Location</CardTitle>
          </div>
          {editable && (
            <Badge variant={privacyMode === 'precise' ? 'success' : 'warning'}>
              {privacyMode === 'precise' ? 'Precise' : 'Neighborhood'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map Embed */}
        <div className="relative w-full h-56 bg-neutral-100 rounded-lg overflow-hidden">
          {loading && (
            <Skeleton className="w-full h-full" />
          )}
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-neutral-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <p className="text-sm text-neutral-600 mb-2">Map unavailable</p>
                <Button size="sm" variant="ghost" onClick={() => { setError(false); setLoading(true); }}>
                  Retry
                </Button>
              </div>
            </div>
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              loading="lazy"
              allowFullScreen
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-neutral-200">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-neutral-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-sm text-neutral-600">Location not available</p>
              </div>
            </div>
          )}
        </div>

        {/* Address Info */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-500">Business Name</p>
              <p className="font-semibold text-neutral-900 mt-0.5">{businessName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-500">Address</p>
              <div className="text-neutral-900 mt-0.5">
                <p>{addressLine1}</p>
                {addressLine2 && <p>{addressLine2}</p>}
                <p>
                  {city}{state && `, ${state}`} {postalCode}
                </p>
                <p className="text-sm text-neutral-500 mt-1">{countryCode}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Get Directions Button */}
        <Button
          variant="primary"
          className="w-full"
          onClick={() => window.open(mapsUrl, '_blank', 'noopener,noreferrer')}
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Get Directions
        </Button>

        {/* Privacy Mode Toggle (Settings Only) */}
        {editable && onPrivacyModeChange && (
          <div className="pt-4 border-t border-neutral-200">
            <p className="text-sm font-medium text-neutral-700 mb-3">Privacy Mode</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={privacyMode === 'precise' ? 'primary' : 'ghost'}
                onClick={() => onPrivacyModeChange('precise')}
                className="flex-1"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Precise
              </Button>
              <Button
                size="sm"
                variant={privacyMode === 'neighborhood' ? 'primary' : 'ghost'}
                onClick={() => onPrivacyModeChange('neighborhood')}
                className="flex-1"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Neighborhood
              </Button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {privacyMode === 'precise' 
                ? 'Shows exact location on the map' 
                : 'Shows approximate area for privacy (coordinates rounded)'}
            </p>
          </div>
        )}

        {/* Display Toggle (Settings Only) */}
        {editable && onToggleDisplay && (
          <div className="pt-4 border-t border-neutral-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-700">Show on public page</p>
                <p className="text-xs text-neutral-500 mt-0.5">Display map to visitors</p>
              </div>
              <button
                onClick={() => onToggleDisplay(!displayMap)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  displayMap ? 'bg-primary-600' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    displayMap ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

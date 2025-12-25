"use client";

import { useState, useEffect } from 'react';

interface GoogleMapEmbedProps {
  address: string;
  className?: string;
  height?: string;
  showDirections?: boolean;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function GoogleMapEmbed({ 
  address, 
  className = "",
  height = "h-64",
  showDirections = true 
}: GoogleMapEmbedProps) {
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);
  const [isClient, setIsClient] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    console.log('[GoogleMapEmbed] API Key available:', !!key, 'Length:', key?.length);
    console.log('[GoogleMapEmbed] Address:', address);
    setApiKey(key);
  }, [address]);

  const handleIframeLoad = () => {
    console.log('[GoogleMapEmbed] Iframe loaded successfully');
  };

  const handleIframeError = () => {
    console.error('[GoogleMapEmbed] Iframe failed to load');
    setMapError('Failed to load map');
  };

  if (!isClient) {
    return (
      <div className={`${height} ${className} flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg`}>
        <div className="animate-pulse text-gray-400 text-sm">Loading map...</div>
      </div>
    );
  }
  
  if (!apiKey) {
    return (
      <div className={`${height} ${className} flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600`}>
        <div className="text-center p-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Map unavailable</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs">Google Maps API key not configured</p>
        </div>
      </div>
    );
  }

  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(address)}`;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  console.log('[GoogleMapEmbed] Full details:', {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey?.substring(0, 10),
    address,
    encodedAddress: encodeURIComponent(address),
    embedUrlLength: embedUrl.length,
    embedUrlStart: embedUrl.substring(0, 80)
  });

  if (mapError) {
    return (
      <div className={`${height} ${className} flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-300 dark:border-red-700`}>
        <div className="text-center p-4">
          <p className="text-red-600 dark:text-red-400 text-sm mb-2">Map failed to load</p>
          <p className="text-red-500 dark:text-red-500 text-xs">Check console for details</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className={`w-full ${height} rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700`}>
        <iframe
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          title="Store Location"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
      {showDirections && (
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Get Directions
          </a>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View on Google Maps
          </a>
        </div>
      )}
    </div>
  );
}

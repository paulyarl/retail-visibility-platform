"use client";

import { useEffect, useRef, useState } from 'react';
import { geocodeAddress } from '@/lib/validation/businessProfile';
import { api } from '@/lib/api';

interface DirectoryListing {
  id: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  primaryCategory?: string;
  ratingAvg: number;
  productCount: number;
  isPromoted?: boolean;
  promotionTier?: string;
}

interface DirectoryMapProps {
  listings: DirectoryListing[];
  center?: [number, number];
  zoom?: number;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function DirectoryMap({ 
  listings, 
  center = [39.8283, -98.5795], // Center of USA
  zoom = 4 
}: DirectoryMapProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any>(null);
  const [autoGeocoding, setAutoGeocoding] = useState(false);

  // Calculate listings with and without coordinates
  const validListings = listings.filter(l => l.latitude && l.longitude);
  const listingsWithoutCoords = listings.filter(l => !l.latitude || !l.longitude);

  // Auto-geocode stores without coordinates
  const handleAutoGeocode = async (store: DirectoryListing) => {
    // Only require address, city, and zipCode - country defaults to US
    if (!store.address || !store.city || !store.zipCode) {
      console.log('[DirectoryMap] Store missing required address fields for geocoding:', store.businessName);
      return null;
    }
    
    try {
      console.log('[DirectoryMap] Auto-geocoding store:', store.businessName);
      
      const coordinates = await geocodeAddress({
        address_line1: store.address,
        city: store.city,
        state: store.state,
        postal_code: store.zipCode,
        country_code: store.country || 'US', // Default to US if not specified
      });

      if (coordinates) {
        console.log('[DirectoryMap] Got coordinates for', store.businessName, ':', coordinates);
        
        // Update the store coordinates via API
        const response = await api.patch(`/api/tenants/${store.id}/coordinates`, coordinates);

        if (response.ok) {
          console.log('[DirectoryMap] Successfully updated coordinates for', store.businessName);
          return coordinates;
        } else {
          console.error('[DirectoryMap] Failed to update coordinates for', store.businessName);
        }
      } else {
        console.log('[DirectoryMap] Geocoding failed for', store.businessName);
      }
    } catch (error) {
      console.error('[DirectoryMap] Auto-geocode error for', store.businessName, ':', error);
    }
    
    return null;
  };

  // Auto-geocode stores when component mounts
  useEffect(() => {
    const autoGeocodeStores = async () => {
      if (listingsWithoutCoords.length === 0) return;
      
      // Find stores that have complete address info but no coordinates
      // Country is optional - defaults to US
      const storesWithCompleteAddress = listingsWithoutCoords.filter(store => 
        store.address && store.city && store.zipCode
      );

      if (storesWithCompleteAddress.length === 0) return;

      console.log(`[DirectoryMap] Found ${storesWithCompleteAddress.length} stores with addresses but no coordinates`);
      
      // Auto-geocode the first store (to avoid overwhelming the geocoding API)
      const store = storesWithCompleteAddress[0];
      await handleAutoGeocode(store);
    };

    // Run auto-geocoding with a slight delay to avoid blocking the UI
    const timer = setTimeout(autoGeocodeStores, 1000);
    return () => clearTimeout(timer);
  }, [listingsWithoutCoords]);

  useEffect(() => {
    // Import Leaflet only on client side
    const initializeMap = async () => {
      if (!mapContainerRef.current) return;

      try {
        const L = (await import('leaflet')).default;
        
        // Import CSS files using require() to bypass TypeScript module checking
        if (typeof window !== 'undefined') {
          require('leaflet/dist/leaflet.css');
          require('leaflet.markercluster/dist/MarkerCluster.css');
          require('leaflet.markercluster/dist/MarkerCluster.Default.css');
          await import('leaflet.markercluster');
        }

        // Initialize map only once
        if (!mapRef.current) {
          mapRef.current = L.map(mapContainerRef.current).setView(center, zoom);

          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(mapRef.current);

          // Initialize marker cluster group
          markersRef.current = L.markerClusterGroup({
            chunkedLoading: true,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
          });

          mapRef.current.addLayer(markersRef.current);
        }

        // Clear existing markers
        if (markersRef.current) {
          markersRef.current.clearLayers();
        }

        // Add markers for listings with coordinates
        if (validListings.length > 0 && markersRef.current) {
          const bounds = L.latLngBounds([]);

          validListings.forEach((listing) => {
            if (!listing.latitude || !listing.longitude) return;

            // Determine marker style based on promotion status
            const isPromoted = listing.isPromoted && listing.promotionTier;
            const markerColor = isPromoted ? '#f59e0b' : '#2563eb'; // Gold for promoted, blue for regular
            const markerSize: [number, number] = isPromoted ? [48, 48] : [40, 40]; // Larger for promoted
            const iconAnchor: [number, number] = isPromoted ? [24, 48] : [20, 40];

            const marker = L.marker([listing.latitude, listing.longitude], {
              icon: L.divIcon({
                className: isPromoted ? 'custom-marker promoted-marker' : 'custom-marker',
                html: `
                  <div class="marker-pin ${isPromoted ? 'promoted' : ''}">
                    ${isPromoted ? '<div class="promoted-badge">⭐</div>' : ''}
                    <div class="marker-icon" style="background: ${markerColor};">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                    </div>
                  </div>
                `,
                iconSize: markerSize,
                iconAnchor: iconAnchor,
                popupAnchor: [0, isPromoted ? -48 : -40],
              }),
              // Promoted markers have higher z-index
              zIndexOffset: isPromoted ? 1000 : 0,
            });

            // Create popup content
            const popupContent = `
              <div class="map-popup ${isPromoted ? 'promoted' : ''}">
                ${isPromoted ? '<div class="popup-promoted-badge">⭐ Promoted</div>' : ''}
                ${listing.logoUrl ? `<img src="${listing.logoUrl}" alt="${listing.businessName}" class="popup-logo" />` : ''}
                <h3 class="popup-title">${listing.businessName}</h3>
                ${listing.primaryCategory ? `<p class="popup-category">${listing.primaryCategory}</p>` : ''}
                ${listing.address ? `<p class="popup-address">${listing.address}</p>` : ''}
                ${listing.city && listing.state ? `<p class="popup-location">${listing.city}, ${listing.state}</p>` : ''}
                <div class="popup-stats">
                  ${listing.ratingAvg > 0 ? `<span>⭐ ${listing.ratingAvg.toFixed(1)}</span>` : ''}
                  ${listing.productCount > 0 ? `<span>📦 ${listing.productCount} products</span>` : ''}
                </div>
                <a href="/directory/${listing.slug}" class="popup-link">View Store →</a>
              </div>
            `;

            marker.bindPopup(popupContent, {
              maxWidth: 300,
              className: 'custom-popup',
            });

            markersRef.current?.addLayer(marker);
            bounds.extend([listing.latitude, listing.longitude]);
          });

          // Fit map to show all markers
          if (bounds.isValid() && mapRef.current) {
            mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
        }

        // Show message for stores without coordinates
        if (listingsWithoutCoords.length > 0 && validListings.length === 0 && mapRef.current) {
          // Center on a reasonable location (e.g., center of USA)
          mapRef.current.setView([39.8283, -98.5795], 4);
        }
      } catch (error) {
        console.error('[DirectoryMap] Error initializing map:', error);
      }
    };

    initializeMap();

    // Cleanup function
    return () => {
      // Don't destroy the map on every render, only on unmount
    };
  }, [listings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <div ref={mapContainerRef} className="w-full h-[600px] rounded-lg overflow-hidden shadow-lg" />
      
      {/* Info message for stores without coordinates */}
      {listingsWithoutCoords.length > 0 && validListings.length === 0 && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-1">
                Location Coordinates Not Available
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {listingsWithoutCoords.length === 1 
                  ? `${listingsWithoutCoords[0].businessName} has an address but no precise location coordinates for mapping.`
                  : `${listingsWithoutCoords.length} stores have addresses but no precise location coordinates for mapping.`
                }
              </p>
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Stores are displayed in Grid and List views with their addresses.
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Automatically getting coordinates...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom Styles */}
      <style jsx global>{`
        .custom-marker {
          background: none;
          border: none;
        }

        .marker-pin {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .marker-pin.promoted {
          width: 48px;
          height: 48px;
        }

        .promoted-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          z-index: 10;
        }

        .marker-icon {
          width: 32px;
          height: 32px;
          background: #2563eb;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .marker-pin.promoted .marker-icon {
          width: 40px;
          height: 40px;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }

        .marker-icon svg {
          width: 20px;
          height: 20px;
          color: white;
          transform: rotate(45deg);
        }

        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
        }

        .custom-popup .leaflet-popup-content {
          margin: 0;
          width: 280px !important;
        }

        .map-popup {
          padding: 16px;
          position: relative;
        }

        .map-popup.promoted {
          border-left: 4px solid #f59e0b;
        }

        .popup-promoted-badge {
          display: inline-block;
          padding: 4px 12px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .popup-logo {
          width: 100%;
          height: 120px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .popup-title {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 8px 0;
        }

        .popup-category {
          font-size: 14px;
          color: #2563eb;
          margin: 0 0 8px 0;
        }

        .popup-address,
        .popup-location {
          font-size: 14px;
          color: #6b7280;
          margin: 4px 0;
        }

        .popup-stats {
          display: flex;
          gap: 12px;
          margin: 12px 0;
          font-size: 14px;
          color: #374151;
        }

        .popup-link {
          display: inline-block;
          margin-top: 12px;
          padding: 8px 16px;
          background: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .popup-link:hover {
          background: #1d4ed8;
        }

        .marker-cluster-small,
        .marker-cluster-medium,
        .marker-cluster-large {
          background-color: rgba(37, 99, 235, 0.6);
        }

        .marker-cluster-small div,
        .marker-cluster-medium div,
        .marker-cluster-large div {
          background-color: rgba(37, 99, 235, 0.8);
          color: white;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}


export { DirectoryMap };

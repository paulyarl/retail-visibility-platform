"use client";

import { useEffect, useRef, useState } from 'react';
import { geocodeAddress, validateCoordinates } from '@/lib/geocoding';

// Google Maps type declarations
declare global {
  namespace google {
    namespace maps {
      class Map {
        constructor(mapDiv: HTMLElement, opts?: any);
        fitBounds(bounds: any): void;
        getZoom(): number;
        setZoom(zoom: number): void;
        setCenter(center: any): void;
      }
      class Marker {
        constructor(opts?: any);
        setMap(map: Map | null): void;
        setIcon(icon: any): void;
        addListener(event: string, callback: () => void): void;
      }
      class Size {
        constructor(width: number, height: number);
      }
      class Point {
        constructor(x: number, y: number);
      }
      class LatLngBounds {
        extend(point: any): void;
      }
      class InfoWindow {
        setContent(content: string): void;
        open(map: Map, marker: Marker): void;
      }
      namespace event {
        function addListener(instance: any, event: string, callback: () => void): any;
        function removeListener(listener: any): void;
      }
      namespace Animation {
        const DROP: any;
      }
    }
  }
}

interface DirectoryListing {
  id: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  primaryCategory?: string;
  ratingAvg: number;
  productCount: number;
}

interface DirectoryMapGoogleProps {
  listings: DirectoryListing[];
  center?: { lat: number; lng: number };
  zoom?: number;
  useMapEndpoint?: boolean; // Use unified map endpoint instead of passed listings
  filters?: {
    category?: string;
    storeType?: string;
    city?: string;
    state?: string;
    q?: string; // Search query
  };
}

// Global flag to track if script is loading or loaded
let isScriptLoading = false;
let isScriptLoaded = false;

export default function DirectoryMapGoogle({ 
  listings, 
  center = { lat: 39.8283, lng: -98.5795 }, // Center of USA
  zoom = 4,
  useMapEndpoint = false,
  filters = {}
}: DirectoryMapGoogleProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapListings, setMapListings] = useState<DirectoryListing[]>(listings);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Geocode listings missing coordinates
  useEffect(() => {
    const geocodeMissingCoordinates = async () => {
      const listingsNeedingGeocoding = mapListings.filter(
        listing => !listing.latitude || !listing.longitude
      );

      if (listingsNeedingGeocoding.length === 0) return;

      setIsGeocoding(true);
      console.log(`[DirectoryMap] Geocoding ${listingsNeedingGeocoding.length} addresses...`);

      const updatedListings = [...mapListings];

      for (const listing of listingsNeedingGeocoding) {
        const geocodeResult = await geocodeAddress(
          listing.address || '',
          listing.city,
          listing.state,
          listing.zipCode
        );

        if (geocodeResult && validateCoordinates(geocodeResult.latitude, geocodeResult.longitude)) {
          const index = updatedListings.findIndex(l => l.id === listing.id);
          if (index !== -1) {
            updatedListings[index] = {
              ...updatedListings[index],
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
            };
            console.log(`[DirectoryMap] Geocoded "${listing.businessName}": ${geocodeResult.latitude}, ${geocodeResult.longitude}`);
          }
        } else {
          console.warn(`[DirectoryMap] Failed to geocode "${listing.businessName}"`);
        }

        // Rate limiting: 10 requests per second
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setMapListings(updatedListings);
      setIsGeocoding(false);
      console.log(`[DirectoryMap] Geocoding complete`);
    };

    geocodeMissingCoordinates();
  }, [mapListings.length]); // Only run when listings first load

  // Fetch from map endpoint if enabled
  useEffect(() => {
    if (!useMapEndpoint) {
      setMapListings(listings);
      return;
    }

    const fetchMapData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const params = new URLSearchParams();
        if (filters.category) params.append('category', filters.category);
        if (filters.storeType) params.append('storeType', filters.storeType);
        if (filters.city) params.append('city', filters.city);
        if (filters.state) params.append('state', filters.state);
        if (filters.q) params.append('q', filters.q); // Search query
        params.append('limit', '100');

        const url = `${apiUrl}/api/directory/map/locations?${params.toString()}`;
        
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          setMapListings(data.data?.listings || []);
        } else {
          console.error('[DirectoryMapGoogle] API fetch failed:', response.status, response.statusText);
        }
      } catch (err) {
        console.error('[DirectoryMapGoogle] Error fetching map data:', err);
      }
    };

    fetchMapData();
  }, [useMapEndpoint, filters.category, filters.storeType, filters.city, filters.state, filters.q, listings]);

  // Filter listings with valid coordinates
  const validListings = mapListings.filter(l => l.latitude && l.longitude);

  useEffect(() => {
    // Check if Google Maps is already loaded
    if ((window as any).google && (window as any).google.maps) {
      isScriptLoaded = true;
      setIsLoaded(true);
      return;
    }

    // If script is already loading, wait for it
    if (isScriptLoading) {
      const checkInterval = setInterval(() => {
        if ((window as any).google && (window as any).google.maps) {
          isScriptLoaded = true;
          setIsLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      isScriptLoading = true;
      existingScript.addEventListener('load', () => {
        isScriptLoaded = true;
        setIsLoaded(true);
      });
      return;
    }

    // Load Google Maps script
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError('Google Maps API key not configured');
      console.error('[DirectoryMapGoogle] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set');
      return;
    }

    isScriptLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isScriptLoaded = true;
      isScriptLoading = false;
      setIsLoaded(true);
    };
    script.onerror = () => {
      isScriptLoading = false;
      setError('Failed to load Google Maps');
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || !(window as any).google) return;

    const google = (window as any).google;

    // Initialize map
    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center,
        zoom,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
      });

      // Create single info window for all markers
      infoWindowRef.current = new google.maps.InfoWindow();
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add markers for each listing
    validListings.forEach((listing) => {
      if (!listing.latitude || !listing.longitude || !mapRef.current) return;

      // Create custom marker with store logo
      let markerOptions: any = {
        position: { lat: listing.latitude, lng: listing.longitude },
        map: mapRef.current,
        title: listing.businessName,
        animation: google.maps.Animation.DROP,
      };

      // Use store logo as marker icon if available
      let marker: google.maps.Marker;
      if (listing.logoUrl) {
        // Set initial icon with logo URL - Google Maps will handle loading
        markerOptions.icon = {
          url: listing.logoUrl,
          scaledSize: new google.maps.Size(40, 40),
          origin: new google.maps.Point(0, 0),
          anchor: new google.maps.Point(20, 40),
        };
      }

      marker = new google.maps.Marker(markerOptions);

      // Add error handling for logo loading after marker creation
      if (listing.logoUrl) {
        const img = new Image();
        img.onload = () => {
          // Logo loaded successfully - marker is already using it
        };
        img.onerror = () => {
          // Logo failed to load, reset to default marker
          console.warn(`[DirectoryMap] Logo failed to load for ${listing.businessName}: ${listing.logoUrl}`);
          marker.setIcon(null); // Reset to default red marker
        };
        img.src = listing.logoUrl;
      }

      // Create info window content
      const infoContent = `
        <div style="padding: 12px; max-width: 250px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111;">
            ${listing.businessName}
          </h3>
          ${listing.address ? `
            <p style="margin: 4px 0; font-size: 14px; color: #666;">
              ${listing.address}
            </p>
          ` : ''}
          ${listing.city || listing.state ? `
            <p style="margin: 4px 0; font-size: 14px; color: #666;">
              ${[listing.city, listing.state].filter(Boolean).join(', ')}
            </p>
          ` : ''}
          ${listing.ratingAvg > 0 ? `
            <p style="margin: 8px 0 4px 0; font-size: 14px; color: #666;">
              ⭐ ${listing.ratingAvg.toFixed(1)} rating
            </p>
          ` : ''}
          ${listing.productCount > 0 ? `
            <p style="margin: 4px 0; font-size: 14px; color: #666;">
              ${listing.productCount} products
            </p>
          ` : ''}
          <a 
            href="/directory/${listing.slug}" 
            style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;"
          >
            View Store
          </a>
        </div>
      `;

      // Add click listener to show info window
      marker.addListener('click', () => {
        if (infoWindowRef.current && mapRef.current) {
          infoWindowRef.current.setContent(infoContent);
          infoWindowRef.current.open(mapRef.current, marker);
        }
      });

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (validListings.length > 0 && mapRef.current) {
      const bounds = new google.maps.LatLngBounds();
      validListings.forEach(listing => {
        if (listing.latitude && listing.longitude) {
          bounds.extend({ lat: listing.latitude, lng: listing.longitude });
        }
      });
      mapRef.current.fitBounds(bounds);
      
      // Prevent too much zoom for single marker
      const listener = google.maps.event.addListener(mapRef.current, 'idle', () => {
        if (mapRef.current && mapRef.current.getZoom()! > 15) {
          mapRef.current.setZoom(15);
        }
        google.maps.event.removeListener(listener);
      });
    }
  }, [isLoaded, validListings, center, zoom]);

  if (error) {
    return (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Map Error</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden shadow-lg">
      <div ref={mapContainerRef} className="w-full h-full" />
      {validListings.length === 0 && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg p-6 text-center">
            <p className="text-gray-900 font-medium">No stores with locations to display</p>
            <p className="text-gray-600 text-sm mt-2">Stores need coordinates to appear on the map</p>
          </div>
        </div>
      )}
    </div>
  );
}

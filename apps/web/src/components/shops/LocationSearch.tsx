/**
 * LocationSearch Component
 * Allows users to filter by location (city/state/zip or coordinates)
 * Phase 5 UI Implementation
 */

'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { LocationParams } from '@/types/scope';
import { useShopLocations } from '@/hooks/shops/useShopLocations';

interface LocationSearchProps {
  value?: LocationParams;
  onChange: (location: LocationParams) => void;
}

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

export default function LocationSearch({ value, onChange }: LocationSearchProps) {
  const [city, setCity] = useState(value?.city || '');
  const [state, setState] = useState(value?.state || '');
  const [zip, setZip] = useState(value?.zip || '');
  const [radius, setRadius] = useState(value?.radius || 25);
  const [useCoordinates, setUseCoordinates] = useState(
    !!(value?.latitude && value?.longitude)
  );
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  // Fetch available locations using cached hook
  const { locations: availableLocations, loading: locationsLoading, error: locationsError } = useShopLocations();

  // Update internal state when value changes
  useEffect(() => {
    if (value) {
      setCity(value.city || '');
      setState(value.state || '');
      setZip(value.zip || '');
      setRadius(value.radius || 25);
      setUseCoordinates(!!(value.latitude && value.longitude));
    }
  }, [value]);

  const handleApply = () => {
    const location: LocationParams = {};

    if (useCoordinates && value?.latitude && value?.longitude) {
      location.latitude = value.latitude;
      location.longitude = value.longitude;
      location.radius = radius;
    } else {
      if (city) location.city = city;
      if (state) location.state = state;
      if (zip) location.zip = zip;
    }

    onChange(location);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: LocationParams = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radius: radius
        };
        
        setUseCoordinates(true);
        setGettingLocation(false);
        onChange(location);
      },
      (error) => {
        setGettingLocation(false);
        setLocationError(error.message);
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Location Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setUseCoordinates(false)}
          className={`
            flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
            transition-colors
            ${!useCoordinates
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          <MapPin size={18} />
          By Address
        </button>
        <button
          onClick={() => setUseCoordinates(true)}
          className={`
            flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
            transition-colors
            ${useCoordinates
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
        >
          <Navigation size={18} />
          Near Me
        </button>
      </div>

      {/* Address Inputs */}
      {!useCoordinates && (
        <div className="space-y-3">
          {locationsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Loading locations...</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  City
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="">Select city...</option>
                  {Array.from(new Set(availableLocations.map(loc => loc.city)))
                    .sort()
                    .map(cityName => (
                      <option key={cityName} value={cityName}>
                        {cityName}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value="">Select state...</option>
                    {Array.from(new Set(availableLocations.map(loc => loc.state)))
                      .sort()
                      .map(stateName => (
                        <option key={stateName} value={stateName}>
                          {stateName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ZIP Code
                  </label>
                  <select
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                  >
                    <option value="">Select ZIP...</option>
                    {Array.from(new Set(availableLocations.map(loc => loc.zip)))
                      .sort()
                      .map(zipCode => (
                        <option key={zipCode} value={zipCode}>
                          {zipCode}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {availableLocations.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {availableLocations.length} locations available on the platform
                </p>
              )}

              <button
                onClick={handleApply}
                disabled={!city && !state && !zip}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
              >
                Apply Location Filter
              </button>
            </>
          )}
        </div>
      )}

      {/* Geolocation */}
      {useCoordinates && (
        <div className="space-y-3">
          {value?.latitude && value?.longitude ? (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300 font-medium mb-1">
                📍 Location detected
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Lat: {value.latitude.toFixed(4)}, Lng: {value.longitude.toFixed(4)}
              </p>
            </div>
          ) : (
            <button
              onClick={handleGetCurrentLocation}
              disabled={gettingLocation}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {gettingLocation ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Getting your location...
                </>
              ) : (
                <>
                  <Navigation size={18} />
                  Use My Current Location
                </>
              )}
            </button>
          )}

          {locationError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">
                {locationError}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Radius Selector (for coordinates only) */}
      {useCoordinates && value?.latitude && value?.longitude && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Search Radius: {radius} miles
          </label>
          <div className="flex gap-2">
            {RADIUS_OPTIONS.map(r => (
              <button
                key={r}
                onClick={() => {
                  setRadius(r);
                  onChange({
                    ...value,
                    radius: r
                  });
                }}
                className={`
                  flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${radius === r
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                {r}mi
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>
          <strong>By Address:</strong> Filter products by city, state, or ZIP code
        </p>
        <p>
          <strong>Near Me:</strong> Find products within a specific radius of your location
        </p>
      </div>
    </div>
  );
}

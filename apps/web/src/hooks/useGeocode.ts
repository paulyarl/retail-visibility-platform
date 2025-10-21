import { useState, useEffect } from 'react';

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

interface UseGeocodeOptions {
  address: string;
  enabled?: boolean;
}

interface UseGeocodeReturn {
  coordinates: GeocodeResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGeocode({ address, enabled = true }: UseGeocodeOptions): UseGeocodeReturn {
  const [coordinates, setCoordinates] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geocode = async () => {
    if (!address || !enabled) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tenant/profile/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error('Failed to geocode address');
      }

      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        setCoordinates({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      } else {
        throw new Error('Invalid geocode response');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Geocoding failed');
      setCoordinates(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (address && enabled) {
      // Debounce geocoding requests
      const timer = setTimeout(() => {
        geocode();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [address, enabled]);

  return {
    coordinates,
    loading,
    error,
    refetch: geocode,
  };
}

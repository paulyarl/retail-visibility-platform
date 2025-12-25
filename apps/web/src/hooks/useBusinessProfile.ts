/**
 * Proof of concept: Business profile hook with optional case transformation
 * Tests the transform utility on safe, non-critical fields
 */

import { useState, useEffect } from 'react';
import { safeTransformToCamel, BusinessProfile } from '@/utils/case-transform';
import { api } from '@/lib/api';

interface UseBusinessProfileOptions {
  transform?: boolean; // Optional transformation
  tenantId?: string;
}

interface ApiBusinessProfile {
  business_name?: string;
  address_line1?: string;
  address_line2?: string;
  phone_number?: string;
  website_url?: string;
  created_at?: string;
  updated_at?: string;
  map_privacy_mode?: string;
}

export const useBusinessProfile = (options: UseBusinessProfileOptions = {}) => {
  const { transform = false, tenantId } = options;
  const [data, setData] = useState<BusinessProfile | ApiBusinessProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`/api/tenants/${tenantId}/profile`);
      if (!response.ok) throw new Error('Failed to fetch profile');
      
      const rawData = await response.json();
      
      // Apply transformation if requested
      const processedData = transform 
        ? safeTransformToCamel<BusinessProfile>(rawData)
        : rawData;
      
      setData(processedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [tenantId, transform]);

  return {
    data,
    loading,
    error,
    refetch: fetchProfile,
    // Helper to demonstrate both formats
    rawData: data as ApiBusinessProfile,
    camelData: transform ? data as BusinessProfile : safeTransformToCamel<BusinessProfile>(data)
  };
};

// Example usage for testing (create as separate .tsx component)
export const createTestComponent = () => {
  console.log('Create BusinessProfileTest.tsx component to test transforms');
  console.log('Usage: const { data: snakeData } = useBusinessProfile({ tenantId, transform: false });');
  console.log('Usage: const { data: camelData } = useBusinessProfile({ tenantId, transform: true });');
};

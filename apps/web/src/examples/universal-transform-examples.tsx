/**
 * UNIVERSAL TRANSFORM EXAMPLES - Frontend Usage
 * Shows how to use the universal transforms in your React components
 */

import React, { useState } from 'react';
import { enhanceApiResponse, useUniversalApi, universalFetch, quickTransform } from '../utils/universal-transform';

// ===== EXAMPLE 1: Enhanced API Hook =====
export const useBusinessProfile = (tenantId: string) => {
  const { get } = useUniversalApi();
  
  const fetchProfile = async () => {
    // This automatically handles both naming conventions
    const profile = await get<any>(`/api/tenants/${tenantId}/business-profile`);
    
    // Now BOTH work on the same object:
    console.log('Snake case:', profile.business_name);  // ✅ Works
    console.log('Camel case:', profile.businessName);   // ✅ Also works!
    
    return profile;
  };
  
  return { fetchProfile };
};

// ===== EXAMPLE 2: Manual Response Enhancement =====
export const fetchTenantData = async (tenantId: string) => {
  const response = await fetch(`/api/tenants/${tenantId}`);
  const rawData = await response.json();
  
  // Enhance the response to have both conventions
  const tenant = enhanceApiResponse(rawData);
  
  // Now your team can use either:
  const name1 = tenant.business_name;  // ✅ Snake case (current frontend style)
  const name2 = tenant.businessName;   // ✅ Camel case (if preferred)
  
  return tenant;
};

// ===== EXAMPLE 3: Universal Fetch (Drop-in Replacement) =====
export const updateBusinessProfile = async (tenantId: string, data: any) => {
  // This handles transforms automatically
  const response = await universalFetch(`/api/tenants/${tenantId}/business-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data) // Automatically enhanced with both conventions
  });
  
  const result = await response.json(); // Automatically enhanced response
  
  // Both naming conventions available:
  return {
    snake_case: result.business_name,  // ✅ Works
    camelCase: result.businessName     // ✅ Also works
  };
};

// ===== EXAMPLE 4: Form Handling =====
export const BusinessProfileForm = () => {
  const [businessName, setBusinessName] = useState<string>('');
  
  const handleSubmit = async (formData: any) => {
    // Transform form data to have both conventions
    const enhancedData = quickTransform.formData(formData);
    
    // API receives both:
    // { business_name: "Store", businessName: "Store" }
    const response = await fetch('/api/business-profile', {
      method: 'POST',
      body: JSON.stringify(enhancedData)
    });
    
    const result = await response.json();
    const enhanced = quickTransform.businessProfile(result);
    
    // Use either convention in your UI:
    setBusinessName(enhanced.business_name || enhanced.businessName);
  };
  
  return null; // React component code here
};

// ===== EXAMPLE 5: Gradual Migration Pattern =====
export const MigrationExample = () => {
  // OLD WAY (still works):
  const oldFetch = async () => {
    const response = await fetch('/api/profile');
    const data = await response.json();
    return data.business_name; // Must use snake_case
  };
  
  // NEW WAY (flexible):
  const newFetch = async () => {
    const response = await universalFetch('/api/profile');
    const data = await response.json();
    
    // Use whatever convention you prefer:
    return data.businessName || data.business_name; // Both work!
  };
  
  return { oldFetch, newFetch };
};

// ===== EXAMPLE 6: Component Props Flexibility =====
interface FlexibleBusinessProfileProps {
  // Component accepts either naming convention
  profile: {
    business_name?: string;
    businessName?: string;
    address_line1?: string;
    addressLine1?: string;
    // ... etc
  };
}

export const FlexibleBusinessProfile: React.FC<FlexibleBusinessProfileProps> = ({ profile }) => {
  // Enhance to ensure both conventions are available
  const enhanced = enhanceApiResponse(profile);
  
  return (
    <div>
      {/* Use whatever convention you prefer */}
      <h1>{enhanced.businessName || enhanced.business_name}</h1>
      <p>{enhanced.addressLine1 || enhanced.address_line1}</p>
    </div>
  );
};

// ===== EXAMPLE 7: Type-Safe Usage =====
interface BusinessProfile {
  business_name: string;
  businessName: string; // Both available after enhancement
  address_line1: string;
  addressLine1: string;
  // ... etc
}

export const typeSafeExample = async (): Promise<BusinessProfile> => {
  const { get } = useUniversalApi();
  return get<BusinessProfile>('/api/business-profile');
  // Returns object with both naming conventions
};

// ===== EXAMPLE 8: Backward Compatibility =====
export const BackwardCompatible = {
  // For components that expect snake_case (current frontend)
  fetchForSnakeCase: async () => {
    const response = await universalFetch('/api/profile');
    const data = await response.json();
    // data.business_name is guaranteed to exist
    return data;
  },
  
  // For new components that prefer camelCase
  fetchForCamelCase: async () => {
    const response = await universalFetch('/api/profile');
    const data = await response.json();
    // data.businessName is guaranteed to exist
    return data;
  }
};

// ===== EXAMPLE 9: Real-World Component Integration =====
export const BusinessCard = ({ tenantId }: { tenantId: string }) => {
  const [profile, setProfile] = React.useState<any>(null);
  
  React.useEffect(() => {
    const loadProfile = async () => {
      // Use universal fetch
      const response = await universalFetch(`/api/tenants/${tenantId}/profile`);
      const data = await response.json();
      
      // Both conventions now available
      setProfile(data);
    };
    
    loadProfile();
  }, [tenantId]);
  
  if (!profile) return <div>Loading...</div>;
  
  return (
    <div className="business-card">
      {/* Your existing code works unchanged */}
      <h2>{profile.business_name}</h2>
      <p>{profile.address_line1}</p>
      
      {/* New code can use camelCase if preferred */}
      <p>{profile.businessName}</p>
      <p>{profile.addressLine1}</p>
      
      {/* Both point to the same values! */}
    </div>
  );
};

export default {
  useBusinessProfile,
  fetchTenantData,
  updateBusinessProfile,
  BusinessProfileForm,
  MigrationExample,
  FlexibleBusinessProfile,
  typeSafeExample,
  BackwardCompatible,
  BusinessCard
};

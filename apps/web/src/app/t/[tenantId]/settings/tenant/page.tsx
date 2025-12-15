'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import BusinessProfileCard from '@/components/settings/BusinessProfileCard';
import GBPLocationCard from '@/components/settings/GBPLocationCard';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { api } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { Spinner } from '@/components/ui';
import { onboardingDataService } from '@/services/onboardingDataService';
import { onboardingStorageService } from '@/services/onboardingStorageService';

export default function TenantBusinessProfilePage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Centralized access control - Platform Support or Tenant Admin
  const { hasAccess, loading: accessLoading, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );
  
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [mergedProfile, setMergedProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    loadProfile();
    loadTenantName();
  }, [tenantId]);

  const loadOnboardingData = async (): Promise<Partial<BusinessProfile>> => {
    try {
      // Fetch from API (same as onboarding flow)
      const apiData = await onboardingDataService.fetchTenantData(tenantId);
      
      // Load from localStorage (any saved progress)
      const savedProgress = onboardingStorageService.load(tenantId);
      const localData = savedProgress?.businessData || {};
      
      // Merge: API data as base, localStorage overrides
      const merged = { ...apiData, ...localData };
      
      // Sanitize and normalize
      const sanitized = onboardingDataService.sanitizeData(merged);
      const normalized = onboardingDataService.normalizeData(sanitized);
      
      console.log('[TenantSettings] Onboarding data loaded:', normalized);
      return normalized;
    } catch (err) {
      console.error('[TenantSettings] Failed to load onboarding data:', err);
      return {};
    }
  };

  const mergeProfileData = async (profileData: BusinessProfile | null) => {
    const onboardingData = await loadOnboardingData();
    
    if (!profileData) {
      // If no profile exists, use onboarding data as base
      setMergedProfile(onboardingData as BusinessProfile);
      return;
    }
    
    // Merge profile data with onboarding data
    // Priority: existing profile > onboarding data
    const merged: BusinessProfile = {
      business_name: profileData.business_name || onboardingData.business_name || '',
      address_line1: profileData.address_line1 || onboardingData.address_line1 || '',
      address_line2: profileData.address_line2 || onboardingData.address_line2 || '',
      city: profileData.city || onboardingData.city || '',
      state: profileData.state || onboardingData.state || '',
      postal_code: profileData.postal_code || onboardingData.postal_code || '',
      country_code: profileData.country_code || onboardingData.country_code || 'US',
      phone_number: profileData.phone_number || onboardingData.phone_number || '',
      email: profileData.email || onboardingData.email || '',
      website: profileData.website || onboardingData.website || '',
      contact_person: profileData.contact_person || onboardingData.contact_person || '',
      logo_url: profileData.logo_url || onboardingData.logo_url || '',
      business_description: profileData.business_description || onboardingData.business_description || '',
      social_links: profileData.social_links || onboardingData.social_links || {},
      latitude: profileData.latitude || onboardingData.latitude,
      longitude: profileData.longitude || onboardingData.longitude,
    };
    
    console.log('[TenantSettings] Merged profile data:', merged);
    setMergedProfile(merged);
  };

  const loadProfile = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/api/tenant/profile?tenant_id=${encodeURIComponent(tenantId)}`);
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        // Merge with onboarding data
        await mergeProfileData(data);
      } else {
        // If no profile exists, still try to merge onboarding data
        await mergeProfileData(null);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Still try to load onboarding data even if API fails
      await mergeProfileData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadTenantName = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/public/tenant/${encodeURIComponent(tenantId)}`);
      
      if (response.ok) {
        const data = await response.json();
        setTenantName(data.name || '');
      }
    } catch (error) {
      console.error('Failed to load tenant name:', error);
    }
  };

  const handleUpdate = async (updatedProfile: BusinessProfile) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.post(`${apiBaseUrl}/api/tenant/profile`, {
        tenant_id: tenantId, // Fixed: use tenant_id instead of tenantId
        ...updatedProfile,
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setMergedProfile(data); // Update merged profile with saved data
        // Reload the profile data to ensure we have the latest from server
        loadProfile();
      } else {
        console.error('Failed to update profile:', response.statusText);
        // Still update local state for UI feedback, but it will be overwritten when loadProfile() completes
        setProfile(updatedProfile);
        setMergedProfile(updatedProfile);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      // Update local state for UI feedback even if API call fails
      setProfile(updatedProfile);
      setMergedProfile(updatedProfile);
    }
  };

  // Access control checks
  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        title="Admin Access Required"
        message="You need tenant administrator privileges to manage business profile settings."
        userRole={tenantRole}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Business Profile"
        description="Manage your store identity, contact details, and logo"
        icon={Icons.Settings}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BusinessProfileCard 
          profile={mergedProfile} 
          loading={loading}
          onUpdate={handleUpdate}
          tenantName={tenantName}
        />
        
        {/* GBP Location Linking */}
        <GBPLocationCard tenantId={tenantId} />
      </div>
    </div>
  );
}

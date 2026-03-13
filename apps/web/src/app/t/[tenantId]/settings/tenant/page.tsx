'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import BusinessProfileCard from '@/components/settings/BusinessProfileCard';
import GBPLocationCard from '@/components/settings/GBPLocationCard';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
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
      let localData = {};
      try {
        const savedProgress = await onboardingStorageService.load(tenantId);
        localData = savedProgress?.businessData || {};
      } catch (storageError) {
        // If localStorage is corrupted or decryption fails, log and continue with empty data
        console.warn('[TenantSettings] Failed to load local onboarding data, using API data only:', storageError);
        // The OnboardingStorageService.load() method already clears corrupted data, so we don't need to do it here
      }

      // Merge: API data as base, localStorage overrides
      const merged = { ...apiData, ...localData };

      // Sanitize and normalize
      const sanitized = onboardingDataService.sanitizeData(merged);
      const normalized = onboardingDataService.normalizeData(sanitized);

//      console.log('[TenantSettings] Onboarding data loaded:', normalized);
      return normalized;
    } catch (err) {
      console.error('[TenantSettings] Failed to load onboarding data:', err);
      return {};
    }
  };

  const mergeProfileData = async (profileData: BusinessProfile | null) => {
    const onboardingData = await loadOnboardingData();
    //console.log('[TenantSettings] Onboarding data:', onboardingData);
    //console.log('[TenantSettings] Profile data:', profileData);
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
      slug: (profileData as any).slug || (onboardingData as any).slug || '',
    };
    
    //console.log('[TenantSettings] Merged profile data:', merged);
    setMergedProfile(merged);
  };

  const loadProfile = async () => {
    try {
      const data = await platformHomeService.getTenantProfile(tenantId);
      
      if (data) {
        setProfile(data as BusinessProfile);
        // Merge with onboarding data
        await mergeProfileData(data as BusinessProfile);
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
      const data = await platformHomeService.getTenant(tenantId);
      
      if (data) {
        setTenantName(data.name || '');
      }
    } catch (error) {
      console.error('Failed to load tenant name:', error);
    }
  };

  const handleUpdate = async (updatedProfile: BusinessProfile) => {
    //console.log('[TenantSettings] handleUpdate called with:', updatedProfile);
    try {
      const data = await platformHomeService.updateTenantProfile(tenantId, updatedProfile as any);
      
      if (data) {
        setProfile(data as BusinessProfile);
        setMergedProfile(data as BusinessProfile); // Update merged profile with saved data
        
        // Update localStorage to keep it in sync with database changes
        await onboardingStorageService.updateBusinessData(tenantId, data as BusinessProfile);
        
        // Reload the profile data to ensure we have the latest from server
        loadProfile();
      } else {
        console.error('Failed to update profile: No response data');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
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

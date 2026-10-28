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
import { mergeTenantProfile } from '@/lib/settings/tenant-profile-merge';
import { clientLogger } from '@/lib/client-logger';




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
        clientLogger.warn('[TenantSettings] Failed to load local onboarding data, using API data only:', { detail: storageError });
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
      clientLogger.error('[TenantSettings] Failed to load onboarding data:', { detail: err });
      return {};
    }
  };

  const mergeProfileData = async (profileData: BusinessProfile | null) => {
    const onboardingData = await loadOnboardingData();
    //console.log('[TenantSettings] Onboarding data:', onboardingData);
    //console.log('[TenantSettings] Profile data:', profileData);
    // Profile wins, onboarding fills the gaps. The helper carries every field
    // the readiness score reads (hours/seo_tags included) so the card can't
    // under-report a profile that has them stored.
    setMergedProfile(mergeTenantProfile(profileData, onboardingData));
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
      clientLogger.error('Failed to load profile:', { detail: error });
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
      clientLogger.error('Failed to load tenant name:', { detail: error });
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
        clientLogger.error('Failed to update profile: No response data');
      }
    } catch (error) {
      clientLogger.error('Failed to update profile:', { detail: error });
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
          tenantId={tenantId}
        />
        
        {/* GBP Location Linking */}
        <GBPLocationCard tenantId={tenantId} />
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import BusinessProfileCard from '@/components/settings/BusinessProfileCard';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { api } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { Spinner } from '@/components/ui';

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

  useEffect(() => {
    loadProfile();
    loadTenantName();
  }, [tenantId]);

  const loadProfile = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/tenant/profile?tenantId=${encodeURIComponent(tenantId)}`);
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
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
      const response = await api.post(`${apiBaseUrl}/tenant/profile`, {
        ...updatedProfile,
        tenantId,
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        // Reload the profile data to ensure we have the latest from server
        loadProfile();
      } else {
        console.error('Failed to update profile:', response.statusText);
        // Still update local state for UI feedback, but it will be overwritten when loadProfile() completes
        setProfile(updatedProfile);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      // Update local state for UI feedback even if API call fails
      setProfile(updatedProfile);
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
          profile={profile} 
          loading={loading}
          onUpdate={handleUpdate}
          tenantName={tenantName}
        />
      </div>
    </div>
  );
}

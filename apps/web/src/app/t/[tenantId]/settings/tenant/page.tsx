'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import BusinessProfileCard from '@/components/settings/BusinessProfileCard';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { api } from '@/lib/api';

export default function TenantBusinessProfilePage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [tenantId]);

  const loadProfile = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/tenant/${encodeURIComponent(tenantId)}/profile`);
      
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

  const handleUpdate = (updatedProfile: BusinessProfile) => {
    setProfile(updatedProfile);
  };

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
        />
      </div>
    </div>
  );
}

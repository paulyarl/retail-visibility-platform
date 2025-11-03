'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import GBPCategoryCard from '@/components/settings/GBPCategoryCard';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui';

export default function GBPCategoryPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await api.get(`/api/tenant/profile?tenant_id=${tenantId}`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (error) {
        console.error('[GBPCategoryPage] Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      loadProfile();
    }
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageHeader
        title="Google Business Profile Category"
        description="Manage your primary business category for Google Business Profile"
      />

      <div className="mt-6">
        <GBPCategoryCard
          tenantId={tenantId}
          initialCategory={
            profile?.gbpCategoryId && profile?.gbpCategoryName
              ? { id: profile.gbpCategoryId, name: profile.gbpCategoryName }
              : null
          }
          syncStatus={profile?.gbpCategorySyncStatus}
          lastMirrored={profile?.gbpCategoryLastMirrored}
        />
      </div>
    </div>
  );
}

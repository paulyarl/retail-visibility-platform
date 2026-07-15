'use client';

import { useState, useCallback } from 'react';
import { directorySupportService } from '@/services/DirectorySupportSingletonService';

export interface DirectoryStatus {
  tenant: {
    id: string;
    name: string;
    subscriptionTier: string;
    subscriptionStatus: string;
  };
  settings: {
    isPublished: boolean;
  };
  profile: {
    businessName?: string;
    city?: string;
    state?: string;
    phoneNumber?: string;
    email?: string;
    website?: string;
    logoUrl?: string;
    hours?: any;
  } | null;
  itemCount: number;
  isFeatured: boolean;
  featuredUntil?: string;
}

export interface QualityCheck {
  completenessPercent: number;
  checks: Record<string, boolean>;
  recommendations: string[];
  itemCount: number;
  canPublish: boolean;
}

export interface SupportNote {
  id: string;
  note: string;
  createdAt: string;
  createdByUser: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

export function useDirectorySupport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatus = useCallback(async (tenantId: string): Promise<DirectoryStatus | null> => {
    try {
      setLoading(true);
      setError(null);

      const status = await directorySupportService.getDirectoryStatus(tenantId);
      return status;
    } catch (error) {
      console.error('Failed to get directory status:', error);
      setError('Failed to get directory status');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkQuality = useCallback(async (tenantId: string): Promise<QualityCheck | null> => {
    try {
      setLoading(true);
      setError(null);

      const qualityCheck = await directorySupportService.getDirectoryQualityCheck(tenantId);
      return qualityCheck;
    } catch (err) {
      console.error('Error checking quality:', err);
      setError(err instanceof Error ? err.message : 'Failed to check quality');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getNotes = useCallback(async (tenantId: string): Promise<SupportNote[]> => {
    try {
      setLoading(true);
      setError(null);

      const notes = await directorySupportService.getDirectoryNotes(tenantId);
      return notes || [];
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notes');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const addNote = useCallback(async (tenantId: string, note: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const result = await directorySupportService.addDirectoryNote(tenantId, note);
      return !!result;
    } catch (err) {
      console.error('Error adding note:', err);
      setError(err instanceof Error ? err.message : 'Failed to add note');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchTenants = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await directorySupportService.searchDirectory(query);
      const tenants = response?.data?.tenants || response?.tenants || [];
      return tenants.map((t: any) => ({
        ...t,
        subscriptionTier: t.subscription_tier,
        subscriptionStatus: t.subscription_status,
        businessProfile: t.tenant_business_profiles_list
          ? {
              ...t.tenant_business_profiles_list,
              businessName: t.tenant_business_profiles_list.business_name,
            }
          : undefined,
        directorySettings: t.directory_settings_list
          ? {
              ...t.directory_settings_list,
              isPublished: t.directory_settings_list.is_published,
              isFeatured: t.directory_settings_list.is_featured,
            }
          : undefined,
      }));
    } catch (err) {
      console.error('Error searching tenants:', err);
      setError(err instanceof Error ? err.message : 'Failed to search');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getStatus,
    checkQuality,
    getNotes,
    addNote,
    searchTenants,
  };
}

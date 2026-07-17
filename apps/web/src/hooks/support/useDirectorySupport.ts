'use client';

import { useState, useCallback } from 'react';
import { directorySupportService } from '@/services/DirectorySupportSingletonService';
import { clientLogger } from '@/lib/client-logger';

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

      const raw = await directorySupportService.getDirectoryStatus(tenantId) as any;
      if (!raw) return null;
      return {
        ...raw,
        tenant: {
          ...raw.tenant,
          subscriptionTier: raw.tenant?.subscription_tier,
          subscriptionStatus: raw.tenant?.subscription_status,
        },
        settings: {
          ...raw.settings,
          isPublished: raw.settings?.is_published ?? false,
          isFeatured: raw.settings?.is_featured ?? false,
        },
        profile: raw.profile
          ? { ...raw.profile, businessName: raw.profile.business_name }
          : null,
      };
    } catch (error) {
      clientLogger.error('Failed to get directory status:', { detail: error });
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
      clientLogger.error('Error checking quality:', { detail: err });
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

      const raw = await directorySupportService.getDirectoryNotes(tenantId) as any;
      if (!raw) return [];
      const notes = Array.isArray(raw) ? raw : (raw.notes || []);
      return notes.map((n: any) => ({
        ...n,
        createdAt: n.created_at || n.createdAt,
        createdBy: n.created_by || n.createdBy,
      }));
    } catch (err) {
      clientLogger.error('Error fetching notes:', { detail: err });
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
      clientLogger.error('Error adding note:', { detail: err });
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
      clientLogger.error('Error searching tenants:', { detail: err });
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

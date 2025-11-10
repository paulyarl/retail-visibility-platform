'use client';

import { useState, useCallback } from 'react';

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

      const response = await fetch(`/api/support/directory/tenant/${tenantId}/status`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }

      return await response.json();
    } catch (err) {
      console.error('Error fetching directory status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load status');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkQuality = useCallback(async (tenantId: string): Promise<QualityCheck | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/support/directory/tenant/${tenantId}/quality-check`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check quality');
      }

      return await response.json();
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

      const response = await fetch(`/api/support/directory/tenant/${tenantId}/notes`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }

      const data = await response.json();
      return data.notes || [];
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

      const response = await fetch(`/api/support/directory/tenant/${tenantId}/add-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ note }),
      });

      if (!response.ok) {
        throw new Error('Failed to add note');
      }

      return true;
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

      const response = await fetch(`/api/support/directory/search?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to search');
      }

      const data = await response.json();
      return data.tenants || [];
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

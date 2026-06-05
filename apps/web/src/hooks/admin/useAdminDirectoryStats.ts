'use client';

import { useState, useEffect } from 'react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

export interface DirectoryStats {
  total: number;
  published: number;
  featured: number;
  draft: number;
  byTier: Record<string, number>;
}

export interface AdminDirectoryStatsHook {
  stats: DirectoryStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAdminDirectoryStats(): AdminDirectoryStatsHook {
  const [stats, setStats] = useState<DirectoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const stats = await platformHomeService.getAdminDirectoryStats();
      setStats(stats);
    } catch (err) {
      console.error('Failed to fetch directory stats:', err);
      setError('Failed to fetch directory stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    loading,
    error,
    refresh: fetchStats,
  };
}

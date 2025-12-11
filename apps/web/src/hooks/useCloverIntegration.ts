'use client';

import { useState, useEffect, useCallback } from 'react';
import { CloverStatus } from '@/components/clover';
import { useAuth } from '@/contexts/AuthContext';

interface CloverIntegrationData {
  enabled: boolean;
  mode: 'demo' | 'production' | null;
  status: string | null;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  demoEnabledAt?: string;
  demoLastActiveAt?: string;
  lastSyncAt?: string;
}

interface UseCloverIntegrationResult {
  // State
  data: CloverIntegrationData | null;
  loading: boolean;
  error: string | null;
  
  // Computed
  cloverStatus: CloverStatus;
  isConnected: boolean;
  isDemoMode: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  enableDemo: () => Promise<void>;
  disableDemo: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sync: () => Promise<void>;
}

export function useCloverIntegration(tenantId: string): UseCloverIntegrationResult {
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<CloverIntegrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute Clover status from data
  const getCloverStatus = useCallback((): CloverStatus => {
    if (!data) return 'disconnected';
    if (!data.enabled) return 'disconnected';
    if (data.mode === 'demo') return 'demo';
    if (data.status === 'error') return 'error';
    if (data.status === 'syncing') return 'syncing';
    return 'connected';
  }, [data]);

  const cloverStatus = getCloverStatus();
  const isConnected = data?.enabled || false;
  const isDemoMode = data?.mode === 'demo';

  // Fetch integration status
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/clover/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch integration status');
      }
      
      const responseData = await res.json();
      setData(responseData);
    } catch (err: any) {
      console.error('Failed to fetch Clover status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Enable demo mode
  const enableDemo = useCallback(async () => {
    try {
      setError(null);
      
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/clover/demo/enable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to enable demo mode');
      }
      
      const responseData = await res.json();
      
      // Show success message
      if (typeof window !== 'undefined') {
        alert(`Demo mode enabled! ${responseData.itemsImported} items imported.`);
      }
      
      // Refresh status
      await refresh();
    } catch (err: any) {
      console.error('Failed to enable demo:', err);
      setError(err.message);
      throw err;
    }
  }, [tenantId, refresh]);

  // Disable demo mode
  const disableDemo = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const confirmed = confirm(
        'Are you sure you want to disable demo mode? This will remove all demo items from your inventory.'
      );
      
      if (!confirmed) return;
    }
    
    try {
      setError(null);
      
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/clover/demo/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keepItems: false })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to disable demo mode');
      }
      
      const responseData = await res.json();
      
      // Show success message
      if (typeof window !== 'undefined') {
        alert(`Demo mode disabled. ${responseData.itemsDeleted} items removed.`);
      }
      
      // Refresh status
      await refresh();
    } catch (err: any) {
      console.error('Failed to disable demo:', err);
      setError(err.message);
      throw err;
    }
  }, [tenantId, refresh]);

  // Connect Clover account (OAuth)
  const connect = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch authorization URL
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/clover/oauth/authorize`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to initiate OAuth flow');
      }
      
      const responseData = await res.json();
      
      // Redirect to Clover authorization page
      if (typeof window !== 'undefined' && responseData.authorizationUrl) {
        window.location.href = responseData.authorizationUrl;
      }
    } catch (err: any) {
      console.error('Failed to connect Clover:', err);
      setError(err.message);
      throw err;
    }
  }, [tenantId]);

  // Disconnect Clover account
  const disconnect = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const confirmed = confirm(
        'Are you sure you want to disconnect Clover? This will stop syncing your inventory.'
      );
      
      if (!confirmed) return;
    }
    
    try {
      setError(null);
      
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/clover/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to disconnect');
      }
      
      // Show success message
      if (typeof window !== 'undefined') {
        alert('Clover disconnected successfully.');
      }
      
      // Refresh status
      await refresh();
    } catch (err: any) {
      console.error('Failed to disconnect:', err);
      setError(err.message);
      throw err;
    }
  }, [tenantId, refresh]);

  // Trigger manual sync
  const sync = useCallback(async () => {
    try {
      setError(null);
      
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/clover/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to sync');
      }
      
      // Show success message
      if (typeof window !== 'undefined') {
        alert('Sync started successfully. This may take a few minutes.');
      }
      
      // Refresh status
      await refresh();
    } catch (err: any) {
      console.error('Failed to sync:', err);
      setError(err.message);
      throw err;
    }
  }, [tenantId, refresh]);

  // Initial load and OAuth callback handling
  useEffect(() => {
    if (!tenantId) return;
    
    // Check for OAuth callback status
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const errorParam = urlParams.get('error');
      const message = urlParams.get('message');
      
      if (success === 'connected') {
        alert('Successfully connected to Clover! Your inventory will sync shortly.');
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      } else if (errorParam) {
        const errorMessage = message || errorParam;
        setError(`Connection failed: ${errorMessage}`);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    
    refresh();
  }, [tenantId, refresh]);

  return {
    data,
    loading,
    error,
    cloverStatus,
    isConnected,
    isDemoMode,
    refresh,
    enableDemo,
    disableDemo,
    connect,
    disconnect,
    sync,
  };
}

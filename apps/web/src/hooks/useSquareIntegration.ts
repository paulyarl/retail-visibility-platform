'use client';

import { useState, useEffect, useCallback } from 'react';
import { SquareStatus } from '@/components/square';
import { useAuth } from '@/contexts/AuthContext';

interface SquareIntegrationData {
  enabled: boolean;
  status: string | null;
  stats?: {
    totalItems: number;
    mappedItems: number;
    conflictItems: number;
  };
  lastSyncAt?: string;
  merchantId?: string;
}

interface UseSquareIntegrationResult {
  // State
  data: SquareIntegrationData | null;
  loading: boolean;
  error: string | null;
  
  // Computed
  squareStatus: SquareStatus;
  isConnected: boolean;
  
  // Actions
  refresh: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sync: () => Promise<void>;
}

export function useSquareIntegration(tenantId: string): UseSquareIntegrationResult {
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<SquareIntegrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute Square status from data
  const getSquareStatus = useCallback((): SquareStatus => {
    if (!data) return 'disconnected';
    if (!data.enabled) return 'disconnected';
    if (data.status === 'error') return 'error';
    if (data.status === 'syncing') return 'syncing';
    return 'connected';
  }, [data]);

  const squareStatus = getSquareStatus();
  const isConnected = data?.enabled || false;

  // Fetch integration status
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/square/status`, {
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
      console.error('Failed to fetch Square status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Connect Square account (OAuth)
  const connect = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch authorization URL
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/square/oauth/authorize`, {
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
      
      // Redirect to Square authorization page
      if (typeof window !== 'undefined' && responseData.authorizationUrl) {
        window.location.href = responseData.authorizationUrl;
      }
    } catch (err: any) {
      console.error('Failed to connect Square:', err);
      setError(err.message);
      throw err;
    }
  }, [tenantId]);

  // Disconnect Square account
  const disconnect = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const confirmed = confirm(
        'Are you sure you want to disconnect Square? This will stop syncing your inventory.'
      );
      
      if (!confirmed) return;
    }
    
    try {
      setError(null);
      
      const token = getAccessToken();
      const res = await fetch(`/api/integrations/${tenantId}/square/disconnect`, {
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
        alert('Square disconnected successfully.');
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
      const res = await fetch(`/api/integrations/${tenantId}/square/sync`, {
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
        alert('Successfully connected to Square! Your inventory will sync shortly.');
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
    squareStatus,
    isConnected,
    refresh,
    connect,
    disconnect,
    sync,
  };
}

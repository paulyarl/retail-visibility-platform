'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, Loader2, AlertTriangle } from 'lucide-react';

interface CleanupScanSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Tenant {
  id: string;
  name: string;
  city?: string;
  state?: string;
}

export default function CleanupScanSessionsModal({ isOpen, onClose }: CleanupScanSessionsModalProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingTenants, setFetchingTenants] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sessionStats, setSessionStats] = useState<{ active: number; total: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTenants();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTenantId) {
      fetchSessionStats();
    } else {
      setSessionStats(null);
    }
  }, [selectedTenantId]);

  const fetchTenants = async () => {
    setFetchingTenants(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${apiUrl}/tenants`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch tenants');
      const data = await response.json();
      // API returns array directly, not wrapped in { data: [...] }
      setTenants(Array.isArray(data) ? data : (data.data || []));
    } catch (err) {
      setError('Failed to load tenants');
    } finally {
      setFetchingTenants(false);
    }
  };

  const fetchSessionStats = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${apiUrl}/api/admin/scan-sessions/stats?tenantId=${selectedTenantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch session stats');
      const data = await response.json();
      setSessionStats(data);
    } catch (err) {
      console.error('Failed to fetch session stats:', err);
    }
  };

  const handleCleanup = async () => {
    if (!selectedTenantId) {
      setError('Please select a tenant');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${apiUrl}/api/admin/scan-sessions/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tenantId: selectedTenantId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to cleanup sessions');
      }

      const result = await response.json();
      setSuccess(`✅ Cleaned up ${result.cleaned} active scan sessions`);
      
      // Refresh stats
      await fetchSessionStats();
      
      // Reset after 2 seconds
      setTimeout(() => {
        setSelectedTenantId('');
        setSuccess('');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to cleanup sessions');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Cleanup Scan Sessions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Close active scan sessions for a tenant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Warning */}
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1">
                  About Scan Session Cleanup
                </h4>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  This tool closes all active scan sessions for a tenant. Use this when sessions are stuck or 
                  when a tenant hits the rate limit (50 active sessions). Sessions will be marked as "cancelled".
                </p>
              </div>
            </div>
          </div>

          {/* Tenant Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Tenant
            </label>
            {fetchingTenants ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <select
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                disabled={loading}
              >
                <option value="">-- Select a tenant --</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} {tenant.city && tenant.state ? `(${tenant.city}, ${tenant.state})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Session Stats */}
          {sessionStats && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Current Session Stats
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Active Sessions</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {sessionStats.active}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Total Sessions</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {sessionStats.total}
                  </p>
                </div>
              </div>
              {sessionStats.active >= 50 && (
                <div className="mt-3 text-xs text-red-600 dark:text-red-400 font-medium">
                  ⚠️ Rate limit reached! Cleanup recommended.
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleCleanup}
            disabled={loading || !selectedTenantId}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cleaning up...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Cleanup Sessions
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

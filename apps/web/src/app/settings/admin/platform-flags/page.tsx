"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Alert } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import ProtectedRoute from '@/components/ProtectedRoute';

type PlatformFlag = {
  id: string;
  flag: string;
  enabled: boolean;
  rollout: string | null;
  allowTenantOverride: boolean;
  updatedAt: string;
};

export default function PlatformFlagsPage() {
  const [flags, setFlags] = useState<PlatformFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/platform-flags', { 
        cache: 'no-store',
        credentials: 'include' 
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      
      setFlags(data.data || []);
    } catch (err) {
      console.error('[Platform Flags] Load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load flags');
    } finally {
      setLoading(false);
    }
  };

  const updateFlag = async (flag: string, updates: Partial<PlatformFlag>) => {
    try {
      setSaving(flag);
      setError(null);
      
      const res = await fetch('/api/admin/platform-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag, ...updates }),
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      
      setSuccess(`${flag} updated successfully`);
      setTimeout(() => setSuccess(null), 3000);
      await loadFlags();
    } catch (err) {
      console.error('[Platform Flags] Update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update flag');
    } finally {
      setSaving(null);
    }
  };

  const addFlag = async () => {
    const flag = prompt('Enter flag key (e.g., FF_NEW_FEATURE)')?.trim();
    if (!flag) return;
    
    if (!flag.startsWith('FF_')) {
      setError('Flag must start with FF_');
      return;
    }
    
    await updateFlag(flag, { enabled: false, allowTenantOverride: false });
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading flags...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Platform Feature Flags"
          description="Control feature rollout and tenant override permissions (Database-backed)"
          icon={Icons.Settings}
          backLink={{
            href: '/settings',
            label: 'Back to Settings'
          }}
          actions={
            <button 
              onClick={addFlag}
              className="bg-black text-white px-4 py-2 rounded hover:bg-neutral-800"
            >
              Add Flag
            </button>
          }
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <Alert variant="error" className="mb-6" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" className="mb-6" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Info Alert */}
          <Alert variant="info" title="Database-Backed Flags" className="mb-6">
            <div className="text-sm space-y-2">
              <p>
                These flags are stored in the database and persist across sessions. Changes affect all users immediately.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Enabled:</strong> Feature is active platform-wide</li>
                <li><strong>Allow Tenant Override:</strong> Tenants can enable even if platform disabled</li>
                <li><strong>Rollout Notes:</strong> Document rollout strategy or pilot details</li>
              </ul>
            </div>
          </Alert>

          {flags.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-neutral-500 mb-4">No flags yet. Add your first flag to get started.</p>
                <button 
                  onClick={addFlag}
                  className="bg-black text-white px-4 py-2 rounded hover:bg-neutral-800"
                >
                  Add First Flag
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {flags.map((flag) => (
                <Card key={flag.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-neutral-900">
                            {flag.flag}
                          </h3>
                          <Badge variant={flag.enabled ? "success" : "default"}>
                            {flag.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          {flag.allowTenantOverride && (
                            <Badge variant="info">
                              Tenant Override Allowed
                            </Badge>
                          )}
                        </div>
                        
                        {/* Rollout Notes */}
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Rollout notes (e.g., Pilot: 5 tenants)"
                            defaultValue={flag.rollout || ''}
                            onBlur={(e) => updateFlag(flag.flag, { rollout: e.target.value || null })}
                            disabled={saving === flag.flag}
                            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>

                        {/* Tenant Override Checkbox */}
                        <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
                          <input
                            type="checkbox"
                            id={`override-${flag.flag}`}
                            checked={flag.allowTenantOverride}
                            onChange={(e) => updateFlag(flag.flag, { allowTenantOverride: e.target.checked })}
                            disabled={saving === flag.flag}
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded"
                          />
                          <label htmlFor={`override-${flag.flag}`} className="text-sm text-neutral-700 cursor-pointer">
                            Allow tenants to override this flag (enable even when platform disabled)
                          </label>
                        </div>

                        {saving === flag.flag && (
                          <p className="text-xs text-neutral-500 mt-2">Saving...</p>
                        )}
                      </div>

                      {/* Toggle Switch */}
                      <div className="flex items-center gap-4 ml-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={flag.enabled}
                            onChange={(e) => updateFlag(flag.flag, { enabled: e.target.checked })}
                            disabled={saving === flag.flag}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Legacy System Notice */}
          <Card className="mt-8 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Legacy System Available
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-800">
                The old localStorage-based flags system is still available at{' '}
                <Link href="/settings/admin/features" className="font-medium underline">
                  /settings/admin/features
                </Link>
                {' '}for backward compatibility. Consider migrating all flags to this DB-backed system.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

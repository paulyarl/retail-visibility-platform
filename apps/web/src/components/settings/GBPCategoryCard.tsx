'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import GBPCategorySelectorAdapter from './GBPCategorySelectorAdapter';
import { api } from '@/lib/api';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface SelectedCategory {
  id: string;
  name: string;
}

interface GBPCategoryCardProps {
  tenantId: string;
  initialPrimary?: SelectedCategory | null;
  initialSecondary?: SelectedCategory[];
  syncStatus?: string | null;
  lastSynced?: string | null;
}

interface CategoryMapping {
  gbpCategoryId: string;
  gbpCategoryName: string;
  platformCategory: {
    id: string;
    name: string;
    slug: string;
    icon: string;
  } | null;
  mappingConfidence: string;
  isMapped: boolean;
}

export default function GBPCategoryCard({
  tenantId,
  initialPrimary,
  initialSecondary = [],
  syncStatus,
  lastSynced,
}: GBPCategoryCardProps) {
  const [primary, setPrimary] = useState<SelectedCategory | null>(initialPrimary || null);
  const [secondary, setSecondary] = useState<SelectedCategory[]>(initialSecondary);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [loadingMappings, setLoadingMappings] = useState(false);

  // Load mappings on mount if categories exist
  useEffect(() => {
    if (primary || secondary.length > 0) {
      const allCategories = primary ? [primary, ...secondary] : secondary;
      fetchMappings(allCategories);
    }
  }, []); // Only run on mount

  const fetchMappings = async (categories: SelectedCategory[]) => {
    if (categories.length === 0) {
      setMappings([]);
      return;
    }

    try {
      setLoadingMappings(true);
      const categoryIds = categories.map(c => c.id).join(',');
      console.log('[GBPCategoryCard] Fetching mappings for:', categoryIds);
      const response = await api.get(`/api/gbp/mappings?categoryIds=${encodeURIComponent(categoryIds)}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[GBPCategoryCard] Mappings received:', data.mappings);
        setMappings(data.mappings || []);
      } else {
        console.error('[GBPCategoryCard] Failed to fetch mappings:', response.status);
      }
    } catch (err) {
      console.error('[GBPCategoryCard] Failed to fetch mappings:', err);
    } finally {
      setLoadingMappings(false);
    }
  };

  const handleSave = async () => {
    if (!primary) {
      setError('Please select a primary category');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await api.put('/api/tenant/gbp-category', {
        tenantId,
        primary: {
          id: primary.id,
          name: primary.name,
        },
        secondary: secondary.map(s => ({
          id: s.id,
          name: s.name,
        })),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save GBP categories');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Fetch mappings after successful save
      const allCategories = [primary, ...secondary];
      await fetchMappings(allCategories);
    } catch (err) {
      console.error('[GBPCategoryCard] Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save categories');
    } finally {
      setSaving(false);
    }
  };

  const getSyncStatusDisplay = () => {
    if (!syncStatus) return null;

    const statusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
      synced: { 
        icon: <CheckCircle2 className="w-4 h-4" />, 
        label: 'Synced', 
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
      },
      pending: { 
        icon: <Clock className="w-4 h-4" />, 
        label: 'Pending', 
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' 
      },
      error: { 
        icon: <AlertCircle className="w-4 h-4" />, 
        label: 'Error', 
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' 
      },
    };

    const config = statusConfig[syncStatus] || statusConfig.pending;

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.icon}
        {config.label}
      </div>
    );
  };

  const totalCategories = (primary ? 1 : 0) + secondary.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Google Business Profile Categories</CardTitle>
            <CardDescription>
              Select your primary category and up to 9 secondary categories
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getSyncStatusDisplay()}
            {totalCategories > 0 && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {totalCategories} {totalCategories === 1 ? 'category' : 'categories'}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <GBPCategorySelectorAdapter
            tenantId={tenantId}
            primary={primary}
            secondary={secondary}
            onPrimaryChange={setPrimary}
            onSecondaryChange={setSecondary}
            disabled={saving}
          />

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Categories saved successfully!
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  Your categories will sync to your directory listing automatically.
                </p>
              </div>
            </div>
          )}

          {lastSynced && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last synced: {new Date(lastSynced).toLocaleString()}
            </p>
          )}

          {/* Category Mappings Display */}
          {mappings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Directory Category Mappings
              </h4>
              <div className="space-y-2">
                {mappings.map((mapping) => (
                  <div
                    key={mapping.gbpCategoryId}
                    className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {mapping.gbpCategoryName}
                      </p>
                      {mapping.isMapped && mapping.platformCategory ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-neutral-600 dark:text-neutral-400">
                            Maps to:
                          </span>
                          <a
                            href={`/directory/categories/${mapping.platformCategory.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium flex items-center gap-1"
                          >
                            {mapping.platformCategory.icon} {mapping.platformCategory.name}
                            <span className="text-[10px]">↗</span>
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          ⚠️ No platform category mapping
                        </p>
                      )}
                    </div>
                    <div>
                      {mapping.isMapped ? (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          mapping.mappingConfidence === 'exact'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : mapping.mappingConfidence === 'close'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                        }`}>
                          {mapping.mappingConfidence}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
                          unmapped
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {mappings.some(m => !m.isMapped) && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> Some categories don't have platform mappings yet. Your store won't appear in those category pages until mappings are added.
                  </p>
                </div>
              )}
            </div>
          )}

          {loadingMappings && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
              <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">Loading mappings...</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !primary}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save & Sync to Directory'}
            </button>

            {(primary || secondary.length > 0) && (
              <button
                onClick={() => {
                  setPrimary(null);
                  setSecondary([]);
                }}
                disabled={saving}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

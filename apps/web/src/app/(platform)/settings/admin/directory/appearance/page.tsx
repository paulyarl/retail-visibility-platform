'use client';

/**
 * Directory Appearance Admin Page
 *
 * 3-card picker for directory home layout variant (discovery/editorial/immersive).
 * Saves to platform settings via platformSettingsService.updatePlatformSettings().
 * Links to /directory?layout_preview=<variant> for live preview.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import {
  DIRECTORY_LAYOUT_META,
  type DirectoryLayoutKey,
} from '@/components/directory/redesign/types';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

export default function DirectoryAppearancePage() {
  const [currentLayout, setCurrentLayout] = useState<DirectoryLayoutKey>('discovery');
  const [savedLayout, setSavedLayout] = useState<DirectoryLayoutKey>('discovery');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await platformSettingsService.getPlatformSettings();
        const stored = settings.features?.directoryHomeLayout as string | undefined;
        if (stored && ['discovery', 'editorial', 'immersive'].includes(stored)) {
          setCurrentLayout(stored as DirectoryLayoutKey);
          setSavedLayout(stored as DirectoryLayoutKey);
        }
      } catch (err) {
        clientLogger.error('Failed to load platform settings:', { detail: err });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await platformSettingsService.updatePlatformSettings({
        features: { directoryHomeLayout: currentLayout },
      } as any);
      if (result) {
        setSavedLayout(currentLayout);
        setMessage({ type: 'success', text: 'Directory home layout saved successfully.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save layout. Please try again.' });
      }
    } catch (err) {
      clientLogger.error('Failed to save directory layout:', { detail: err });
      setMessage({ type: 'error', text: 'An error occurred while saving.' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = currentLayout !== savedLayout;

  const variants: DirectoryLayoutKey[] = ['discovery', 'editorial', 'immersive'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Directory Home Appearance"
        description="Choose the layout variant for the public directory home page. This is a platform-wide setting."
        actions={
          <Link
            href="/settings/admin/directory/listings"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ← Directory Panel
          </Link>
        }
      />

      {/* Layout picker cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {variants.map((key) => {
          const meta = DIRECTORY_LAYOUT_META[key];
          const isSelected = currentLayout === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCurrentLayout(key)}
              disabled={loading}
              className={`relative flex flex-col items-start p-6 rounded-2xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
              } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {isSelected && (
                <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
              )}
              <div className="text-3xl mb-3">{meta.icon}</div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                {meta.label}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {meta.description}
              </p>
              {/* Preview link */}
              <Link
                href={`/directory?layout_preview=${key}`}
                target="_blank"
                className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                Preview →
              </Link>
            </button>
          );
        })}
      </div>

      {/* Save bar */}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving || loading}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Layout'}
        </button>
        {hasChanges && !saving && (
          <button
            onClick={() => setCurrentLayout(savedLayout)}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            Cancel
          </button>
        )}
        {message && (
          <span
            className={`text-sm font-medium ${
              message.type === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {message.text}
          </span>
        )}
      </div>

      {/* Info note */}
      <div className="mt-8 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          The directory home layout is a platform-wide admin setting. All visitors
          will see the selected variant. Use the preview links to test each layout
          before saving. The <code className="text-blue-600 dark:text-blue-400">?layout_preview=</code>
          query parameter overrides the saved setting for the current session only.
        </p>
      </div>
    </div>
  );
}

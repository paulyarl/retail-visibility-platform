'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@mantine/core';

interface QualityCheck {
  completenessPercent: number;
  checks: Record<string, boolean>;
  recommendations: string[];
  itemCount: number;
  canPublish: boolean;
}

const CHECK_LABELS: Record<string, string> = {
  business_name: 'Business Name',
  address: 'Street Address',
  cityState: 'City & State',
  phone: 'Phone Number',
  email: 'Email Address',
  website: 'Website URL',
  logo: 'Business Logo',
  hours: 'Business Hours',
  description: 'SEO Description (100+ chars)',
  category: 'Primary Category',
  hasItems: 'Has Products',
  hasMultipleItems: '10+ Products',
};

export default function DirectoryHealthClient({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<QualityCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQualityCheck = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/tenants/${tenantId}/directory/quality-check`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quality check');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchQualityCheck();
  }, [fetchQualityCheck]);

  const score = data?.completenessPercent ?? 0;
  const scoreColor = score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const ringColor = score >= 80 ? 'border-emerald-500' : score >= 50 ? 'border-amber-500' : 'border-red-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Directory Health</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Check your directory listing completeness and get recommendations
          </p>
        </div>
        <Link href={`/t/${tenantId}/settings/directory`}>
          <Button variant="outline" size="sm">Back to Directory Settings</Button>
        </Link>
      </div>

      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Running quality check...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-red-700 dark:text-red-300 font-medium">Error</p>
          <p className="text-red-600 dark:text-red-400 text-sm mt-1">{error}</p>
          <Button variant="outline" color="red" size="sm" className="mt-3" onClick={fetchQualityCheck}>Retry</Button>
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/* Score Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-6">
              <div className={`flex-shrink-0 w-24 h-24 rounded-full border-4 ${ringColor} flex items-center justify-center`}>
                <span className={`text-2xl font-bold ${scoreColor}`}>{score}%</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Completeness Score</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {score >= 80
                    ? 'Your directory listing is in great shape!'
                    : score >= 50
                    ? 'Your listing needs some improvements to attract more customers.'
                    : 'Your listing is missing key information. Add more details to improve visibility.'}
                </p>
                <div className="mt-2 flex gap-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {data.itemCount} products
                  </span>
                  {data.canPublish ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                      Ready to publish
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                      Not ready to publish
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Checklist</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(data.checks).map(([key, passed]) => (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  {passed ? (
                    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className={`text-sm ${passed ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                    {CHECK_LABELS[key] || key}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recommendations</h3>
              <ul className="space-y-2">
                {data.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {rec}
                  </li>
                ))}
              </ul>
              <Link href={`/t/${tenantId}/settings/directory`} className="mt-4 inline-block">
                <Button variant="filled" size="sm">Improve Your Listing</Button>
              </Link>
            </div>
          )}

          {/* Refresh */}
          <div className="flex justify-end">
            <Button variant="subtle" size="sm" onClick={fetchQualityCheck} loading={loading}>
              Re-run Check
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { googleProductTaxonomyService, GoogleCategoryCoverage } from '@/services/GoogleProductTaxonomyService';
import { clientLogger } from '@/lib/client-logger';

export default function CategoryCoverageBadge() {
  const [coverage, setCoverage] = useState<GoogleCategoryCoverage | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCoverage = async () => {
    try {
      setLoading(true);
      const data = await googleProductTaxonomyService.getCoverage();
      setCoverage(data);
    } catch (err) {
      clientLogger.error('[CategoryCoverageBadge] Error:', { detail: err });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoverage();
  }, []);

  if (loading) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        Loading coverage...
      </span>
    );
  }

  if (!coverage) {
    return null;
  }

  const { mapped, total, coveragePercent } = coverage;
  const colorClass = coveragePercent === 100
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : coveragePercent >= 50
    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {mapped} of {total} mapped ({coveragePercent}%)
    </span>
  );
}

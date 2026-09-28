'use client';

/**
 * ProspectReportClient — public owner-facing report page.
 *
 * The signed token in the URL IS the capability: fetch the public DTO and
 * render the shared ProspectReportView. Mirrors SeedReportClient's
 * fetch-then-render shape without the seed-report header/footer chrome —
 * the report carries its own provenance footer and CTA.
 */

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import prospectReportPublicService, {
  ProspectReport,
} from '@/services/ProspectReportPublicService';
import ProspectReportView from '@/components/marketing-ops/ProspectReportView';

export default function ProspectReportClient() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [report, setReport] = useState<ProspectReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setInvalid(true);
        setLoading(false);
        return;
      }
      const data = await prospectReportPublicService.getReport(token);
      if (cancelled) return;
      if (data) {
        setReport(data);
      } else {
        setInvalid(true);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading report...</p>
      </div>
    );
  }

  if (invalid || !report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md px-4">
          <h1 className="text-lg font-semibold text-gray-900">Report not available</h1>
          <p className="text-sm text-gray-600 mt-2">
            This report link is invalid or no longer active. If you were sent this
            link, please contact the person who shared it with you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 py-8">
      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-sm">
        <ProspectReportView report={report} />
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, Store, Copy, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { DemoStorefrontResult } from '@/services/MarketingOpsService';

export default function DemoStorefrontClient({ campaignId }: { campaignId: string }) {
  const [demo, setDemo] = useState<DemoStorefrontResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await marketingOpsService.generateDemoStorefront(campaignId);
      setDemo(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load demo storefront');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchDemo();
  }, [fetchDemo]);

  const handleCopy = async () => {
    if (!demo) return;
    try {
      await navigator.clipboard.writeText(demo.demoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex flex-col">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href={`/settings/admin/marketing-ops/campaigns/${campaignId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Campaign
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Store className="w-6 h-6 text-teal-600" />
              Demo Storefront Preview
            </h1>
            {demo && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {demo.template.replace(/_/g, ' ')} template · expires {new Date(demo.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {demo && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700"
              >
                <Copy className="w-4 h-4" />
                {copied ? 'Copied!' : 'Copy Demo URL'}
              </button>
              <a
                href={demo.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </a>
              <button
                onClick={fetchDemo}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : demo ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden h-full min-h-[70vh]">
            <iframe
              src={demo.demoUrl}
              title="Demo Storefront Preview"
              className="w-full h-full min-h-[70vh] border-0"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

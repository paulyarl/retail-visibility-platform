'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Eye, MousePointerClick, Clock, Smartphone, Monitor, Tablet, Activity } from 'lucide-react';
import marketingOpsService, { GalleryAnalytics } from '@/services/MarketingOpsService';

interface GalleryAnalyticsTabProps {
  campaignId: string;
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function GalleryAnalyticsTab({ campaignId }: GalleryAnalyticsTabProps) {
  const [analytics, setAnalytics] = useState<GalleryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await marketingOpsService.getGalleryAnalytics(campaignId);
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-start gap-2">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!analytics || analytics.totalTokens === 0) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6 text-center py-12">
        <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500 font-medium">No gallery links generated yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Generate a gallery link in the panel above to start tracking engagement.
        </p>
      </div>
    );
  }

  // Funnel summary
  const funnel = [
    { label: 'Tokens Generated', value: analytics.totalTokens, color: 'bg-blue-500' },
    { label: 'Viewed', value: analytics.viewedTokens, color: 'bg-yellow-500' },
    { label: 'CTA Clicks', value: analytics.ctaClicks, color: 'bg-green-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Funnel Summary */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Engagement Funnel</h3>
        <div className="grid grid-cols-3 gap-4">
          {funnel.map((step) => (
            <div key={step.label} className="text-center">
              <div className={`mx-auto w-12 h-12 rounded-full ${step.color} flex items-center justify-center mb-2`}>
                <span className="text-white font-bold text-lg">{step.value}</span>
              </div>
              <p className="text-sm font-medium">{step.label}</p>
            </div>
          ))}
        </div>
        {analytics.uniqueSessions > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-700 text-center">
            <p className="text-sm text-gray-500">
              CTA Click-Through Rate: <span className="font-bold text-gray-700 dark:text-gray-300">{analytics.ctaCtr}%</span>
            </p>
          </div>
        )}
      </div>

      {/* Per-token breakdown */}
      <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Per-Token Engagement</h3>
        <div className="space-y-4">
          {analytics.perToken.map((token) => {
            const isViewed = token.totalOpens > 0;
            return (
              <div
                key={token.tokenId}
                className="p-4 bg-gray-50 dark:bg-neutral-700/50 rounded-lg space-y-3"
              >
                {/* Token header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {token.archetype && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                        {token.archetype}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">
                      {token.tokenId.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {token.viewedAt && (
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {new Date(token.viewedAt).toLocaleDateString()}
                      </span>
                    )}
                    {token.convertedAt && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded">
                        Converted
                      </span>
                    )}
                  </div>
                </div>

                {/* Engagement metrics */}
                {isViewed ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">Opens</p>
                        <p className="font-medium">{token.totalOpens}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">Sessions</p>
                        <p className="font-medium">{token.uniqueSessions}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">Avg Duration</p>
                        <p className="font-medium">{formatDuration(token.avgSessionDurationMs)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-400">CTA Clicks</p>
                        <p className="font-medium">{token.ctaClicks}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>No prospect views yet</span>
                    {token.expiresAt && (
                      <span className="text-xs">
                        — link expires in {Math.max(0, Math.ceil((new Date(token.expiresAt).getTime() - Date.now()) / 86400000))}d
                      </span>
                    )}
                  </div>
                )}

                {/* Screenshot views + carousel navs */}
                {isViewed && (token.totalScreenshotViews > 0 || token.totalCarouselNavs > 0) && (
                  <div className="flex gap-4 text-xs text-gray-500 pt-2 border-t border-gray-200 dark:border-neutral-600">
                    {token.totalScreenshotViews > 0 && (
                      <span>Screenshots viewed: {token.totalScreenshotViews}</span>
                    )}
                    {token.totalCarouselNavs > 0 && (
                      <span>Carousel navs: {token.totalCarouselNavs}</span>
                    )}
                    {token.ctaHovers > 0 && (
                      <span>CTA hovers: {token.ctaHovers}</span>
                    )}
                  </div>
                )}

                {/* Device breakdown */}
                {isViewed && (token.mobileViews > 0 || token.desktopViews > 0 || token.tabletViews > 0) && (
                  <div className="flex gap-4 text-xs pt-2 border-t border-gray-200 dark:border-neutral-600">
                    <span className="flex items-center gap-1 text-gray-500">
                      <Smartphone className="h-3 w-3" /> Mobile: {token.mobileViews}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                      <Monitor className="h-3 w-3" /> Desktop: {token.desktopViews}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                      <Tablet className="h-3 w-3" /> Tablet: {token.tabletViews}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

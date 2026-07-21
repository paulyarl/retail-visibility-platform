'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ArrowLeft, BarChart3, Eye, Check, X, DollarSign, TrendingUp, Zap, ArrowDownCircle, Sparkles, Scale } from 'lucide-react';
import FunnelService, { type FunnelAnalyticsSummary, type FunnelStepConversion, type FunnelTimeSeries, type FunnelAovComparison, type FunnelPreviewMetrics } from '@/services/FunnelService';

interface FunnelAnalyticsClientProps {
  tenantId: string;
  funnelId: string;
}

const STEP_ICONS: Record<string, typeof Zap> = {
  order_bump: Zap,
  upsell: TrendingUp,
  downsell: ArrowDownCircle,
  oto: Sparkles,
};

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function FunnelAnalyticsClient({ tenantId, funnelId }: FunnelAnalyticsClientProps) {
  const router = useRouter();
  const [summary, setSummary] = useState<FunnelAnalyticsSummary | null>(null);
  const [steps, setSteps] = useState<FunnelStepConversion[]>([]);
  const [timeseries, setTimeseries] = useState<FunnelTimeSeries[]>([]);
  const [aov, setAov] = useState<FunnelAovComparison | null>(null);
  const [previewMetrics, setPreviewMetrics] = useState<FunnelPreviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await FunnelService.getFunnelAnalytics(tenantId, funnelId);
      setSummary(data.summary);
      setSteps(data.steps);
      setTimeseries(data.timeseries);
      setAov(data.aov);
      setPreviewMetrics(data.preview);
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [tenantId, funnelId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/t/${tenantId}/settings/funnels/${funnelId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Funnel Analytics</h1>
          <p className="text-sm text-muted-foreground">Performance metrics for this funnel</p>
        </div>
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      {!summary && !error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">No Analytics Data Yet</h2>
            <p className="text-sm text-muted-foreground">
              Analytics will appear once your funnel starts receiving traffic.
            </p>
          </CardContent>
        </Card>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Views</span>
                </div>
                <p className="text-2xl font-bold">{summary.total_views}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Accepts</span>
                </div>
                <p className="text-2xl font-bold">{summary.total_accepts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Revenue</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(summary.total_revenue_cents)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-muted-foreground">Conversion Rate</span>
                </div>
                <p className="text-2xl font-bold">{formatPercent(summary.conversion_rate)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Preview → Checkout Metrics */}
          {previewMetrics && (previewMetrics.preview_views > 0 || previewMetrics.step_clicks > 0 || previewMetrics.buy_now_clicks > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview → Checkout
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Preview Views</div>
                    <p className="text-xl font-bold">{previewMetrics.preview_views}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Step Clicks</div>
                    <p className="text-xl font-bold">{previewMetrics.step_clicks}</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Buy Now Clicks</div>
                    <p className="text-xl font-bold">{previewMetrics.buy_now_clicks}</p>
                  </div>
                  <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
                    <div className="text-xs text-muted-foreground mb-1">Conversion Rate</div>
                    <p className="text-xl font-bold text-blue-600">{formatPercent(previewMetrics.preview_to_checkout_rate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Revenue Uplift */}
          {summary.revenue_uplift_cents > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-sm">
                    Revenue Uplift: <strong>{formatCurrency(summary.revenue_uplift_cents)}</strong> from funnel offers
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AOV Comparison */}
          {aov && (aov.orders_with_funnel > 0 || aov.orders_without_funnel > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Average Order Value Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Without Funnel</div>
                    <p className="text-xl font-bold">{formatCurrency(aov.aov_without_funnel_cents)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{aov.orders_without_funnel} orders</p>
                  </div>
                  <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950/20">
                    <div className="text-xs text-muted-foreground mb-1">With Funnel</div>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(aov.aov_with_funnel_cents)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{aov.orders_with_funnel} orders</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground mb-1">Uplift</div>
                    <p className="text-xl font-bold">
                      {aov.uplift_percent > 0 ? '+' : ''}{aov.uplift_percent}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(aov.aov_with_funnel_cents - aov.aov_without_funnel_cents)} per order
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step Conversion */}
          {steps.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Step Conversion</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {steps.map((step, i) => {
                  const Icon = STEP_ICONS[step.step_type] || Zap;
                  return (
                    <div key={step.step_id || i} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="text-sm font-medium">{step.step_type.replace('_', ' ')}</span>
                        </div>
                        <Badge variant="outline">{formatPercent(step.conversion_rate)}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <div><Eye className="h-3 w-3 inline mr-1" />{step.views} views</div>
                        <div><Check className="h-3 w-3 inline mr-1" />{step.accepts} accepts</div>
                        <div><X className="h-3 w-3 inline mr-1" />{step.skips} skips</div>
                        <div><DollarSign className="h-3 w-3 inline mr-1" />{formatCurrency(step.revenue_cents)}</div>
                      </div>
                      <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600 rounded-full"
                          style={{ width: `${Math.min(step.conversion_rate * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Time Series */}
          {timeseries.length > 0 && (
            <Card>
              <CardHeader><CardTitle>30-Day Trend</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {timeseries.slice(-14).map((ts, i) => {
                    const maxViews = Math.max(...timeseries.map(t => t.views), 1);
                    const width = (ts.views / maxViews) * 100;
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-20">{ts.date}</span>
                        <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="w-12 text-right">{ts.views}</span>
                        <span className="w-16 text-right text-green-600">{formatCurrency(ts.revenue_cents)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

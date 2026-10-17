'use client';

/**
 * FlyerAnalyticsCard — per-flyer engagement + order attribution.
 *
 * Spec §10: counters are DIRECTIONAL, never demand — a flyer that drove
 * fifty phone calls shows zero attributed orders and may still be the
 * merchant's best week. The card says so.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BarChart3 } from 'lucide-react';
import { flyerService, type FlyerAnalytics } from '@/services/FlyerService';
import { formatPrice } from '@/lib/pricing';

interface Props { tenantId: string }

export default function FlyerAnalyticsCard({ tenantId }: Props) {
  const [analytics, setAnalytics] = useState<FlyerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    flyerService.getAnalytics(tenantId, 30)
      .then((a) => { if (!cancelled) setAnalytics(a); })
      .catch(() => { if (!cancelled) setAnalytics(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId]);

  if (loading || !analytics || analytics.flyers.length === 0) return null;

  const visible = analytics.flyers.filter(
    (f) => f.totals.impressions > 0 || f.totals.clicks > 0 || f.orders > 0 ||
      f.daily.some((d) => d.impressions + d.clicks + d.add_to_cart > 0),
  );
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-neutral-400" /> Engagement — last {analytics.windowDays} days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {visible.map((f) => {
            const adds = f.daily.reduce((n, d) => n + d.add_to_cart, 0);
            const srcEntries = Object.entries(f.bySrc).sort((a, b) => b[1] - a[1]).slice(0, 4);
            return (
              <div key={f.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{f.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {f.totals.impressions} views · {f.totals.clicks} taps · {adds} added to cart
                  </p>
                  {srcEntries.length > 0 && (
                    <p className="text-xs text-neutral-400 mt-0.5">
                      via {srcEntries.map(([src, n]) => `${src === 'qr-customer' ? 'QR' : src} ${n}`).join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {f.orders} order{f.orders === 1 ? '' : 's'}
                  </p>
                  {f.revenueCents > 0 && (
                    <p className="text-xs text-neutral-500">{formatPrice(f.revenueCents)} attributed</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-neutral-400 mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-3">
          Directional only — phone orders from the flyer image aren't counted here.
        </p>
      </CardContent>
    </Card>
  );
}

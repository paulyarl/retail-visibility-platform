'use client';

/**
 * FlyerCardOrderPanel — reorder the physical QR card pack (spec §4.3).
 *
 * One double-sided card: customer QR on the front (always-current specials),
 * merchant QR on the back (manage specials / reorder). Platform takes the
 * order and delegates print+ship to a vendor — no inventory, no shipping.
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CreditCard, Download } from 'lucide-react';
import { flyerService, type FlyerCardOrder } from '@/services/FlyerService';
import { formatPrice } from '@/lib/pricing';

interface Props { tenantId: string }

const PACK_LABELS: Record<number, string> = { 25: '25 cards', 50: '50 cards', 100: '100 cards' };
const PACK_COSTS: Record<number, number> = { 25: 1900, 50: 3200, 100: 5400 };

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  printed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  shipped: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500',
};

export default function FlyerCardOrderPanel({ tenantId }: Props) {
  const [orders, setOrders] = useState<FlyerCardOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [packSize, setPackSize] = useState<25 | 50 | 100>(50);
  const [packCount, setPackCount] = useState(1);
  const [addr, setAddr] = useState({ name: '', line1: '', line2: '', city: '', state: '', zip: '' });

  const load = async () => {
    try { setOrders(await flyerService.getCardOrders(tenantId)); }
    catch { setOrders([]); }
    finally { setLoaded(true); }
  };
  useEffect(() => { load(); }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await flyerService.createCardOrder(tenantId, {
        packSize,
        packCount,
        shippingAddress: {
          name: addr.name, line1: addr.line1, line2: addr.line2 || null,
          city: addr.city, state: addr.state || null, zip: addr.zip,
        },
      });
      setNotice('Card order placed — the print partner will confirm shortly.');
      setOrdering(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const totalCents = PACK_COSTS[packSize] * packCount;
  const addrValid = addr.name && addr.line1 && addr.city && addr.zip;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-neutral-400" /> Counter cards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Double-sided cards for your counter: front sends customers to your live specials,
          back brings you here to manage them. Printed and shipped by our print partner.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <a href={flyerService.cardArtUrl(tenantId)} download
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
            <Download className="w-3.5 h-3.5" /> Preview card artwork (PDF)
          </a>
          {!ordering && (
            <Button variant="outline" size="sm" onClick={() => setOrdering(true)}>Order a pack</Button>
          )}
        </div>

        {notice && <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-2.5 text-xs text-green-700 dark:text-green-300">{notice}</div>}
        {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-700 dark:text-red-300">{error}</div>}

        {ordering && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
            <div className="flex gap-2">
              {([25, 50, 100] as const).map((size) => (
                <button key={size} type="button" onClick={() => setPackSize(size)}
                  className={`text-sm rounded-lg px-3 py-1.5 border ${packSize === size ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' : 'border-neutral-300 dark:border-neutral-700'}`}>
                  {PACK_LABELS[size]}
                </button>
              ))}
              <input type="number" min={1} max={20} value={packCount}
                onChange={(e) => setPackCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="w-20 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm"
                title="Packs" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={addr.name} onChange={(e) => setAddr({ ...addr, name: e.target.value })} placeholder="Recipient name"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
              <input value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} placeholder="Address line 1"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
              <input value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} placeholder="Address line 2 (optional)"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
              <input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} placeholder="City"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
              <input value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} placeholder="State"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
              <input value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} placeholder="ZIP"
                className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm" />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button size="sm" onClick={submit} disabled={submitting || !addrValid}>
                {submitting ? 'Placing order…' : `Place order — ${formatPrice(totalCents)}`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOrdering(false)} disabled={submitting}>Cancel</Button>
            </div>
          </div>
        )}

        {loaded && orders.length > 0 && (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {orders.map((o) => (
              <div key={o.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral-900 dark:text-white">
                    {o.pack_count}× {PACK_LABELS[o.pack_size] ?? `${o.pack_size} cards`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {new Date(o.created_at).toLocaleDateString()}
                    {o.total_cost_cents != null && ` · ${formatPrice(o.total_cost_cents)}`}
                  </p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[o.status] ?? STATUS_COLORS.submitted}`}>
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

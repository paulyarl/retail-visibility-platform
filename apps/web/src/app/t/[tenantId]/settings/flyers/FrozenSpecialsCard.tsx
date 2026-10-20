'use client';

/**
 * FrozenSpecialsCard — "Freeze unsold" for the flyer frozen panel (spec §4.1a, §6).
 *
 * Lists the frozen copies that are still sellable and freezes dishes from the
 * repertoire into the Frozen Specials item. Gated by flyer_frozen in the parent.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { flyerService, type FlyerVariant } from '@/services/FlyerService';
import { formatPrice } from '@/lib/pricing';
import { clientLogger } from '@/lib/client-logger';

interface Props { tenantId: string }

export default function FrozenSpecialsCard({ tenantId }: Props) {
  const [dishes, setDishes] = useState<FlyerVariant[]>([]);
  const [frozen, setFrozen] = useState<FlyerVariant[]>([]);
  const [dishId, setDishId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rep = await flyerService.getRepertoire(tenantId);
      setDishes(rep.dishes.filter(d => !(d.attributes as any)?.no_price));
      setFrozen(rep.frozen);
    } catch (err: any) {
      clientLogger.error('[FrozenSpecials] load failed', { detail: err });
      setError(err?.message || 'Failed to load frozen specials');
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const selected = dishes.find(d => d.id === dishId);

  const selectDish = (id: string) => {
    setDishId(id);
    const dish = dishes.find(d => d.id === id);
    setQuantity(dish && dish.stock > 0 ? String(dish.stock) : '');
  };

  const freeze = async () => {
    const qty = parseInt(quantity, 10);
    if (!selected || !Number.isFinite(qty) || qty < 1) {
      setError('Pick a dish and a quantity of at least 1');
      return;
    }
    const priceNum = parseFloat(price);
    setBusy(true);
    setError(null);
    try {
      await flyerService.freezeDishes(tenantId, [{
        sourceVariantId: selected.id,
        quantity: qty,
        priceCents: Number.isFinite(priceNum) ? Math.round(priceNum * 100) : null,
      }]);
      setDishId('');
      setQuantity('');
      setPrice('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to freeze dish');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Frozen specials</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Freeze unsold dishes to sell them after the flyer ends, while supplies last. Frozen copies show in the flyer&apos;s &quot;From the freezer&quot; panel.
        </p>

        {frozen.length > 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 divide-y divide-neutral-100 dark:divide-neutral-800">
            {frozen.map(v => (
              <div key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-neutral-900 dark:text-white">{v.variant_name}</span>
                <span className="text-neutral-500">
                  {v.price_cents != null ? formatPrice(v.price_cents) : ''} · {v.stock} left
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Nothing frozen yet.</p>
        )}

        {dishes.length === 0 ? (
          <p className="text-sm text-neutral-500">Add a dish to a flyer first — frozen specials come from your dish library.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Dish</label>
              <select
                value={dishId} onChange={e => selectDish(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              >
                <option value="">Select a dish…</option>
                {dishes.map(d => (
                  <option key={d.id} value={d.id}>{d.variant_name}{d.stock > 0 ? ` (${d.stock} left)` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Quantity</label>
              <input
                type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Frozen price (optional)</label>
              <input
                type="number" min={0} step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                placeholder={selected?.price_cents != null ? formatPrice(selected.price_cents) : ''}
                className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={freeze} disabled={busy || !dishId} size="sm">{busy ? 'Freezing…' : 'Freeze unsold'}</Button>
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </CardContent>
    </Card>
  );
}

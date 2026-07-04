'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/hooks/use-toast';
import { Package, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { itemsDataService, Item } from '@/services/itemsDataService';
import ItemUpdateService from '@/lib/singletons/ItemUpdateService';

type ConditionType = 'new' | 'used' | 'refurbished';

const CONDITION_LABELS: Record<ConditionType, string> = {
  new: 'New',
  used: 'Used',
  refurbished: 'Refurbished',
};

const CONDITION_COLORS: Record<ConditionType, string> = {
  new: 'bg-green-100 text-green-800 border-green-200',
  used: 'bg-orange-100 text-orange-800 border-orange-200',
  refurbished: 'bg-blue-100 text-blue-800 border-blue-200',
};

const CONDITION_DOT: Record<ConditionType, string> = {
  new: 'bg-green-500',
  used: 'bg-orange-500',
  refurbished: 'bg-blue-500',
};

const ALL_CONDITIONS: ConditionType[] = ['new', 'used', 'refurbished'];

interface ProductConditionsClientProps {
  tenantId: string;
}

export default function ProductConditionsClient({ tenantId }: ProductConditionsClientProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCondition, setFilterCondition] = useState<ConditionType | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetCondition, setTargetCondition] = useState<ConditionType | ''>('');
  const [updating, setUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<{ done: number; total: number } | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const allItems: Item[] = [];
      const limit = 50;
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await itemsDataService.fetchItems(tenantId, {}, { page, limit });
        allItems.push(...res.items);
        hasMore = res.pagination.hasMore;
        page++;
        if (page > 20) break;
      }
      setItems(allItems);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({ title: 'Error', description: 'Failed to load products', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const conditionCounts = useMemo(() => {
    const counts: Record<string, number> = { new: 0, used: 0, refurbished: 0, unknown: 0 };
    for (const item of items) {
      const c = item.condition;
      if (c === 'new' || c === 'brand_new') counts.new++;
      else if (c === 'used') counts.used++;
      else if (c === 'refurbished') counts.refurbished++;
      else counts.unknown++;
    }
    return counts;
  }, [items]);

  const normalizeCondition = (c?: string): ConditionType | 'unknown' => {
    if (c === 'new' || c === 'brand_new') return 'new';
    if (c === 'used') return 'used';
    if (c === 'refurbished') return 'refurbished';
    return 'unknown';
  };

  const filteredItems = useMemo(() => {
    if (filterCondition === 'all') return items;
    return items.filter((item) => normalizeCondition(item.condition) === filterCondition);
  }, [items, filterCondition]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkReassign = async () => {
    if (!targetCondition || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setUpdating(true);
    setUpdateProgress({ done: 0, total: ids.length });
    let successCount = 0;
    let failCount = 0;

    const itemUpdateService = ItemUpdateService.getInstance(tenantId);

    for (let i = 0; i < ids.length; i++) {
      try {
        const result = await itemUpdateService.updateItem(ids[i], { condition: targetCondition });
        if (result.success) {
          successCount++;
          setItems((prev) =>
            prev.map((item) =>
              item.id === ids[i] ? { ...item, condition: targetCondition } : item
            )
          );
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
      setUpdateProgress({ done: i + 1, total: ids.length });
    }

    setUpdating(false);
    setUpdateProgress(null);
    setTargetCondition('');
    clearSelection();

    if (successCount > 0) {
      toast({
        title: 'Conditions updated',
        description: `${successCount} product${successCount !== 1 ? 's' : ''} set to ${CONDITION_LABELS[targetCondition]}${failCount > 0 ? `, ${failCount} failed` : ''}.`,
        variant: 'success',
      });
    } else if (failCount > 0) {
      toast({
        title: 'Update failed',
        description: `Failed to update ${failCount} product${failCount !== 1 ? 's' : ''}.`,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white flex items-center gap-3 mb-2">
          <Package className="h-8 w-8 text-primary-600" />
          Product Conditions
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Filter products by condition and reassign conditions in bulk
        </p>
        <div className="flex gap-2 mt-3">
          <Link href={`/t/${tenantId}/items`}>
            <Button variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              Inventory
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {ALL_CONDITIONS.map((cond) => (
          <div
            key={cond}
            className={`cursor-pointer transition-all rounded-lg border bg-white dark:bg-neutral-800 p-4 ${
              filterCondition === cond ? 'ring-2 ring-primary-500 border-primary-200' : 'border-neutral-200 dark:border-neutral-700 hover:shadow-md'
            }`}
            onClick={() => {
              setFilterCondition(filterCondition === cond ? 'all' : cond);
              clearSelection();
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {CONDITION_LABELS[cond]}
                </p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {conditionCounts[cond] || 0}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${CONDITION_DOT[cond]}`} />
            </div>
          </div>
        ))}
        <div
          className={`cursor-pointer transition-all rounded-lg border bg-white dark:bg-neutral-800 p-4 ${
            filterCondition === 'all' ? 'ring-2 ring-primary-500 border-primary-200' : 'border-neutral-200 dark:border-neutral-700 hover:shadow-md'
          }`}
          onClick={() => {
            setFilterCondition('all');
            clearSelection();
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                All Products
              </p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white">{items.length}</p>
            </div>
            <Package className="w-5 h-5 text-neutral-400" />
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-4 rounded-xl border border-primary-500 bg-primary-50 dark:bg-primary-900/20 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40">
              <span className="text-sm font-bold text-primary-700 dark:text-primary-300">
                {selectedIds.size}
              </span>
            </div>
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <ArrowRight className="h-4 w-4 text-neutral-400" />
            <select
              value={targetCondition}
              onChange={(e) => setTargetCondition(e.target.value as ConditionType)}
              className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
            >
              <option value="">Set condition...</option>
              <option value="new">New</option>
              <option value="used">Used</option>
              <option value="refurbished">Refurbished</option>
            </select>
            <Button
              size="sm"
              variant="primary"
              onClick={handleBulkReassign}
              disabled={!targetCondition || updating}
            >
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {updateProgress
                    ? `${updateProgress.done}/${updateProgress.total}`
                    : 'Updating...'}
                </>
              ) : (
                'Apply'
              )}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} disabled={updating}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Filter & Select Bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {filterCondition === 'all'
              ? `All products (${filteredItems.length})`
              : `${CONDITION_LABELS[filterCondition]} (${filteredItems.length})`}
          </span>
        </div>
        {filteredItems.length > 0 && (
          <Button size="sm" variant="ghost" onClick={selectedIds.size === filteredItems.length ? clearSelection : selectAll}>
            {selectedIds.size === filteredItems.length && selectedIds.size > 0
              ? 'Deselect All'
              : 'Select All'}
          </Button>
        )}
      </div>

      {/* Products Table */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 dark:text-neutral-400">
              {items.length === 0
                ? 'No products found. Create products first to manage their conditions.'
                : 'No products match this condition filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                      onChange={() => {
                        if (selectedIds.size === filteredItems.length) clearSelection();
                        else selectAll();
                      }}
                      className="rounded border-neutral-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Condition
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredItems.map((item) => {
                  const cond = normalizeCondition(item.condition);
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                        isSelected ? 'bg-primary-50 dark:bg-primary-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(item.id)}
                          className="rounded border-neutral-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {item.imageGallery && item.imageGallery.length > 0 ? (
                            <img
                              src={item.imageGallery[0]?.url || item.imageGallery[0]?.thumbnail_url}
                              alt={item.name}
                              className="w-10 h-10 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                              <Package className="w-5 h-5 text-neutral-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                              {item.name}
                            </p>
                            {item.brand && (
                              <p className="text-xs text-neutral-500">{item.brand}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {item.price != null
                          ? `$${(item.price_cents != null ? item.price_cents / 100 : item.price).toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {cond === 'unknown' ? (
                          <Badge variant="outline" className="text-xs">
                            Not set
                          </Badge>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${CONDITION_COLORS[cond]}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${CONDITION_DOT[cond]}`} />
                            {CONDITION_LABELS[cond]}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Info Note */}
      <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium mb-1">About Product Conditions</p>
          <p>
            Conditions are assigned during product creation and can be updated here in bulk.
            Select products, choose a target condition, and apply. Updates sync to your storefront
            and Google Merchant feed.
          </p>
        </div>
      </div>
    </div>
  );
}

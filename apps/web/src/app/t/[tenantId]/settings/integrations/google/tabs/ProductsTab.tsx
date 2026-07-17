'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@mantine/core';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { gmcValidationService, BulkValidationReport } from '@/services/GMCValidationService';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  ShoppingBag,
} from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

interface ProductSyncItem {
  id: string;
  title: string;
  sku: string | null;
  syncStatus: string;
  syncedAt: string | null;
  visibility: string;
  price: number | null;
  productType: string | null;
  syncError: string | null;
  gmcItemId: string | null;
}

interface ProductsTabProps {
  tenantId: string;
  gmcConnected: boolean;
  hasMerchantLink: boolean;
  onSyncAll: () => void;
  syncing: boolean;
  syncResult: any;
}

type StatusFilter = 'all' | 'success' | 'pending' | 'error';

export default function ProductsTab({
  tenantId,
  gmcConnected,
  hasMerchantLink,
  onSyncAll,
  syncing,
  syncResult,
}: ProductsTabProps) {
  const [products, setProducts] = useState<ProductSyncItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [validationReport, setValidationReport] = useState<BulkValidationReport | null>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const result = await platformHomeService.getGMCProductSyncStatus(tenantId, {
        status: statusFilter,
        search,
        limit: 100,
      });
      setProducts(result.data?.products || []);
      setTotal(result.data?.total || 0);
    } catch (err) {
      clientLogger.error('Failed to fetch product sync status:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [tenantId, statusFilter, search]);

  useEffect(() => {
    if (tenantId && gmcConnected) {
      fetchProducts();
    } else {
      setLoading(false);
    }
  }, [fetchProducts, tenantId, gmcConnected]);

  // Auto-refresh every 30 seconds during active sync
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchProducts();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchProducts]);

  // Enable auto-refresh when syncing
  useEffect(() => {
    if (syncing) {
      setAutoRefresh(true);
    } else {
      const timeout = setTimeout(() => setAutoRefresh(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [syncing]);

  // Refresh after sync completes
  useEffect(() => {
    if (syncResult?.success) {
      fetchProducts();
    }
  }, [syncResult, fetchProducts]);

  async function handleLoadValidation() {
    try {
      setLoadingValidation(true);
      const report = await gmcValidationService.getValidationReport(tenantId);
      setValidationReport(report);
    } catch (err) {
      clientLogger.error('Failed to load validation report:', { detail: err });
    } finally {
      setLoadingValidation(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
            <CheckCircle className="w-3 h-3" /> Synced
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
            <XCircle className="w-3 h-3" /> Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400">
            {status}
          </span>
        );
    }
  }

  if (!gmcConnected) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-8 text-center">
        <ShoppingBag className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Google Merchant Center Not Connected
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Connect your Google Merchant Center account to view product sync status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700 rounded-lg p-1">
          {(['all', 'success', 'pending', 'error'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <Button
          onClick={fetchProducts}
          variant="default"
          size="sm"
          className="inline-flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>

        {/* Sync All */}
        {hasMerchantLink && (
          <Button
            onClick={onSyncAll}
            loading={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg text-sm"
          >
            <ShoppingBag className="w-4 h-4" />
            Sync All Products
          </Button>
        )}
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Auto-refreshing every 30 seconds during active sync...
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div className={`p-3 rounded-lg text-sm ${
          syncResult.success
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
        }`}>
          <p className="font-medium">{syncResult.message}</p>
          {syncResult.data && (
            <p className="mt-1">
              Synced: {syncResult.data.synced} | Failed: {syncResult.data.failed}
            </p>
          )}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <span className="text-sm text-blue-800 dark:text-blue-200 font-medium">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => {
              onSyncAll();
              setSelectedIds(new Set());
            }}
            className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
          >
            Sync Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Product Table */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700">
              <tr className="text-left text-xs text-neutral-500 uppercase tracking-wider">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-neutral-300"
                  />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Sync Status</th>
                <th className="px-4 py-3">Last Synced</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-neutral-400 mx-auto mb-2" />
                    <p className="text-sm text-neutral-500">Loading products...</p>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <p className="text-sm text-neutral-500">No products found.</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="rounded border-neutral-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {product.title}
                      </div>
                      {product.productType && (
                        <div className="text-xs text-neutral-400 capitalize">{product.productType}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400 font-mono">
                      {product.sku || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(product.syncStatus)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {product.syncedAt
                        ? new Date(product.syncedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400 max-w-[200px] truncate">
                      {product.syncError || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500">
            Showing {products.length} of {total} products
          </div>
        )}
      </div>

      {/* Validation Report */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Validation Report</h3>
            <p className="text-sm text-neutral-500">Pre-sync compliance check for Google Shopping</p>
          </div>
          <button
            onClick={handleLoadValidation}
            disabled={loadingValidation}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingValidation ? 'animate-spin' : ''}`} />
            {validationReport ? 'Refresh' : 'Run Validation'}
          </button>
        </div>
        {validationReport && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3">
                <div className="text-xs text-neutral-500">Total Products</div>
                <div className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{validationReport.totalItems}</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <div className="text-xs text-green-600 dark:text-green-400">Valid</div>
                <div className="text-xl font-bold text-green-700 dark:text-green-300">{validationReport.validItems}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <div className="text-xs text-red-600 dark:text-red-400">Errors</div>
                <div className="text-xl font-bold text-red-700 dark:text-red-300">{validationReport.itemsWithErrors}</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <div className="text-xs text-amber-600 dark:text-amber-400">Warnings</div>
                <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{validationReport.itemsWithWarnings}</div>
              </div>
            </div>

            {validationReport.results.filter((r: any) => r.validation.issues.length > 0).length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {validationReport.results
                  .filter((r: any) => r.validation.issues.length > 0)
                  .map((r: any) => (
                    <div key={r.itemId} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100">{r.itemName}</span>
                          {r.sku && <span className="text-xs text-neutral-500 font-mono">{r.sku}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {r.validation.errors > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                              <XCircle className="w-3 h-3" /> {r.validation.errors} error{r.validation.errors !== 1 ? 's' : ''}
                            </span>
                          )}
                          {r.validation.warnings > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                              <AlertTriangle className="w-3 h-3" /> {r.validation.warnings} warning{r.validation.warnings !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {r.validation.issues.map((issue: any, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-xs">
                            {issue.severity === 'error' ? (
                              <XCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                            )}
                            <span className="text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium">{issue.field}:</span> {issue.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}

            {validationReport.results.filter((r: any) => r.validation.issues.length > 0).length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                All products pass Google Shopping validation checks.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

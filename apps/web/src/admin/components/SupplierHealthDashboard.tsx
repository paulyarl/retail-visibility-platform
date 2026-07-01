/**
 * Supplier Health Dashboard
 *
 * Displays aggregated health metrics for all suppliers:
 * - Summary cards: total suppliers, catalog items, GTIN coverage, success rate, alerts
 * - Per-supplier table with metrics and freshness alerts
 * - Weekly report export (CSV)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  SupplierService,
  type HealthDashboard,
  type SupplierHealthMetric,
} from '@/services/SupplierService';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Activity, TrendingUp, Database, AlertTriangle, Download, RefreshCw } from 'lucide-react';

export default function SupplierHealthDashboard() {
  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await SupplierService.getHealthDashboard();
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load health dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCsv = () => {
    if (!dashboard) return;

    const headers = [
      'Supplier ID',
      'Supplier Name',
      'Active',
      'Connection Type',
      'Catalog Items',
      'Mappings',
      'GTIN Coverage %',
      'Success Rate %',
      'Dedup Rate %',
      'Items Updated 24h',
      'Quarantined Items',
      'Unreplayed Quarantine 24h',
      'Freshness Lag (hours)',
      'Freshness Alert',
      'Last Updated',
    ];

    const rows = dashboard.suppliers.map((s: SupplierHealthMetric) => [
      s.supplier_id,
      s.supplier_name,
      s.active ? 'Yes' : 'No',
      s.connection_type,
      s.total_catalog_items,
      s.total_mappings,
      s.gtin_coverage_pct,
      s.success_rate_pct,
      s.dedup_rate_pct,
      s.items_updated_24h,
      s.quarantined_items,
      s.unreplayed_quarantine_24h,
      s.freshness_lag_hours ?? 'N/A',
      s.freshness_alert ? 'YES' : 'No',
      s.last_updated ? new Date(s.last_updated).toISOString() : 'Never',
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-health-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const { summary } = dashboard;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Health Dashboard</h1>
          <p className="text-gray-600">Monitor supplier catalog sync health and performance</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Database className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Catalog Items</p>
              <p className="text-2xl font-bold text-gray-900">{summary.total_catalog_items.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg GTIN Coverage</p>
              <p className="text-2xl font-bold text-gray-900">{summary.avg_gtin_coverage_pct}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{summary.avg_success_rate_pct}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${summary.alerts_count > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <AlertTriangle className={`h-5 w-5 ${summary.alerts_count > 0 ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Freshness Alerts</p>
              <p className={`text-2xl font-bold ${summary.alerts_count > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {summary.alerts_count}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total Suppliers</p>
          <p className="text-lg font-semibold">{summary.total_suppliers}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Active Suppliers</p>
          <p className="text-lg font-semibold">{summary.active_suppliers}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Total Mappings</p>
          <p className="text-lg font-semibold">{summary.total_mappings.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Quarantined Items</p>
          <p className={`text-lg font-semibold ${summary.total_quarantined > 0 ? 'text-amber-600' : ''}`}>
            {summary.total_quarantined}
          </p>
        </div>
      </div>

      {/* Per-supplier table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Supplier Metrics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">GTIN %</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Success %</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Updated 24h</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quarantined</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Freshness</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dashboard.suppliers.map((s: SupplierHealthMetric) => (
                <tr key={s.supplier_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{s.supplier_name}</span>
                      {s.is_builtin && (
                        <Badge variant="default">Built-in</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{s.connection_type}</p>
                  </td>
                  <td className="px-4 py-3">
                    {s.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="default">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {s.total_catalog_items.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={s.gtin_coverage_pct >= 80 ? 'text-green-600' : s.gtin_coverage_pct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                      {s.gtin_coverage_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <span className={s.success_rate_pct >= 95 ? 'text-green-600' : s.success_rate_pct >= 80 ? 'text-amber-600' : 'text-red-600'}>
                      {s.success_rate_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-900">
                    {s.items_updated_24h}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {s.quarantined_items > 0 ? (
                      <span className="text-amber-600">{s.quarantined_items}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {s.freshness_alert ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        {s.freshness_lag_hours}h
                      </span>
                    ) : s.freshness_lag_hours !== null ? (
                      <span className="text-green-600">{s.freshness_lag_hours}h</span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {s.last_updated ? new Date(s.last_updated).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

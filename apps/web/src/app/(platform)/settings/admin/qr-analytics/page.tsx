'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, QrCode, RefreshCw, Users, TrendingUp, Globe, Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import QrAnalyticsService, {
  type AdminQrAnalyticsResult,
  type QrConsumerType,
  type QrSurfaceType,
} from '@/services/QrAnalyticsService';

const DAYS_BACK_OPTIONS = [7, 14, 30, 60, 90];

const CONSUMER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Consumers' },
  { value: 'merchant', label: 'Merchant' },
  { value: 'admin', label: 'Admin' },
];

const SURFACE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Surfaces' },
  { value: 'storefront', label: 'Storefront' },
  { value: 'product', label: 'Product' },
  { value: 'directory', label: 'Directory' },
  { value: 'qr_landing', label: 'QR Landing' },
  { value: 'promo', label: 'Promo' },
  { value: 'private_grant', label: 'Private Grant' },
  { value: 'general', label: 'General' },
];

export default function AdminQrAnalyticsPage() {
  const [data, setData] = useState<AdminQrAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [daysBack, setDaysBack] = useState(30);
  const [consumer, setConsumer] = useState('');
  const [surface, setSurface] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await QrAnalyticsService.getAdminAnalytics(daysBack, {
        consumer: consumer ? (consumer as QrConsumerType) : undefined,
        surface: surface ? (surface as QrSurfaceType) : undefined,
      });
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin QR analytics');
    } finally {
      setLoading(false);
    }
  }, [daysBack, consumer, surface]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = QrAnalyticsService;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/settings/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
                QR Analytics (Admin)
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Cross-tenant QR scan analytics — total scans, unique visitors, and tenant breakdowns
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Range:</label>
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            >
              {DAYS_BACK_OPTIONS.map((d) => (
                <option key={d} value={d}>Last {d} days</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Consumer:</label>
            <select
              value={consumer}
              onChange={(e) => setConsumer(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            >
              {CONSUMER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Surface:</label>
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            >
              {SURFACE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading analytics...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        ) : !data ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No analytics data yet</h3>
            <p className="text-sm text-gray-500">
              QR analytics are computed from scan events across all tenants.
            </p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <AdminSummaryCard
                icon={<QrCode className="w-5 h-5" />}
                label="Total Scans"
                value={fmt.formatNumber(data.totals.totalScans)}
                color="indigo"
              />
              <AdminSummaryCard
                icon={<Users className="w-5 h-5" />}
                label="Unique Visitors"
                value={fmt.formatNumber(data.totals.uniqueVisitors)}
                color="blue"
              />
              <AdminSummaryCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Active Tenants"
                value={String(data.totals.tenantCount)}
                color="green"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* By Consumer */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">By Consumer</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600">
                        <th className="px-4 py-3 font-medium">Consumer</th>
                        <th className="px-4 py-3 font-medium text-right">Scans</th>
                        <th className="px-4 py-3 font-medium text-right">Unique Visitors</th>
                        <th className="px-4 py-3 font-medium text-right">Tenants</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.byConsumer.map((row) => (
                        <tr key={row.consumer} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 capitalize">{row.consumer}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(row.totalScans)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(row.uniqueVisitors)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(row.tenantCount)}</td>
                        </tr>
                      ))}
                      {data.byConsumer.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No data</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* By Surface */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">By Surface</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-gray-600">
                        <th className="px-4 py-3 font-medium">Surface</th>
                        <th className="px-4 py-3 font-medium text-right">Scans</th>
                        <th className="px-4 py-3 font-medium text-right">Unique Visitors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.bySurface.map((row) => (
                        <tr key={row.surface} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{QrAnalyticsService.getSurfaceLabel(row.surface)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(row.totalScans)}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{fmt.formatNumber(row.uniqueVisitors)}</td>
                        </tr>
                      ))}
                      {data.bySurface.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-gray-500">No data</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Recent Scans</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th className="px-4 py-3 font-medium">Tenant</th>
                      <th className="px-4 py-3 font-medium">Surface</th>
                      <th className="px-4 py-3 font-medium">Consumer</th>
                      <th className="px-4 py-3 font-medium">Source</th>
                      <th className="px-4 py-3 font-medium">Country</th>
                      <th className="px-4 py-3 font-medium">Device</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recentScans.map((scan) => (
                      <tr key={scan.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700 font-mono text-xs">{scan.tenantId}</td>
                        <td className="px-4 py-3 text-gray-700">{QrAnalyticsService.getSurfaceLabel(scan.surface as QrSurfaceType)}</td>
                        <td className="px-4 py-3 text-gray-700 capitalize">{scan.consumer}</td>
                        <td className="px-4 py-3 text-gray-700">{scan.source || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{scan.geoCountry || '—'}</td>
                        <td className="px-4 py-3 text-gray-700 capitalize">{scan.deviceType || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(scan.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    ))}
                    {data.recentScans.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No recent scans</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdminSummaryCard({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${colorMap[color] || colorMap.blue}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

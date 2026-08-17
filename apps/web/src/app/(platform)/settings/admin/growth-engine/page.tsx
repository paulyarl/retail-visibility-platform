'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import growthEngineAdminService, {
  FunnelStage,
  NicheBreakdown,
  CityBreakdown,
  TimeSeriesPoint,
  Recommendation,
} from '@/services/GrowthEngineAdminService';

export default function GrowthEngineDashboard() {
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [niches, setNiches] = useState<NicheBreakdown[]>([]);
  const [cities, setCities] = useState<CityBreakdown[]>([]);
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, n, c, s, r] = await Promise.all([
        growthEngineAdminService.getFunnel(),
        growthEngineAdminService.getByNiche(),
        growthEngineAdminService.getByCity(),
        growthEngineAdminService.getTimeSeries(),
        growthEngineAdminService.getRecommendations(),
      ]);
      setFunnel(f?.stages ?? []);
      setNiches(n);
      setCities(c);
      setSeries(s);
      setRecs(r);
    } catch (err: any) {
      setError(err?.message || 'failed_to_load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-gray-500">Loading analytics...</p></div>;
  }
  if (error) {
    return <div className="py-12 text-center"><p className="text-red-600">{error}</p></div>;
  }

  const maxFunnelCount = funnel.length > 0 ? funnel[0].count : 1;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth Engine</h1>
          <p className="text-sm text-gray-500 mt-1">End-to-end funnel: seeks → prospects → seeds → published → claimed → upgraded</p>
        </div>
        <Link href="/settings/admin/directory/batches" className="text-sm text-blue-600 hover:underline">
          Batch Operations →
        </Link>
      </div>

      {/* Funnel */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Funnel (Last 90 Days)</h2>
        <div className="space-y-3">
          {funnel.map((stage, i) => {
            const widthPct = maxFunnelCount > 0 ? Math.max(2, (stage.count / maxFunnelCount) * 100) : 0;
            return (
              <div key={stage.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{stage.label}</span>
                  <span className="text-sm text-gray-500">
                    {stage.count}
                    {stage.conversionFromPrevious !== null && (
                      <span className="ml-2 text-xs">
                        ({(stage.conversionFromPrevious * 100).toFixed(0)}% from previous)
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-6">
                  <div
                    className={`h-6 rounded-full flex items-center justify-end px-2 text-xs text-white font-medium ${
                      i < 2 ? 'bg-blue-500' : i < 4 ? 'bg-green-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  >
                    {stage.count > 0 && stage.count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Next Expansion Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recs.map((rec, i) => (
              <div
                key={i}
                className={`border rounded-lg p-4 ${
                  rec.priority === 'high' ? 'border-green-200 bg-green-50' :
                  rec.priority === 'medium' ? 'border-blue-200 bg-blue-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 text-sm">{rec.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    rec.priority === 'high' ? 'bg-green-100 text-green-700' :
                    rec.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {rec.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{rec.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Time series */}
      {series.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Seeds Over Time</h2>
          <div className="flex items-end gap-2 h-40">
            {series.map((point) => {
              const maxVal = Math.max(...series.map((s) => s.seedsCreated), 1);
              const height = (point.seedsCreated / maxVal) * 100;
              return (
                <div key={point.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-blue-200 rounded-t" style={{ height: `${height}%` }} title={`${point.seedsCreated} seeds`} />
                  <span className="text-xs text-gray-400 rotate-45 origin-left">{point.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Niche and City tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Niche breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">Per-Niche Breakdown</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                <th className="py-2 px-3 font-medium">Category</th>
                <th className="py-2 px-3 font-medium">Seeds</th>
                <th className="py-2 px-3 font-medium">Pub</th>
                <th className="py-2 px-3 font-medium">Claimed</th>
                <th className="py-2 px-3 font-medium">Claim %</th>
              </tr>
            </thead>
            <tbody>
              {niches.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400">No data yet</td></tr>
              ) : (
                niches.map((n) => (
                  <tr key={n.category} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-gray-900">{n.category}</td>
                    <td className="py-2 px-3 text-gray-700">{n.seeds}</td>
                    <td className="py-2 px-3 text-gray-700">{n.published}</td>
                    <td className="py-2 px-3 text-gray-700">{n.claimed}</td>
                    <td className="py-2 px-3">
                      <span className={`font-medium ${n.claimRate > 0.3 ? 'text-green-600' : n.claimRate < 0.1 ? 'text-red-600' : 'text-gray-700'}`}>
                        {(n.claimRate * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* City breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 p-4 border-b border-gray-200">Per-City Breakdown</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600 bg-gray-50">
                <th className="py-2 px-3 font-medium">City</th>
                <th className="py-2 px-3 font-medium">Niches</th>
                <th className="py-2 px-3 font-medium">Seeds</th>
                <th className="py-2 px-3 font-medium">Claimed</th>
                <th className="py-2 px-3 font-medium">Claim %</th>
              </tr>
            </thead>
            <tbody>
              {cities.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400">No data yet</td></tr>
              ) : (
                cities.map((c) => (
                  <tr key={c.city} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-gray-900">{c.city}</td>
                    <td className="py-2 px-3 text-gray-700">{c.niches}</td>
                    <td className="py-2 px-3 text-gray-700">{c.seeds}</td>
                    <td className="py-2 px-3 text-gray-700">{c.claimed}</td>
                    <td className="py-2 px-3">
                      <span className={`font-medium ${c.claimRate > 0.3 ? 'text-green-600' : c.claimRate < 0.1 ? 'text-red-600' : 'text-gray-700'}`}>
                        {(c.claimRate * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

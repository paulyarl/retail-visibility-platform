'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { BarChart3, Plus, ExternalLink, Loader2 } from 'lucide-react';

interface GapQuery {
  id: string;
  query: string;
  count: number;
  lastAsked: string;
  category?: string;
}

interface CoverageScore {
  total: number;
  answered: number;
  coveragePercent: number;
}

interface FaqGapReportProps {
  tenantId: string;
  onCreateFaq?: (question: string) => void;
}

export default function FaqGapReport({ tenantId, onCreateFaq }: FaqGapReportProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [queries, setQueries] = useState<GapQuery[]>([]);
  const [coverage, setCoverage] = useState<CoverageScore>({ total: 0, answered: 0, coveragePercent: 0 });

  useEffect(() => {
    // Placeholder data — will be wired to real gap report API when faq_bot_interactions table exists
    setLoading(true);
    const timer = setTimeout(() => {
      setQueries([
        { id: '1', query: 'What is your warranty policy?', count: 23, lastAsked: '2025-06-05', category: 'Returns' },
        { id: '2', query: 'Do you ship internationally?', count: 18, lastAsked: '2025-06-06', category: 'Shipping' },
        { id: '3', query: 'How do I track my order?', count: 14, lastAsked: '2025-06-04', category: 'Orders' },
        { id: '4', query: 'Can I change my order after placing it?', count: 9, lastAsked: '2025-06-03', category: 'Orders' },
        { id: '5', query: 'What payment methods do you accept?', count: 7, lastAsked: '2025-06-02', category: 'Payments' },
      ]);
      setCoverage({ total: 120, answered: 87, coveragePercent: 72.5 });
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [tenantId, timeRange]);

  return (
    <div className="space-y-6">
      {/* Coverage Score Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-neutral-900">{coverage.total}</p>
            <p className="text-sm text-neutral-500">Total Queries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-green-600">{coverage.answered}</p>
            <p className="text-sm text-neutral-500">Answered by FAQ</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{coverage.coveragePercent.toFixed(1)}%</p>
            <p className="text-sm text-neutral-500">Coverage Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">Period:</span>
        {(['7d', '30d', '90d'] as const).map((range) => (
          <Button
            key={range}
            size="sm"
            variant={timeRange === range ? 'default' : 'outline'}
            onClick={() => setTimeRange(range)}
          >
            {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
          </Button>
        ))}
      </div>

      {/* Ranked Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      ) : queries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No unanswered queries found in this period.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unanswered Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-3 font-medium text-neutral-500">#</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500">Query</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500">Category</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-500">Times Asked</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500">Last Asked</th>
                  <th className="text-right py-2 px-3 font-medium text-neutral-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((q, i) => (
                  <tr key={q.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-2 px-3 text-neutral-400">{i + 1}</td>
                    <td className="py-2 px-3 font-medium text-neutral-900">{q.query}</td>
                    <td className="py-2 px-3">
                      {q.category ? (
                        <Badge variant="outline">{q.category}</Badge>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-neutral-700">{q.count}</td>
                    <td className="py-2 px-3 text-neutral-500">{q.lastAsked}</td>
                    <td className="py-2 px-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => onCreateFaq?.(q.query)}
                      >
                        <Plus className="w-3 h-3" /> Create FAQ
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

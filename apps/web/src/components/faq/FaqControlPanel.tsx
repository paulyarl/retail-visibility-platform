'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  HelpCircle,
  BarChart3,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { faqService } from '@/services/FaqService';

interface CoverageMetrics {
  totalFaqs: number;
  activeFaqs: number;
  draftFaqs: number;
  archivedFaqs: number;
  totalCategories: number;
  categoriesWithFaqs: number;
  categoryCoveragePercent: number;
  totalProducts: number;
  productsWithFaqs: number;
  productCoveragePercent: number;
  freshnessPercent: number;
  orphanFaqs: number;
  feedbackUp: number;
  feedbackDown: number;
  feedbackSuggestEdit: number;
  helpfulnessPercent: number;
}

interface FaqControlPanelProps {
  tenantId: string;
}

export default function FaqControlPanel({ tenantId }: FaqControlPanelProps) {
  const [metrics, setMetrics] = useState<CoverageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCoverage() {
      try {
        const data = await faqService.getCoverage(tenantId);
        setMetrics(data);
      } catch (err: any) {
        setError(err?.message || 'Network error');
      } finally {
        setLoading(false);
      }
    }
    if (tenantId) fetchCoverage();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const statCards = [
    {
      label: 'Total FAQs',
      value: metrics.totalFaqs,
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      detail: `${metrics.activeFaqs} active, ${metrics.draftFaqs} draft, ${metrics.archivedFaqs} archived`,
    },
    {
      label: 'Category Coverage',
      value: `${metrics.categoryCoveragePercent.toFixed(0)}%`,
      icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
      detail: `${metrics.categoriesWithFaqs} of ${metrics.totalCategories} categories have active FAQs`,
      color: metrics.categoryCoveragePercent >= 80 ? 'green' : metrics.categoryCoveragePercent >= 50 ? 'yellow' : 'red',
    },
    {
      label: 'Product Coverage',
      value: `${metrics.productCoveragePercent.toFixed(0)}%`,
      icon: <Users className="w-5 h-5 text-purple-600" />,
      detail: `${metrics.productsWithFaqs} of ${metrics.totalProducts} products linked`,
    },
    {
      label: 'Freshness',
      value: `${metrics.freshnessPercent.toFixed(0)}%`,
      icon: <BarChart3 className="w-5 h-5 text-orange-600" />,
      detail: 'Updated within 90 days',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3 mb-2">
                {stat.icon}
                <span className="text-sm text-neutral-500">{stat.label}</span>
              </div>
              <p className="text-2xl font-semibold text-neutral-900">{stat.value}</p>
              <p className="text-xs text-neutral-500 mt-1">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Health Checks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-700">Orphan FAQs (no category)</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{metrics.orphanFaqs}</span>
                {metrics.orphanFaqs > 0 ? (
                  <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Needs attention
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">OK</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-700">Category coverage</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{metrics.categoryCoveragePercent.toFixed(0)}%</span>
                {metrics.categoryCoveragePercent >= 80 ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Good</Badge>
                ) : metrics.categoryCoveragePercent >= 50 ? (
                  <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Fair</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Poor</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-700">Content freshness</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{metrics.freshnessPercent.toFixed(0)}%</span>
                {metrics.freshnessPercent >= 70 ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Fresh</Badge>
                ) : (
                  <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Stale</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feedback Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-semibold text-green-600">{metrics.feedbackUp}</p>
              <p className="text-sm text-neutral-500">Thumbs Up</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-red-500">{metrics.feedbackDown}</p>
              <p className="text-sm text-neutral-500">Thumbs Down</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-blue-600">{metrics.feedbackSuggestEdit}</p>
              <p className="text-sm text-neutral-500">Suggested Edits</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-200 text-center">
            <p className="text-sm text-neutral-500">
              Helpfulness score: <span className="font-semibold text-neutral-900">{metrics.helpfulnessPercent.toFixed(0)}%</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

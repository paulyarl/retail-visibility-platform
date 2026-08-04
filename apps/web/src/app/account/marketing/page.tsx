'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, TrendingUp, CheckCircle, Clock, Download, ArrowRight } from 'lucide-react';
import marketingCustomerService, {
  CustomerPortalOverview,
} from '@/services/MarketingCustomerService';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function MarketingOverviewPage() {
  const [overview, setOverview] = useState<CustomerPortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await marketingCustomerService.getOverview();
        setOverview(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!overview) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Services</h1>
        <p className="text-gray-500 mt-1">Track your marketing purchases and deliverables</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Spent</p>
              <p className="text-xl font-bold text-gray-900">{formatPrice(overview.totalSpentCents)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Engagements</p>
              <p className="text-xl font-bold text-gray-900">{overview.activeEngagements}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Deliverables Ready</p>
              <p className="text-xl font-bold text-gray-900">{overview.deliverablesReady}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Your Campaigns</h2>
        </div>
        {overview.campaigns.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No campaigns yet. Once you purchase a marketing package, it will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {overview.campaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/account/marketing/campaigns/${campaign.id}`}
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{campaign.businessName}</p>
                    <p className="text-sm text-gray-500">{campaign.serviceCategoryLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      campaign.status.status === 'delivered' ? 'bg-green-50 text-green-700' :
                      campaign.status.status === 'in_production' ? 'bg-blue-50 text-blue-700' :
                      campaign.status.status === 'active_plan' ? 'bg-purple-50 text-purple-700' :
                      'bg-gray-50 text-gray-700'
                    }`}>
                      {campaign.status.label}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">Paid {formatDate(campaign.datePaid)}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent purchases */}
      {overview.recentPurchases.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Purchases</h2>
            <Link href="/account/marketing/purchases" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {overview.recentPurchases.slice(0, 5).map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{purchase.businessName}</p>
                  <p className="text-xs text-gray-500">{purchase.serviceCategoryLabel} · {formatDate(purchase.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{formatPrice(purchase.amountCents)}</span>
                  <a
                    href={purchase.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-blue-600"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

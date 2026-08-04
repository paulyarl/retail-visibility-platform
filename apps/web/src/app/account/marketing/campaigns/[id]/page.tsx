'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, CheckCircle, Clock, Package, ExternalLink } from 'lucide-react';
import marketingCustomerService, {
  CustomerCampaignProjection,
} from '@/services/MarketingCustomerService';

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CampaignDetailPage() {
  const params = useParams();
  const campaignId = (params?.id as string) || '';

  const [campaign, setCampaign] = useState<CustomerCampaignProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await marketingCustomerService.getCampaign(campaignId);
        setCampaign(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load campaign');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/account/marketing" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> Back to My Services
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Campaign not found'}
        </div>
      </div>
    );
  }

  // Build timeline steps (§7.3)
  const timeline = [
    { label: 'Payment received', date: campaign.datePaid, done: !!campaign.datePaid },
    { label: 'In production', date: null, done: campaign.status.status === 'in_production' || campaign.status.status === 'delivered' || campaign.status.status === 'completed' },
    { label: 'Delivered', date: campaign.dateDelivered, done: campaign.status.status === 'delivered' || campaign.status.status === 'completed' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/account/marketing" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" /> Back to My Services
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campaign.businessName}</h1>
            <p className="text-gray-500 mt-1">{campaign.serviceCategoryLabel} · {campaign.city}</p>
            <p className="text-xs text-gray-400 mt-2">Order reference: {campaign.displayId}</p>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            campaign.status.status === 'delivered' ? 'bg-green-50 text-green-700' :
            campaign.status.status === 'in_production' ? 'bg-blue-50 text-blue-700' :
            campaign.status.status === 'active_plan' ? 'bg-purple-50 text-purple-700' :
            'bg-gray-50 text-gray-700'
          }`}>
            {campaign.status.label}
          </span>
        </div>
      </div>

      {/* Timeline (§7.3) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Progress</h2>
        <div className="space-y-4">
          {timeline.map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step.done ? 'bg-green-50' : 'bg-gray-100'
              }`}>
                {step.done ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium ${step.done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</p>
                {step.date && <p className="text-sm text-gray-500">{formatDate(step.date)}</p>}
              </div>
              {i < timeline.length - 1 && (
                <div className={`absolute left-7 w-0.5 h-8 ${step.done ? 'bg-green-200' : 'bg-gray-200'}`} style={{ marginTop: '40px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Deliverables */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Deliverables</h2>
        </div>
        {campaign.deliverables.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Deliverables will appear here once ready.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {campaign.deliverables.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{d.title}</p>
                    <p className="text-xs text-gray-500">
                      {d.deliveredAt ? `Delivered ${formatDate(d.deliveredAt)}` : 'Pending'}
                    </p>
                  </div>
                </div>
                {d.downloadUrl && (
                  <a
                    href={d.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipts */}
      {campaign.receipts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Receipts</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {campaign.receipts.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{formatPrice(r.amountCents)}</p>
                  <p className="text-xs text-gray-500">{formatDate(r.date)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/account/marketing/receipts/${r.revenueId}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View
                  </Link>
                  <a
                    href={r.receiptUrl}
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

      {/* Website link */}
      {campaign.websiteUrl && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <a
            href={campaign.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-600 hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            Visit business website
          </a>
        </div>
      )}
    </div>
  );
}

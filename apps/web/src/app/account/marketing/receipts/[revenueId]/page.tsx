'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import marketingCustomerService, { ReceiptViewModel } from '@/services/MarketingCustomerService';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ReceiptViewPage() {
  const params = useParams();
  const revenueId = (params?.revenueId as string) || '';

  const [receipt, setReceipt] = useState<ReceiptViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await marketingCustomerService.getReceipt(revenueId);
        setReceipt(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [revenueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/account/marketing/purchases" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> Back to Purchases
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Receipt not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/account/marketing/purchases" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" /> Back to Purchases
      </Link>

      {/* Receipt card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Receipt</h1>
              <p className="text-sm text-gray-500 mt-1">{formatDate(receipt.date)}</p>
            </div>
            <a
              href={marketingCustomerService.getReceiptPdfUrl(receipt.revenueId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Download className="w-4 h-4" /> Download PDF
            </a>
          </div>
        </div>

        {/* Business info */}
        <div className="p-8 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{receipt.businessName}</h2>
          {receipt.city && <p className="text-sm text-gray-500">{receipt.city}</p>}
          <p className="text-sm text-gray-700 mt-2">{receipt.serviceCategoryLabel}</p>
        </div>

        {/* Line items */}
        <div className="p-8 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Service</span>
            <span className="text-gray-900 font-medium">{receipt.serviceCategoryLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Amount</span>
            <span className="text-gray-900">{formatPrice(receipt.amountCents)}</span>
          </div>
          {receipt.discountCents > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Discount</span>
              <span className="text-green-600">-{formatPrice(receipt.discountCents)}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-bold text-gray-900 text-lg">{formatPrice(receipt.totalCents)}</span>
          </div>
        </div>

        {/* Customer info */}
        {(receipt.customerName || receipt.customerEmail || receipt.billingAddress) && (
          <div className="p-8 border-t border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Billed To</h3>
            {receipt.customerName && <p className="text-sm text-gray-900">{receipt.customerName}</p>}
            {receipt.customerEmail && <p className="text-sm text-gray-500">{receipt.customerEmail}</p>}
            {receipt.billingAddress && <p className="text-sm text-gray-500 mt-1">{receipt.billingAddress}</p>}
          </div>
        )}

        {/* QR block (§7.4) */}
        {receipt.qrDestinationUrl && (
          <div className="p-8 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-3">Scan to visit {receipt.businessName}</p>
            <div className="inline-block p-4 bg-white border border-gray-200 rounded-lg">
              {/* QR is rendered client-side via qr-code-styling or an img tag;
                  the PDF service composites it server-side. For the HTML view,
                  we use a simple QR code image API as a fallback. */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(receipt.qrDestinationUrl)}`}
                alt={`QR code for ${receipt.businessName}`}
                className="w-36 h-36"
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 truncate max-w-xs mx-auto">{receipt.qrDestinationUrl}</p>
          </div>
        )}
      </div>
    </div>
  );
}

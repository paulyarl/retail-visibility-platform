'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Store,
  ArrowRight,
  Sparkles,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { qrScanService } from '@/services/QrScanService';

interface QRTenantInfo {
  tenantId: string;
  tenantName: string;
  subdomain: string | null;
  slug: string | null;
  isDemo: boolean;
}

export default function QRLandingPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.tenantId as string;

  const [tenantInfo, setTenantInfo] = useState<QRTenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function trackAndFetch() {
      try {
        const data = await qrScanService.trackScan(tenantId, {
          source: 'qr_code',
          referrer: document.referrer || null,
          userAgent: navigator.userAgent,
        });
        if (data) {
          setTenantInfo(data);
        }
      } catch (err) {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      trackAndFetch();
    }
  }, [tenantId]);

  function handleVisitStore() {
    if (tenantInfo?.subdomain) {
      window.location.href = `https://${tenantInfo.subdomain}.visibleshelf.com`;
    } else if (tenantInfo?.slug) {
      router.push(`/tenant/${tenantInfo.slug}`);
    } else {
      router.push(`/tenant/${tenantId}`);
    }
  }

  function handleSignup() {
    router.push(`/signup?demo=${tenantId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-neutral-900 dark:to-neutral-800">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading demo store...</p>
        </div>
      </div>
    );
  }

  if (error || !tenantInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-neutral-900 dark:to-neutral-800">
        <div className="text-center max-w-md p-8">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Store Not Found
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            This QR code may be expired or invalid. Please contact the person who shared it with you.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Go to VisibleShelf
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900">
      {/* Demo Banner */}
      {tenantInfo.isDemo && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 text-center text-sm font-medium">
          <Sparkles className="w-4 h-4 inline mr-1" />
          This is a demo store — explore the VisibleShelf platform
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-6">
            <Store className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-3">
            {tenantInfo.tenantName}
          </h1>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">
            You scanned a QR code to get here. Welcome!
          </p>
        </div>

        {/* Demo Info Card */}
        {tenantInfo.isDemo && (
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-8 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
                  This is a Live Demo
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Explore a fully functional online store powered by VisibleShelf. Browse products,
                  check out features, and see what your store could look like.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <Package className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <p className="text-xs text-neutral-600 dark:text-neutral-400">Real Products</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-neutral-600 dark:text-neutral-400">Full Features</p>
              </div>
              <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                <p className="text-xs text-neutral-600 dark:text-neutral-400">Time-Limited</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleVisitStore}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
              >
                Visit Demo Store
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleSignup}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors"
              >
                Get Your Own Store
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Non-demo: just redirect */}
        {!tenantInfo.isDemo && (
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-8 text-center">
            <Store className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
              {tenantInfo.tenantName}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              Redirecting you to the store...
            </p>
            <button
              onClick={handleVisitStore}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Visit Store
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-neutral-400 dark:text-neutral-500">
            Powered by{' '}
            <span className="font-semibold text-neutral-600 dark:text-neutral-400">VisibleShelf</span>
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            QR scan tracked at {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Download, Package, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert } from '@/components/ui';

interface DigitalDownload {
  accessToken: string;
  productName: string;
  deliveryMethod: string;
  licenseType: string;
  downloadCount: number;
  downloadLimit: number | null;
  downloadsRemaining: number | null;
  expiresAt: Date | null;
  isExpired: boolean;
  isRevoked: boolean;
  asset: {
    name: string;
    fileSize: number;
  } | null;
}

interface OrderDetailsClientProps {
  orderId: string;
}

export default function OrderDetailsClient({ orderId }: OrderDetailsClientProps) {
  const [downloads, setDownloads] = useState<DigitalDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDownloads();
  }, [orderId]);

  const fetchDownloads = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/download/orders/${orderId}/downloads`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch downloads');
      }

      const data = await response.json();
      setDownloads(data.downloads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load downloads');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (accessToken: string) => {
    window.open(`/api/download/${accessToken}`, '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(date));
  };

  const getDaysRemaining = (expiresAt: Date | null): number | null => {
    if (!expiresAt) return null;
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="space-y-3 mt-8">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Alert variant="error" title="Error">
            {error}
          </Alert>
        </div>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Digital Products</h2>
            <p className="text-gray-600">This order does not contain any digital products.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Digital Downloads</h1>
          <p className="text-gray-600">Order #{orderId.slice(0, 8).toUpperCase()}</p>
        </div>

        {/* Download Items */}
        <div className="space-y-4">
          {downloads.map((download) => {
            const daysRemaining = getDaysRemaining(download.expiresAt);
            const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;
            const canDownload = !download.isExpired && !download.isRevoked && 
              (download.downloadsRemaining === null || download.downloadsRemaining > 0);

            return (
              <div
                key={download.accessToken}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="p-6">
                  {/* Product Name */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-1">
                        💾 {download.productName}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {download.licenseType.charAt(0).toUpperCase() + download.licenseType.slice(1)} License
                      </p>
                    </div>
                  </div>

                  {/* Download Button */}
                  {canDownload ? (
                    <button
                      onClick={() => handleDownload(download.accessToken)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors mb-4"
                    >
                      <Download className="w-5 h-5" />
                      Download Now
                    </button>
                  ) : (
                    <div className="mb-4">
                      <Alert variant="error" title="Download Unavailable">
                        {download.isExpired && 'Access has expired'}
                        {download.isRevoked && 'Access has been revoked'}
                        {!download.isExpired && !download.isRevoked && download.downloadsRemaining === 0 && 
                          'Download limit reached'}
                      </Alert>
                    </div>
                  )}

                  {/* Download Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {/* Downloads Remaining */}
                    <div className="flex items-center gap-2 text-gray-700">
                      <Download className="w-4 h-4 text-gray-400" />
                      <span>
                        {download.downloadLimit === null ? (
                          'Unlimited downloads'
                        ) : (
                          <>
                            <span className="font-medium">{download.downloadsRemaining}</span> of{' '}
                            <span className="font-medium">{download.downloadLimit}</span> downloads remaining
                          </>
                        )}
                      </span>
                    </div>

                    {/* Access Duration */}
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>
                        {download.expiresAt === null ? (
                          'Lifetime access'
                        ) : (
                          <>
                            {download.isExpired ? (
                              <span className="text-red-600 font-medium">Expired</span>
                            ) : (
                              <>
                                {isExpiringSoon && (
                                  <span className="text-orange-600 font-medium">
                                    ⚠️ {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining
                                  </span>
                                )}
                                {!isExpiringSoon && (
                                  <span>
                                    Expires {formatDate(download.expiresAt)}
                                  </span>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </span>
                    </div>

                    {/* File Size */}
                    {download.asset && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span>File size: {formatFileSize(download.asset.fileSize)}</span>
                      </div>
                    )}

                    {/* Download Count */}
                    <div className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-4 h-4 text-gray-400" />
                      <span>Downloaded {download.downloadCount} {download.downloadCount === 1 ? 'time' : 'times'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 Download Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-blue-900 text-sm">
            <li>Click the "Download Now" button above</li>
            <li>Files will download directly to your device</li>
            <li>Save files to a secure location</li>
          </ol>
          <p className="mt-4 text-sm text-blue-800">
            🔒 Your download links are unique and secure. Do not share them with others.
          </p>
        </div>

        {/* Support */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>Need help? Contact support for assistance.</p>
        </div>
      </div>
    </div>
  );
}

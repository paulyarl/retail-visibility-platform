'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Package, Calendar, Download, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { customerOrderService } from '@/services/CustomerOrderService';
import { publicDownloadService } from '@/services/downloads/PublicDownloadService';

export interface DownloadItem {
  productName: string;
  licenseType?: string;
  accessToken: string;
  downloadCount: number;
  downloadLimit: number | null;
  downloadsRemaining: number | null;
  expiresAt: string | null;
  isExpired: boolean;
  isRevoked: boolean;
  asset?: {
    name: string;
    type: string;
    fileSize: number;
    mimeType: string;
    assetType?: 'file' | 'link' | 'license_key' | 'access_grant';
    externalUrl?: string;
    requiresLicenseKey?: boolean;
  };
}

interface DigitalDownloadsCardProps {
  orderId: string;
  downloads?: DownloadItem[];
  onDownload?: (accessToken: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function DigitalDownloadsCard({ orderId, downloads: propDownloads, onDownload }: DigitalDownloadsCardProps) {
  const [downloads, setDownloads] = useState<DownloadItem[]>(propDownloads || []);
  const [loading, setLoading] = useState(!propDownloads);

  useEffect(() => {
    if (propDownloads) {
      setDownloads(propDownloads);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDownloads = async () => {
      try {
        setLoading(true);
        const data = await customerOrderService.getOrderDownloads(orderId);
        if (!cancelled) {
          setDownloads(data?.downloads || []);
        }
      } catch (error) {
        console.error('[DigitalDownloadsCard] Error fetching downloads:', error);
        if (!cancelled) {
          setDownloads([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDownloads();

    return () => { cancelled = true; };
  }, [orderId, propDownloads]);

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDownload = async (accessToken: string) => {
    if (onDownload) {
      onDownload(accessToken);
    } else {
      try {
        setDownloadError(null);
        setDownloading(true);
        setProgress(0);
        await publicDownloadService.validateAndDownloadWithProgress(
          accessToken,
          undefined,
          (prog) => setProgress(prog)
        );
      } catch (err) {
        setDownloadError(err instanceof Error ? err.message : 'Download failed');
      } finally {
        setDownloading(false);
      }
    }
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Digital Downloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (downloads.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Digital Downloads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {downloadError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {downloadError}
          </div>
        )}
        {downloading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Downloading... {Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {downloads.map((download) => {
          const daysRemaining = getDaysRemaining(download.expiresAt);
          const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;
          const canDownload = !download.isExpired && !download.isRevoked &&
            (download.downloadsRemaining === null || download.downloadsRemaining > 0);

          return (
            <div key={download.accessToken} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{download.productName}</h4>
                  {download.licenseType && (
                    <p className="text-sm text-gray-600">
                      {download.licenseType.charAt(0).toUpperCase() + download.licenseType.slice(1)} License
                    </p>
                  )}
                </div>
              </div>

              {canDownload ? (
                <button
                  onClick={() => handleDownload(download.accessToken)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors mb-3"
                >
                  <Package className="w-4 h-4" />
                  Download Now
                </button>
              ) : (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                  {download.isExpired && '⏰ Access has expired'}
                  {download.isRevoked && '🔒 Access has been revoked'}
                  {!download.isExpired && !download.isRevoked && download.downloadsRemaining === 0 &&
                    '📊 Download limit reached'}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span>
                    {download.downloadLimit === null ? (
                      'Unlimited downloads'
                    ) : (
                      <>
                        <span className="font-medium">{download.downloadsRemaining}</span> of{' '}
                        <span className="font-medium">{download.downloadLimit}</span> remaining
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
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
                                ⚠️ {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
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

                {download.asset && (
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span>Size: {formatFileSize(download.asset.fileSize)}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-400" />
                  <span>Downloaded {download.downloadCount} {download.downloadCount === 1 ? 'time' : 'times'}</span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900 mb-2">
            💡 <strong>Download Instructions:</strong>
          </p>
          <ol className="list-decimal list-inside text-sm text-blue-900 space-y-1 ml-2">
            <li>Click "Download Now" button above</li>
            <li>Files will download directly to your device</li>
            <li>Save files to a secure location</li>
          </ol>
          <p className="text-xs text-blue-800 mt-3">
            🔒 Your download links are unique and secure. Do not share them with others.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

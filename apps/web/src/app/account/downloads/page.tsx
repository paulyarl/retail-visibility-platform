'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerOrderService, CustomerOrder } from '@/services/CustomerOrderService';
import { Package, Download, ExternalLink, Calendar, AlertTriangle, CheckCircle, XCircle, File, Link as LinkIcon, Key, Shield, Clock } from 'lucide-react';
import DownloadProgress, { DownloadProgressCompact } from '@/components/downloads/DownloadProgress';
import { publicDownloadService } from '@/services/downloads/PublicDownloadService';

interface DigitalDownload {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  tenantId: string;
  tenantName: string;
  itemId: string;
  productName: string;
  productType: 'digital' | 'hybrid' | 'physical';
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

export default function DigitalDownloadsPage() {
  const { customer } = useCustomerAuth();
  const [downloads, setDownloads] = useState<DigitalDownload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer?.email) {
      loadDownloads();
    }
  }, [customer?.email]);

  const loadDownloads = async () => {
    if (!customer?.email) return;
    
    try {
      setLoading(true);
      setError(null);

      // Get all customer orders
      const ordersResult = await customerOrderService.getCustomerOrders(customer.email, 1, 100);
      
      if (!ordersResult.orders) {
        setDownloads([]);
        return;
      }

      // Filter for orders with digital/hybrid products and get downloads
      const digitalDownloads: DigitalDownload[] = [];
      
      for (const order of ordersResult.orders) {
        // Check if order has digital/hybrid items
        const digitalItems = order.items?.filter(
          (item: any) => item.productType === 'digital' || item.productType === 'hybrid'
        );

        if (digitalItems && digitalItems.length > 0) {
          // Get downloads for this order
          const downloadsResult = await customerOrderService.getOrderDownloads(order.orderId);
          
          if (downloadsResult?.success && downloadsResult?.downloads) {
            for (const download of downloadsResult.downloads) {
              // Find matching item to get product details
              const matchingItem = digitalItems.find(
                (item: any) => item.itemId === download.inventoryItemId
              );

              if (matchingItem) {
                digitalDownloads.push({
                  orderId: order.orderId,
                  orderNumber: order.orderNumber,
                  orderDate: order.createdAt,
                  tenantId: order.tenantId,
                  tenantName: order.tenantName || 'Store',
                  itemId: download.inventoryItemId,
                  productName: matchingItem.name,
                  productType: matchingItem.productType || 'digital',
                  accessToken: download.accessToken,
                  downloadCount: download.downloadCount,
                  downloadLimit: download.downloadLimit,
                  downloadsRemaining: download.downloadsRemaining,
                  expiresAt: download.expiresAt,
                  isExpired: download.isExpired,
                  isRevoked: download.isRevoked,
                  asset: download.asset,
                });
              }
            }
          }
        }
      }

      // Sort by order date (newest first)
      digitalDownloads.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
      
      setDownloads(digitalDownloads);
    } catch (err: any) {
      console.error('Failed to load digital downloads:', err);
      setError('Failed to load your digital downloads. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (accessToken: string, asset?: any) => {
    if (asset?.assetType === 'link' && asset.externalUrl) {
      window.open(asset.externalUrl, '_blank');
    } else if (asset?.requiresLicenseKey) {
      // For license keys, we'll need to implement license key retrieval
      window.open(`/api/download/${accessToken}`, '_blank');
    } else {
      window.open(`/api/download/${accessToken}`, '_blank');
    }
  };

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < sizes.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAssetIcon = (type?: string) => {
    switch (type) {
      case 'file':
        return <File className="w-5 h-5" />;
      case 'link':
        return <LinkIcon className="w-5 h-5" />;
      case 'license_key':
        return <Key className="w-5 h-5" />;
      default:
        return <Download className="w-5 h-5" />;
    }
  };

  const getAssetTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      file: 'File Download',
      link: 'External Link',
      license_key: 'License Key',
      access_grant: 'Access Grant',
    };
    return labels[type || ''] || 'Download';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="w-6 h-6" />
          Digital Downloads
        </h1>
        <p className="text-gray-600 mt-1">
          Access your digital products and downloads
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <Button onClick={loadDownloads} className="mt-2" size="sm">
            Try Again
          </Button>
        </div>
      )}

      {downloads.length === 0 ? (
        <Card className="text-center py-12">
          <Download className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No digital downloads</h3>
          <p className="text-gray-500">
            You haven't purchased any digital products yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {downloads.map((download) => {
            const daysRemaining = getDaysRemaining(download.expiresAt);
            const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;
            const canDownload = !download.isExpired && !download.isRevoked && 
              (download.downloadsRemaining === null || download.downloadsRemaining > 0);

            return (
              <Card key={download.accessToken}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {download.productName}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          download.productType === 'digital' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {download.productType === 'digital' ? 'Digital' : 'Hybrid'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Order: {download.orderNumber}</p>
                        <p>Store: {download.tenantName}</p>
                        <p>Purchased: {formatDate(download.orderDate)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canDownload ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : download.isExpired ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : download.isRevoked ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                </div>

                {/* Download Status and Actions */}
                <div className="mb-4">
                  {canDownload ? (
                    <div className="space-y-3">
                      {download.asset?.assetType === 'link' ? (
                        <Button
                          onClick={() => handleDownload(download.accessToken, download.asset)}
                          className="w-full sm:w-auto"
                          variant="outline"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open External Link
                        </Button>
                      ) : download.asset?.requiresLicenseKey ? (
                        <Button
                          onClick={() => handleDownload(download.accessToken, download.asset)}
                          className="w-full sm:w-auto"
                        >
                          <Key className="w-4 h-4 mr-2" />
                          Get License Key
                        </Button>
                      ) : (
                        <DownloadProgress
                          asset={{
                            id: download.itemId,
                            name: download.asset?.name || 'Download',
                            downloadUrl: `/api/download/${download.accessToken}`,
                            fileSize: download.asset?.fileSize,
                            mimeType: download.asset?.mimeType,
                          }}
                          accessToken={download.accessToken}
                          onDownloadComplete={() => {
                            // Refresh downloads to update count
                            loadDownloads();
                          }}
                          onDownloadError={(asset, error) => {
                            console.error('Download failed:', error);
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      {download.isExpired && '⏰ Access has expired'}
                      {download.isRevoked && '🔒 Access has been revoked'}
                      {!download.isExpired && !download.isRevoked && download.downloadsRemaining === 0 && 
                        '📊 Download limit reached'}
                    </div>
                  )}
                </div>

                {/* Asset Information */}
                <div className="space-y-3">
                  {/* Asset Type and Size */}
                  {download.asset && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {getAssetIcon(download.asset.assetType)}
                        <span>{getAssetTypeLabel(download.asset.assetType)}</span>
                      </div>
                      {download.asset.fileSize && (
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(download.asset.fileSize)}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Download Limits and Expiry */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Download className="w-4 h-4" />
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

                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
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
                                  <span>Expires {formatDate(download.expiresAt)}</span>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Download Count */}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package className="w-4 h-4" />
                    <span>Downloaded {download.downloadCount} {download.downloadCount === 1 ? 'time' : 'times'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}
    </div>
  );
}

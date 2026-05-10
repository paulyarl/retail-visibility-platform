'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { 
  Download, 
  File, 
  Link as LinkIcon, 
  Key, 
  Shield, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

interface DigitalAsset {
  id: string;
  assetName: string;
  assetType: string;
  fileSize?: number;
  fileMimeType?: string;
  externalUrl?: string;
  downloadMethod: string;
  requiresLicenseKey: boolean;
  isPrimary: boolean;
  displayOrder: number;
}

interface DownloadPageData {
  id: string;
  title: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  brandColor?: string;
  instructions?: string;
  thankYouMessage?: string;
  supportEmail?: string;
  supportUrl?: string;
  requireAuthentication: boolean;
  accessExpires: boolean;
  accessDurationDays?: number;
  downloadLimit?: number;
  allowMultipleDownloads: boolean;
  item: {
    id: string;
    name: string;
    productType: string;
    digitalDeliveryMethod: string;
  };
  assets: DigitalAsset[];
}

interface AccessValidation {
  granted: boolean;
  reason?: string;
  accessGrant?: {
    downloadCount: number;
    maxDownloads: number | null;
    expiresAt: string | null;
  };
}

export default function PublicDownloadPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params.tenantId as string;
  const slug = params.slug as string;
  const accessToken = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<DownloadPageData | null>(null);
  const [accessValidation, setAccessValidation] = useState<AccessValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingAssetId, setDownloadingAssetId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadDownloadPage();
  }, [tenantId, slug, accessToken]);

  const loadDownloadPage = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load download page data
      const pageResponse = await fetch(`/api/downloads/${tenantId}/${slug}`);
      if (!pageResponse.ok) {
        if (pageResponse.status === 404) {
          setError('Download page not found');
        } else {
          setError('Failed to load download page');
        }
        return;
      }

      const pageResult = await pageResponse.json();
      if (!pageResult.success) {
        setError(pageResult.error || 'Failed to load download page');
        return;
      }

      setPageData(pageResult.data);

      // Validate access if token is provided
      if (accessToken) {
        const accessResponse = await fetch(
          `/api/downloads/${tenantId}/${slug}/validate?token=${accessToken}`
        );
        const accessResult = await accessResponse.json();
        setAccessValidation(accessResult);
      } else {
        // No token provided - check if authentication is required
        setAccessValidation({
          granted: !pageResult.data.requireAuthentication,
          reason: pageResult.data.requireAuthentication ? 'TOKEN_REQUIRED' : undefined,
        });
      }
    } catch (err) {
      console.error('Error loading download page:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (asset: DigitalAsset) => {
    if (!accessToken) {
      setError('Access token required for download');
      return;
    }

    try {
      setDownloadingAssetId(asset.id);

      // Record the download
      const response = await fetch(`/api/downloads/${tenantId}/${slug}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accessToken,
          assetId: asset.id,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Download failed');
        return;
      }

      // Handle different asset types
      if (asset.assetType === 'link' && asset.externalUrl) {
        window.open(asset.externalUrl, '_blank');
      } else if (asset.assetType === 'file' && result.downloadUrl) {
        // Trigger file download
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = asset.assetName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (asset.requiresLicenseKey && result.licenseKey) {
        // Show license key
        setCopiedKey(result.licenseKey);
      }

      // Refresh access validation to update download count
      loadDownloadPage();
    } catch (err) {
      console.error('Download error:', err);
      setError('Download failed');
    } finally {
      setDownloadingAssetId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
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

  const getAssetIcon = (type: string) => {
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

  const getAssetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      file: 'File Download',
      link: 'External Link',
      license_key: 'License Key',
      access_grant: 'Access Grant',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Loading download page...</p>
        </div>
      </div>
    );
  }

  if (error && !pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Download Unavailable</h1>
          <p className="mt-2 text-gray-600">{error}</p>
        </Card>
      </div>
    );
  }

  if (!pageData) {
    return null;
  }

  const brandStyle = pageData.brandColor ? {
    '--brand-color': pageData.brandColor,
  } as React.CSSProperties : {};

  return (
    <div className="min-h-screen bg-gray-50" style={brandStyle}>
      {/* Banner */}
      {pageData.bannerUrl && (
        <div 
          className="h-48 bg-cover bg-center"
          style={{ backgroundImage: `url(${pageData.bannerUrl})` }}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          {pageData.logoUrl && (
            <img 
              src={pageData.logoUrl} 
              alt="Logo" 
              className="h-16 mx-auto mb-4"
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900">{pageData.title}</h1>
          {pageData.description && (
            <p className="mt-2 text-gray-600">{pageData.description}</p>
          )}
        </div>

        {/* Access Status */}
        {accessValidation && !accessValidation.granted && (
          <Alert variant="warning" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <div>
              <p className="font-medium">Access Required</p>
              <p className="text-sm mt-1">
                {accessValidation.reason === 'TOKEN_REQUIRED' && (
                  <>
                    Please use the download link from your purchase confirmation email.
                    <a 
                      href={`mailto:${pageData.supportEmail}?subject=Download Access Issue`}
                      className="block mt-2 text-blue-600 hover:underline"
                    >
                      Contact support for assistance
                    </a>
                  </>
                )}
                {accessValidation.reason === 'ACCESS_EXPIRED' && (
                  'Your download access has expired. Please contact support for assistance.'
                )}
                {accessValidation.reason === 'DOWNLOAD_LIMIT_REACHED' && (
                  'You have reached the maximum number of downloads allowed.'
                )}
                {accessValidation.reason === 'INVALID_TOKEN' && (
                  'The download link is invalid or has been revoked.'
                )}
              </p>
            </div>
          </Alert>
        )}

        {/* Access Info */}
        {accessValidation?.granted && accessValidation.accessGrant && (
          <Card className="mb-6 p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Access Verified</span>
                </div>
                {accessValidation.accessGrant.maxDownloads && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Download className="w-4 h-4" />
                    <span>
                      {accessValidation.accessGrant.downloadCount} / {accessValidation.accessGrant.maxDownloads} downloads
                    </span>
                  </div>
                )}
                {accessValidation.accessGrant.expiresAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>
                      Expires: {new Date(accessValidation.accessGrant.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Instructions */}
        {pageData.instructions && (
          <Card className="mb-6 p-4 bg-blue-50 border-blue-200">
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Download Instructions</p>
                <p className="whitespace-pre-wrap">{pageData.instructions}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Assets */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Available Downloads</h2>
          
          {pageData.assets.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              No downloads available at this time.
            </Card>
          ) : (
            pageData.assets
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((asset) => (
                <Card key={asset.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                        {getAssetIcon(asset.assetType)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{asset.assetName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {getAssetTypeLabel(asset.assetType)}
                          </Badge>
                          {asset.fileSize && (
                            <span className="text-xs text-gray-500">
                              {formatFileSize(asset.fileSize)}
                            </span>
                          )}
                          {asset.isPrimary && (
                            <Badge variant="default" className="text-xs">
                              Primary
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleDownload(asset)}
                      disabled={!accessValidation?.granted || downloadingAssetId === asset.id}
                      className="flex items-center gap-2"
                    >
                      {downloadingAssetId === asset.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : asset.assetType === 'link' ? (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          <span>Open Link</span>
                        </>
                      ) : asset.requiresLicenseKey ? (
                        <>
                          <Key className="w-4 h-4" />
                          <span>Get Key</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Download</span>
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ))
          )}
        </div>

        {/* Thank You Message */}
        {pageData.thankYouMessage && (
          <Card className="mt-8 p-6 text-center bg-green-50 border-green-200">
            <CheckCircle className="w-8 h-8 mx-auto text-green-600" />
            <p className="mt-4 text-green-800">{pageData.thankYouMessage}</p>
          </Card>
        )}

        {/* Support */}
        <div className="mt-8 text-center text-sm text-gray-500">
          {pageData.supportEmail && (
            <p>
              Need help?{' '}
              <a 
                href={`mailto:${pageData.supportEmail}`}
                className="text-blue-600 hover:underline"
              >
                Contact Support
              </a>
            </p>
          )}
          {pageData.supportUrl && (
            <p className="mt-1">
              <a 
                href={pageData.supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Visit Support Center
              </a>
            </p>
          )}
        </div>
      </div>

      {/* License Key Modal/Toast */}
      {copiedKey && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <Key className="w-5 h-5" />
          <span className="font-mono">{copiedKey}</span>
          <button
            onClick={() => copyToClipboard(copiedKey)}
            className="p-1 hover:bg-gray-700 rounded"
          >
            {copiedKey === copiedKey ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

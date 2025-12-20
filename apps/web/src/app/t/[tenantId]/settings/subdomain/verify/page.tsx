'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, API_BASE_URL } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Globe,
  Link as LinkIcon,
  Eye,
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';

interface Product {
  id: string;
  name: string;
  sku: string;
  imageUrl?: string;
}

interface SubdomainStatus {
  hasSubdomain: boolean;
  subdomain: string | null;
  platformDomain: string;
  isLive: boolean;
  sampleProducts: Product[];
}

export default function SubdomainVerificationPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SubdomainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId && !accessLoading) {
      if (!hasAccess) {
        router.push('/login');
        return;
      }
      loadVerificationStatus();
    }
  }, [tenantId, hasAccess, accessLoading]);

  const loadVerificationStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get tenant subdomain status
      const tenantRes = await api.get(`/api/tenants/${tenantId}`);
      if (!tenantRes.ok) throw new Error('Failed to load tenant data');

      const tenant = await tenantRes.json();
      const subdomain = tenant.subdomain || null;
      const hasSubdomain = !!(subdomain && subdomain.trim().length > 0);

      // Detect platform domain
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'visibleshelf.com';
      let platformDomain = 'visibleshelf.com';
      if (hostname.endsWith('.visibleshelf.com')) {
        platformDomain = 'visibleshelf.com';
      } else if (hostname.endsWith('.visibleshelf.store')) {
        platformDomain = 'visibleshelf.store';
      } else if (hostname.endsWith('.localhost')) {
        platformDomain = 'localhost';
      }

      // Get sample products for testing
      const productsRes = await api.get(`/api/items?tenantId=${tenantId}&limit=3`);
      let sampleProducts: Product[] = [];
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        sampleProducts = (productsData.items || productsData.data || []).slice(0, 3);
      }

      // Check if subdomain is live (this is a basic check - in production you might want more sophisticated verification)
      const isLive = hasSubdomain && platformDomain !== 'localhost'; // For localhost, we'd need special handling

      setStatus({
        hasSubdomain,
        subdomain,
        platformDomain,
        isLive,
        sampleProducts,
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load verification status');
    } finally {
      setLoading(false);
    }
  };

  const getSubdomainUrl = (path: string = '') => {
    if (!status?.hasSubdomain) return null;
    return `https://${status.subdomain}.${status.platformDomain}${path}`;
  };

  const getProductUrl = (productId: string) => {
    if (!status?.hasSubdomain) return `/products/${productId}`;
    return `https://${status.subdomain}.${status.platformDomain}/products/${productId}`;
  };

  if (accessLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-neutral-400">Loading verification status...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-neutral-400">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/t/${tenantId}/settings/subdomain`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Subdomain Settings
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-neutral-100 mb-2">
            Subdomain Verification
          </h1>
          <p className="text-gray-600 dark:text-neutral-400">
            Confirm your custom subdomain is live and working correctly
          </p>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 mb-6">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Status Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Subdomain Status
            </CardTitle>
            <CardDescription>
              Current configuration and live status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Subdomain Configured:</span>
                <div className="flex items-center gap-2">
                  {status?.hasSubdomain ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 dark:text-green-300 font-medium">
                        {status.subdomain}.{status.platformDomain}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-red-700 dark:text-red-300">Not configured</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-medium">Live Status:</span>
                <div className="flex items-center gap-2">
                  {status?.isLive ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 dark:text-green-300">Live</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-orange-600" />
                      <span className="text-orange-700 dark:text-orange-300">
                        {status?.hasSubdomain ? 'Testing required' : 'Configure subdomain first'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {status?.hasSubdomain && (
                <div className="pt-4 border-t border-gray-200 dark:border-neutral-700">
                  <p className="text-sm text-gray-600 dark:text-neutral-400 mb-3">
                    Test your subdomain by visiting these URLs:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-blue-600" />
                      <a
                        href={getSubdomainUrl() || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                      >
                        {getSubdomainUrl()}
                      </a>
                      <ExternalLink className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product Testing */}
        {status?.hasSubdomain && status.sampleProducts.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Test Product Pages
              </CardTitle>
              <CardDescription>
                Verify that product pages load correctly with your subdomain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {status.sampleProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-neutral-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-neutral-100">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-neutral-400">
                          SKU: {product.sku}
                        </p>
                      </div>
                    </div>
                    <a
                      href={getProductUrl(product.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      Test
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={loadVerificationStatus}
            disabled={loading}
            variant="secondary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>

          {status?.hasSubdomain && (
            <Link
              href={`/t/${tenantId}/settings/subdomain`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              <Globe className="w-4 h-4" />
              Manage Subdomain
            </Link>
          )}

          {!status?.hasSubdomain && (
            <Link
              href={`/t/${tenantId}/settings/subdomain`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              <Globe className="w-4 h-4" />
              Configure Subdomain
            </Link>
          )}
        </div>

        {/* Help */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Need Help?
          </h3>
          <p className="text-blue-800 dark:text-blue-200 mb-4">
            If your subdomain isn't working as expected, check these common issues:
          </p>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• DNS propagation may take up to 24-48 hours</li>
            <li>• Make sure your subdomain only contains lowercase letters, numbers, and hyphens</li>
            <li>• The subdomain must not start or end with a hyphen</li>
            <li>• Try refreshing this page and testing again</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

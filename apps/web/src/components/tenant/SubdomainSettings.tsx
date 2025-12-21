'use client';

import { useParams } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Loader2, CheckCircle, AlertCircle, Info, Eye, Globe, ExternalLink, RefreshCw } from 'lucide-react';
import { api, API_BASE_URL } from '@/lib/api';

interface SubdomainSettingsProps {
  tenantId: string;
}

interface SubdomainCheckResult {
  available: boolean;
  valid: boolean;
  subdomain: string;
  message: string;
}

export default function SubdomainSettings({ tenantId }: SubdomainSettingsProps) {
  const [currentSubdomain, setCurrentSubdomain] = useState<string>('');
  const [newSubdomain, setNewSubdomain] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<SubdomainCheckResult | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [userSubdomains, setUserSubdomains] = useState<any[]>([]);
  const [loadingSubdomains, setLoadingSubdomains] = useState(false);

  // Detect platform domain for URL display
  const [platformDomain, setPlatformDomain] = useState<string>('visibleshelf.com');
  const [platformUrl, setPlatformUrl] = useState<string>('visibleshelf.com');

  useEffect(() => {
    // Detect platform domain from current hostname
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'visibleshelf.com';
    const port = typeof window !== 'undefined' ? window.location.port : '';

    // Check if hostname matches known platform domains
    if (hostname.endsWith('.visibleshelf.com')) {
      setPlatformDomain('visibleshelf.com');
      setPlatformUrl('visibleshelf.com');
    } else if (hostname.endsWith('.visibleshelf.store')) {
      setPlatformDomain('visibleshelf.store');
      setPlatformUrl('visibleshelf.store');
    } else if (hostname.endsWith('.localhost')) {
      setPlatformDomain('localhost');
      setPlatformUrl(port ? `localhost:${port}` : 'localhost');
    } else if (hostname === 'localhost') {
      setPlatformDomain('localhost');
      setPlatformUrl(port ? `localhost:${port}` : 'localhost');
    } else {
      // Fallback to production domain
      setPlatformDomain('visibleshelf.com');
      setPlatformUrl('visibleshelf.com');
    }

    loadCurrentSubdomain();
    loadUserSubdomains();
  }, [tenantId]);

  const loadCurrentSubdomain = async () => {
    try {
      const response = await api.get(`/api/tenants/${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentSubdomain(data.subdomain || '');
      }
    } catch (error) {
      console.error('Failed to load current subdomain:', error);
    }
  };

  const loadUserSubdomains = async () => {
    try {
      setLoadingSubdomains(true);
      const response = await api.get(`/api/tenants/my-subdomains?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        // Use API-provided URLs directly - they are dynamically detected based on request host
        setUserSubdomains(data.subdomains);
      }
    } catch (error) {
      console.error('Failed to load user subdomains:', error);
    } finally {
      setLoadingSubdomains(false);
    }
  };

  const checkSubdomainAvailability = async () => {
    if (!newSubdomain.trim()) return;

    setIsChecking(true);
    setCheckResult(null);
    setError('');

    try {
      const response = await api.get(`/api/tenants/check-subdomain/${newSubdomain}`);
      const result = await response.json();

      setCheckResult(result);
    } catch (error) {
      console.error('Failed to check subdomain:', error);
      setError('Failed to check subdomain availability');
    } finally {
      setIsChecking(false);
    }
  };

  const updateSubdomain = async () => {
    if (!newSubdomain.trim()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.put(`/api/tenants/${tenantId}/subdomain`, { subdomain: newSubdomain });

      const data = await response.json();

      if (response.ok) {
        setCurrentSubdomain(newSubdomain);
        setSuccess('Subdomain updated successfully!');
        setNewSubdomain('');
        setCheckResult(null);
      } else {
        setError(data.message || 'Failed to update subdomain');
      }
    } catch (error) {
      console.error('Failed to update subdomain:', error);
      setError('Failed to update subdomain');
    } finally {
      setIsLoading(false);
    }
  };

  const removeSubdomain = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.delete(`/api/tenants/${tenantId}/subdomain`);

      const data = await response.json();

      if (response.ok) {
        setCurrentSubdomain('');
        setSuccess('Subdomain removed successfully!');
        setNewSubdomain('');
        setCheckResult(null);
      } else {
        setError(data.message || 'Failed to remove subdomain');
      }
    } catch (error) {
      console.error('Failed to remove subdomain:', error);
      setError('Failed to remove subdomain');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUserSubdomain = async (targetTenantId: string, subdomain: string) => {
    if (!confirm(`Are you sure you want to remove the subdomain "${subdomain}"? This will stop it from being accessible.`)) {
      return;
    }

    try {
      const response = await api.delete(`/api/tenants/${targetTenantId}/subdomain`);
      if (response.ok) {
        // Refresh the subdomains list
        await loadUserSubdomains();
        // If this was the current tenant's subdomain, refresh current subdomain too
        if (targetTenantId === tenantId) {
          await loadCurrentSubdomain();
        }
        setSuccess('Subdomain removed successfully!');
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to remove subdomain');
      }
    } catch (error) {
      console.error('Failed to delete subdomain:', error);
      setError('Failed to remove subdomain');
    }
  };

  const getSubdomainUrl = (subdomain: string) => {
    return `https://${subdomain}.${platformUrl}`;
  };

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
          <Info className="h-5 w-5" />
          Custom Subdomain
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-300">
          Set up a custom subdomain for your Google Shopping listings. This helps with GMC domain compliance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 dark:bg-gray-800">
        {/* Current Subdomain Display */}
        {currentSubdomain && (
          <div className="space-y-2">
            <Label className="text-gray-900 dark:text-white">Current Subdomain</Label>
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">{currentSubdomain}.{platformDomain}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Your products will be accessible at {getSubdomainUrl(currentSubdomain)}
            </p>
          </div>
        )}

        {/* Subdomain Input */}
        <div className="space-y-2">
          <Label htmlFor="subdomain" className="text-gray-900 dark:text-white">
            {currentSubdomain ? 'Change Subdomain' : 'Set Subdomain'}
          </Label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                id="subdomain"
                type="text"
                placeholder="yourstore"
                value={newSubdomain}
                onChange={(e) => setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="pr-20"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                .{platformDomain}
              </span>
            </div>
            <Button
              variant="secondary"
              onClick={checkSubdomainAvailability}
              disabled={!newSubdomain.trim() || isChecking}
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Check'
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Use only lowercase letters, numbers, and hyphens. Cannot start or end with a hyphen.
          </p>
        </div>

        {/* Check Result */}
        {checkResult && (
          <Alert className={checkResult.available ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {checkResult.available ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={checkResult.available ? 'text-green-800' : 'text-red-800'}>
              {checkResult.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={updateSubdomain}
            disabled={!newSubdomain.trim() || !checkResult?.available || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {currentSubdomain ? 'Update Subdomain' : 'Set Subdomain'}
          </Button>

          {currentSubdomain && (
            <Button
              variant="secondary"
              onClick={removeSubdomain}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remove Subdomain
            </Button>
          )}

          {currentSubdomain && (
            <Link
              href={`/t/${tenantId}/settings/subdomain/verify`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              <Eye className="w-4 h-4" />
              Verify Subdomain
            </Link>
          )}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Help Text */}
        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
          <p className="text-gray-600 dark:text-gray-300">
            <strong className="text-gray-900 dark:text-gray-200">Why set a subdomain?</strong> Google Merchant Center requires product URLs to match your website domain for approval.
            Using a subdomain ensures your products are accessible from {platformUrl} while maintaining GMC compliance.
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            <strong className="text-gray-900 dark:text-gray-200">URL format:</strong> Your products will be accessible at https://yoursubdomain.{platformUrl}/products/...
          </p>
        </div>

        {/* Your Existing Subdomains */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 mb-4">
            Your Existing Subdomains
          </h3>

          {loadingSubdomains ? (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading subdomains...
            </div>
          ) : userSubdomains.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-neutral-400">
              No subdomains configured yet. Set up your first subdomain above.
            </p>
          ) : (
            <div className="space-y-3">
              {userSubdomains.map((subdomain) => (
                <div
                  key={`${subdomain.tenantId}-${subdomain.subdomain}`}
                  className="flex items-center justify-between p-4 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-gray-900 dark:text-neutral-100">
                        {subdomain.subdomain}.{platformDomain}
                      </span>
                      {subdomain.tenantId === tenantId && (
                        <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                          Current Tenant
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-neutral-400 mb-1">
                      {subdomain.tenantName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-neutral-500">
                      Created {new Date(subdomain.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={subdomain.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Visit
                    </a>
                    <button
                      onClick={() => deleteUserSubdomain(subdomain.tenantId, subdomain.subdomain)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 rounded transition-colors border border-red-200 dark:border-red-800"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

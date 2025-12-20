'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';

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

  // Detect platform domain for URL display
  const [platformDomain, setPlatformDomain] = useState<string>('visibleshelf.com');

  useEffect(() => {
    // Detect platform domain from current hostname
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'visibleshelf.com';

    // Check if hostname matches known platform domains
    if (hostname.endsWith('.visibleshelf.com')) {
      setPlatformDomain('visibleshelf.com');
    } else if (hostname.endsWith('.visibleshelf.store')) {
      setPlatformDomain('visibleshelf.store');
    } else if (hostname.endsWith('.localhost')) {
      setPlatformDomain('localhost');
    } else if (hostname === 'localhost') {
      setPlatformDomain('localhost');
    } else {
      // Fallback to production domain
      setPlatformDomain('visibleshelf.com');
    }

    loadCurrentSubdomain();
  }, [tenantId]);

  const loadCurrentSubdomain = async () => {
    try {
      const response = await fetch(`/api/tenants/${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentSubdomain(data.subdomain || '');
      }
    } catch (error) {
      console.error('Failed to load current subdomain:', error);
    }
  };

  const checkSubdomainAvailability = async () => {
    if (!newSubdomain.trim()) return;

    setIsChecking(true);
    setCheckResult(null);
    setError('');

    try {
      const response = await fetch(`/api/tenants/check-subdomain/${newSubdomain}`);
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
      const response = await fetch(`/api/tenants/${tenantId}/subdomain`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subdomain: newSubdomain }),
      });

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
      const response = await fetch(`/api/tenants/${tenantId}/subdomain`, {
        method: 'DELETE',
      });

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

  const getSubdomainUrl = (subdomain: string) => {
    return `https://${subdomain}.${platformDomain}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Custom Subdomain
        </CardTitle>
        <CardDescription>
          Set up a custom subdomain for your Google Shopping listings. This helps with GMC domain compliance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Subdomain Display */}
        {currentSubdomain && (
          <div className="space-y-2">
            <Label>Current Subdomain</Label>
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">{currentSubdomain}.{platformDomain}</span>
            </div>
            <p className="text-sm text-gray-600">
              Your products will be accessible at {getSubdomainUrl(currentSubdomain)}
            </p>
          </div>
        )}

        {/* Subdomain Input */}
        <div className="space-y-2">
          <Label htmlFor="subdomain">
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
          <p className="text-xs text-gray-500">
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
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>Why set a subdomain?</strong> Google Merchant Center requires product URLs to match your website domain for approval.
            Using a subdomain ensures your products are accessible from {platformDomain} while maintaining GMC compliance.
          </p>
          <p>
            <strong>URL format:</strong> Your products will be accessible at https://yoursubdomain.{platformDomain}/products/...
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

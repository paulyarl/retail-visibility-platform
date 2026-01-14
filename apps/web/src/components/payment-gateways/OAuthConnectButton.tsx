'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface OAuthConnectButtonProps {
  tenantId: string;
  gatewayType: 'paypal' | 'square';
  isConnected: boolean;
  merchantId?: string;
  expiresAt?: Date;
  onConnectionChange: () => void;
}

export default function OAuthConnectButton({
  tenantId,
  gatewayType,
  isConnected,
  merchantId,
  expiresAt,
  onConnectionChange,
}: OAuthConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gatewayName = gatewayType === 'paypal' ? 'PayPal' : 'Square';
  const gatewayColor = gatewayType === 'paypal' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-black hover:bg-gray-800';

  const handleConnect = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get authorization URL from backend
      const response = await api.get(
        `/api/oauth/${gatewayType}/authorize?tenantId=${tenantId}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate OAuth flow');
      }

      const { authorizationUrl } = await response.json();

      // Redirect to OAuth provider
      window.location.href = authorizationUrl;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect ${gatewayName}? You'll need to reconnect to process payments.`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/oauth/${gatewayType}/disconnect`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect');
      }

      onConnectionChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isConnected) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-green-900">Connected to {gatewayName}</p>
            {merchantId && (
              <p className="text-sm text-green-700 mt-1">
                Merchant ID: <span className="font-mono">{merchantId}</span>
              </p>
            )}
            {expiresAt && (
              <p className="text-xs text-green-600 mt-1">
                Token expires: {new Date(expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-600 mb-3">
          Connect your {gatewayName} account securely with OAuth. No need to manually enter credentials.
        </p>
        <Button
          onClick={handleConnect}
          disabled={loading}
          className={`${gatewayColor} text-white`}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect {gatewayName}
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p>✓ Secure OAuth 2.0 authentication</p>
        <p>✓ Automatic token refresh</p>
        <p>✓ No credential storage required</p>
      </div>
    </div>
  );
}

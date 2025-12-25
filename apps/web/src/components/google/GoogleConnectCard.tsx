"use client";

/**
 * Google Connect Suite Card
 * ENH-2026-043 + ENH-2026-044
 * 
 * Unified card for Google Merchant Center + Business Profile connection
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@/components/ui';

interface GoogleAccount {
  connected: boolean;
  email?: string;
  displayName?: string;
  profilePictureUrl?: string;
  scopes?: string[];
  merchantLinks?: number;
  gbpLocations?: number;
}

interface GoogleConnectCardProps {
  tenantId: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function GoogleConnectCard({ tenantId, onConnect, onDisconnect }: GoogleConnectCardProps) {
  const [account, setAccount] = useState<GoogleAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch connection status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/google/status?tenantId=${tenantId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch Google account status');
      }

      const data = await response.json();
      setAccount(data);
    } catch (err) {
      console.error('[GoogleConnect] Status fetch error:', err);
      setError('Failed to load Google account status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [tenantId]);

  // Handle connect button
  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);

      // Get authorization URL from backend
      const response = await fetch(`/api/google/auth?tenantId=${tenantId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'incomplete_business_profile') {
          setError('Please complete your business profile before connecting to Google');
          return;
        }
        throw new Error('Failed to initiate Google authorization');
      }

      const { authUrl } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
      
      onConnect?.();
    } catch (err) {
      console.error('[GoogleConnect] Connection error:', err);
      setError('Failed to connect to Google');
      setConnecting(false);
    }
  };

  // Handle disconnect button
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? This will remove access to your Merchant Center and Business Profile data.')) {
      return;
    }

    try {
      setDisconnecting(true);
      setError(null);

      const response = await fetch(`/api/google/disconnect?tenantId=${tenantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Google account');
      }

      setAccount({ connected: false });
      onDisconnect?.();
    } catch (err) {
      console.error('[GoogleConnect] Disconnect error:', err);
      setError('Failed to disconnect Google account');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Google Connect Suite</CardTitle>
          <CardDescription>Loading connection status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google Connect Suite
            </CardTitle>
            <CardDescription>
              Connect to Google Merchant Center and Business Profile
            </CardDescription>
          </div>
          {account?.connected && (
            <Badge variant="success">Connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {account?.connected ? (
          <>
            {/* Connected Account Info */}
            <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-lg">
              {account.profilePictureUrl && (
                <img
                  src={account.profilePictureUrl}
                  alt={account.displayName || 'Profile'}
                  className="h-12 w-12 rounded-full"
                />
              )}
              <div className="flex-1">
                <p className="font-medium text-neutral-900">{account.displayName}</p>
                <p className="text-sm text-neutral-600">{account.email}</p>
              </div>
            </div>

            {/* Connection Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p className="text-sm font-medium text-blue-900">Merchant Center</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{account.merchantLinks || 0}</p>
                <p className="text-xs text-blue-700">Accounts linked</p>
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm font-medium text-green-900">Business Profile</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{account.gbpLocations || 0}</p>
                <p className="text-xs text-green-700">Locations synced</p>
              </div>
            </div>

            {/* Scopes */}
            <div className="p-3 bg-neutral-50 rounded-lg">
              <p className="text-xs font-medium text-neutral-600 mb-2">Authorized Access:</p>
              <div className="flex flex-wrap gap-2">
                {account.scopes?.includes('https://www.googleapis.com/auth/content') && (
                  <Badge variant="info">Merchant Center</Badge>
                )}
                {account.scopes?.includes('https://www.googleapis.com/auth/business.manage') && (
                  <Badge variant="info">Business Profile</Badge>
                )}
              </div>
            </div>

            {/* Disconnect Button */}
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              variant="secondary"
              className="w-full"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect Google Account'}
            </Button>
          </>
        ) : (
          <>
            {/* Not Connected State */}
            <div className="text-center py-6">
              <svg className="h-16 w-16 mx-auto mb-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-neutral-600 mb-4">
                Connect your Google account to sync inventory with Merchant Center and manage your Business Profile.
              </p>
              <ul className="text-sm text-neutral-600 space-y-2 mb-6 text-left max-w-md mx-auto">
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Sync products to Google Shopping</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>View Business Profile insights</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Manage multiple locations</span>
                </li>
              </ul>
            </div>

            {/* Connect Button */}
            <Button
              onClick={handleConnect}
              disabled={connecting}
              variant="primary"
              className="w-full"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
              </svg>
              {connecting ? 'Connecting...' : 'Connect with Google'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';
import { Flags } from '@/lib/flags';
import { ContextBadges } from '@/components/ContextBadges';

interface ScanSession {
  id: string;
  status: string;
  deviceType: string;
  scannedCount: number;
  committedCount: number;
  duplicateCount: number;
  startedAt: string;
  completedAt?: string;
}

export default function TenantScanPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;
  
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<'usb' | 'camera' | 'manual'>('usb');
  const [rateLimitError, setRateLimitError] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/api/scan/my-sessions?tenantId=${tenantId}`);
      
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = async () => {
    if (!Flags.SKU_SCANNING) {
      alert('SKU scanning is not enabled. Please contact your administrator.');
      return;
    }

    if (selectedDevice === 'camera' && !Flags.SCAN_CAMERA) {
      alert('Camera scanning is not enabled. Please select USB or manual mode.');
      return;
    }

    try {
      setCreating(true);
      
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

      const response = await api.post(`${apiBaseUrl}/api/scan/start`, {
        tenantId,
        deviceType: selectedDevice,
      });

      if (response.ok) {
        const data = await response.json();
        setRateLimitError(false);
        router.push(`/t/${tenantId}/scan/${data.session.id}`);
      } else {
        const error = await response.json();
        if (error.error === 'rate_limit_exceeded') {
          setRateLimitError(true);
        } else {
          alert(`Failed to start session: ${error.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start scanning session');
    } finally {
      setCreating(false);
    }
  };

  const cancelSession = async (sessionId: string) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.delete(`${apiBaseUrl}/api/scan/${sessionId}`);

      if (response.ok) {
        await loadSessions(); // Refresh the list
      } else {
        alert('Failed to cancel session');
      }
    } catch (error) {
      console.error('Failed to cancel session:', error);
      alert('Failed to cancel session');
    }
  };

  const cleanupMySessions = async () => {
    if (!confirm('This will close all your active scan sessions. Continue?')) {
      return;
    }

    try {
      setCleaningUp(true);
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      const response = await api.post(`${apiBaseUrl}/api/scan/cleanup-my-sessions`, {
        tenantId,
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Cleaned up ${data.cleaned} active sessions. You can now start a new scan.`);
        setRateLimitError(false);
        await loadSessions();
      } else {
        const error = await response.json();
        alert(`Failed to cleanup sessions: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to cleanup sessions:', error);
      alert('Failed to cleanup sessions');
    } finally {
      setCleaningUp(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'completed':
        return <Badge variant="info">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="default">Cancelled</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="SKU Scanning"
        description="Scan barcodes to quickly add products to your inventory"
        icon={Icons.Inventory}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Context Badges */}
        <ContextBadges 
          tenant={{ id: tenantId, name: '' }}
          contextLabel="Scanning"
        />
        {/* Feature Flag Check */}
        {!Flags.SKU_SCANNING && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                  SKU Scanning Disabled
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-400 mt-1">
                  The SKU scanning feature is not enabled for your account. Contact your administrator to enable it.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Start New Session */}
        <Card>
          <CardHeader>
            <CardTitle>Start New Scanning Session</CardTitle>
            <CardDescription>
              Choose your scanning method and begin adding products
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Device Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                  Scanning Method
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* USB Scanner */}
                  <button
                    onClick={() => setSelectedDevice('usb')}
                    disabled={!Flags.SCAN_USB}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      selectedDevice === 'usb'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    } ${!Flags.SCAN_USB ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <svg className="w-8 h-8 mb-2 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      <p className="font-medium text-neutral-900 dark:text-white">USB Scanner</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                        Fast and reliable
                      </p>
                      {selectedDevice === 'usb' && (
                        <Badge variant="success" className="mt-2 text-xs">Selected</Badge>
                      )}
                    </div>
                  </button>

                  {/* Camera */}
                  <button
                    onClick={() => setSelectedDevice('camera')}
                    disabled={!Flags.SCAN_CAMERA}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      selectedDevice === 'camera'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    } ${!Flags.SCAN_CAMERA ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <svg className="w-8 h-8 mb-2 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="font-medium text-neutral-900 dark:text-white">Camera</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                        Use device camera
                      </p>
                      {!Flags.SCAN_CAMERA && (
                        <Badge variant="default" className="mt-2 text-xs">Disabled</Badge>
                      )}
                      {selectedDevice === 'camera' && Flags.SCAN_CAMERA && (
                        <Badge variant="success" className="mt-2 text-xs">Selected</Badge>
                      )}
                    </div>
                  </button>

                  {/* Manual Entry */}
                  <button
                    onClick={() => setSelectedDevice('manual')}
                    className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
                      selectedDevice === 'manual'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <svg className="w-8 h-8 mb-2 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <p className="font-medium text-neutral-900 dark:text-white">Manual Entry</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                        Type barcodes
                      </p>
                      {selectedDevice === 'manual' && (
                        <Badge variant="success" className="mt-2 text-xs">Selected</Badge>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Rate Limit Error */}
              {rateLimitError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-900 dark:text-red-300">
                        Too Many Active Sessions
                      </p>
                      <p className="text-sm text-red-800 dark:text-red-400 mt-1">
                        You have reached the maximum number of active scan sessions (50). Close your old sessions to start a new one.
                      </p>
                      <button
                        onClick={cleanupMySessions}
                        disabled={cleaningUp}
                        className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cleaningUp ? 'Cleaning up...' : 'Close All My Sessions'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Start Button */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Ready to scan with {selectedDevice === 'usb' ? 'USB scanner' : selectedDevice === 'camera' ? 'camera' : 'manual entry'}
                </p>
                <Button
                  onClick={startNewSession}
                  disabled={creating || !Flags.SKU_SCANNING}
                  loading={creating}
                  className="px-6"
                >
                  {creating ? 'Starting...' : 'Start Scanning'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Sessions</CardTitle>
                <CardDescription>View and manage your scanning sessions</CardDescription>
              </div>
              <button
                onClick={loadSessions}
                disabled={loading}
                className="px-3 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-neutral-600 dark:text-neutral-400">No scanning sessions yet</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
                  Start a new session to begin scanning products
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
                  >
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => router.push(`/t/${tenantId}/scan/${session.id}`)}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        {getStatusBadge(session.status)}
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {new Date(session.startedAt).toLocaleString()}
                        </span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-500">
                          {session.deviceType}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-neutral-700 dark:text-neutral-300">
                        <span>{session.scannedCount} scanned</span>
                        <span>{session.committedCount} committed</span>
                        {session.duplicateCount > 0 && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            {session.duplicateCount} duplicates
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.status === 'active' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Cancel this session?')) {
                              cancelSession(session.id);
                            }
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

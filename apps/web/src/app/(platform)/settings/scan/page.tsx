'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@mantine/core';
import { Button } from '@mantine/core';
import { Badge } from '@/components/ui/Badge';
import PageHeader, { Icons } from '@/components/PageHeader';
import { itemsSingletonService } from '@/services/ItemsSingletonService';
import { useBarcodeScanCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { UserTenantSelector } from '@/components/tenant/UserTenantSelector';


interface ScanSession {
  id: string;
  status: string;
  deviceType: string;
  scannedCount: number;
  committedCount: number;
  duplicateCount: number;
  startedAt: string;
  completedAt?: string;
  committed?: string; // Date when session was committed (maps to completedAt)
}

export default function ScanPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<'usb' | 'camera' | 'manual'>('usb');
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);

  // Capability-based barcode scan access (supersedes Flags env var control)
  const barcodeCap = useBarcodeScanCapability(selectedTenant || undefined, { forTenant: true });
  const barcodeEnabled = barcodeCap.data?.enabled ?? null; // null = still loading
  const barcodeModes = barcodeCap.data?.allowedModes ?? [];
  const usbAllowed = barcodeModes.includes('usb');
  const cameraAllowed = barcodeModes.includes('camera');
  const manualAllowed = barcodeModes.includes('manual');

  useEffect(() => {
    // Initialize selected tenant from localStorage
    const lastTenantId = localStorage.getItem('lastTenantId');
    if (lastTenantId) {
      setSelectedTenant(lastTenantId);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [selectedTenant]);

  const loadSessions = async () => {
    try {
      if (!selectedTenant) {
        setSessions([]);
        setLoading(false);
        return;
      }
      
      const data = await itemsSingletonService.getMyScanSessions(selectedTenant);
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelSession = async (sessionId: string) => {
    try {
      await itemsSingletonService.cancelScanSession(sessionId);
      await loadSessions(); // Refresh the list
    } catch (err) {
      console.error('[ScanPage] Failed to cancel session:', err);
      alert('Failed to cancel session');
    }
  };

  const cleanupMySessions = async () => {
    if (!selectedTenant) {
      alert('Please select a tenant first');
      return;
    }
    
    if (!confirm('This will close all active scan sessions for this tenant. Continue?')) {
      return;
    }

    try {
      setCleaningUp(true);
      
      await itemsSingletonService.cleanupMyScanSessions(selectedTenant);
      alert(`✅ Cleaned up active sessions. You can now start a new scan.`);
      await loadSessions();
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

  const startNewSession = async () => {
    if (!barcodeEnabled) {
      alert('Barcode scanning is not enabled for this tenant. Please upgrade your plan or contact your administrator.');
      return;
    }

    if (!selectedTenant) {
      alert('Please select a tenant first');
      return;
    }

    try {
      setCreating(true);

      const data = await itemsSingletonService.startScanSession(selectedTenant, selectedDevice);

      if (data && data.session) {
        // Store selected tenant in localStorage for future use
        localStorage.setItem('lastTenantId', selectedTenant);
        router.push(`/scan/${data.session.id}`);
      } else {
        console.error('Invalid session response:', data);
        alert('Failed to start session: Invalid response from server');
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start scanning session');
    } finally {
      setCreating(false);
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
        {/* Capability Disabled Warning */}
        {barcodeEnabled === false && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                  Barcode Scanning Disabled
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-400 mt-1">
                  Barcode scanning is not enabled for this tenant. Upgrade your plan or contact your administrator to enable it.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Start New Session */}
        <Card withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Start New Scanning Session</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Choose your scanning method and begin adding products</p>
              </div>
            </div>
            <div className="space-y-4">
              {/* Tenant Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                  Select Tenant
                </label>
                <UserTenantSelector
                  selectedTenant={selectedTenant}
                  onTenantSelect={setSelectedTenant}
                  placeholder="Select a tenant to start scanning..."
                />
              </div>

              {/* Device Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                  Scanning Method
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* USB Scanner - requires barcode_usb capability */}
                  <button
                    onClick={() => setSelectedDevice('usb')}
                    disabled={!usbAllowed}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      selectedDevice === 'usb'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    } ${!usbAllowed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <svg className="w-8 h-8 mb-2 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      <p className="font-medium text-neutral-900 dark:text-white">USB Scanner</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                        Fast and reliable
                      </p>
                      {!usbAllowed && (
                        <Badge variant="default" className="mt-2 text-xs bg-amber-100 text-amber-800">Pro+</Badge>
                      )}
                      {usbAllowed && selectedDevice === 'usb' && (
                        <Badge variant="success" className="mt-2 text-xs">Selected</Badge>
                      )}
                    </div>
                  </button>

                  {/* Camera - requires barcode_camera capability */}
                  <button
                    onClick={() => setSelectedDevice('camera')}
                    disabled={!cameraAllowed}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      selectedDevice === 'camera'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    } ${!cameraAllowed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
                      {!cameraAllowed && (
                        <Badge variant="default" className="mt-2 text-xs bg-amber-100 text-amber-800">Pro+</Badge>
                      )}
                      {cameraAllowed && selectedDevice === 'camera' && (
                        <Badge variant="success" className="mt-2 text-xs">Selected</Badge>
                      )}
                    </div>
                  </button>

                  {/* Manual Entry - requires barcode_manual capability */}
                  <button
                    onClick={() => setSelectedDevice('manual')}
                    disabled={!manualAllowed}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      selectedDevice === 'manual'
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    } ${!manualAllowed ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <svg className="w-8 h-8 mb-2 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <p className="font-medium text-neutral-900 dark:text-white">Manual Entry</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                        Type barcodes
                      </p>
                      {!manualAllowed && (
                        <Badge variant="default" className="mt-2 text-xs bg-amber-100 text-amber-800">Pro+</Badge>
                      )}
                      {manualAllowed && selectedDevice === 'manual' && (
                        <Badge variant="success" className="mt-2 text-xs">Selected</Badge>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Start Button */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Ready to scan with {selectedDevice === 'usb' ? 'USB scanner' : selectedDevice === 'camera' ? 'camera' : 'manual entry'}
                </p>
                <Button
                  onClick={startNewSession}
                  disabled={creating || barcodeEnabled === false}
                  loading={creating}
                  variant='gradient'
                  style={{color:'white',hover:{color:'indigo'}}}
                  className="px-6"
                >
                  {creating ? 'Starting...' : 'Start Scanning'}
                </Button>
              </div>
              </div>
            </div>
          </Card>

        {/* Recent Sessions */}
        <Card withBorder padding="lg" radius="md">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Sessions</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">View and manage your scanning sessions</p>
              </div>
            </div>
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
                    <div className="flex-1" onClick={() => router.push(`/scan/${session.id}`)}>
                      <div className="flex items-center gap-3 mb-1">
                        {getStatusBadge(session.status)}
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {new Date(session.startedAt).toLocaleString()}
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
          </div>
        </Card>

        {/* Session Management Tips */}
        {sessions.length > 0 && (
          <Card className="p-6 rounded-lg">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    💡 Best Practice: Keep Your Sessions Clean
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                    You have {sessions.length} scan sessions. For better performance, we recommend completing or canceling old sessions regularly. Active sessions should be committed or canceled within the same day.
                  </p>
                  <button
                    onClick={cleanupMySessions}
                    disabled={cleaningUp}
                    className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cleaningUp ? 'Cleaning Up...' : 'Clean Up Active Sessions'}
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

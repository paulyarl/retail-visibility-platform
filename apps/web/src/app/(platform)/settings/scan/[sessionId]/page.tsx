'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import BatchReview from '@/components/scan/BatchReview';
import EnrichmentPreview from '@/components/scan/EnrichmentPreview';
import { itemsSingletonService } from '@/services/ItemsSingletonService';
import { notifications } from '@mantine/notifications';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

// Interface compatible with BatchReview component
interface ScanResult {
  id: string;
  barcode: string;
  sku: string;
  status: string;
  enrichment?: {
    name?: string;
    brand?: string;
    description?: string;
    categoryPath?: string[];
    tenantCategoryId?: string;
    metadata?: Record<string, any>;
  };
  createdAt: string;
}

interface ScanSession {
  id: string;
  tenantId: string;
  status: string;
  deviceType: string;
  scannedCount: number;
  committedCount: number;
  duplicateCount: number;
  startedAt: string;
  template?: any;
  results: ScanResult[];
}

export default function ActiveScanPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ScanSession | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const sessionData = await itemsSingletonService.getScanSession(sessionId);
      
      if (sessionData && sessionData.success && sessionData.data) {
        const session = sessionData.data.session || sessionData.data; // Handle nested structure
        setSession(session);
        
        // Transform results to BatchReview format
        // Results might be nested under different property names
        const results = session.results || session.scan_results_list || [];
        
        const transformedResults = results.map((result: any): ScanResult => ({
          id: result.id,
          barcode: result.barcode,
          sku: result.sku,
          status: result.status,
          enrichment: result.enrichment,
          createdAt: result.created_at,
        }));
        
        setResults(transformedResults);
        
        // Auto-select first result for preview
        if (transformedResults.length > 0 && !selectedResult) {
          setSelectedResult(transformedResults[0]);
        }
      } else {
        clientLogger.error('[PlatformScanPage] Invalid session response:', { detail: sessionData });
        notifications.show({ title: 'Error', message: 'Failed to load session', color: 'red' });
        router.push('/scan');
      }
    } catch (error) {
      clientLogger.error('Failed to load session:', { detail: error });
      notifications.show({ title: 'Error', message: 'Failed to load session', color: 'red' });
      router.push('/scan');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (barcode: string) => {
    if (!session || session.status !== 'active') {
      notifications.show({ title: 'Warning', message: 'Session is not active', color: 'yellow' });
      return;
    }

    try {
      setScanning(true);
      
      const tenantId = session.tenantId;
      if (!tenantId) {
        clientLogger.error('[PlatformScanPage] No tenant ID found in session');
        notifications.show({ title: 'Error', message: 'Session is missing tenant information', color: 'red' });
        return;
      }
      
      const data = await itemsSingletonService.lookupBarcode(sessionId, barcode);
      
      if (data && data.success) {
        // Show duplicate warning
        if (data.duplicate) {
          notifications.show({ title: 'Duplicate Item', message: `Item: ${data.duplicate.name || data.duplicate.sku}`, color: 'yellow' });
        }
        
        // Reload session and results to get updated data
        await loadSession();
        
        // Select the newly added result
        if (data.result) {
          const transformedResult: ScanResult = {
            id: data.result.id,
            barcode: data.result.barcode,
            sku: data.result.sku,
            status: data.result.status,
            enrichment: data.result.enrichment,
            createdAt: data.result.created_at,
          };
          setSelectedResult(transformedResult);
        }
      } else {
        notifications.show({ title: 'Error', message: data?.error || 'Failed to scan barcode', color: 'red' });
      }
    } catch (error) {
      clientLogger.error('Failed to scan barcode:', { detail: error });
      notifications.show({ title: 'Error', message: 'Failed to scan barcode', color: 'red' });
    } finally {
      setScanning(false);
    }
  };

  const handleEnrichmentEdit = useCallback(async (field: string, value: any) => {
    if (!selectedResult || !session || session.status !== 'active') {
      return;
    }

    // Update local state immediately for responsive UI
    const updatedEnrichment = {
      ...selectedResult.enrichment,
      [field]: value,
    };

    setSelectedResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        enrichment: updatedEnrichment,
      };
    });

    // Update session results to keep UI in sync
    setSession((prev: ScanSession | null) => {
      if (!prev) return prev;
      return {
        ...prev,
        results: prev.results.map((r: ScanResult) => 
          r.id === selectedResult.id 
            ? { ...r, enrichment: updatedEnrichment }
            : r
        ),
      };
    });

    // Persist the enrichment changes to the API
    try {
      await itemsSingletonService.updateScanResult(sessionId, selectedResult.id, updatedEnrichment);
    } catch (error) {
      clientLogger.error('Failed to update scan result enrichment:', { detail: error });
      // Could show error toast here, but for now just log it
    }
  }, [selectedResult, session, sessionId]);

  const handleRemove = async (resultId: string) => {
    if (!session || session.status !== 'active') {
      notifications.show({ title: 'Warning', message: 'Session is not active', color: 'yellow' });
      return;
    }

    try {
      await itemsSingletonService.removeScanResult(sessionId, resultId);

      // Clear selection if we're removing the selected item
      if (selectedResult?.id === resultId) {
        setSelectedResult(null);
      }
      
      // Reload session and results
      await loadSession();
    } catch (error) {
      clientLogger.error('Failed to remove item:', { detail: error });
      notifications.show({ title: 'Error', message: 'Failed to remove item', color: 'red' });
    }
  };

  const handleCommit = async () => {
    if (!session || session.status !== 'active') {
      notifications.show({ title: 'Warning', message: 'Session is not active', color: 'yellow' });
      return;
    }

    const validCount = results?.filter((r: ScanResult) => r.status !== 'error').length || 0;
    
    if (!confirm(`Commit ${validCount} items to inventory?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setCommitting(true);
      
      await itemsSingletonService.commitScanSession(sessionId);
      notifications.show({ title: 'Success', message: `Successfully committed ${validCount} items to inventory!`, color: 'green' });
      router.push('/scan');
    } catch (error) {
      clientLogger.error('Failed to commit session:', { detail: error });
      notifications.show({ title: 'Error', message: 'Failed to commit session', color: 'red' });
    } finally {
      setCommitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this scanning session?\n\nAll scanned items will be discarded.')) {
      return;
    }

    try {
      await itemsSingletonService.cancelScanSession(sessionId);
      router.push('/scan');
    } catch (error) {
      clientLogger.error('Failed to cancel session:', { detail: error });
      notifications.show({ title: 'Error', message: 'Failed to cancel session', color: 'red' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 dark:text-neutral-400">Session not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Active Scanning Session"
        description={`${session.scannedCount || 0} items scanned • ${results?.length || 0} total results`}
        icon={Icons.Inventory}
        backLink={{ href: '/scan', label: 'Back to Sessions' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Scanner & Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Barcode Scanner */}
            <BarcodeScanner
              onScan={handleScan}
              onError={(error) => notifications.show({ title: 'Scanner Error', message: error, color: 'red' })}
              mode={session.deviceType === 'manual' ? 'manual' : session.deviceType === 'camera' ? 'camera' : 'usb'}
              disabled={session.status !== 'active' || scanning}
            />

            {/* Enrichment Preview */}
            {selectedResult && (
              <EnrichmentPreview
                barcode={selectedResult.barcode}
                sku={selectedResult.sku}
                enrichment={selectedResult.enrichment}
                tenantId={session.tenantId}
                validation={[
                  ...(selectedResult.status === 'duplicate' ? [{
                    field: 'duplicate',
                    message: 'This item already exists in inventory',
                    severity: 'warning' as const,
                  }] : []),
                  ...(!selectedResult.enrichment?.name ? [{
                    field: 'name',
                    message: 'Product name is required',
                    severity: 'error' as const,
                  }] : []),
                  ...(!selectedResult.enrichment?.tenantCategoryId ? [{
                    field: 'category',
                    message: 'Category is required',
                    severity: 'error' as const,
                  }] : []),
                ]}
                isLoading={scanning && selectedResult.barcode === selectedResult.barcode}
                editable={session.status === 'active'}
                onEdit={handleEnrichmentEdit}
              />
            )}
          </div>

          {/* Right Column - Batch Review */}
          <div className="lg:col-span-1">
            <BatchReview
              results={results || []}
              onRemove={handleRemove}
              onCommit={handleCommit}
              onCancel={handleCancel}
              isCommitting={committing}
              disabled={session.status !== 'active'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

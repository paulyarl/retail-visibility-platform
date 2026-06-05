'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import BatchReview from '@/components/scan/BatchReview';
import EnrichmentPreview from '@/components/scan/EnrichmentPreview';
import { itemsSingletonService } from '@/services/ItemsSingletonService';

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
  // console.log('[PlatformScanPage] Component mounted', { selectedResult });
  // console.log('[PlatformScanPage] Component mounted', { sessionId });
  // console.log('[PlatformScanPage] Component mounted', { loading });
  // console.log('[PlatformScanPage] Component mounted', { scanning });
  // console.log('[PlatformScanPage] Component mounted', { committing });

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const sessionData = await itemsSingletonService.getScanSession(sessionId);
      // console.log('[PlatformScanPage] Session data:', sessionData);
      
      if (sessionData && sessionData.success && sessionData.data) {
        const session = sessionData.data.session || sessionData.data; // Handle nested structure
          // console.log('[PlatformScanPage] Session:', session);
          // console.log('[PlatformScanPage] Device type:', session.device_type, session.deviceType);
          // console.log('[PlatformScanPage] Session status:', session.status);
          // console.log('[PlatformScanPage] Tenant ID:', session.tenantId);
        setSession(session);
        
        // Transform results to BatchReview format
        // Results might be nested under different property names
        const results = session.results || session.scan_results_list || [];
        // console.log('[PlatformScanPage] Results:', results);
        
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
        console.error('[PlatformScanPage] Invalid session response:', sessionData);
        alert('Failed to load session');
        router.push('/scan');
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load session');
      router.push('/scan');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (barcode: string) => {
    if (!session || session.status !== 'active') {
      alert('Session is not active');
      return;
    }

    try {
      setScanning(true);
      
      const tenantId = session.tenantId;
      if (!tenantId) {
        console.error('[PlatformScanPage] No tenant ID found in session');
        alert('Session is missing tenant information');
        return;
      }
      
      const data = await itemsSingletonService.lookupBarcode(sessionId, barcode);
      
      if (data && data.success) {
        // Show duplicate warning
        if (data.duplicate) {
          alert(`⚠️ Duplicate item detected\n\nItem: ${data.duplicate.name || data.duplicate.sku}`);
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
        alert(data?.error || 'Failed to scan barcode');
      }
    } catch (error) {
      console.error('Failed to scan barcode:', error);
      alert('Failed to scan barcode');
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
      console.error('Failed to update scan result enrichment:', error);
      // Could show error toast here, but for now just log it
    }
  }, [selectedResult, session, sessionId]);

  const handleRemove = async (resultId: string) => {
    if (!session || session.status !== 'active') {
      alert('Session is not active');
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
      console.error('Failed to remove item:', error);
      alert('Failed to remove item');
    }
  };

  const handleCommit = async () => {
    if (!session || session.status !== 'active') {
      alert('Session is not active');
      return;
    }

    const validCount = results?.filter((r: ScanResult) => r.status !== 'error').length || 0;
    
    if (!confirm(`Commit ${validCount} items to inventory?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setCommitting(true);
      
      await itemsSingletonService.commitScanSession(sessionId);
      alert(`✅ Successfully committed ${validCount} items to inventory!`);
      router.push('/scan');
    } catch (error) {
      console.error('Failed to commit session:', error);
      alert('Failed to commit session');
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
      console.error('Failed to cancel session:', error);
      alert('Failed to cancel session');
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
              onError={(error) => alert(error)}
              mode={session.deviceType === 'manual' ? 'manual' : session.deviceType === 'camera' ? 'camera' : 'usb'}
              disabled={session.status !== 'active' || scanning}
            />

            {/* Enrichment Preview */}
            {selectedResult && (
              // console.log('[ScanPage] Selected result:', selectedResult),
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

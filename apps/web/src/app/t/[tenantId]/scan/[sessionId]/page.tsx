'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader, { Icons } from '@/components/PageHeader';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import BatchReview from '@/components/scan/BatchReview';
import EnrichmentPreview from '@/components/scan/EnrichmentPreview';
import { itemsSingletonService } from '@/services/ItemsSingletonService';

interface ScanResult {
  id: string;
  barcode: string;
  sku?: string;
  status: string;
  enrichment?: any;
  duplicateOf?: string;
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
  completedAt?: string;
  template?: any;
  results: ScanResult[];
}




export default function TenantActiveScanPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.tenantId as string;
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
      // console.log('[TenantScanSession] Loading session:', sessionId);
      const sessionData = await itemsSingletonService.getScanSession(sessionId);
      // console.log('[TenantScanSession] Session data response:', sessionData);
      
      if (sessionData && sessionData.success && sessionData.data) {
        const session = sessionData.data.session || sessionData.data; // Handle nested structure
        // console.log('[TenantScanSession] Parsed session:', session);
        // console.log('[TenantScanSession] Session status:', session.status);
        // console.log('[TenantScanSession] Session device type:', session.deviceType);
        
        setSession(session);
        setResults(session.results || session.scan_results_list || []);
        
        // Auto-select first result for preview
        const results = session.results || session.scan_results_list || [];
        // console.log('[TenantScanSession] Session results:', results);
        if (results.length > 0 && !selectedResult) {
          setSelectedResult(results[0]);
        }
      } else {
        console.error('[TenantScanSession] Invalid session data structure:', sessionData);
        alert('Failed to load session');
        router.push(`/t/${tenantId}/scan`);
      }
    } catch (error) {
      console.error('[TenantScanSession] Failed to load session:', error);
      alert('Failed to load session');
      router.push(`/t/${tenantId}/scan`);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (barcode: string) => {
    if (!session || session.status !== 'active') return;
    
    try {
      setScanning(true);
      // console.log('[TenantScanSession] Scanning barcode:', barcode);
      
      const data = await itemsSingletonService.lookupBarcode(sessionId, barcode);
      // console.log('[TenantScanSession] Scan response:', data);

      if (data && data.success) {
        // Add new result to the list
        const newResult = data.result;
        // console.log('[TenantScanSession] New result:', newResult);
        
        setResults(prev => {
          // console.log('[TenantScanSession] Previous results:', prev);
          const updated = [...prev, newResult];
          // console.log('[TenantScanSession] Updated results:', updated);
          return updated;
        });
        
        setSession(prev => {
          // console.log('[TenantScanSession] Previous session:', prev);
          const updated = prev ? {
            ...prev,
            scannedCount: prev.scannedCount + 1,
            duplicateCount: prev.duplicateCount + (data.duplicate ? 1 : 0)
          } : null;
          // console.log('[TenantScanSession] Updated session:', updated);
          return updated;
        });
        
        // Auto-select the new result for preview
        // console.log('[TenantScanSession] Setting selected result:', newResult);
        setSelectedResult(newResult);
      } else {
        console.error('[TenantScanSession] Scan failed:', data);
        alert(data?.error || 'Failed to scan barcode');
      }
    } catch (error) {
      console.error('[TenantScanSession] Failed to scan barcode:', error);
      alert('Failed to scan barcode');
    } finally {
      setScanning(false);
    }
  };

  const handleRemove = async (resultId: string) => {
    try {
      await itemsSingletonService.removeScanResult(sessionId, resultId);

      // Clear selection if we're removing the selected item
      if (selectedResult?.id === resultId) {
        setSelectedResult(null);
      }

      // Remove from results list
      setResults(prev => prev.filter((r: ScanResult) => r.id !== resultId));
      
      // Update session counts
      setSession(prev => prev ? {
        ...prev,
        scannedCount: Math.max(0, prev.scannedCount - 1)
      } : null);
    } catch (error) {
      console.error('Failed to remove result:', error);
      alert('Failed to remove result');
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
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        results: prev.results.map(r => 
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

  const handleCommit = async () => {
    if (!session || session.status !== 'active') {
      alert('Session is not active');
      return;
    }

    const validCount = session.results.filter(r => r.status !== 'duplicate').length;
    
    if (!confirm(`Commit ${validCount} items to inventory?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setCommitting(true);
      
      // First, save all enrichment data for all results
      // console.log('Saving enrichment data for all results...');
      for (const result of session.results) {
        if (result.enrichment && Object.keys(result.enrichment).length > 0) {
          try {
            await itemsSingletonService.updateScanResult(sessionId, result.id, result.enrichment);
          } catch (error) {
            console.error(`Failed to save enrichment for result ${result.id}:`, error);
          }
        }
      }
      
      // Then commit the session
      const data = await itemsSingletonService.commitScanSession(sessionId, false);

      if (data && data.success) {
        alert(`✅ Successfully committed ${data.committed} items to inventory!`);
        router.push(`/t/${tenantId}/scan`);
      } else {
        if (data?.error === 'validation_failed') {
          alert(`Validation failed:\n\n${data.validation?.errors?.map((e: any) => `• ${e.field}: ${e.message}`).join('\n')}`);
        } else {
          alert(`Failed to commit: ${data?.error || 'Unknown error'}`);
        }
      }
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
      router.push(`/t/${tenantId}/scan`);
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
    console.log('[TenantScanSession] Session is null after loading');
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 dark:text-neutral-400">Session not found</p>
        </div>
      </div>
    );
  }

  // console.log('[TenantScanSession] Rendering with session:', session);
  // console.log('[TenantScanSession] Session status for scanner:', session.status);
  // console.log('[TenantScanSession] Device type for scanner:', session.deviceType);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Active Scanning Session"
        description={`${session.scannedCount} items scanned • ${session.duplicateCount} duplicates`}
        icon={Icons.Inventory}
        backLink={{ href: `/t/${tenantId}/scan`, label: 'Back to Sessions' }}
        actions={
          <Link
            href={`/t/${tenantId}/items`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Items
          </Link>
        }
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

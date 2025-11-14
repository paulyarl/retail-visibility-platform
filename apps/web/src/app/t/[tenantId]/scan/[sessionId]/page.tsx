'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import BatchReview from '@/components/scan/BatchReview';
import EnrichmentPreview from '@/components/scan/EnrichmentPreview';
import { api } from '@/lib/api';

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
  status: string;
  deviceType: string;
  scannedCount: number;
  committedCount: number;
  duplicateCount: number;
  results: ScanResult[];
}

export default function TenantActiveScanPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params.tenantId as string;
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ScanSession | null>(null);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [committing, setCommitting] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.get(`${apiBaseUrl}/api/scan/${sessionId}`);
      
      if (response.ok) {
        const data = await response.json();
        setSession(data.session);
        
        // Auto-select first result for preview
        if (data.session.results?.length > 0 && !selectedResult) {
          setSelectedResult(data.session.results[0]);
        }
      } else {
        alert('Failed to load session');
        router.push(`/t/${tenantId}/scan`);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load session');
      router.push(`/t/${tenantId}/scan`);
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
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      const response = await api.post(`${apiBaseUrl}/api/scan/${sessionId}/lookup-barcode`, {
        barcode,
      });

      if (response.ok) {
        const data = await response.json();
        
        // Show duplicate warning
        if (data.duplicate) {
          alert(`⚠️ ${data.duplicate.warning}\n\nItem: ${data.duplicate.item.name || data.duplicate.item.sku}`);
        }
        
        // Reload session to get updated results
        await loadSession();
        
        // Select the newly added result
        setSelectedResult(data.result);
      } else {
        const error = await response.json();
        if (error.error === 'duplicate_barcode') {
          alert('This barcode has already been scanned in this session');
        } else {
          alert(`Failed to scan: ${error.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to scan barcode:', error);
      alert('Failed to scan barcode');
    } finally {
      setScanning(false);
    }
  };

  const handleRemove = async (resultId: string) => {
    if (!session || session.status !== 'active') {
      alert('Session is not active');
      return;
    }

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.delete(`${apiBaseUrl}/api/scan/${sessionId}/results/${resultId}`);

      if (response.ok) {
        // Clear selection if we're removing the selected item
        if (selectedResult?.id === resultId) {
          setSelectedResult(null);
        }
        
        // Reload session
        await loadSession();
      } else {
        alert('Failed to remove item');
      }
    } catch (error) {
      console.error('Failed to remove item:', error);
      alert('Failed to remove item');
    }
  };

  const handleEnrichmentEdit = useCallback((field: string, value: any) => {
    if (!selectedResult || !session || session.status !== 'active') {
      return;
    }

    // Update local state immediately for responsive UI
    setSelectedResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        enrichment: {
          ...prev.enrichment,
          [field]: value,
        },
      };
    });

    // Update session results to keep UI in sync
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        results: prev.results.map(r => 
          r.id === selectedResult.id 
            ? { ...r, enrichment: { ...r.enrichment, [field]: value } }
            : r
        ),
      };
    });

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce API call
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await api.patch(`${apiBaseUrl}/api/scan/${sessionId}/results/${selectedResult.id}/enrichment`, {
          [field]: value,
        });

        if (!response.ok) {
          console.error('Failed to update enrichment data');
          // Optionally reload session to revert to server state
          // await loadSession();
        }
      } catch (error) {
        console.error('Failed to update enrichment:', error);
      }
    }, 500); // Wait 500ms after user stops typing
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
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      const response = await api.post(`${apiBaseUrl}/api/scan/${sessionId}/commit`, {
        skipValidation: false,
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Successfully committed ${data.committed} items to inventory!`);
        router.push(`/t/${tenantId}/scan`);
      } else {
        const error = await response.json();
        if (error.error === 'validation_failed') {
          alert(`Validation failed:\n\n${error.validation.errors.map((e: any) => `• ${e.field}: ${e.message}`).join('\n')}`);
        } else {
          alert(`Failed to commit: ${error.error || 'Unknown error'}`);
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
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await api.delete(`${apiBaseUrl}/api/scan/${sessionId}`);

      if (response.ok) {
        router.push(`/t/${tenantId}/scan`);
      } else {
        alert('Failed to cancel session');
      }
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
        description={`${session.scannedCount} items scanned • ${session.duplicateCount} duplicates`}
        icon={Icons.Inventory}
        backLink={{ href: `/t/${tenantId}/scan`, label: 'Back to Sessions' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Scanner & Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Barcode Scanner */}
            <BarcodeScanner
              onScan={handleScan}
              onError={(error) => alert(error)}
              mode={session.deviceType as any}
              disabled={session.status !== 'active' || scanning}
            />

            {/* Enrichment Preview */}
            {selectedResult && (
              <EnrichmentPreview
                barcode={selectedResult.barcode}
                sku={selectedResult.sku}
                enrichment={selectedResult.enrichment}
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
                  ...(!selectedResult.enrichment?.categoryPath?.length ? [{
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
              results={session.results || []}
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

import { useState, useEffect } from 'react';
import type { SwisPreviewItem } from '@/components/tenant/SwisPreviewWidget';

interface UseSwisPreviewOptions {
  tenantId: string;
  limit?: number;
  sortOrder?: 'updated_desc' | 'price_asc' | 'alpha_asc';
}

interface UseSwisPreviewReturn {
  items: SwisPreviewItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  refetch: () => void;
}

export function useSwisPreview({
  tenantId,
  limit = 12,
  sortOrder = 'updated_desc',
}: UseSwisPreviewOptions): UseSwisPreviewReturn {
  const [items, setItems] = useState<SwisPreviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        sort: sortOrder,
      });

      const response = await fetch(`/api/tenant/${tenantId}/swis/preview?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch products (${response.status})`);
      }

      const data = await response.json();
      
      setItems(data.items || []);
      setLastUpdated(data.items?.[0]?.updated_at || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) {
      fetchPreview();
    }
  }, [tenantId, limit, sortOrder]);

  return {
    items,
    loading,
    error,
    lastUpdated,
    refetch: fetchPreview,
  };
}

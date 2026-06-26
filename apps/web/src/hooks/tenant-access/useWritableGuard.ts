'use client';

import { useState, useEffect, useCallback } from 'react';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';

/**
 * Hook that checks whether the tenant's subscription is writable.
 * Returns { isReadOnly, internalStatus, loading }.
 *
 * When isReadOnly is true, the tenant has a frozen/canceled/expired subscription
 * and write operations are blocked by the backend (requireWritableSubscription middleware).
 * The UI should show a ReadOnlyBanner and disable save/submit buttons.
 */
export function useWritableGuard(tenantId: string | null): {
  isReadOnly: boolean;
  internalStatus: string;
  loading: boolean;
} {
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [internalStatus, setInternalStatus] = useState('active');
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const state = await unifiedCapabilityService.getAllCapabilities(tenantId);
      if (state?.subscriptionContext) {
        setIsReadOnly(state.subscriptionContext.isReadOnly);
        setInternalStatus(state.subscriptionContext.internalStatus);
      } else {
        setIsReadOnly(false);
        setInternalStatus('active');
      }
    } catch {
      setIsReadOnly(false);
      setInternalStatus('active');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { check(); }, [check]);

  return { isReadOnly, internalStatus, loading };
}

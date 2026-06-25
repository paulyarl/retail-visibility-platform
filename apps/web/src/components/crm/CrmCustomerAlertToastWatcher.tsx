'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import { toast } from '@/hooks/use-toast';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import type { CrmAlert } from '@/types/crm';

/**
 * Customer-scoped CRM alert toast watcher.
 * Polls for customer-visible CRM alerts and fires toast notifications
 * when new alerts arrive. Mounted in the account layout so toasts
 * appear on any /account/* page.
 */
export default function CrmCustomerAlertToastWatcher() {
  const { isAuthenticated } = useCustomerAuth();
  const prevAlertIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);

  const { data: alerts } = useQuery<CrmAlert[]>({
    queryKey: ['crm', 'customer', 'alerts', 'toast-watcher'],
    queryFn: () => crmCustomerService.listAlerts(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    retry: 0,
    throwOnError: false,
  });

  useEffect(() => {
    if (!alerts) return;

    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      prevAlertIdsRef.current = new Set(alerts.map(a => a.id));
      return;
    }

    const prevIds = prevAlertIdsRef.current;
    const newAlerts = alerts.filter(a => !prevIds.has(a.id));

    for (const alert of newAlerts) {
      toast({
        title: alert.title,
        description: alert.body || 'New alert',
        variant: alert.type === 'warning' ? 'warning' : 'info',
      });
    }

    if (newAlerts.length > 0) {
      prevAlertIdsRef.current = new Set(alerts.map(a => a.id));
    }
  }, [alerts]);

  return null;
}

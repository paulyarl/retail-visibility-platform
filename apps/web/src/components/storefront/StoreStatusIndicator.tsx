"use client";

import { useState, useEffect } from 'react';
import { computeStoreStatus } from '@/lib/hours-utils';
import { directoryService } from '@/services/DirectorySingletonService';

interface StoreStatusIndicatorProps {
  tenantId: string;
}

async function getBusinessHours(tenantId: string) {
  try {
    const data = await directoryService.getBusinessHours(tenantId);
    
    if (!data || !data.success || !data.data) return null;

    const hoursData = data.data;
    
    // Handle both response formats: periods array or day-based object
    if (hoursData.periods && Array.isArray(hoursData.periods)) {
      const { periods, timezone } = hoursData;
      const hours: any = { timezone };
      
      // Convert periods to day-based format for BusinessHoursDisplay
      periods.forEach((period: any) => {
        const dayName = period.day?.toUpperCase(); // Keep uppercase for BusinessHoursDisplay
        if (dayName && !hours[dayName]) {
          hours[dayName] = {
            open: period.open,
            close: period.close
          };
        }
      });
      
      // Include periods array for BusinessHoursDisplay to handle multiple periods
      if (periods.length > 0) {
        hours.periods = periods;
      }
      
      return hours;
    } else {
      // Assume data is already in day-based format
      return hoursData;
    }
  } catch (error) {
    console.error('Error fetching business hours:', error);
    return null;
  }
}

export default function StoreStatusIndicator({ tenantId }: StoreStatusIndicatorProps) {
  const [storeStatus, setStoreStatus] = useState<any>(null);

  useEffect(() => {
    const loadStatus = async () => {
      const hours = await getBusinessHours(tenantId);
      const status = hours ? computeStoreStatus(hours) : null;
      setStoreStatus(status);
    };

    if (tenantId) {
      loadStatus();
    }
  }, [tenantId]);

  if (!storeStatus) return null;

  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${
        storeStatus.status === 'open' ? 'bg-green-500' :
        storeStatus.status === 'closing-soon' ? 'bg-orange-500' :
        storeStatus.status === 'opening-soon' ? 'bg-blue-500' :
        'bg-red-500'
      }`}></span>
      <span className={`font-medium ${
        storeStatus.status === 'open' ? 'text-green-700' :
        storeStatus.status === 'closing-soon' ? 'text-orange-700' :
        storeStatus.status === 'opening-soon' ? 'text-blue-700' :
        'text-red-700'
      }`}>
        {storeStatus.label}
      </span>
    </div>
  );
}

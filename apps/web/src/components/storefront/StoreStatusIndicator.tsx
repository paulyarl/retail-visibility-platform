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

  const getStatusStyles = () => {
    switch (storeStatus.status) {
      case 'open':
        return {
          bg: 'bg-green-500/90',
          text: 'text-white',
          dot: 'bg-white'
        };
      case 'closing-soon':
        return {
          bg: 'bg-orange-500/90',
          text: 'text-white',
          dot: 'bg-white'
        };
      case 'opening-soon':
        return {
          bg: 'bg-blue-500/90',
          text: 'text-white',
          dot: 'bg-white'
        };
      default:
        return {
          bg: 'bg-red-500/90',
          text: 'text-white',
          dot: 'bg-white'
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold backdrop-blur-sm shadow-lg ${styles.bg} ${styles.text}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${styles.dot}`}></span>
      <span className="truncate max-w-[210px]">{storeStatus.label}</span>
    </div>
  );
}

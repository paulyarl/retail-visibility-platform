import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Distance conversion utilities
 */
export const distanceUtils = {
  /**
   * Convert kilometers to miles
   */
  kmToMiles: (km: number): number => {
    return km * 0.62137119223733;
  },
  
  /**
   * Detect if user is in US based on browser locale
   */
  isUSUser: (): boolean => {
    if (typeof window === 'undefined') return false;
    
    const locale = navigator.language || navigator.languages?.[0] || 'en-US';
    return locale.startsWith('en-US') || locale.startsWith('en-US');
  },
  
  /**
   * Format distance display based on user locale
   * Returns formatted distance with appropriate unit
   */
  formatDistance: (km: number): string => {
    if (km === null || km === undefined) return '';
    
    const isUS = distanceUtils.isUSUser();
    
    if (isUS) {
      const miles = distanceUtils.kmToMiles(km);
      if (miles < 1) {
        return `${Math.round(miles * 5280)}ft away`;
      }
      return `${Math.round(miles)}mi away`;
    } else {
      if (km < 1) {
        return `${Math.round(km * 1000)}m away`;
      }
      return `${Math.round(km)}km away`;
    }
  },
  
  /**
   * Get distance in preferred unit for calculations
   */
  getDistanceInPreferredUnit: (km: number): number => {
    const isUS = distanceUtils.isUSUser();
    return isUS ? distanceUtils.kmToMiles(km) : km;
  }
};

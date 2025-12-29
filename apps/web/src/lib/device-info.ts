/**
 * Device information utilities for enhanced session tracking
 */

interface DeviceInfo {
  name?: string;
  platform?: string;
  mobile?: boolean;
  screenWidth?: number;
  screenHeight?: number;
  timezone?: string;
  language?: string;
}

/**
 * Get device name from browser APIs
 * Falls back to generated name if not available
 */
export function getDeviceName(): string {
  try {
    // Try modern User-Agent Data API (Chrome 90+, Edge 90+)
    if ('userAgentData' in navigator) {
      const uaData = (navigator as any).userAgentData;
      if (uaData && uaData.platform) {
        const platform = uaData.platform.toLowerCase();
        const isMobile = uaData.mobile || false;

        // Generate descriptive name based on platform
        if (platform.includes('windows')) {
          return isMobile ? 'Windows Phone' : 'Windows PC';
        } else if (platform.includes('macos') || platform.includes('mac')) {
          return isMobile ? 'iPhone' : 'Mac';
        } else if (platform.includes('linux')) {
          return isMobile ? 'Android Device' : 'Linux PC';
        } else if (platform.includes('android')) {
          return 'Android Device';
        } else if (platform.includes('ios') || platform.includes('iphone')) {
          return 'iPhone';
        } else {
          return `${platform.charAt(0).toUpperCase() + platform.slice(1)} Device`;
        }
      }
    }

    // Fallback to basic platform detection
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'Windows PC';
    if (platform.includes('mac')) return 'Mac';
    if (platform.includes('linux')) return 'Linux PC';
    if (platform.includes('android')) return 'Android Device';
    if (platform.includes('iphone') || platform.includes('ipad')) return 'iOS Device';

    // Ultimate fallback
    return 'Unknown Device';

  } catch (error) {
    console.warn('Failed to get device name:', error);
    return 'Unknown Device';
  }
}

/**
 * Get comprehensive device information
 */
export function getDeviceInfo(): DeviceInfo {
  return {
    name: getDeviceName(),
    platform: navigator.platform,
    mobile: /Mobi|Android/i.test(navigator.userAgent),
    screenWidth: screen.width,
    screenHeight: screen.height,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
  };
}

/**
 * Get device info as JSON string for API headers
 */
export function getDeviceInfoHeader(): string {
  try {
    const deviceInfo = getDeviceInfo();
    return JSON.stringify(deviceInfo);
  } catch (error) {
    console.warn('Failed to generate device info header:', error);
    return JSON.stringify({ name: 'Unknown Device' });
  }
}

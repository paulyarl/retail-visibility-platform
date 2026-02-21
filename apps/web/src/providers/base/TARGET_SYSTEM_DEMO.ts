/**
 * System Demonstration - Shows the new target system in action
 * 
 * This example demonstrates how the cleaned-up classes work:
 * - ApiSystemSingleton: SYSTEM + API (port 4000)
 * - SystemSingleton: SYSTEM + WEB (port 3000)
 * - Cross-target capabilities
 */

import { ApiSystemSingleton } from '@/providers/base/ApiSystemSingleton';
import { SystemSingleton } from '@/providers/base/SystemSingleton';
import { RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingleton';

// ====================
// API SYSTEM SERVICE (Port 4000)
// ====================

class BackendSystemService extends ApiSystemSingleton {
  private static instance: BackendSystemService;

  private constructor() {
    super('BackendSystemService');
  }

  static getInstance(): BackendSystemService {
    if (!BackendSystemService.instance) {
      BackendSystemService.instance = new BackendSystemService();
    }
    return BackendSystemService.instance;
  }

  /**
   * Default behavior: SYSTEM + API
   * Goes to: http://localhost:4000/api/system/status
   */
  async getSystemStatus() {
    console.log('🔧 API System: Getting status from API server (port 4000)');
    return this.makeDefaultRequest('/api/system/status');
  }

  /**
   * Explicit API request: SYSTEM + API
   * Goes to: http://localhost:4000/api/health
   */
  async getApiHealth() {
    console.log('🔧 API System: Getting health from API server (port 4000)');
    return this.makeApiRequest('/api/health');
  }

  /**
   * Cross-target: SYSTEM + WEB
   * Goes to: http://localhost:3000/api/system/web-status
   */
  async getWebStatus() {
    console.log('🌐 API System: Getting web status from WEB server (port 3000)');
    return this.makeWebRequest('/api/system/web-status');
  }

  /**
   * Hybrid: PUBLIC + API
   * Goes to: http://localhost:4000/public/system/info
   */
  async getPublicInfo() {
    console.log('🔓 API System: Getting public info from API server (port 4000)');
    return this.makePublicApiRequest('/public/system/info');
  }
}

// ====================
// WEB SYSTEM SERVICE (Port 3000)
// ====================

class WebSystemService extends SystemSingleton {
  private static instance: WebSystemService;

  private constructor() {
    super('WebSystemService');
  }

  static getInstance(): WebSystemService {
    if (!WebSystemService.instance) {
      WebSystemService.instance = new WebSystemService();
    }
    return WebSystemService.instance;
  }

  /**
   * Default behavior: SYSTEM + WEB
   * Goes to: http://localhost:3000/api/system/status
   */
  async getSystemStatus() {
    console.log('🌐 Web System: Getting status from WEB server (port 3000)');
    return this.makeDefaultRequest('/api/system/status');
  }

  /**
   * Explicit WEB request: SYSTEM + WEB
   * Goes to: http://localhost:3000/api/health
   */
  async getWebHealth() {
    console.log('🌐 Web System: Getting health from WEB server (port 3000)');
    return this.makeWebRequest('/api/health');
  }

  /**
   * Cross-target: SYSTEM + API
   * Goes to: http://localhost:4000/api/system/api-status
   */
  async getApiStatus() {
    console.log('🔧 Web System: Getting API status from API server (port 4000)');
    return this.makeApiRequest('/api/system/api-status');
  }

  /**
   * Hybrid: PUBLIC + WEB
   * Goes to: http://localhost:3000/public/system/info
   */
  async getPublicInfo() {
    console.log('🔓 Web System: Getting public info from WEB server (port 3000)');
    return this.makePublicWebRequest('/public/system/info');
  }
}

// ====================
// DEMONSTRATION FUNCTION
// ====================

export async function demonstrateTargetSystem() {
  console.log('🚀 Demonstrating Target System Architecture\n');

  const apiService = BackendSystemService.getInstance();
  const webService = WebSystemService.getInstance();

  console.log('=== API System Service (Default: SYSTEM + API) ===');
  await apiService.getSystemStatus();    // SYSTEM + API (port 4000)
  await apiService.getApiHealth();      // SYSTEM + API (port 4000)
  await apiService.getWebStatus();      // SYSTEM + WEB (port 3000) - Cross-target!
  await apiService.getPublicInfo();     // PUBLIC + API (port 4000) - Hybrid!

  console.log('\n=== Web System Service (Default: SYSTEM + WEB) ===');
  await webService.getSystemStatus();    // SYSTEM + WEB (port 3000)
  await webService.getWebHealth();      // SYSTEM + WEB (port 3000)
  await webService.getApiStatus();      // SYSTEM + API (port 4000) - Cross-target!
  await webService.getPublicInfo();     // PUBLIC + WEB (port 3000) - Hybrid!

  console.log('\n✨ Target System Demo Complete!');
  console.log('✅ Clean defaults with flexible overrides');
  console.log('✅ Type-safe enum-based targeting');
  console.log('✅ Cross-target capabilities');
  console.log('✅ No manual URL construction needed');
}

// Export services for use
export { BackendSystemService, WebSystemService };

import { NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

/**
 * Dashboard API - Optimized endpoint for home page
 * Combines multiple API calls into one for better performance
 */
export async function GET(request: NextRequest) {
  try {
    // Get user's tenants
    const tenantsRes = await proxyGet(request, '/tenants');
    
    if (!tenantsRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: tenantsRes.status });
    }
    
    const tenants = await tenantsRes.json();
    
    if (!Array.isArray(tenants) || tenants.length === 0) {
      return NextResponse.json({
        tenant: null,
        stats: {
          totalItems: 0,
          activeItems: 0,
          syncIssues: 0,
          locations: 0,
        },
        isChain: false,
        organizationName: null,
        storefrontUrl: null,
      });
    }
    
    // Get preferred tenant or use first
    const preferredTenantId = request.cookies.get('tenantId')?.value;
    let selectedTenant = preferredTenantId 
      ? tenants.find((t: any) => t.id === preferredTenantId) || tenants[0]
      : tenants[0];
    
    // Fetch items for selected tenant
    let itemsRes = await proxyGet(request, `/items?tenantId=${selectedTenant.id}`);
    let totalItems = 0;
    let activeItems = 0;
    let lowStockItems = 0;
    
    if (itemsRes.ok) {
      const items = await itemsRes.json();
      console.log('[Dashboard] Items response:', { isArray: Array.isArray(items), type: typeof items, length: items?.length, keys: Object.keys(items || {}) });
      if (Array.isArray(items)) {
        totalItems = items.length;
        activeItems = items.filter((i: any) => i.itemStatus === 'active').length;
        lowStockItems = items.filter((i: any) => i.googleSyncStatus === 'error' || i.googleSyncStatus === 'pending').length;
      } else if (items && typeof items === 'object' && 'items' in items) {
        // Handle paginated response
        const itemsArray = items.items;
        if (Array.isArray(itemsArray)) {
          totalItems = itemsArray.length;
          activeItems = itemsArray.filter((i: any) => i.itemStatus === 'active').length;
          lowStockItems = itemsArray.filter((i: any) => i.googleSyncStatus === 'error' || i.googleSyncStatus === 'pending').length;
        }
      }
    }
    
    // If selected tenant has no items but other tenants exist, try to find one with items
    if (totalItems === 0 && tenants.length > 1) {
      console.log('[Dashboard] Searching for tenant with items...');
      for (const tenant of tenants) {
        if (tenant.id === selectedTenant.id) continue; // Skip the one we already checked
        
        const testItemsRes = await proxyGet(request, `/items?tenantId=${tenant.id}`);
        if (testItemsRes.ok) {
          const testItems = await testItemsRes.json();
          if (Array.isArray(testItems) && testItems.length > 0) {
            // Found a tenant with items, use it instead
            console.log(`[Dashboard] Found tenant with ${testItems.length} items:`, tenant.name);
            selectedTenant = tenant;
            totalItems = testItems.length;
            activeItems = testItems.filter((i: any) => i.itemStatus === 'active').length;
            lowStockItems = testItems.filter((i: any) => i.googleSyncStatus === 'error' || i.googleSyncStatus === 'pending').length;
            console.log(`[Dashboard] Stats: total=${totalItems}, active=${activeItems}, syncIssues=${lowStockItems}`);
            break;
          }
        }
      }
    }
    
    console.log('[Dashboard] Final stats before return:', { totalItems, activeItems, lowStockItems, tenantId: selectedTenant.id });
    
    // Fetch tenant details
    const tenantRes = await proxyGet(request, `/tenants/${selectedTenant.id}`);
    
    let isChain = false;
    let organizationName = null;
    let locations = 1;
    
    if (tenantRes.ok) {
      const tenant = await tenantRes.json();
      if (tenant.organization) {
        isChain = true;
        organizationName = tenant.organization.name;
        // Count only tenants in the same organization
        locations = tenants.filter((t: any) => t.organizationId === tenant.organizationId).length;
      }
    }
    
    const storefrontUrl = `/tenant/${selectedTenant.id}`;
    
    // Calculate platform-level stats for chains
    let platformStats = null;
    if (isChain && locations > 1) {
      platformStats = {
        totalLocations: locations,
        totalTenants: locations,
        // Note: For full platform stats, we'd need to fetch items for all tenants
        // This would require additional API calls, so we keep it simple for now
      };
    }
    
    return NextResponse.json({
      tenant: {
        id: selectedTenant.id,
        name: selectedTenant.name,
      },
      stats: {
        totalItems,
        activeItems,
        syncIssues: lowStockItems, // Renamed: items with Google sync errors/pending
        locations,
      },
      platformStats,
      isChain,
      organizationName,
      storefrontUrl,
    });
    
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

/**
 * Dashboard API - Optimized endpoint for home page
 * Combines multiple API calls into one for better performance
 */
export async function GET(request: NextRequest) {
  try {
    // Get user's tenants
    const tenantsRes = await proxyGet(request, '/api/tenants');
    
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
          lowStockItems: 0,
          locations: 0,
        },
        isChain: false,
        organizationName: null,
        storefrontUrl: null,
      });
    }
    
    // Get preferred tenant or use first
    const preferredTenantId = request.cookies.get('tenantId')?.value;
    const selectedTenant = preferredTenantId 
      ? tenants.find((t: any) => t.id === preferredTenantId) || tenants[0]
      : tenants[0];
    
    // Fetch tenant details and items in parallel
    const [tenantRes, itemsRes] = await Promise.all([
      proxyGet(request, `/api/tenants/${selectedTenant.id}`),
      proxyGet(request, `/api/items?tenantId=${selectedTenant.id}`),
    ]);
    
    let totalItems = 0;
    let activeItems = 0;
    let lowStockItems = 0;
    
    if (itemsRes.ok) {
      const items = await itemsRes.json();
      if (Array.isArray(items)) {
        totalItems = items.length;
        activeItems = items.filter((i: any) => i.itemStatus === 'active').length;
        lowStockItems = items.filter((i: any) => i.stock !== undefined && i.stock < 10).length;
      }
    }
    
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
        lowStockItems,
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

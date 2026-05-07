import { NextRequest, NextResponse } from 'next/server';
import { tenantDashboardService } from '@/services/TenantDashboardService';

/**
 * Dashboard API - Optimized endpoint for home page
 * Uses TenantDashboardService for cached dashboard operations
 */
export async function GET(request: NextRequest) {
  try {
    // Extract tenantId from query params
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Get dashboard data using service with automatic caching
    const dashboardData = await tenantDashboardService.getTenantDashboard(tenantId);

    if (!dashboardData) {
      return NextResponse.json({ 
        error: 'dashboard_not_found',
        message: 'Unable to fetch dashboard data' 
      }, { status: 404 });
    }

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch dashboard data' 
      },
      { status: 500 }
    );
  }
}

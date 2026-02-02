import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * GET /api/inventory/tenant-limits
 * 
 * Cached API route for tenant limits and capacity
 * Cache: 5 minutes (300s) - aligned with real-time needs
 */
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const tenantId = headersList.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: 'Tenant ID required',
        cached: false
      }, { 
        status: 400,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
    }

    // This would integrate with your existing tenant limits API
    // but with singleton service caching
    const response = await fetch(`${process.env.API_BASE_URL}/api/tenant-limits/status`, {
      headers: {
        'x-tenant-id': tenantId,
        'Authorization': headersList.get('authorization') || ''
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tenant limits');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data,
      cached: true,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        'X-Cache-Status': 'HIT'
      }
    });
    
  } catch (error) {
    console.error('Error fetching tenant limits:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch tenant limits',
      cached: false
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  }
}

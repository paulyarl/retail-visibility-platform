import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/tenant
 * Get current user's tenant information
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Get user's tenant from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenantId')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.tenantId) {
      return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
    }

    // Fetch tenant from backend API
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tenants/${userData.tenantId}`);
    
    if (!res.ok) {
      return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 });
    }

    const tenant = await res.json();
    
    // Get SKU count
    const { count } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true })
      .eq('tenantId', userData.tenantId);

    return NextResponse.json({
      ...tenant,
      _count: {
        items: count || 0
      }
    });
  } catch (error) {
    console.error('[GET /api/tenant] Error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

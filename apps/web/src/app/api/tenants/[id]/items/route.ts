import { NextResponse } from 'next/server';
import { proxyGet } from '@/lib/api-proxy';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Fetch items for this tenant from backend with auth
    const res = await proxyGet(request, `/tenants/${id}/items`);
    
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json([]);
      }
      return NextResponse.json(
        { error: 'Failed to fetch items' },
        { status: res.status }
      );
    }
    
    const items = await res.json();
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching tenant items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Fetch items for this tenant from backend
    const res = await fetch(`${API_BASE_URL}/tenants/${id}/items`);
    
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

import { NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPatch, proxyDelete } from '@/lib/api-proxy';

// GET /api/organization-requests/[id] - Get a specific request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await proxyGet(request, `/organization-requests/${id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[Organization Request] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization request' },
      { status: 500 }
    );
  }
}

// PATCH /api/organization-requests/[id] - Update request (approve/reject/agree to cost)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const res = await proxyPatch(request, `/organization-requests/${id}`, body);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[Organization Request] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update organization request' },
      { status: 500 }
    );
  }
}

// DELETE /api/organization-requests/[id] - Cancel/delete a request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const res = await proxyDelete(request, `/organization-requests/${id}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('[Organization Request] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization request' },
      { status: 500 }
    );
  }
}

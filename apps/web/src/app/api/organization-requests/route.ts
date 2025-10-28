import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/organization-requests - List all requests (Admin only) or user's requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId');
    const userId = searchParams.get('userId');

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (tenantId) {
      where.tenantId = tenantId;
    }
    
    if (userId) {
      where.requestedBy = userId;
    }

    const requests = await prisma.organizationRequest.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('[Organization Requests] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization requests' },
      { status: 500 }
    );
  }
}

// POST /api/organization-requests - Create a new request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, organizationId, requestedBy, requestType, notes, estimatedCost, costCurrency } = body;

    if (!tenantId || !organizationId || !requestedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, organizationId, requestedBy' },
        { status: 400 }
      );
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.organizationRequest.findFirst({
      where: {
        tenantId,
        organizationId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending request already exists for this tenant and organization' },
        { status: 409 }
      );
    }

    const organizationRequest = await prisma.organizationRequest.create({
      data: {
        tenantId,
        organizationId,
        requestedBy,
        requestType: requestType || 'join',
        notes,
        estimatedCost,
        costCurrency: costCurrency || 'USD',
        status: 'pending',
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
    });

    return NextResponse.json(organizationRequest, { status: 201 });
  } catch (error) {
    console.error('[Organization Requests] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization request' },
      { status: 500 }
    );
  }
}

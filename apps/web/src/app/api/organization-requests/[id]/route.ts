import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/organization-requests/[id] - Get a specific request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const organizationRequest = await prisma.organizationRequest.findUnique({
      where: { id },
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

    if (!organizationRequest) {
      return NextResponse.json(
        { error: 'Organization request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(organizationRequest);
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
    const { status, adminNotes, processedBy, costAgreed, estimatedCost } = body;

    const updateData: any = {};

    if (status) {
      updateData.status = status;
      updateData.processedAt = new Date();
      if (processedBy) {
        updateData.processedBy = processedBy;
      }
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    if (estimatedCost !== undefined) {
      updateData.estimatedCost = estimatedCost;
    }

    if (costAgreed !== undefined) {
      updateData.costAgreed = costAgreed;
      if (costAgreed) {
        updateData.costAgreedAt = new Date();
      }
    }

    const organizationRequest = await prisma.organizationRequest.update({
      where: { id },
      data: updateData,
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

    // If approved and cost agreed, assign tenant to organization
    if (status === 'approved' && organizationRequest.costAgreed) {
      await prisma.tenant.update({
        where: { id: organizationRequest.tenantId },
        data: {
          organizationId: organizationRequest.organizationId,
        },
      });
    }

    return NextResponse.json(organizationRequest);
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

    await prisma.organizationRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Organization Request] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization request' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PUT /api/admin/feature-overrides/[id]/status - Update override status
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json() as { status: string; reason?: string };
    const { status, reason } = body;

    // Validate required fields
    if (!status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['active', 'expired', 'revoked', 'pending'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if override exists
    const existingOverride = await prisma.feature_overrides.findUnique({
      where: { id }
    });

    if (!existingOverride) {
      return NextResponse.json(
        { error: 'Feature override not found' },
        { status: 404 }
      );
    }

    // Update override status
    const updatedOverride = await prisma.feature_overrides.update({
      where: { id },
      data: {
        status,
        updated_at: new Date(),
        // Update reason if provided
        ...(reason && { reason })
      },
      include: {
        feature_override_details: true
      }
    });

    return NextResponse.json(updatedOverride);

  } catch (error) {
    console.error('Error updating feature override status:', error);
    return NextResponse.json(
      { error: 'Failed to update feature override status' },
      { status: 500 }
    );
  }
}

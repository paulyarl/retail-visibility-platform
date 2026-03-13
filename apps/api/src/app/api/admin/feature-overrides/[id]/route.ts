import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// DELETE /api/admin/feature-overrides/[id] - Delete override
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

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

    // Delete override (cascade will delete details)
    await prisma.feature_overrides.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Feature override deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting feature override:', error);
    return NextResponse.json(
      { error: 'Failed to delete feature override' },
      { status: 500 }
    );
  }
}

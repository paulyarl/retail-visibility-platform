/**
 * Order Number Generator Utility
 * Generates unique, human-readable order numbers
 * Format: ORD-YYYY-NNNNNN (e.g., ORD-2024-000001)
 */

import { prisma } from '../prisma';

/**
 * Generate a unique order number for a tenant
 * @param tenantId - The tenant ID
 * @returns Promise<string> - Unique order number
 */
export async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  // Try up to 10 times to find an available order number
  for (let attempt = 0; attempt < 10; attempt++) {
    // Get the highest order number for this year
    const latestOrder = await prisma.orders.findFirst({
      where: {
        tenant_id: tenantId,
        order_number: {
          startsWith: prefix,
        },
      },
      orderBy: {
        order_number: 'desc',
      },
      select: {
        order_number: true,
      },
    });

    let nextSequence = 1;
    if (latestOrder) {
      // Extract the sequence number from the latest order
      const parts = latestOrder.order_number.split('-');
      const currentSequence = parseInt(parts[2], 10);
      nextSequence = currentSequence + 1;
    }

    // Add random offset on retry to avoid collisions
    if (attempt > 0) {
      nextSequence += attempt;
    }

    const sequentialNumber = nextSequence.toString().padStart(6, '0');
    const orderNumber = `${prefix}${sequentialNumber}`;

    // Check if this order number is available
    const existing = await prisma.orders.findUnique({
      where: { order_number: orderNumber },
    });

    if (!existing) {
      return orderNumber;
    }
  }

  // Fallback: use timestamp-based unique number
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${randomSuffix}`;
}

/**
 * Validate order number format
 * @param orderNumber - Order number to validate
 * @returns boolean - True if valid format
 */
export function isValidOrderNumber(orderNumber: string): boolean {
  // Format: ORD-YYYY-NNNNNN
  const regex = /^ORD-\d{4}-\d{6}$/;
  return regex.test(orderNumber);
}

/**
 * Parse order number to extract year and sequence
 * @param orderNumber - Order number to parse
 * @returns Object with year and sequence, or null if invalid
 */
export function parseOrderNumber(orderNumber: string): { year: number; sequence: number } | null {
  if (!isValidOrderNumber(orderNumber)) {
    return null;
  }

  const parts = orderNumber.split('-');
  return {
    year: parseInt(parts[1], 10),
    sequence: parseInt(parts[2], 10),
  };
}

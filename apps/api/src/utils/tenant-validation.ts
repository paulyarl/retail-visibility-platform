/**
 * Tenant Validation Utilities
 * 
 * Ensures data integrity for tenant creation:
 * - No duplicate locations per owner
 * - No duplicate addresses across tenants
 * - No duplicate business names at same address
 */

import { prisma } from '../prisma';

export interface TenantValidationError {
  field: string;
  message: string;
  existingTenantId?: string;
  existingTenantName?: string;
}

export interface TenantValidationResult {
  valid: boolean;
  errors: TenantValidationError[];
}

/**
 * Validate tenant creation for duplicates
 */
export async function validateTenantCreation(
  userId: string,
  tenantName: string,
  businessProfile?: {
    businessName?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }
): Promise<TenantValidationResult> {
  const errors: TenantValidationError[] = [];

  // 1. Check for duplicate tenant name by same owner
  const duplicateName = await prisma.tenant.findFirst({
    where: {
      name: tenantName,
      users: {
        some: {
          userId,
          role: 'OWNER',
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (duplicateName) {
    errors.push({
      field: 'name',
      message: `You already own a location named "${tenantName}"`,
      existingTenantId: duplicateName.id,
      existingTenantName: duplicateName.name,
    });
  }

  // 2. Check for duplicate address (if business profile provided)
  if (businessProfile?.addressLine1 && businessProfile?.city && businessProfile?.state) {
    const duplicateAddress = await checkDuplicateAddress(
      businessProfile.addressLine1,
      businessProfile.city,
      businessProfile.state,
      businessProfile.postalCode
    );

    if (duplicateAddress) {
      errors.push({
        field: 'address',
        message: `A location already exists at this address: ${duplicateAddress.name}`,
        existingTenantId: duplicateAddress.id,
        existingTenantName: duplicateAddress.name,
      });
    }
  }

  // 3. Check for duplicate business name at same address
  if (businessProfile?.businessName && businessProfile?.addressLine1 && businessProfile?.city) {
    const duplicateBusinessAtAddress = await checkDuplicateBusinessAtAddress(
      businessProfile.businessName,
      businessProfile.addressLine1,
      businessProfile.city,
      businessProfile.state || ''
    );

    if (duplicateBusinessAtAddress) {
      errors.push({
        field: 'businessName',
        message: `"${businessProfile.businessName}" already exists at this address`,
        existingTenantId: duplicateBusinessAtAddress.id,
        existingTenantName: duplicateBusinessAtAddress.name,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if address already exists
 */
async function checkDuplicateAddress(
  addressLine1: string,
  city: string,
  state: string,
  postalCode?: string
): Promise<{ id: string; name: string } | null> {
  // Normalize address for comparison
  const normalizedAddress = normalizeAddress(addressLine1);
  const normalizedCity = city.trim().toLowerCase();
  const normalizedState = state.trim().toUpperCase();

  // Check TenantBusinessProfile table
  const existingProfile = await prisma.tenantBusinessProfile.findFirst({
    where: {
      addressLine1: {
        contains: normalizedAddress,
        mode: 'insensitive',
      },
      city: {
        equals: normalizedCity,
        mode: 'insensitive',
      },
      state: {
        equals: normalizedState,
        mode: 'insensitive',
      },
      ...(postalCode && {
        postalCode: {
          equals: postalCode.trim(),
          mode: 'insensitive',
        },
      }),
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (existingProfile) {
    return {
      id: existingProfile.tenant.id,
      name: existingProfile.tenant.name,
    };
  }

  // Also check legacy metadata (for backwards compatibility)
  const tenantsWithMetadata = await prisma.tenant.findMany({
    where: {
      metadata: {
        path: ['address_line1'],
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      metadata: true,
    },
  });

  for (const tenant of tenantsWithMetadata) {
    const metadata = tenant.metadata as any;
    if (
      metadata?.address_line1 &&
      normalizeAddress(metadata.address_line1) === normalizedAddress &&
      metadata?.city?.toLowerCase() === normalizedCity &&
      metadata?.state?.toUpperCase() === normalizedState
    ) {
      return {
        id: tenant.id,
        name: tenant.name,
      };
    }
  }

  return null;
}

/**
 * Check if business name already exists at same address
 */
async function checkDuplicateBusinessAtAddress(
  businessName: string,
  addressLine1: string,
  city: string,
  state: string
): Promise<{ id: string; name: string } | null> {
  const normalizedBusinessName = businessName.trim().toLowerCase();
  const normalizedAddress = normalizeAddress(addressLine1);
  const normalizedCity = city.trim().toLowerCase();
  const normalizedState = state.trim().toUpperCase();

  const existingProfile = await prisma.tenantBusinessProfile.findFirst({
    where: {
      businessName: {
        equals: normalizedBusinessName,
        mode: 'insensitive',
      },
      addressLine1: {
        contains: normalizedAddress,
        mode: 'insensitive',
      },
      city: {
        equals: normalizedCity,
        mode: 'insensitive',
      },
      state: {
        equals: normalizedState,
        mode: 'insensitive',
      },
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (existingProfile) {
    return {
      id: existingProfile.tenant.id,
      name: existingProfile.tenant.name,
    };
  }

  return null;
}

/**
 * Normalize address for comparison
 * Removes common variations (St vs Street, Ave vs Avenue, etc.)
 */
function normalizeAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    // Remove punctuation
    .replace(/[.,#]/g, '')
    // Normalize common abbreviations
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\bapartment\b/g, 'apt')
    .replace(/\bsuite\b/g, 'ste')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if user already owns a tenant with this name
 */
export async function checkDuplicateTenantName(
  userId: string,
  tenantName: string
): Promise<boolean> {
  const existing = await prisma.tenant.findFirst({
    where: {
      name: tenantName,
      users: {
        some: {
          userId,
          role: 'OWNER',
        },
      },
    },
  });

  return !!existing;
}

/**
 * Get all tenants owned by user (for duplicate checking)
 */
export async function getUserOwnedTenants(userId: string) {
  return await prisma.userTenant.findMany({
    where: {
      userId,
      role: 'OWNER',
    },
    include: {
      tenant: {
        include: {
          businessProfile: true,
        },
      },
    },
  });
}

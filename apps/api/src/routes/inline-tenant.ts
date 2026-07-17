import { Router } from 'express';
import { z } from 'zod';
import { user_role } from '@prisma/client';
import { prisma, basePrisma } from '../prisma';
import { authenticateToken, checkTenantAccess, requireAdmin } from '../middleware/auth';
import { requireRoleGroup } from '../middleware/role-validation';
import { USER_ROLES } from '../config/role-groups';
import { TRIAL_CONFIG } from '../config/tenant-limits';
import { generateTenantId, generateUserTenantId } from '../lib/id-generator';
import { audit } from '../audit';
import { validateTierAssignment, validateTierCompatibility } from '../middleware/tier-validation';
import { validateTierSKUCompatibility } from '../middleware/sku-limits';
import { checkTenantCreationLimit } from '../middleware/permissions';
import { memoryCache, cacheKeys, CACHE_TTL } from '../utils/cache';
import { getDirectPool } from '../utils/db-pool';
import { tenantController } from '../controllers/tenant/TenantController';
import { asyncErrorWrapper } from '../middleware/errorHandler';
import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

const router = Router();

// GET /api/public/tenant/:tenantId/business-hours/status
router.get('/api/public/tenant/:tenantId/business-hours/status', async (req, res) => {
  const { tenantId } = req.params;

  try {
    const cacheKey = cacheKeys.businessHoursStatus(tenantId);
    const cachedResult = memoryCache.get(cacheKey);

    if (cachedResult) {
      return res.json(cachedResult);
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { location_status: true, closure_reason: true, reopening_date: true }
    });

    if (tenant?.location_status && tenant.location_status !== 'active') {
      const { getLocationStatusInfo } = await import('../utils/location-status');
      const statusInfo = getLocationStatusInfo(tenant.location_status as any);

      let label = statusInfo.label;
      if (tenant.closure_reason) {
        label = `${statusInfo.label} - ${tenant.closure_reason}`;
      }
      if (tenant.reopening_date) {
        const reopenDate = new Date(tenant.reopening_date);
        label += ` (Reopens ${reopenDate.toLocaleDateString()})`;
      }

      const result = {
        success: true,
        data: {
          isOpen: false,
          status: 'closed',
          label,
          locationStatus: tenant.location_status,
          statusInfo: {
            showStorefront: statusInfo.showStorefront,
            showInDirectory: statusInfo.showInDirectory,
            description: statusInfo.description,
            icon: statusInfo.icon,
            color: statusInfo.color
          },
          reopeningDate: tenant.reopening_date?.toISOString() || null,
          closureReason: tenant.closure_reason || null
        }
      };

      memoryCache.set(cacheKey, result, CACHE_TTL.BUSINESS_HOURS_STATUS);
      return res.json(result);
    }

    const hoursRow = await prisma.business_hours_list.findUnique({
      where: { tenant_id: tenantId }
    });

    if (!hoursRow) {
      const result = {
        success: true,
        data: {
          isOpen: false,
          status: 'closed',
          label: 'Closed'
        }
      };
      memoryCache.set(cacheKey, result, CACHE_TTL.BUSINESS_HOURS_STATUS);
      return res.json(result);
    }

    const specialHours = await prisma.business_hours_special_list.findMany({
      where: { tenant_id: tenantId },
      orderBy: { date: 'asc' }
    });

    const periods = hoursRow.periods as any[] || [];
    const hours: any = { timezone: hoursRow.timezone };

    periods.forEach((period: any) => {
      const dayName = period.day?.toLowerCase();
      if (dayName && !hours[dayName]) {
        hours[dayName] = {
          open: period.open,
          close: period.close
        };
      }
    });

    if (periods.length > 0) {
      hours.periods = periods;
    }

    if (specialHours.length > 0) {
      hours.special = specialHours.map((sh: any) => ({
        date: sh.date.toISOString().slice(0, 10),
        open: sh.open,
        close: sh.close,
        isClosed: sh.isClosed,
        note: sh.note
      }));
    }

    const { computeStoreStatus } = await import('../lib/hours-utils');
    const status = computeStoreStatus(hours);

    const result = {
      success: true,
      data: status || {
        isOpen: false,
        status: 'closed',
        label: 'Closed'
      }
    };

    memoryCache.set(cacheKey, result, CACHE_TTL.BUSINESS_HOURS_STATUS);

    res.json(result);
  } catch (error) {
    logger.error('Error computing store status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to compute store status'
    });
  }
});

// GET /api/tenants/my-subdomains
router.get("/api/tenants/my-subdomains", authenticateToken, async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user?.userId || user?.user_id || user?.id;
    const requestedTenantId = req.query.tenantId as string;

    const userTenants = await prisma.user_tenants.findMany({
      where: { user_id: userId },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            created_at: true
          }
        }
      }
    });

    let filteredUserTenants = userTenants;

    if (requestedTenantId) {
      filteredUserTenants = userTenants.filter(ut => ut.tenants.id === requestedTenantId);
    }

    const subdomains = filteredUserTenants
      .filter(ut => ut.tenants.subdomain)
      .map(ut => {
        let platformDomain = 'visibleshelf.com';
        let protocol = 'https';
        let port = '';

        if (req.headers.host) {
          const hostname = req.headers.host.split(':')[0];
          if (hostname.endsWith('.visibleshelf.com')) {
            platformDomain = 'visibleshelf.com';
          } else if (hostname.endsWith('.visibleshelf.store')) {
            platformDomain = 'visibleshelf.store';
          } else if (hostname.endsWith('.localhost') || hostname === 'localhost') {
            platformDomain = 'localhost';
            protocol = 'http';
            port = ':3000';
          }
        }

        return {
          tenantId: ut.tenants.id,
          tenantName: ut.tenants.name,
          subdomain: ut.tenants.subdomain,
          createdAt: ut.tenants.created_at,
          url: `${protocol}://${ut.tenants.subdomain}.${platformDomain}${port}`,
          platformDomain,
          isCurrentTenant: requestedTenantId ? ut.tenants.id === requestedTenantId : false
        };
      });

    res.json({
      success: true,
      subdomains,
      total: subdomains.length,
      scopedToTenant: !!requestedTenantId
    });
  } catch (error: any) {
    logger.error('[TENANTS] Error fetching user subdomains:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch subdomains'
    });
  }
});

// GET /api/tenants/:id
router.get("/api/tenants/:id", authenticateToken, checkTenantAccess, asyncErrorWrapper((req, res) => tenantController.getTenant(req, res)));

// POST /api/tenants
const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country_code: z.string().optional(),
  ownerId: z.string().optional(),
  organizationId: z.string().optional(),
});
router.post("/api/tenants", authenticateToken, checkTenantCreationLimit, async (req, res) => {
  const parsed = createTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  try {
    const userId = req.user!.userId || req.user!.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'authentication_required', message: 'Invalid user ID' });
    }

    const ownerId = (req.user?.role === user_role.PLATFORM_SUPPORT || req.user?.role === user_role.PLATFORM_ADMIN) && parsed.data.ownerId
      ? parsed.data.ownerId
      : userId;

    const ownerUser = await prisma.users.findUnique({
      where: { id: ownerId },
      select: { id: true, role: true }
    });
    const isOwnerPlatformAdmin = ownerUser?.role === USER_ROLES.PLATFORM_ADMIN || ownerUser?.role === USER_ROLES.ADMIN;
    if (!isOwnerPlatformAdmin) {
      const now = new Date();
      const activeTrialCount = await prisma.tenants.count({
        where: {
          user_tenants: {
            some: { user_id: ownerId }
          },
          subscription_status: 'trial',
          OR: [
            { trial_ends_at: { gt: now } },
            { trial_ends_at: null }
          ]
        }
      });
      if (activeTrialCount >= 1) {
        return res.status(409).json({
          error: 'trial_limit_reached',
          message: 'You already have an active trial tenant. Please upgrade your existing tenant or wait for your trial to expire before creating a new one.'
        });
      }
    }

    const { validateTenantCreation } = await import('../utils/tenant-validation');
    const validation = await validateTenantCreation(
      ownerId,
      parsed.data.name
    );

    if (!validation.valid) {
      return res.status(409).json({
        error: 'duplicate_tenant',
        message: 'A location with this information already exists',
        validationErrors: validation.errors,
      });
    }

    const trial_ends_at = new Date();
    trial_ends_at.setDate(trial_ends_at.getDate() + TRIAL_CONFIG.durationDays);

    if (parsed.data.organizationId) {
      console.log('[POST /tenants] Assigning tenant to organization:', parsed.data.organizationId);
    }

    const tenant = await prisma.tenants.create({
      data: {
        id: generateTenantId(),
        name: parsed.data.name,
        slug: parsed.data.slug,
        created_by: req.user?.userId || null,
        subscription_tier: 'discovery',
        subscription_status: 'trial',
        trial_ends_at: trial_ends_at,
        location_status: 'active',
        organization_id: parsed.data.organizationId || null,
        metadata: {
          city: parsed.data.city,
          state: parsed.data.state,
          country_code: parsed.data.country_code,
        }
      }
    });

    const tenantCheck = await prisma.tenants.findUnique({
      where: { id: tenant.id }
    });

    if (!tenantCheck) {
      logger.error('[POST /tenants] CRITICAL: Tenant disappeared before UserTenant creation!', undefined);
      return res.status(500).json({ error: "tenant_creation_failed", message: "Tenant was created but is no longer accessible" });
    }

    const userTenant = await prisma.user_tenants.create({
      data: {
        id: generateUserTenantId(ownerId, tenant.id),
        user_id: ownerId,
        tenant_id: tenant.id,
        role: 'OWNER' as const,
        updated_at: new Date(),
      },
    });

    try {
      const ownerUser = await prisma.users.findUnique({
        where: { id: ownerId },
        select: { id: true, role: true }
      });
      if (ownerUser && !ownerUser.role) {
        await prisma.users.update({
          where: { id: ownerId },
          data: { role: USER_ROLES.OWNER }
        });
        console.log(`[POST /tenants] Updated owner ${ownerId} platform role to OWNER`);
      }
    } catch (roleError) {
      console.warn('[POST /tenants] Could not update owner platform role:', roleError);
    }

    await audit({ tenantId: tenant.id, actor: ownerId, action: "tenant.create", payload: { name: parsed.data.name, ownerId } });
    res.status(201).json(tenant);
  } catch (error) {
    logger.error('[POST /tenants] Error creating tenant:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_create_tenant", message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// PUT /api/tenants/:id
const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
});
router.put("/api/tenants/:id", authenticateToken, checkTenantAccess, async (req, res) => {
  const parsed = updateTenantSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  try {
    const data: any = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.region !== undefined) data.region = parsed.data.region;
    if (parsed.data.language !== undefined) data.language = parsed.data.language;
    if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
    const tenant = await prisma.tenants.update({ where: { id: req.params.id as string }, data });
    res.json(tenant);
  } catch (e) {
    logger.error('[PUT /tenants/:id] Error updating tenant:', undefined, { error: { name: (e as any)?.name || 'Error', message: (e as any)?.message || String(e), stack: (e as any)?.stack } });
    res.status(500).json({ error: "failed_to_update_tenant" });
  }
});

// PATCH /api/tenants/:id
const patchTenantSchema = z.object({
  subscription_tier: z.enum(['google_only', 'discovery', 'starter', 'storefront', 'professional', 'commitment', 'enterprise', 'organization']).optional(),
  subscription_status: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional(),
  organization_id: z.string().optional(),
});
router.patch("/api/tenants/:id", authenticateToken, requireAdmin, validateTierAssignment, validateTierCompatibility, validateTierSKUCompatibility, asyncErrorWrapper((req, res) => tenantController.updateTenant(req, res)));

// POST /api/tenants/:id/geocode
router.post("/api/tenants/:id/geocode", async (req, res) => {
  try {
    const { id } = req.params;

    const listingResult = await basePrisma.$queryRaw<any[]>`
      SELECT address, city, state, zip_code, business_name
      FROM directory_listings_list
      WHERE tenant_id = ${id}
      LIMIT 1
    `;

    if (!listingResult || listingResult.length === 0) {
      return res.status(400).json({ error: "tenant_not_found" });
    }

    const listing = listingResult[0];
    if (!listing.address || !listing.city || !listing.zip_code) {
      return res.status(400).json({ error: "incomplete_address", message: "Address, city, and zip code are required for geocoding" });
    }

    const fullAddress = [
      listing.address,
      listing.city,
      listing.state,
      listing.zip_code,
      'USA'
    ].filter(Boolean).join(', ');

    const apiKey = unifiedConfig.googleMapsApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: "geocoding_not_configured", message: "Google Maps API key not configured" });
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`;
    const geocodeResponse = await fetch(geocodeUrl);
    const geocodeData = await geocodeResponse.json() as {
      status: string;
      results?: Array<{
        geometry: {
          location: {
            lat: number;
            lng: number;
          };
        };
      }>;
      error_message?: string;
    };

    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      return res.status(400).json({ error: "geocoding_failed", status: geocodeData.status });
    }

    const location = geocodeData.results[0].geometry.location;
    const latitude = location.lat;
    const longitude = location.lng;

    await basePrisma.$executeRaw`
      UPDATE "tenant_business_profiles_list"
      SET latitude = ${latitude},
          longitude = ${longitude},
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${id}
    `;

    await basePrisma.$executeRaw`
      UPDATE "directory_listings_list"
      SET latitude = ${latitude},
          longitude = ${longitude},
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${id}
    `;

    res.json({
      success: true,
      latitude,
      longitude,
      business_name: listing.business_name
    });
  } catch (error) {
    logger.error('[POST /api/tenants/:id/geocode] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_geocode_tenant" });
  }
});

// PATCH /api/tenants/:id/coordinates
const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
router.patch("/api/tenants/:id/coordinates", async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = coordinatesSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "invalid_coordinates",
        details: parsed.error.flatten()
      });
    }

    const { latitude, longitude } = parsed.data;

    await basePrisma.$executeRaw`
      UPDATE "tenant_business_profiles_list"
      SET latitude = ${latitude},
          longitude = ${longitude},
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${id}
    `;

    await basePrisma.$executeRaw`
      UPDATE "directory_listings_list"
      SET latitude = ${latitude},
          longitude = ${longitude},
          updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ${id}
    `;

    res.json({
      success: true,
      message: 'Coordinates updated successfully',
      latitude,
      longitude
    });
  } catch (error) {
    logger.error('[PATCH /api/tenants/:id/coordinates] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_update_coordinates" });
  }
});

// DELETE /api/tenants/:id
router.delete("/api/tenants/:id", authenticateToken, checkTenantAccess, requireRoleGroup('IS_TENANT_OWNER'), async (req, res) => {
  try {
    const tenant_id = req.params.id;

    await prisma.user_tenants.deleteMany({
      where: { tenant_id }
    });

    await prisma.tenants.delete({
      where: { id: tenant_id }
    });

    res.json({ success: true, message: 'Tenant deleted successfully' });
  } catch (error) {
    logger.error('[DELETE /tenants/:id] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_delete_tenant" });
  }
});

// PATCH /api/tenants/:id/status
router.patch("/api/tenants/:id/status", authenticateToken, checkTenantAccess, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { status, reason, reopening_date } = req.body;

  try {
    const validStatuses = ['active', 'temporarily_closed', 'permanently_closed', 'renovating', 'relocating', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'invalid_status', validStatuses });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id },
      select: { location_status: true, name: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    const oldStatus = tenant.location_status;
    const updated = await prisma.tenants.update({
      where: { id },
      data: {
        location_status: status,
        status_changed_at: new Date(),
        status_changed_by: req.user?.userId || null,
        closure_reason: reason || null,
        reopening_date: reopening_date ? new Date(reopening_date) : null,
      }
    });

    const { getLocationStatusInfo } = await import('../utils/location-status');
    const statusInfo = getLocationStatusInfo(status);

    res.json({
      success: true,
      tenant: updated,
      oldStatus,
      newStatus: status,
      statusInfo,
      duration: Date.now() - startTime
    });
  } catch (error: any) {
    logger.error('[PATCH /tenants/:id/status] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_update_status", details: error.message });
  }
});

// POST /api/tenants/:id/status/preview
router.post("/api/tenants/:id/status/preview", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { getLocationStatusInfo } = await import('../utils/location-status');
    const statusInfo = getLocationStatusInfo(status);

    const tenant = await prisma.tenants.findUnique({
      where: { id },
      select: { _count: { select: { inventory_items: true } } }
    });

    res.json({
      success: true,
      statusInfo,
      productCount: tenant?._count?.inventory_items || 0,
      willShowStorefront: statusInfo.showStorefront,
      willShowInDirectory: statusInfo.showInDirectory,
    });
  } catch (error: any) {
    logger.error('[POST /tenants/:id/status/preview] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_preview_status", details: error.message });
  }
});

// GET /api/tenants/:id/status-history
router.get("/api/tenants/:id/status-history", authenticateToken, checkTenantAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const pool = getDirectPool();
    const result = await pool.query(
      'SELECT * FROM location_status_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [id, limit]
    );

    const statusInfoMap: Record<string, { label: string; icon: string }> = {
      pending: { label: 'Pending', icon: '⏳' },
      active: { label: 'Active', icon: '✅' },
      inactive: { label: 'Inactive', icon: '⏸️' },
      closed: { label: 'Closed', icon: '🔒' },
      archived: { label: 'Archived', icon: '📦' },
    };

    const history = result.rows.map((row: any) => ({
      id: row.id,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      changedBy: row.changed_by,
      reason: row.reason,
      reopeningDate: row.reopening_date,
      createdAt: row.created_at,
      metadata: row.metadata,
      oldStatusInfo: statusInfoMap[row.old_status] ?? { label: row.old_status, icon: '❓' },
      newStatusInfo: statusInfoMap[row.new_status] ?? { label: row.new_status, icon: '❓' },
    }));

    res.json({ history });
  } catch (error) {
    logger.error('[GET /tenants/:id/status-history] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_status_history" });
  }
});

// GET /api/tenants/by-status/:status
router.get("/api/tenants/by-status/:status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const tenants = await prisma.tenants.findMany({
      where: { location_status: status as any },
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        location_status: true,
        status_changed_at: true,
        closure_reason: true,
        reopening_date: true,
        created_at: true,
      }
    });

    const total = await prisma.tenants.count({
      where: { location_status: status as any }
    });

    res.json({
      tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    logger.error('[GET /tenants/by-status/:status] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: "failed_to_get_tenants_by_status" });
  }
});

export default router;

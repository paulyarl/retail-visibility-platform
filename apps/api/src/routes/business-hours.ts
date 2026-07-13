import { Router, Request, Response } from 'express'
import { prisma } from '../prisma'
import { requireFlag } from '../middleware/flags'
import { generateGbpHoursSyncLogId, generateQuickStart, generateSpecialHoursId } from '../lib/id-generator'
import CacheService, { CacheKeys } from '../lib/cache-service';
import BotKnowledgeEmbeddingService from '../services/BotKnowledgeEmbeddingService';

// Cache TTL constants
const CACHE_TTL = {
  BUSINESS_HOURS_STATUS: 5 * 60 * 1000, // 5 minutes
  BUSINESS_HOURS_SPECIAL: 15 * 60 * 1000, // 15 minutes
  BUSINESS_HOURS: 30 * 60 * 1000 // 30 minutes
};

const router = Router()

// Public router for unauthenticated access (mounted at /api/public/tenants/:tenantId)
const publicBusinessHoursRouter = Router({ mergeParams: true })

// Mirror status (attempt counter). Persistence is reflected in BusinessHours rows.
const mirrorAttempts = new Map<string, number>()

// GET /api/public/tenants/:tenantId/business-hours
publicBusinessHoursRouter.get('/business-hours',
  async (req: Request<{ tenantId: string }>, res: Response) => {
  const { tenantId } = req.params
  const row = await prisma.business_hours_list.findUnique({ where: { tenant_id: tenantId } })
  const timezone = row?.timezone || 'America/New_York'
  const periods: any[] = (row?.periods as any) || []
  res.json({ success: true, data: { timezone, periods } })
})

// GET /api/tenant/:tenantId/business-hours (kept for authenticated callers)
router.get('/tenant/:tenantId/business-hours',
  async (req, res) => {
  const { tenantId } = req.params
  const row = await prisma.business_hours_list.findUnique({ where: { tenant_id: tenantId } })
  const timezone = row?.timezone || 'America/New_York'
  const periods: any[] = (row?.periods as any) || []
  res.json({ success: true, data: { timezone, periods } })
})

// Alias: GET /api/business-hours/:tenantId (for frontend compatibility)
router.get('/business-hours/:tenantId',
  async (req, res) => {
  const { tenantId } = req.params
  const row = await prisma.business_hours_list.findUnique({ where: { tenant_id: tenantId } })
  const timezone = row?.timezone || 'America/New_York'
  const periods: any[] = (row?.periods as any) || []
  res.json({ success: true, data: { timezone, periods } })
})

// PUT /api/tenant/:tenantId/business-hours
router.put('/tenant/:tenantId/business-hours',
  async (req, res) => {
  const { tenantId } = req.params
  const { timezone, periods } = req.body || {}
  const nextTz = timezone || 'America/New_York'
  const nextPeriods = Array.isArray(periods) ? periods : []
  await prisma.business_hours_list.upsert({
    where: { tenant_id: tenantId },
    update: { timezone: nextTz, periods: nextPeriods as any },
    create: {
      id: `${tenantId}_hours`,
      tenant_id: tenantId,
      timezone: nextTz,
      periods: nextPeriods as any,
      updated_at: new Date()
    },
  })

  // Invalidate cache for this tenant's business hours status
  const cacheKey = CacheKeys.BUSINESS_HOURS(tenantId)
  await CacheService.del(cacheKey);
  // Also invalidate the status cache
  const cacheKeyStatus = CacheKeys.BUSINESS_HOURS_STATUS(tenantId)
  await CacheService.del(cacheKeyStatus);
  console.log(`[Business Hours] Invalidated cache for tenant ${tenantId}`)

  // Update business profile hours
  const { updateBusinessProfileHours } = await import('../utils/business-hours-utils');
  await updateBusinessProfileHours(tenantId);

  // Fire-and-forget: sync hours to Google Business Profile (gated by storefront + hours + GBP capabilities)
  import('../lib/google/capability-gate').then(({ isGBPHoursSyncAllowed }) => {
    return isGBPHoursSyncAllowed(tenantId);
  }).then(allowed => {
    if (!allowed) return;
    return import('../services/GBPBusinessInfoSync').then(({ syncBusinessHours, syncSpecialHours }) => {
      return Promise.all([syncBusinessHours(tenantId), syncSpecialHours(tenantId)])
        .then(([regular, special]) => {
          console.log(`[Business Hours] GBP sync for tenant ${tenantId}: regular=${regular.success}, special=${special.success}`);
          if (regular.success && !regular.skipped) {
            prisma.business_hours_list.updateMany({
              where: { tenant_id: tenantId },
              data: { last_synced_at: new Date() } as any,
            }).catch(() => {});
          }
        })
        .catch(err => console.error(`[Business Hours] GBP sync error for tenant ${tenantId}:`, err));
    });
  }).catch(() => {});

  // Refresh hours embeddings (fire-and-forget)
  BotKnowledgeEmbeddingService.getInstance().refreshHoursEmbeddings(tenantId).catch(() => {});

  res.json({ success: true })
})

// GET /api/public/tenants/:tenantId/business-hours/special
publicBusinessHoursRouter.get('/business-hours/special',
  async (req: Request<{ tenantId: string }>, res: Response) => {
  const { tenantId } = req.params
  const rows = await prisma.business_hours_special_list.findMany({ where: { tenant_id: tenantId }, orderBy: { date: 'asc' } })
  const overrides = rows.map((r: any) => ({ date: r.date.toISOString().slice(0,10), isClosed: r.isClosed, open: r.open, close: r.close, note: r.note }))
  res.json({ success: true, data: { overrides } })
})

// GET /api/tenant/:tenantId/business-hours/special (kept for authenticated callers)
router.get('/tenant/:tenantId/business-hours/special',
  async (req, res) => {
  const { tenantId } = req.params
  const rows = await prisma.business_hours_special_list.findMany({ where: { tenant_id: tenantId }, orderBy: { date: 'asc' } })
  const overrides = rows.map((r: any) => ({ date: r.date.toISOString().slice(0,10), isClosed: r.isClosed, open: r.open, close: r.close, note: r.note }))
  res.json({ success: true, data: { overrides } })
})

// PUT /api/tenant/:tenantId/business-hours/special
router.put('/tenant/:tenantId/business-hours/special',
  async (req, res) => {
  const { tenantId } = req.params
  const { overrides } = req.body || {}
  if (!Array.isArray(overrides)) return res.status(400).json({ success: false, error: 'invalid_overrides' })

  // Delete all existing special hours for this tenant first
  await prisma.business_hours_special_list.deleteMany({
    where: { tenant_id: tenantId }
  })

  // Then insert the new set
  for (const o of overrides) {
    const dateStr = o?.date
    if (!dateStr) continue
    const date = new Date(`${dateStr}T00:00:00.000Z`)
    await prisma.business_hours_special_list.create({
      data: {
        id:generateSpecialHoursId(tenantId),
        tenant_id: tenantId,
        date,
        isClosed: !!o.isClosed,
        open: o.open || null,
        close: o.close || null,
        note: o.note || null,
        updated_at: new Date()
      },
    })
  }

  // Update business profile hours
  const { updateBusinessProfileHours } = await import('../utils/business-hours-utils');
  await updateBusinessProfileHours(tenantId);

  // Fire-and-forget: sync hours to Google Business Profile (gated by storefront + hours + GBP capabilities)
  import('../lib/google/capability-gate').then(({ isGBPHoursSyncAllowed }) => {
    return isGBPHoursSyncAllowed(tenantId);
  }).then(allowed => {
    if (!allowed) return;
    return import('../services/GBPBusinessInfoSync').then(({ syncBusinessHours, syncSpecialHours }) => {
      return Promise.all([syncBusinessHours(tenantId), syncSpecialHours(tenantId)])
        .then(([regular, special]) => {
          console.log(`[Business Hours] GBP sync (special update) for tenant ${tenantId}: regular=${regular.success}, special=${special.success}`);
          if (special.success && !special.skipped) {
            prisma.business_hours_list.updateMany({
              where: { tenant_id: tenantId },
              data: { last_synced_at: new Date() } as any,
            }).catch(() => {});
          }
        })
        .catch(err => console.error(`[Business Hours] GBP sync error for tenant ${tenantId}:`, err));
    });
  }).catch(() => {});

  // Refresh hours embeddings (fire-and-forget)
  BotKnowledgeEmbeddingService.getInstance().refreshHoursEmbeddings(tenantId).catch(() => {});

  // Invalidate cache for this tenant's business hours status
  const cacheKey = CacheKeys.BUSINESS_HOURS(tenantId)
  await CacheService.del(cacheKey);

  // Also invalidate the status cache
  const cacheKeyStatus = CacheKeys.BUSINESS_HOURS_STATUS(tenantId)
  await CacheService.del(cacheKeyStatus);
  
  console.log(`[Business Hours] Invalidated cache for tenant ${tenantId} (special hours update)`)

  res.json({ success: true })
})

// POST /api/tenant/:tenantId/gbp/hours/mirror
router.post('/tenant/:tenantId/gbp/hours/mirror',
  async (req, res) => {
  const { tenantId } = req.params

  try {
    // Capability gate: storefront must be retail/service + hours enabled + GBP integration
    const { isGBPHoursSyncAllowed } = await import('../lib/google/capability-gate');
    const allowed = await isGBPHoursSyncAllowed(tenantId);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'GBP hours sync not allowed for this tenant (requires retail/service storefront with hours enabled and GBP integration)',
      });
    }

    // Call syncBusinessHours and syncSpecialHours directly
    const { syncBusinessHours, syncSpecialHours } = await import('../services/GBPBusinessInfoSync');

    const [regularResult, specialResult] = await Promise.all([
      syncBusinessHours(tenantId),
      syncSpecialHours(tenantId),
    ]);

    // Update sync timestamp on business_hours_list
    await prisma.business_hours_list.updateMany({
      where: { tenant_id: tenantId },
      data: { last_synced_at: new Date(), updated_at: new Date() } as any,
    });

    const success = regularResult.success && specialResult.success;
    const skipped = regularResult.skipped && specialResult.skipped;

    console.log(`[GBP Hours Mirror] Tenant ${tenantId}: regular=${regularResult.success}${regularResult.skipped ? ' (skipped)' : ''}, special=${specialResult.success}${specialResult.skipped ? ' (skipped)' : ''}`);

    res.status(success ? 200 : 207).json({
      success,
      data: {
        regularHours: regularResult,
        specialHours: specialResult,
        skipped,
      },
    });
  } catch (error: any) {
    console.error(`[GBP Hours Mirror] Error syncing hours for tenant ${tenantId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
})

// GET /api/tenant/:tenantId/gbp/hours/status
router.get('/tenant/:tenantId/gbp/hours/status',
  async (req, res) => {
  const { tenantId } = req.params
  const row = await prisma.business_hours_list.findUnique({ where: { tenant_id: tenantId } })
  const attempts = mirrorAttempts.get(tenantId) || row?.sync_attempts || 0
  const in_sync = !!row?.last_synced_at 
  res.json({ success: true, data: { in_sync, last_synced_at: row?.last_synced_at?.toISOString(), attempts } })
})

// GET /api/tenant/:tenantId/business-hours/status
router.get('/tenant/:tenantId/business-hours/status',
  async (req, res) => {
  const { tenantId } = req.params

  try {
    // Check cache first
    const cacheKey = CacheKeys.BUSINESS_HOURS_STATUS(tenantId)
    const cachedResult = await CacheService.get(cacheKey);

    if (cachedResult) {
      console.log(`[Business Hours] Cache hit for tenant ${tenantId}`)
      return res.json(cachedResult)
    }

    console.log(`[Business Hours] Cache miss for tenant ${tenantId}, fetching from database`)

    // Get tenant location status first to override hours-based status (aligned with public endpoint)
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { location_status: true, closure_reason: true, reopening_date: true }
    });

    // If tenant has non-active location status, return that status instead of hours-based status
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
          status: 'closed', // Frontend expects 'closed' for non-active status
          label,
          locationStatus: tenant.location_status, // Actual location status for reference
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

      // Cache the result
      await CacheService.set(cacheKey, result, CACHE_TTL.BUSINESS_HOURS_STATUS)
      return res.json(result);
    }

    // Get business hours data
    const hoursRow = await prisma.business_hours_list.findUnique({
      where: { tenant_id: tenantId }
    })

    if (!hoursRow) {
      const result = {
        success: true,
        data: {
          isOpen: false,
          status: 'closed',
          label: 'Closed'
        }
      }
      // Cache the result even for closed stores
      await CacheService.set(cacheKey, result, CACHE_TTL.BUSINESS_HOURS_STATUS)
      return res.json(result)
    }

    // Get special hours
    const specialHours = await prisma.business_hours_special_list.findMany({
      where: { tenant_id: tenantId },
      orderBy: { date: 'asc' }
    })

    // Build hours object
    const periods = hoursRow.periods as any[] || []
    const hours: any = { timezone: hoursRow.timezone }

    // Convert periods to day-based format for computeStoreStatus
    periods.forEach((period: any) => {
      const dayName = period.day?.toLowerCase()
      if (dayName && !hours[dayName]) {
        hours[dayName] = {
          open: period.open,
          close: period.close
        }
      }
    })

    // Include periods array for updated computeStoreStatus
    if (periods.length > 0) {
      hours.periods = periods
    }

    // Add special hours
    if (specialHours.length > 0) {
      hours.special = specialHours.map((sh: any) => ({
        date: sh.date.toISOString().slice(0, 10),
        open: sh.open,
        close: sh.close,
        isClosed: sh.isClosed,
        note: sh.note
      }))
    }

    // Import and use computeStoreStatus
    const { computeStoreStatus } = await import('../lib/hours-utils')
    const status = computeStoreStatus(hours)

    const result = {
      success: true,
      data: status || {
        isOpen: false,
        status: 'closed',
        label: 'Closed'
      }
    }

    // Cache the result
    await CacheService.set(cacheKey, result, CACHE_TTL.BUSINESS_HOURS_STATUS)

    res.json(result)
  } catch (error) {
    console.error('Error computing store status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to compute store status'
    })
  }
})

// Alias: GET /api/business-hours/status/:tenantId
router.get('/business-hours/status/:tenantId',
  async (req, res) => {
  const { tenantId } = req.params

  try {
    // Check cache first
    const cacheKey = CacheKeys.BUSINESS_HOURS_STATUS(tenantId)
    const cachedResult = await CacheService.get(cacheKey)

    if (cachedResult) {
      console.log(`[Business Hours] Cache hit for tenant ${tenantId} (alias endpoint)`)
      return res.json(cachedResult)
    }

    console.log(`[Business Hours] Cache miss for tenant ${tenantId}, fetching from database (alias endpoint)`)

    // Get business hours data
    const hoursRow = await prisma.business_hours_list.findUnique({
      where: { tenant_id: tenantId }
    })

    if (!hoursRow) {
      const result = {
        success: true,
        data: {
          isOpen: false,
          status: 'closed',
          label: 'Closed'
        }
      }
      // Cache the result even for closed stores
      await CacheService.set(cacheKey, result, CACHE_TTL.BUSINESS_HOURS_STATUS)
      return res.json(result)
    }

    // Get special hours
    const specialHours = await prisma.business_hours_special_list.findMany({
      where: { tenant_id: tenantId },
      orderBy: { date: 'asc' }
    })

    // Build hours object
    const periods = hoursRow.periods as any[] || []
    const hours: any = { timezone: hoursRow.timezone }

    // Convert periods to day-based format for computeStoreStatus
    periods.forEach((period: any) => {
      const dayName = period.day?.toLowerCase()
      if (dayName && !hours[dayName]) {
        hours[dayName] = {
          open: period.open,
          close: period.close
        }
      }
    })

    // Include periods array for updated computeStoreStatus
    if (periods.length > 0) {
      hours.periods = periods
    }

    // Add special hours
    if (specialHours.length > 0) {
      hours.special = specialHours.map((sh: any) => ({
        date: sh.date.toISOString().slice(0, 10),
        open: sh.open,
        close: sh.close,
        isClosed: sh.isClosed,
        note: sh.note
      }))
    }

    // Import and use computeStoreStatus
    const { computeStoreStatus } = await import('../lib/hours-utils')
    const status = computeStoreStatus(hours)

    const result = {
      success: true,
      data: status || {
        isOpen: false,
        status: 'closed',
        label: 'Closed'
      }
    }

    // Cache the result
    await CacheService.set(cacheKey, result, CACHE_TTL.BUSINESS_HOURS_STATUS)

    res.json(result)
  } catch (error) {
    console.error('Error computing store status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to compute store status'
    })
  }
})
export { publicBusinessHoursRouter }
export default router


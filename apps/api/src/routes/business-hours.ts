import { Router } from 'express'
import { prisma } from '../prisma'
import { requireFlag } from '../middleware/flags'
import { generateGbpHoursSyncLogId, generateQuickStart } from '../lib/id-generator'
import CacheService, { CacheKeys } from '../lib/cache-service';

// Cache TTL constants
const CACHE_TTL = {
  BUSINESS_HOURS_STATUS: 5 * 60 * 1000, // 5 minutes
  BUSINESS_HOURS_SPECIAL: 15 * 60 * 1000, // 15 minutes
  BUSINESS_HOURS: 30 * 60 * 1000 // 30 minutes
};

const router = Router()

// Mirror status (attempt counter). Persistence is reflected in BusinessHours rows.
const mirrorAttempts = new Map<string, number>()

// GET /api/tenant/:tenantId/business-hours
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
  console.log(`[Business Hours] Invalidated cache for tenant ${tenantId}`)

  // Update business profile hours
  const { updateBusinessProfileHours } = await import('../utils/business-hours-utils');
  await updateBusinessProfileHours(tenantId);

  res.json({ success: true })
})

// GET /api/tenant/:tenantId/business-hours/special
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
        id: `${tenantId}_${date.toISOString().split('T')[0]}`,
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

  // Invalidate cache for this tenant's business hours status
  const cacheKey = CacheKeys.BUSINESS_HOURS(tenantId)
  await CacheService.del(cacheKey);
  console.log(`[Business Hours] Invalidated cache for tenant ${tenantId} (special hours update)`)

  res.json({ success: true })
})

// POST /api/tenant/:tenantId/gbp/hours/mirror
router.post('/tenant/:tenantId/gbp/hours/mirror',
  async (req, res) => {
  const { tenantId } = req.params
  // Enqueue sync job; runner loop will process it
  await prisma.sync_jobs.create({
    data: {
      id: generateGbpHoursSyncLogId(),
      tenant_id: tenantId,
      target: 'gbp_hours',
      status: 'queued',
      attempt: 0,
      payload: { tenantId },
    },
  })
  res.status(202).json({ success: true })
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
    const cacheKey = CacheKeys.BUSINESS_HOURS(tenantId)
    const cachedResult = await CacheService.get(cacheKey);

    if (cachedResult) {
      console.log(`[Business Hours] Cache hit for tenant ${tenantId}`)
      return res.json(cachedResult)
    }

    console.log(`[Business Hours] Cache miss for tenant ${tenantId}, fetching from database`)

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
export default router

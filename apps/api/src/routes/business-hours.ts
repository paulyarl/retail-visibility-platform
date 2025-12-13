import { Router } from 'express'
import { prisma } from '../prisma'
import { requireFlag } from '../middleware/flags'
import { generateGbpHoursSyncLogId, generateQuickStart } from '../lib/id-generator'

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

export default router

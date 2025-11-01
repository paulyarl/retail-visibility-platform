import { Router } from 'express'
import { prisma } from '../prisma'
import { requireFlag } from '../middleware/flags'

const router = Router()

// Mirror status (attempt counter). Persistence is reflected in BusinessHours rows.
const mirrorAttempts = new Map<string, number>()

// GET /api/tenant/:tenantId/business-hours
router.get('/tenant/:tenantId/business-hours',
  requireFlag({ flag: 'gbp_hours', scope: 'tenant', tenantParam: 'tenantId', platformEnvVar: 'FF_TENANT_GBP_HOURS_SYNC' }),
  async (req, res) => {
  const { tenantId } = req.params
  const row = await prisma.businessHours.findUnique({ where: { tenantId } })
  const timezone = row?.timezone || 'America/New_York'
  const periods: any[] = (row?.periods as any) || []
  res.json({ success: true, data: { timezone, periods } })
})

// PUT /api/tenant/:tenantId/business-hours
router.put('/tenant/:tenantId/business-hours',
  requireFlag({ flag: 'gbp_hours', scope: 'tenant', tenantParam: 'tenantId', platformEnvVar: 'FF_TENANT_GBP_HOURS_SYNC' }),
  async (req, res) => {
  const { tenantId } = req.params
  const { timezone, periods } = req.body || {}
  const nextTz = timezone || 'America/New_York'
  const nextPeriods = Array.isArray(periods) ? periods : []
  await prisma.businessHours.upsert({
    where: { tenantId },
    update: { timezone: nextTz, periods: nextPeriods as any },
    create: { tenantId, timezone: nextTz, periods: nextPeriods as any },
  })
  res.json({ success: true })
})

// GET /api/tenant/:tenantId/business-hours/special
router.get('/tenant/:tenantId/business-hours/special',
  requireFlag({ flag: 'gbp_hours', scope: 'tenant', tenantParam: 'tenantId', platformEnvVar: 'FF_TENANT_GBP_HOURS_SYNC' }),
  async (req, res) => {
  const { tenantId } = req.params
  const rows = await prisma.businessHoursSpecial.findMany({ where: { tenantId }, orderBy: { date: 'asc' } })
  const overrides = rows.map((r: any) => ({ date: r.date.toISOString().slice(0,10), isClosed: r.isClosed, open: r.open, close: r.close, note: r.note }))
  res.json({ success: true, data: { overrides } })
})

// PUT /api/tenant/:tenantId/business-hours/special
router.put('/tenant/:tenantId/business-hours/special',
  requireFlag({ flag: 'gbp_hours', scope: 'tenant', tenantParam: 'tenantId', platformEnvVar: 'FF_TENANT_GBP_HOURS_SYNC' }),
  async (req, res) => {
  const { tenantId } = req.params
  const { overrides } = req.body || {}
  if (!Array.isArray(overrides)) return res.status(400).json({ success: false, error: 'invalid_overrides' })
  // Upsert per date
  for (const o of overrides) {
    const dateStr = o?.date
    if (!dateStr) continue
    const date = new Date(`${dateStr}T00:00:00.000Z`)
    await prisma.businessHoursSpecial.upsert({
      where: { tenantId_date: { tenantId, date } },
      update: { isClosed: !!o.isClosed, open: o.open || null, close: o.close || null, note: o.note || null },
      create: { tenantId, date, isClosed: !!o.isClosed, open: o.open || null, close: o.close || null, note: o.note || null },
    })
  }
  res.json({ success: true })
})

// POST /api/tenant/:tenantId/gbp/hours/mirror
router.post('/tenant/:tenantId/gbp/hours/mirror',
  requireFlag({ flag: 'gbp_hours', scope: 'tenant', tenantParam: 'tenantId', platformEnvVar: 'FF_TENANT_GBP_HOURS_SYNC' }),
  async (req, res) => {
  const { tenantId } = req.params
  // Enqueue sync job; runner loop will process it
  await prisma.syncJob.create({
    data: {
      tenantId,
      target: 'gbp_hours',
      status: 'queued',
      attempt: 0,
      payload: { tenantId },
      source: 'manual',
    },
  })
  res.status(202).json({ success: true })
})

// GET /api/tenant/:tenantId/gbp/hours/status
router.get('/tenant/:tenantId/gbp/hours/status',
  requireFlag({ flag: 'gbp_hours', scope: 'tenant', tenantParam: 'tenantId', platformEnvVar: 'FF_TENANT_GBP_HOURS_SYNC' }),
  async (req, res) => {
  const { tenantId } = req.params
  const row = await prisma.businessHours.findUnique({ where: { tenantId } })
  const attempts = mirrorAttempts.get(tenantId) || row?.syncAttempts || 0
  const in_sync = !!row?.lastSyncedAt
  res.json({ success: true, data: { in_sync, last_synced_at: row?.lastSyncedAt?.toISOString(), attempts } })
})

export default router

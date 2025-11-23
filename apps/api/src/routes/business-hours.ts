import { Router } from 'express'
import { prisma } from '../prisma'
import { requireFlag } from '../middleware/flags'
import crypto from 'crypto'

const router = Router()

// Mirror status (attempt counter). Persistence is reflected in BusinessHours rows.
const mirrorAttempts = new Map<string, number>()

// GET /api/tenant/:tenantId/business-hours
router.get('/tenant/:tenantId/business-hours',
  requireFlag({ flag: 'FF_TENANT_GBP_HOURS_SYNC', scope: 'tenant', tenantParam: 'tenantId' }),
  async (req, res) => {
  const { tenantId } = req.params
  const row = await prisma.businessHours.findUnique({ where: { tenantId: tenantId } })
  const timezone = row?.timezone || 'America/New_York'
  const periods: any[] = (row?.periods as any) || []
  res.json({ success: true, data: { timezone, periods } })
})

// PUT /api/tenant/:tenantId/business-hours
router.put('/tenant/:tenantId/business-hours',
  requireFlag({ flag: 'FF_TENANT_GBP_HOURS_SYNC', scope: 'tenant', tenantParam: 'tenantId' }),
  async (req, res) => {
  const { tenantId } = req.params
  const { timezone, periods } = req.body || {}
  const nextTz = timezone || 'America/New_York'
  const nextPeriods = Array.isArray(periods) ? periods : []
  await prisma.businessHours.upsert({
    where: { tenantId }, 
    update: { timezone: nextTz, periods: nextPeriods as any },
    create: { 
      id: `${tenantId}_hours`, 
      tenantId, 
      timezone: nextTz, 
      periods: nextPeriods as any,
      updatedAt: new Date()
    },
  })
  res.json({ success: true })
})

// GET /api/tenant/:tenantId/business-hours/special
router.get('/tenant/:tenantId/business-hours/special',
  requireFlag({ flag: 'FF_TENANT_GBP_HOURS_SYNC', scope: 'tenant', tenantParam: 'tenantId' }),
  async (req, res) => {
  const { tenantId } = req.params
  const rows = await prisma.businessHoursSpecial.findMany({ where: { tenantId: tenantId }, orderBy: { date: 'asc' } })
  const overrides = rows.map((r: any) => ({ date: r.date.toISOString().slice(0,10), isClosed: r.isClosed, open: r.open, close: r.close, note: r.note }))
  res.json({ success: true, data: { overrides } })
})

// PUT /api/tenant/:tenantId/business-hours/special
router.put('/tenant/:tenantId/business-hours/special',
  requireFlag({ flag: 'FF_TENANT_GBP_HOURS_SYNC', scope: 'tenant', tenantParam: 'tenantId' }),
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
      where: { tenantId_date: { tenantId: tenantId, date } },
      update: { 
        isClosed: !!o.isClosed, 
        open: o.open || null, 
        close: o.close || null, 
        note: o.note || null,
        updatedAt: new Date()
      },
      create: { 
        id: `${tenantId}_${date.toISOString().split('T')[0]}`,
        tenantId: tenantId, 
        date, 
        isClosed: !!o.isClosed, 
        open: o.open || null, 
        close: o.close || null, 
        note: o.note || null,
        updatedAt: new Date()
      },
    })
  }
  res.json({ success: true })
})

// POST /api/tenant/:tenantId/gbp/hours/mirror
router.post('/tenant/:tenantId/gbp/hours/mirror',
  requireFlag({ flag: 'FF_TENANT_GBP_HOURS_SYNC', scope: 'tenant', tenantParam: 'tenantId' }),
  async (req, res) => {
  const { tenantId } = req.params
  // Enqueue sync job; runner loop will process it
  await prisma.syncJob.create({
    data: {
      id: crypto.randomUUID(),
      tenantId,
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
  requireFlag({ flag: 'FF_TENANT_GBP_HOURS_SYNC', scope: 'tenant', tenantParam: 'tenantId' }),
  async (req, res) => {
  const { tenantId } = req.params
  const row = await prisma.businessHours.findUnique({ where: { tenantId: tenantId } })
  const attempts = mirrorAttempts.get(tenantId) || row?.syncAttempts || 0
  const in_sync = !!row?.lastSyncedAt 
  res.json({ success: true, data: { in_sync, last_synced_at: row?.lastSyncedAt?.toISOString(), attempts } })
})

export default router

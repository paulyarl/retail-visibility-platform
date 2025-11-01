import { Router } from 'express'

const router = Router()

const FF = String(process.env.FF_TENANT_GBP_HOURS_SYNC || '').toLowerCase() === 'true'

// In-memory store for dev stub (persists per-process)
const hoursStore = new Map<string, { timezone: string; periods: any[]; special: any[] }>()
const mirrorStatus = new Map<string, { in_sync: boolean; last_synced_at?: string; attempts: number; last_error?: string }>()

function requireFlag(res: any) {
  if (!FF) {
    res.status(404).json({ error: 'not_enabled' })
    return false
  }
  return true
}

// GET /api/tenant/:tenantId/business-hours
router.get('/tenant/:tenantId/business-hours', async (req, res) => {
  if (!requireFlag(res)) return
  const { tenantId } = req.params
  const data = hoursStore.get(tenantId) || { timezone: 'America/New_York', periods: [], special: [] }
  res.json({ success: true, data: { timezone: data.timezone, periods: data.periods } })
})

// PUT /api/tenant/:tenantId/business-hours
router.put('/tenant/:tenantId/business-hours', async (req, res) => {
  if (!requireFlag(res)) return
  const { tenantId } = req.params
  const { timezone, periods } = req.body || {}
  const cur = hoursStore.get(tenantId) || { timezone: 'America/New_York', periods: [], special: [] }
  hoursStore.set(tenantId, { timezone: timezone || cur.timezone, periods: Array.isArray(periods) ? periods : cur.periods, special: cur.special })
  res.json({ success: true })
})

// GET /api/tenant/:tenantId/business-hours/special
router.get('/tenant/:tenantId/business-hours/special', async (req, res) => {
  if (!requireFlag(res)) return
  const { tenantId } = req.params
  const data = hoursStore.get(tenantId) || { timezone: 'America/New_York', periods: [], special: [] }
  res.json({ success: true, data: { overrides: data.special } })
})

// PUT /api/tenant/:tenantId/business-hours/special
router.put('/tenant/:tenantId/business-hours/special', async (req, res) => {
  if (!requireFlag(res)) return
  const { tenantId } = req.params
  const { overrides } = req.body || {}
  const cur = hoursStore.get(tenantId) || { timezone: 'America/New_York', periods: [], special: [] }
  hoursStore.set(tenantId, { timezone: cur.timezone, periods: cur.periods, special: Array.isArray(overrides) ? overrides : cur.special })
  res.json({ success: true })
})

// POST /api/tenant/:tenantId/gbp/hours/mirror
router.post('/tenant/:tenantId/gbp/hours/mirror', async (req, res) => {
  if (!requireFlag(res)) return
  const { tenantId } = req.params
  // enqueue a fake job with retry attempt info
  const attempts = (mirrorStatus.get(tenantId)?.attempts || 0) + 1
  mirrorStatus.set(tenantId, { in_sync: false, attempts })
  setTimeout(() => {
    mirrorStatus.set(tenantId, { in_sync: true, last_synced_at: new Date().toISOString(), attempts })
  }, 300)
  res.status(202).json({ success: true })
})

// GET /api/tenant/:tenantId/gbp/hours/status
router.get('/tenant/:tenantId/gbp/hours/status', async (req, res) => {
  if (!requireFlag(res)) return
  const { tenantId } = req.params
  const status = mirrorStatus.get(tenantId) || { in_sync: false, attempts: 0 }
  res.json({ success: true, data: status })
})

export default router

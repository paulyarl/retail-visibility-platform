import { randomUUID } from 'crypto'
import { prisma } from '../prisma'
import { audit } from '../audit'

export type GbpHoursPayload = {
  tenantId: string
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function runGbpHoursSync(payload: GbpHoursPayload) {
  const { tenantId } = payload
  // Load platform hours (source of truth)
  const hours = await prisma.businessHours.upsert({
    where: { tenantId: tenantId },
    update: {},
    create: {
      id: randomUUID(),
      tenantId: tenantId,
      timezone: 'America/New_York',
      periods: [] as any,
      updatedAt: new Date(),
    },
  })
  const specials = await prisma.businessHoursSpecial.findMany({ where: { tenantId: tenantId } })

  // Build GBP payload (shape simplified)
  // Note: GBP supports multiple special hour periods per date
  const gbpPayload = {
    regularHours: {
      periods: (hours.periods as any[]).map((p: any) => ({ day: p.day, openTime: p.open, closeTime: p.close })),
    },
    specialHours: specials.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      isClosed: s.isClosed,
      openTime: s.open || undefined,
      closeTime: s.close || undefined,
      note: s.note || undefined,
    })),
    timezone: hours.timezone,
  }

  // Attempt a real call if configured
  const base = process.env.GOOGLE_BUSINESS_API_URL || 'https://mybusinessbusinessinformation.googleapis.com'
  const realCall = String(process.env.GBP_HOURS_REAL_CALL || '').toLowerCase() === 'true'
  const locationName = process.env.GBP_LOCATION_NAME // e.g. accounts/123/locations/456
  const accessToken = process.env.GBP_ACCESS_TOKEN // ideally retrieved per-tenant; env for pilot simplicity

  let attempt = (hours.syncAttempts || 0) + 1
  let lastError: string | null = null

  for (let i = 0; i < 5; i++) {
    try {
      if (realCall && locationName && accessToken) {
        const url = `${base.replace(/\/$/, '')}/v1/${locationName}?updateMask=regularHours,specialHours,locationTimeZone`
        const body = {
          regularHours: gbpPayload.regularHours,
          specialHours: {
            specialHourPeriods: gbpPayload.specialHours.map((s: any) => ({
              startDate: s.date,
              openTime: s.openTime,
              endDate: s.date,
              closeTime: s.closeTime,
              closed: s.isClosed,
            })),
          },
          locationTimeZone: gbpPayload.timezone,
        }
        const res = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const txt = await res.text().catch(() => res.statusText)
          throw new Error(`GBP_PATCH_failed ${res.status} ${txt}`)
        }
      } else {
        // simulate network latency when real call disabled/missing config
        await sleep(150)
      }

      await prisma.businessHours.update({
        where: { tenantId: tenantId },
        data: { lastSyncedAt: new Date(), syncAttempts: attempt, lastError: null, updatedAt: new Date() },
      })

      try {
        await audit({ tenantId, actor: null, action: 'sync', payload: { entity: 'gbp.hours', ok: true } as any })
      } catch {}

      return { ok: true }
    } catch (e: any) {
      lastError = String(e?.message || e)
      const backoff = Math.min(1000 * Math.pow(2, i), 8000)
      await sleep(backoff)
    }
  }

  await prisma.businessHours.update({ where: { tenantId: tenantId }, data: { syncAttempts: attempt, lastError: lastError, updatedAt: new Date() } })
  try {
    await audit({ tenantId, actor: null, action: 'sync', payload: { entity: 'gbp.hours', ok: false, error: lastError } as any })
  } catch {}
  return { ok: false, error: lastError }
}

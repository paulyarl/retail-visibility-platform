import { prisma } from '../prisma'

type CacheVal = { enabled: boolean; ts: number }
const cache = new Map<string, CacheVal>()
const TTL_MS = 30_000

export async function isTenantFlagOn(tenant_id: string, flag: string): Promise<boolean> {
  const key = `${tenantId}:${flag}`
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.ts < TTL_MS) return hit.enabled

  const row = await prisma.tenant_feature_flags.findUnique({ where: { tenantId_flag: { tenantId, flag } } })
  const enabled = !!row?.enabled
  cache.set(key, { enabled, ts: now })
  return enabled
}

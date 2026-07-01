import { prisma } from '../prisma'

// In-memory runtime overrides (kill switch / force-on)
// Platform-scoped override: key is flag
const platformOverrides = new Map<string, boolean>()
// Tenant-scoped override: key is flag -> (tenantId -> boolean)
const tenantOverrides = new Map<string, Map<string, boolean>>()

// --- 30s cache to avoid repeated DB lookups in hot paths ---
type CachedPlatform = { val: EffectivePlatform; ts: number }
type CachedTenant = { val: EffectiveTenant; ts: number }
const platformCache = new Map<string, CachedPlatform>()
const tenantCache = new Map<string, CachedTenant>()
const CACHE_TTL_MS = 30_000

function invalidatePlatformCache(flag: string) {
  platformCache.delete(flag)
  // Tenant cache depends on platform state, invalidate all tenant entries for this flag
  for (const key of tenantCache.keys()) {
    if (key.startsWith(flag + ':')) tenantCache.delete(key)
  }
}

function invalidateTenantCache(flag: string, tenantId: string) {
  tenantCache.delete(`${flag}:${tenantId}`)
}

export type EffectivePlatform = {
  flag: string
  effectiveOn: boolean
  sources: {
    platform_env: boolean
    platform_db: boolean
    allow_override: boolean
    platform_override?: boolean
  }
  effectiveSource: 'env' | 'override' | 'platform_db' | 'off'
}

export type EffectiveTenant = EffectivePlatform & {
  tenantId: string
  tenantEffectiveOn: boolean
  tenantSources: {
    tenant_db: boolean
    tenant_override?: boolean
  }
  tenantEffectiveSource: 'tenant_override' | 'tenant_db' | 'blocked'
}

function getEnvVarName(flag: string): string {
  return `FF_${flag.toUpperCase()}`
}

export async function getEffectivePlatform(flag: string): Promise<EffectivePlatform> {
  const now = Date.now()
  const cached = platformCache.get(flag)
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.val

  const envVar = getEnvVarName(flag)
  const platformEnvOn = String(process.env[envVar] || '').toLowerCase() === 'true'

  const override = platformOverrides.get(flag)

  const dbFlag = await prisma.platform_feature_flags_list.findUnique({ where: { flag } }) 
  const platformDbOn = !!dbFlag?.enabled
  const allowOverride = !!dbFlag?.allow_tenant_override

  // Precedence: env (on) > override (true/false) > db
  let effectiveOn = false
  let effectiveSource: EffectivePlatform['effectiveSource'] = 'off'

  if (platformEnvOn) {
    effectiveOn = true
    effectiveSource = 'env'
  } else if (override !== undefined) {
    effectiveOn = override
    effectiveSource = 'override'
  } else if (platformDbOn) {
    effectiveOn = true
    effectiveSource = 'platform_db'
  } else {
    effectiveOn = false
    effectiveSource = 'off'
  }

  const result: EffectivePlatform = {
    flag,
    effectiveOn,
    sources: {
      platform_env: platformEnvOn,
      platform_db: platformDbOn,
      allow_override: allowOverride,
      ...(override !== undefined ? { platform_override: override } : {}),
    },
    effectiveSource,
  }

  platformCache.set(flag, { val: result, ts: now })
  return result
}

export async function getEffectiveTenant(flag: string, tenantId: string): Promise<EffectiveTenant> {
  const now = Date.now()
  const cacheKey = `${flag}:${tenantId}`
  const cached = tenantCache.get(cacheKey)
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.val

  const plat = await getEffectivePlatform(flag)

  const tenantMap = tenantOverrides.get(flag)
  const tenantOverride = tenantMap?.get(tenantId)

  const row = await prisma.tenant_feature_flags_list.findUnique({ where: { tenant_id_flag: { tenant_id: tenantId, flag } } })
  const tenantDbOn = !!row?.enabled

  // Apply tenant decision logic mirroring middleware
  // If platform is effectively OFF and platform allow_override is false => blocked
  const allowOverride = plat.sources.allow_override

  let tenantEffectiveOn = false
  let tenantEffectiveSource: EffectiveTenant['tenantEffectiveSource'] = 'blocked'

  if (!plat.effectiveOn && !allowOverride) {
    // Platform OFF + no override allowed = blocked
    tenantEffectiveOn = false
    tenantEffectiveSource = 'blocked'
  } else if (plat.effectiveOn && !allowOverride) {
    // Platform ON + no override allowed = inherit platform state (no tenant DB record needed)
    tenantEffectiveOn = true
    tenantEffectiveSource = 'tenant_db' // Use tenant_db as source for consistency
  } else {
    // Platform ON + override allowed OR Platform OFF + override allowed
    // Check tenant override first, then tenant DB, then fall back to platform
    if (tenantOverride !== undefined) {
      tenantEffectiveOn = tenantOverride
      tenantEffectiveSource = 'tenant_override'
    } else if (tenantDbOn) {
      tenantEffectiveOn = true
      tenantEffectiveSource = 'tenant_db'
    } else {
      // No tenant override or DB record, inherit platform state
      tenantEffectiveOn = plat.effectiveOn
      tenantEffectiveSource = 'tenant_db'
    }
  }

  const result: EffectiveTenant = {
    ...plat,
    tenantId,
    tenantEffectiveOn,
    tenantSources: {
      tenant_db: tenantDbOn,
      ...(tenantOverride !== undefined ? { tenant_override: tenantOverride } : {}),
    },
    tenantEffectiveSource,
  }

  tenantCache.set(cacheKey, { val: result, ts: now })
  return result
}

// Runtime override mutators
export function setPlatformOverride(flag: string, value: boolean | null) {
  if (value === null) {
    platformOverrides.delete(flag)
  } else {
    platformOverrides.set(flag, value)
  }
  invalidatePlatformCache(flag)
}

export function setTenantOverride(flag: string, tenantId: string, value: boolean | null) {
  if (value === null) {
    const map = tenantOverrides.get(flag)
    map?.delete(tenantId)
    if (map && map.size === 0) tenantOverrides.delete(flag)
  } else {
    let map = tenantOverrides.get(flag)
    if (!map) {
      map = new Map<string, boolean>()
      tenantOverrides.set(flag, map)
    }
    map.set(tenantId, value)
  }
  invalidateTenantCache(flag, tenantId)
}

export function invalidateEffectiveFlagCaches() {
  platformCache.clear()
  tenantCache.clear()
}

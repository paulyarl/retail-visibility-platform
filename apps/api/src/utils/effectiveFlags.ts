import { prisma } from '../prisma'

// In-memory runtime overrides (kill switch / force-on)
// Platform-scoped override: key is flag
const platformOverrides = new Map<string, boolean>()
// Tenant-scoped override: key is flag -> (tenantId -> boolean)
const tenantOverrides = new Map<string, Map<string, boolean>>()

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

  return {
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
}

export async function getEffectiveTenant(flag: string, tenantId: string): Promise<EffectiveTenant> {
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

  return {
    ...plat,
    tenantId,
    tenantEffectiveOn,
    tenantSources: {
      tenant_db: tenantDbOn,
      ...(tenantOverride !== undefined ? { tenant_override: tenantOverride } : {}),
    },
    tenantEffectiveSource,
  }
}

// Runtime override mutators
export function setPlatformOverride(flag: string, value: boolean | null) {
  if (value === null) {
    platformOverrides.delete(flag)
  } else {
    platformOverrides.set(flag, value)
  }
}

export function setTenantOverride(flag: string, tenantId: string, value: boolean | null) {
  if (value === null) {
    const map = tenantOverrides.get(flag)
    map?.delete(tenantId)
    if (map && map.size === 0) tenantOverrides.delete(flag)
    return
  }
  let map = tenantOverrides.get(flag)
  if (!map) {
    map = new Map<string, boolean>()
    tenantOverrides.set(flag, map)
  }
  map.set(tenantId, value)
}

import { Request, Response, NextFunction } from 'express'
import { isTenantFlagOn } from '../utils/tenantFlags'
import { prisma } from '../prisma'

export type FlagScope = 'platform' | 'tenant'

// Generic feature gate. Returns 404 when disabled to safely hide surface.
export function requireFlag(opts: { flag: string; scope: FlagScope; tenantParam?: string; platformEnvVar?: string }) {
  const { flag, scope, tenantParam = 'tenantId', platformEnvVar } = opts
  const envVarName = platformEnvVar || `FF_${flag.toUpperCase()}`
  const platformOn = String(process.env[envVarName] || '').toLowerCase() === 'true'

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (scope === 'platform') {
        // Platform scope: check env first, then DB
        if (platformOn) return next()
        
        // Fallback to DB-backed platform flag
        const dbFlag = await prisma.platformFeatureFlag.findUnique({ where: { flag } })
        if (dbFlag?.enabled) return next()
        
        return res.status(404).json({ error: 'not_enabled' })
      }

      // Tenant scope: check platform settings, then tenant flag (with override support)
      const tenantId = (req.params as any)[tenantParam] || (req.query as any)[tenantParam] || (req.body as any)?.[tenantParam]
      if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' })

      // Check platform flag settings (env + DB)
      let platformEnabled = platformOn
      let allowOverride = false
      
      if (!platformEnabled) {
        const dbFlag = await prisma.platformFeatureFlag.findUnique({ where: { flag } })
        platformEnabled = dbFlag?.enabled || false
        allowOverride = dbFlag?.allowTenantOverride || false
      } else {
        // If env is on, check DB for override permission
        const dbFlag = await prisma.platformFeatureFlag.findUnique({ where: { flag } })
        allowOverride = dbFlag?.allowTenantOverride || false
      }

      // Check tenant-specific flag
      const tenantFlagOn = await isTenantFlagOn(String(tenantId), flag)

      // Decision logic:
      // 1. If platform disabled and override not allowed → block
      // 2. If platform disabled but override allowed → check tenant flag
      // 3. If platform enabled → check tenant flag (must be on)
      
      if (!platformEnabled && !allowOverride) {
        return res.status(404).json({ error: 'platform_disabled' })
      }

      if (!platformEnabled && allowOverride) {
        // Tenant can override: allow if tenant flag is on
        if (!tenantFlagOn) return res.status(404).json({ error: 'tenant_not_enabled' })
        return next()
      }

      // Platform enabled: tenant must also enable
      if (!tenantFlagOn) return res.status(404).json({ error: 'tenant_not_enabled' })
      return next()
    } catch (_e) {
      return res.status(500).json({ error: 'flag_check_failed' })
    }
  }
}

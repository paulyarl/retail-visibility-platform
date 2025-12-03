import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma'

const router = Router()

const napSchema = z.object({
  business_name: z.string().min(1, 'business_name_required'),
  address_line1: z.string().min(1, 'address_line1_required'),
  city: z.string().min(1, 'city_required'),
  postal_code: z.string().min(2, 'postal_code_required'),
  country_code: z.string().length(2, 'country_code_two_letters').transform((v) => v.toUpperCase()),
  phone_number: z.string().regex(/^\+[1-9]\d{1,14}$/, 'phone_must_be_e164').optional(),
  email: z.string().email('email_invalid').optional(),
  website: z.string().url('website_invalid').regex(/^https:\/\//i, 'website_must_be_https').optional(),
})

function completenessScore(bp: any) {
  // Weighted scoring: critical (10), important (5), optional (2)
  const parts: Array<{ ok: boolean; weight: number }> = [
    { ok: !!bp.business_name, weight: 10 },
    { ok: !!bp.address_line1, weight: 10 },
    { ok: !!bp.city, weight: 10 },
    { ok: !!bp.postal_code, weight: 10 },
    { ok: !!bp.country_code, weight: 10 },
    { ok: !!bp.phone_number, weight: 5 },
    { ok: !!bp.email, weight: 5 },
    { ok: !!bp.website, weight: 5 },
    { ok: !!bp.logo_url, weight: 2 },
    { ok: bp.hours != null, weight: 2 },
    { ok: bp.social_links != null, weight: 2 },
    { ok: bp.seo_tags != null, weight: 2 },
    { ok: bp.latitude != null && bp.longitude != null, weight: 5 },
  ]
  const total = parts.reduce((a, p) => a + p.weight, 0)
  const got = parts.reduce((a, p) => a + (p.ok ? p.weight : 0), 0)
  const score = Math.round((got / total) * 100)
  const grade = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 50 ? 'fair' : 'poor'
  return { score, grade }
}

// POST /tenant/:tenantId/profile/validate
router.post('/tenant/:tenantId/profile/validate', async (req, res) => {
  try {
    const tenantId = req.params.tenantId
    const parsed = napSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_failed', details: parsed.error.flatten() })
    }

    // Optional: additional policy checks per country can be added here
    return res.json({ success: true, message: 'valid' })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'nap_validation_error' })
  }
})

// GET /tenant/:tenantId/profile/completeness
router.get('/tenant/:tenantId/profile/completeness', async (req, res) => {
  try {
    const tenantId = req.params.tenantId
    const bp = await prisma.tenant_business_profiles_list.findUnique({ where: { tenant_id: tenantId } })
    if (!bp) return res.status(404).json({ success: false, error: 'profile_not_found' })

    const result = completenessScore(bp)
    return res.json({ success: true, data: { ...result } })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'completeness_error' })
  }
})

// POST /tenant/:tenantId/profile/geocode (mockable)
// Accepts address fields and returns lat/lng (mock). If save=true, persists to DB and returns updated completeness.
const geocodeSchema = z.object({
  address_line1: z.string().min(1),
  city: z.string().min(1),
  postal_code: z.string().min(2),
  country_code: z.string().length(2),
  save: z.boolean().optional().default(true),
})
router.post('/tenant/:tenantId/profile/geocode', async (req, res) => {
  try {
    const tenantId = req.params.tenantId
    const parsed = geocodeSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ success: false, error: 'invalid_request', details: parsed.error.flatten() })

    // Simple deterministic mock based on hash of address
    const seed = (parsed.data.address_line1 + parsed.data.city + parsed.data.postal_code + parsed.data.country_code).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const lat = (seed % 180) - 90
    const lng = (seed % 360) - 180

    let completeness: { score: number; grade: string } | undefined
    if (parsed.data.save) {
      const updated = await prisma.tenant_business_profiles_list.upsert({
        where: { tenant_id: tenantId },
        create: {
          tenant_id: tenantId,
          business_name: '',
          address_line1: parsed.data.address_line1,
          city: parsed.data.city,
          postal_code: parsed.data.postal_code,
          country_code: parsed.data.country_code.toUpperCase(),
          latitude: lat,
          longitude: lng,
          display_map: true,
          map_privacy_mode: 'precise',
          updated_at: new Date(),
        },
        update: {
          address_line1: parsed.data.address_line1,
          city: parsed.data.city,
          postal_code: parsed.data.postal_code,
          country_code: parsed.data.country_code.toUpperCase(),
          latitude: lat,
          longitude: lng,
          updated_at: new Date(),
        }
      })
      completeness = completenessScore(updated)
    }

    return res.json({ success: true, data: { latitude: lat, longitude: lng, completeness } })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'geocode_failed' })
  }
})

export default router

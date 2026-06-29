/**
 * Storefront Policy Routes
 *
 * Public:   GET /api/public/storefront-policies/:tenantId
 * Public:   GET /api/public/storefront-policies/:tenantId/:type
 * Merchant: GET /api/tenants/:tenantId/storefront-policies
 * Merchant: PUT /api/tenants/:tenantId/storefront-policies
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import storefrontPolicyService, { PolicyType } from '../services/StorefrontPolicyService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import BotKnowledgeEmbeddingService from '../services/BotKnowledgeEmbeddingService';

const router = Router();

const policySchema = z.object({
  return_policy: z.string().nullable().optional(),
  shipping_policy: z.string().nullable().optional(),
  privacy_policy: z.string().nullable().optional(),
  terms_of_service: z.string().nullable().optional(),
  refund_policy: z.string().nullable().optional(),
});

const VALID_POLICY_TYPES: PolicyType[] = [
  'return_policy',
  'shipping_policy',
  'privacy_policy',
  'terms_of_service',
  'refund_policy',
];

// Public: Get all policies for a tenant (for storefront display)
router.get('/public/storefront-policies/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const policies = await storefrontPolicyService.getPolicies(tenantId);
    res.json({ success: true, policies });
  } catch (error) {
    console.error('Error fetching public storefront policies:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch policies' });
  }
});

// Public: Get a single policy type for a tenant
router.get('/public/storefront-policies/:tenantId/:type', async (req, res) => {
  try {
    const { tenantId, type } = req.params;
    if (!VALID_POLICY_TYPES.includes(type as PolicyType)) {
      return res.status(400).json({ success: false, error: 'invalid_policy_type', message: `Valid types: ${VALID_POLICY_TYPES.join(', ')}` });
    }
    const content = await storefrontPolicyService.getPublicPolicy(tenantId, type as PolicyType);
    if (!content) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Policy not configured' });
    }
    res.json({ success: true, type, content });
  } catch (error) {
    console.error('Error fetching public storefront policy:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch policy' });
  }
});

// Merchant: Get policies for editing
router.get('/:tenantId/storefront-policies', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const policies = await storefrontPolicyService.getPolicies(tenantId);
    res.json({ success: true, policies });
  } catch (error) {
    console.error('Error fetching storefront policies:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch policies' });
  }
});

// Merchant: Update policies
router.put('/:tenantId/storefront-policies', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const validation = policySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid policy data', details: validation.error.issues });
    }
    const updated = await storefrontPolicyService.upsertPolicies(tenantId, validation.data);
    invalidateEffectiveCapabilities(tenantId);
    res.json({ success: true, policies: updated });

    // Refresh policy knowledge embeddings
    BotKnowledgeEmbeddingService.getInstance().refreshPolicyEmbeddings(tenantId).catch(() => {});
  } catch (error) {
    console.error('Error updating storefront policies:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update policies' });
  }
});

export default router;

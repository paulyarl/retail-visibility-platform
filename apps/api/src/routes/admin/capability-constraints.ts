/**
 * Admin routes for Cross-Capability Constraint management.
 *
 * CCL Phase 4: DB-driven constraints.
 * CRUD operations on capability_constraints_list table.
 */

import { Router } from 'express';
import { prisma } from '../../prisma';
import { z } from 'zod';
import { invalidateConstraintCache } from '../../services/resolvers';

const router = Router();

const constraintSchema = z.object({
  constraint_id: z.string().min(1),
  type: z.enum(['requires', 'recommends', 'excludes', 'implies']),
  severity: z.enum(['block', 'warn', 'info']),
  source_capability: z.string().min(1),
  source_field: z.string().min(1),
  source_operator: z.enum(['equals', 'includes', 'not_includes', 'is_true', 'is_false']),
  source_value: z.string(),
  target_capability: z.string().min(1),
  target_field: z.string().min(1),
  target_operator: z.enum(['equals', 'includes', 'not_includes', 'is_true', 'is_false']),
  target_value: z.string(),
  message: z.string().min(1),
  resolution_hint: z.string().min(1),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

// GET /api/admin/capability-constraints — list all constraints
router.get('/', async (_req, res) => {
  try {
    const constraints = await prisma.capability_constraints_list.findMany({
      orderBy: { sort_order: 'asc' },
    });
    res.json(constraints);
  } catch (error) {
    console.error('Error fetching capability constraints:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch constraints' });
  }
});

// GET /api/admin/capability-constraints/:id — get single constraint
router.get('/:id', async (req, res) => {
  try {
    const constraint = await prisma.capability_constraints_list.findUnique({
      where: { id: req.params.id },
    });
    if (!constraint) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Constraint not found' });
    }
    res.json(constraint);
  } catch (error) {
    console.error('Error fetching constraint:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch constraint' });
  }
});

// POST /api/admin/capability-constraints — create new constraint
router.post('/', async (req, res) => {
  try {
    const parsed = constraintSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid constraint data', details: parsed.error.issues });
    }

    const constraint = await prisma.capability_constraints_list.create({
      data: {
        constraint_id: parsed.data.constraint_id,
        type: parsed.data.type,
        severity: parsed.data.severity,
        source_capability: parsed.data.source_capability,
        source_field: parsed.data.source_field,
        source_operator: parsed.data.source_operator,
        source_value: parsed.data.source_value,
        target_capability: parsed.data.target_capability,
        target_field: parsed.data.target_field,
        target_operator: parsed.data.target_operator,
        target_value: parsed.data.target_value,
        message: parsed.data.message,
        resolution_hint: parsed.data.resolution_hint,
        is_active: parsed.data.is_active,
        sort_order: parsed.data.sort_order,
      },
    });

    invalidateConstraintCache();
    res.status(201).json(constraint);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'duplicate', message: 'Constraint ID already exists' });
    }
    console.error('Error creating constraint:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to create constraint' });
  }
});

// PUT /api/admin/capability-constraints/:id — update constraint
router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.capability_constraints_list.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Constraint not found' });
    }

    const updateSchema = constraintSchema.partial();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid constraint data', details: parsed.error.issues });
    }

    const constraint = await prisma.capability_constraints_list.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        updated_at: new Date(),
      },
    });

    invalidateConstraintCache();
    res.json(constraint);
  } catch (error) {
    console.error('Error updating constraint:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update constraint' });
  }
});

// DELETE /api/admin/capability-constraints/:id — delete constraint
router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.capability_constraints_list.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'not_found', message: 'Constraint not found' });
    }

    await prisma.capability_constraints_list.delete({ where: { id: req.params.id } });
    invalidateConstraintCache();
    res.json({ message: 'Constraint deleted' });
  } catch (error) {
    console.error('Error deleting constraint:', error);
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to delete constraint' });
  }
});

export default router;

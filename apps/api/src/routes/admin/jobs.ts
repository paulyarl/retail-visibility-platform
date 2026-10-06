/**
 * Admin Scheduled Jobs API Routes
 *
 * Visibility + control for the JobRegistry module:
 *   GET   /api/admin/jobs                     — job catalog w/ status, last/next run, 30d stats
 *   GET   /api/admin/jobs/:name/runs          — paginated run history
 *   GET   /api/admin/jobs/:name/runs/:runId   — run detail incl. captured logs
 *   POST  /api/admin/jobs/:name/trigger       — manual run (instrumented jobs only)
 *   PATCH /api/admin/jobs/:name/enabled       — kill switch { enabled: boolean }
 *   PATCH /api/admin/jobs/:name/schedule      — reschedule { kind, intervalMinutes | cron }
 *
 * Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts
 */

import { Router, Request, Response } from 'express';
import { listJobs, listRuns, getRun, runJobNow, setJobEnabled, setJobSchedule } from '../../jobs/registry';
import { logger } from '../../logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json({ jobs: await listJobs() });
  } catch (error: any) {
    logger.error('[Admin Jobs] List failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'failed_to_list_jobs', message: error.message });
  }
});

router.get('/:name/runs', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    res.json(await listRuns(req.params.name, page, limit));
  } catch (error: any) {
    logger.error('[Admin Jobs] Runs list failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'failed_to_list_runs', message: error.message });
  }
});

router.get('/:name/runs/:runId', async (req: Request, res: Response) => {
  try {
    const run = await getRun(req.params.runId);
    if (!run || run.job_name !== req.params.name) {
      return res.status(404).json({ error: 'not_found', message: 'Run not found' });
    }
    res.json(run);
  } catch (error: any) {
    logger.error('[Admin Jobs] Run detail failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'failed_to_get_run', message: error.message });
  }
});

router.post('/:name/trigger', async (req: Request, res: Response) => {
  try {
    const result = await runJobNow(req.params.name, 'api');
    if (result.skipped === 'not_found') {
      return res.status(404).json({ error: 'not_found', message: 'Job not found' });
    }
    if (result.skipped === 'not_instrumented') {
      return res.status(400).json({ error: 'not_instrumented', message: 'Job is declared but not yet migrated to the registry — cannot trigger manually' });
    }
    if (result.skipped) {
      return res.status(409).json({ error: result.skipped, message: `Run skipped: ${result.skipped}` });
    }
    res.json({ success: true, runId: result.runId });
  } catch (error: any) {
    logger.error('[Admin Jobs] Trigger failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'trigger_failed', message: error.message });
  }
});

router.patch('/:name/enabled', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'invalid_body', message: 'Body must include { enabled: boolean }' });
    }
    const ok = await setJobEnabled(req.params.name, enabled);
    if (!ok) {
      return res.status(503).json({ error: 'persistence_unavailable', message: 'Could not persist enabled state (DB unavailable)' });
    }
    logger.info(`[Admin Jobs] ${req.params.name} ${enabled ? 'enabled' : 'disabled'}`, undefined, {
      by: (req as any).user?.id,
    });
    res.json({ success: true, name: req.params.name, enabled });
  } catch (error: any) {
    logger.error('[Admin Jobs] Toggle failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'toggle_failed', message: error.message });
  }
});

/**
 * PATCH /api/admin/jobs/:name/schedule
 * Body: { kind: 'default' }                              — back to code-defined schedule
 *    or { kind: 'interval', intervalMinutes: 30 }        — every N minutes
 *    or { kind: 'cron', cron: '0 5 1 * *' }              — 5-field cron, UTC
 */
router.patch('/:name/schedule', async (req: Request, res: Response) => {
  try {
    const { kind, intervalMinutes, cron } = req.body ?? {};
    if (kind !== 'default' && kind !== 'interval' && kind !== 'cron') {
      return res.status(400).json({ error: 'invalid_body', message: 'kind must be default | interval | cron' });
    }
    const value = kind === 'interval' ? String(intervalMinutes ?? '') : kind === 'cron' ? cron : undefined;
    const result = await setJobSchedule(req.params.name, kind, value);
    if (!result.ok) {
      const status = result.error === 'persistence unavailable — DB unreachable or migration not applied' ? 503 : 400;
      return res.status(status).json({ error: 'schedule_update_failed', message: result.error });
    }
    logger.info(`[Admin Jobs] ${req.params.name} rescheduled (${kind})`, undefined, {
      by: (req as any).user?.id,
      value,
    });
    res.json({ success: true, name: req.params.name, nextRunAt: result.nextRunAt });
  } catch (error: any) {
    logger.error('[Admin Jobs] Schedule update failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'schedule_update_failed', message: error.message });
  }
});

export default router;

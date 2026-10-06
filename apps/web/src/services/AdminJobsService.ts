import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface JobRunSummary {
  id: string;
  status: 'running' | 'success' | 'failed' | 'skipped' | string;
  trigger_source: 'schedule' | 'manual' | 'api' | string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error: string | null;
}

export interface JobRun extends JobRunSummary {
  job_name: string;
  result: unknown;
  logs: string | null;
  hostname: string | null;
  created_at: string;
}

export interface ScheduledJob {
  name: string;
  description: string | null;
  scheduleLabel: string | null;
  effectiveSchedule: string | null;
  scheduleOverride: { kind: 'interval' | 'cron'; value: string } | null;
  instrumented: boolean;
  enabled: boolean;
  envDisabled: boolean;
  running: boolean;
  nextRunAt: string | null;
  lastRun: JobRunSummary | null;
  stats30d: { runs: number; failures: number };
}

export interface JobRunsResponse {
  runs: JobRun[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

class AdminJobsService extends AdminApiSingleton {
  constructor() {
    super('admin-jobs');
  }

  async getJobs(): Promise<ScheduledJob[]> {
    try {
      const result = await this.makeDefaultRequest('/api/admin/jobs', {}, 'admin-jobs-list', 0);
      return result.success ? ((result.data as { jobs: ScheduledJob[] }).jobs ?? []) : [];
    } catch (error) {
      clientLogger.error('[AdminJobsService] Error fetching jobs:', { detail: error });
      return [];
    }
  }

  async getRuns(jobName: string, page = 1, limit = 25): Promise<JobRunsResponse> {
    const empty: JobRunsResponse = { runs: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    try {
      const result = await this.makeDefaultRequest(
        `/api/admin/jobs/${encodeURIComponent(jobName)}/runs?page=${page}&limit=${limit}`,
        {},
        `admin-job-runs-${jobName}-${page}`,
        0,
      );
      return result.success ? (result.data as JobRunsResponse) : empty;
    } catch (error) {
      clientLogger.error('[AdminJobsService] Error fetching runs:', { detail: error });
      return empty;
    }
  }

  async getRun(jobName: string, runId: string): Promise<JobRun | null> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/admin/jobs/${encodeURIComponent(jobName)}/runs/${encodeURIComponent(runId)}`,
        {},
        `admin-job-run-${runId}`,
        0,
      );
      return result.success ? (result.data as JobRun) : null;
    } catch (error) {
      clientLogger.error('[AdminJobsService] Error fetching run:', { detail: error });
      return null;
    }
  }

  async triggerJob(jobName: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/admin/jobs/${encodeURIComponent(jobName)}/trigger`,
        { method: 'POST' },
        `admin-job-trigger-${jobName}`,
        0,
      );
      if (result.success) return { ok: true };
      const data = result.data as { error?: string; message?: string } | undefined;
      return { ok: false, error: data?.message || data?.error || 'Trigger failed' };
    } catch (error) {
      clientLogger.error('[AdminJobsService] Error triggering job:', { detail: error });
      return { ok: false, error: 'Request failed' };
    }
  }

  async setSchedule(
    jobName: string,
    kind: 'default' | 'interval' | 'cron',
    opts?: { intervalMinutes?: number; cron?: string },
  ): Promise<{ ok: boolean; error?: string; nextRunAt?: string | null }> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/admin/jobs/${encodeURIComponent(jobName)}/schedule`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            kind,
            ...(opts?.intervalMinutes != null ? { intervalMinutes: opts.intervalMinutes } : {}),
            ...(opts?.cron != null ? { cron: opts.cron } : {}),
          }),
        },
        `admin-job-schedule-${jobName}`,
        0,
      );
      const data = result.data as { error?: string; message?: string; nextRunAt?: string | null } | undefined;
      if (result.success) return { ok: true, nextRunAt: data?.nextRunAt ?? null };
      return { ok: false, error: data?.message || data?.error || 'Update failed' };
    } catch (error) {
      clientLogger.error('[AdminJobsService] Error updating schedule:', { detail: error });
      return { ok: false, error: 'Request failed' };
    }
  }

  async setEnabled(jobName: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
    try {
      const result = await this.makeDefaultRequest(
        `/api/admin/jobs/${encodeURIComponent(jobName)}/enabled`,
        { method: 'PATCH', body: JSON.stringify({ enabled }) },
        `admin-job-enabled-${jobName}`,
        0,
      );
      if (result.success) return { ok: true };
      const data = result.data as { error?: string; message?: string } | undefined;
      return { ok: false, error: data?.message || data?.error || 'Update failed' };
    } catch (error) {
      clientLogger.error('[AdminJobsService] Error toggling job:', { detail: error });
      return { ok: false, error: 'Request failed' };
    }
  }
}

export const adminJobsService = new AdminJobsService();

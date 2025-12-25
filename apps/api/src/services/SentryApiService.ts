/**
 * Sentry API Service
 * Handles API calls to Sentry for monitoring data
 */

interface SentryProject {
  id: string;
  slug: string;
  name: string;
  platform?: string;
  status?: string;
  dateCreated?: string;
}

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  level: string;
  status: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  project: {
    id: string;
    slug: string;
    name: string;
  };
}

interface SentryStats {
  [key: string]: number[];
}

interface SentryApiResponse<T> {
  data: T;
  error?: string;
}

export class SentryApiService {
  private readonly API_BASE = 'https://sentry.io/api/0';
  private readonly token: string;
  private readonly orgSlug: string;

  constructor(token: string, orgSlug: string) {
    this.token = token;
    this.orgSlug = orgSlug;
  }

  /**
   * Make authenticated API request to Sentry
   */
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<SentryApiResponse<T>> {
    try {
      const url = `${this.API_BASE}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { data: null as T, error: 'Invalid API token' };
        }
        if (response.status === 403) {
          return { data: null as T, error: 'Insufficient permissions' };
        }
        if (response.status === 404) {
          return { data: null as T, error: 'Resource not found' };
        }
        return { data: null as T, error: `API error: ${response.status} ${response.statusText}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error('[SentryApiService] Request failed:', error);
      return { data: null as T, error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  /**
   * Get organization projects
   */
  async getProjects(): Promise<SentryApiResponse<SentryProject[]>> {
    return this.makeRequest<SentryProject[]>(`/organizations/${this.orgSlug}/projects/`);
  }

  /**
   * Get organization issues
   */
  async getIssues(options: {
    limit?: number;
    query?: string;
    sort?: string;
  } = {}): Promise<SentryApiResponse<SentryIssue[]>> {
    const { limit = 50, query = '', sort = 'date' } = options;
    const params = new URLSearchParams({
      limit: limit.toString(),
      sort,
      ...(query && { query }),
    });

    return this.makeRequest<SentryIssue[]>(`/organizations/${this.orgSlug}/issues/?${params}`);
  }

  /**
   * Get organization stats
   */
  async getStats(options: {
    since?: number;
    until?: number;
    resolution?: string;
  } = {}): Promise<SentryApiResponse<SentryStats>> {
    const { since, until, resolution = '1d' } = options;
    const params = new URLSearchParams({
      resolution,
      ...(since && { since: since.toString() }),
      ...(until && { until: until.toString() }),
    });

    return this.makeRequest<SentryStats>(`/organizations/${this.orgSlug}/stats/?${params}`);
  }

  /**
   * Get project-specific issues
   */
  async getProjectIssues(projectSlug: string, options: {
    limit?: number;
    query?: string;
  } = {}): Promise<SentryApiResponse<SentryIssue[]>> {
    const { limit = 25, query = '' } = options;
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(query && { query }),
    });

    return this.makeRequest<SentryIssue[]>(`/projects/${this.orgSlug}/${projectSlug}/issues/?${params}`);
  }

  /**
   * Get project releases
   */
  async getProjectReleases(projectSlug: string, options: {
    limit?: number;
  } = {}): Promise<SentryApiResponse<any[]>> {
    const { limit = 10 } = options;
    const params = new URLSearchParams({
      limit: limit.toString(),
    });

    return this.makeRequest<any[]>(`/projects/${this.orgSlug}/${projectSlug}/releases/?${params}`);
  }

  /**
   * Transform Sentry data for frontend consumption
   */
  transformForFrontend(projects: SentryProject[], issues: SentryIssue[], stats: SentryStats) {
    // Calculate metrics from stats
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Extract error counts from stats (assuming index 0 is errors)
    const recentStats = stats['error.count'] || [];
    const totalErrors = recentStats.reduce((sum, count) => sum + count, 0);
    const previousPeriodErrors = recentStats.slice(0, Math.floor(recentStats.length / 2)).reduce((sum, count) => sum + count, 0);
    const currentPeriodErrors = recentStats.slice(Math.floor(recentStats.length / 2)).reduce((sum, count) => sum + count, 0);

    const errorChange = previousPeriodErrors > 0
      ? ((currentPeriodErrors - previousPeriodErrors) / previousPeriodErrors) * 100
      : 0;

    // Calculate active issues (unresolved)
    const activeIssues = issues.filter(issue => issue.status === 'unresolved').length;
    const previousActiveIssues = Math.floor(activeIssues * 0.8); // Estimate
    const activeIssuesChange = previousActiveIssues > 0
      ? ((activeIssues - previousActiveIssues) / previousActiveIssues) * 100
      : 0;

    // Calculate performance score (mock for now - would need performance data)
    const performanceScore = 87; // Mock value
    const performanceChange = 2; // Mock change

    // Calculate error rate (mock calculation)
    const errorRate = totalErrors > 0 ? (activeIssues / totalErrors) * 100 : 0;
    const errorRateChange = -3; // Mock change

    return {
      metrics: [
        {
          title: 'Total Errors',
          value: totalErrors.toLocaleString(),
          change: `${errorChange >= 0 ? '+' : ''}${errorChange.toFixed(1)}%`,
          trend: errorChange >= 0 ? 'up' : 'down',
          description: 'Errors captured in the last period'
        },
        {
          title: 'Error Rate',
          value: `${errorRate.toFixed(1)}%`,
          change: `${errorRateChange >= 0 ? '+' : ''}${errorRateChange.toFixed(1)}%`,
          trend: errorRateChange >= 0 ? 'up' : 'down',
          description: 'Percentage of sessions with errors'
        },
        {
          title: 'Active Issues',
          value: activeIssues.toString(),
          change: `${activeIssuesChange >= 0 ? '+' : ''}${activeIssuesChange.toFixed(1)}%`,
          trend: activeIssuesChange >= 0 ? 'up' : 'down',
          description: 'Unresolved error issues'
        },
        {
          title: 'Performance Score',
          value: performanceScore.toString(),
          change: `${performanceChange >= 0 ? '+' : ''}${performanceChange}%`,
          trend: performanceChange >= 0 ? 'up' : 'down',
          description: 'Average performance score'
        }
      ],
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        slug: project.slug,
        platform: project.platform || 'unknown',
        status: 'active', // Assume active if returned
        lastEvent: 'Recently' // Would need to calculate from actual events
      })),
      issues: issues.slice(0, 10).map(issue => ({
        id: issue.id,
        title: issue.title,
        level: issue.level,
        status: issue.status,
        count: issue.count,
        project: issue.project.name,
        lastSeen: new Date(issue.lastSeen).toLocaleString()
      }))
    };
  }
}

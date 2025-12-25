/**
 * Security Metrics
 * Phase 3: Charts and analytics for security data
 */

'use client';

import { SecurityMetrics as SecurityMetricsType } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrendingUp, TrendingDown, Activity, Shield, AlertTriangle, Users } from 'lucide-react';

interface SecurityMetricsProps {
  metrics: SecurityMetricsType | null;
}

export function SecurityMetrics({ metrics }: SecurityMetricsProps) {
  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No metrics available</p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (current: number, previous?: number) => {
    if (!previous) return null;
    if (current > previous) {
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    } else if (current < previous) {
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    }
    return null;
  };

  const getTrendPercentage = (current: number, previous?: number) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    const isIncrease = change > 0;
    return (
      <span className={isIncrease ? 'text-red-500' : 'text-green-500'}>
        {isIncrease ? '+' : ''}{change.toFixed(1)}%
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Security Metrics
        </CardTitle>
        <CardDescription>
          Key security indicators and trends
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Failed Login Attempts */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <p className="text-sm text-muted-foreground">Failed Logins</p>
              </div>
              {getTrendIcon(metrics.failedLoginAttempts, metrics.previousPeriod?.failedLoginAttempts)}
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{metrics.failedLoginAttempts}</p>
              {getTrendPercentage(metrics.failedLoginAttempts, metrics.previousPeriod?.failedLoginAttempts)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last period: {metrics.previousPeriod?.failedLoginAttempts || 0}
            </p>
          </div>

          {/* Blocked Requests */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <p className="text-sm text-muted-foreground">Blocked Requests</p>
              </div>
              {getTrendIcon(metrics.blockedRequests, metrics.previousPeriod?.blockedRequests)}
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{metrics.blockedRequests}</p>
              {getTrendPercentage(metrics.blockedRequests, metrics.previousPeriod?.blockedRequests)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last period: {metrics.previousPeriod?.blockedRequests || 0}
            </p>
          </div>

          {/* Suspicious Activities */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <p className="text-sm text-muted-foreground">Suspicious Activities</p>
              </div>
              {getTrendIcon(metrics.suspiciousActivities, metrics.previousPeriod?.suspiciousActivities)}
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{metrics.suspiciousActivities}</p>
              {getTrendPercentage(metrics.suspiciousActivities, metrics.previousPeriod?.suspiciousActivities)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last period: {metrics.previousPeriod?.suspiciousActivities || 0}
            </p>
          </div>

          {/* Active Users */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-green-500" />
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
              {getTrendIcon(metrics.activeUsers, metrics.previousPeriod?.activeUsers)}
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{metrics.activeUsers}</p>
              {getTrendPercentage(metrics.activeUsers, metrics.previousPeriod?.activeUsers)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last period: {metrics.previousPeriod?.activeUsers || 0}
            </p>
          </div>

          {/* MFA Adoption */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">MFA Adoption</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{metrics.mfaAdoptionRate}%</p>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${metrics.mfaAdoptionRate}%` }}
              />
            </div>
          </div>

          {/* Average Response Time */}
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{metrics.averageResponseTime}</p>
              <span className="text-sm text-muted-foreground">ms</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Target: &lt; 200ms
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

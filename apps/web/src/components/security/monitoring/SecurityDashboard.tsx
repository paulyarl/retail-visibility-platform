/**
 * Security Dashboard
 * Phase 3: Admin security overview
 */

'use client';

import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Shield, AlertTriangle, Ban, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { SecurityMetrics } from './SecurityMetrics';
import { ThreatMonitor } from './ThreatMonitor';
import { BlockedIPsTable } from './BlockedIPsTable';

export function SecurityDashboard() {
  const { metrics, threats, blockedIPs, healthStatus, loading } = useSecurityMonitoring();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  const getHealthBadge = () => {
    if (!healthStatus) return null;

    const variants: Record<string, 'success' | 'warning' | 'error'> = {
      healthy: 'success',
      warning: 'warning',
      critical: 'error',
      error: 'error',
    };

    return (
      <Badge variant={variants[healthStatus.status]}>
        {healthStatus.status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Security Dashboard
        </h2>
        <p className="text-muted-foreground mt-2">
          Monitor security threats and system health
        </p>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Overall security status</CardDescription>
            </div>
            {getHealthBadge()}
          </div>
        </CardHeader>
        <CardContent>
          {healthStatus && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <Activity className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Uptime</p>
                    <p className="font-semibold">{healthStatus.uptime}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Active Threats</p>
                    <p className="font-semibold">{threats.filter(t => t.status === 'active').length}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <Ban className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Blocked IPs</p>
                    <p className="font-semibold">{blockedIPs.length}</p>
                  </div>
                </div>
              </div>

              {healthStatus?.issues && healthStatus.issues.length > 0 && (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
                  <p className="text-sm font-medium text-yellow-600 mb-2">Active Issues:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {healthStatus.issues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics */}
      <SecurityMetrics metrics={metrics} />

      {/* Threat Monitor */}
      <ThreatMonitor threats={threats} />

      {/* Blocked IPs */}
      <BlockedIPsTable blockedIPs={blockedIPs} />
    </div>
  );
}

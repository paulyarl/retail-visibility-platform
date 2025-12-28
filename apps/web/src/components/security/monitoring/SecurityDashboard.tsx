/**
 * Security Dashboard
 * Phase 3: Admin security overview with platform-wide session and alert monitoring
 */

'use client';

import { useState, useEffect } from 'react';

import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { useAdminSecurityMonitoring } from '@/hooks/useAdminSecurityMonitoring';
import { getAlertsByType } from '@/services/securityMonitoring';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Shield, AlertTriangle, Ban, Activity, Users, Bell, Trash2, ExternalLink } from 'lucide-react';
import { SecurityMetrics } from './SecurityMetrics';
import { ThreatMonitor } from './ThreatMonitor';
import { BlockedIPsTable } from './BlockedIPsTable';
import { AdminSessionsTable } from '../admin/AdminSessionsTable';
import { AdminAlertsTable } from '../admin/AdminAlertsTable';
import { PlatformStabilityDashboard } from './PlatformStabilityDashboard';
import Link from 'next/link';

export function SecurityDashboard() {
  const { metrics, threats, blockedIPs, healthStatus, loading } = useSecurityMonitoring();
  const { 
    sessions, 
    alerts, 
    sessionStats, 
    alertStats, 
    loading: adminLoading,
    revokeSession,
    currentPage,
    pageSize,
    totalSessions,
    handlePageChange,
    handlePageSizeChange,
  } = useAdminSecurityMonitoring();

  const { user } = useAuth();
  const currentUserId = user?.id;

  const [alertsByType, setAlertsByType] = useState<any[]>([]);
  const [alertsByTypeLoading, setAlertsByTypeLoading] = useState(true);

  useEffect(() => {
    const fetchAlertsByType = async () => {
      try {
        const data = await getAlertsByType(5, 168); // 5 examples per type, 7 days
        setAlertsByType(data);
      } catch (error) {
        console.error('Failed to fetch alerts by type:', error);
      } finally {
        setAlertsByTypeLoading(false);
      }
    };

    fetchAlertsByType();
  }, []);

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

      {/* Account Deletion Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Account Deletion Management
              </CardTitle>
              <CardDescription>Manage user account deletion requests and grace periods</CardDescription>
            </div>
            <Link href="/settings/admin/deletion-requests">
              <Button variant="outline" size="sm">
                Manage Requests
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p>
              Review and manage account deletion requests during the 30-day grace period. 
              Monitor data preservation choices and handle admin overrides.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <Badge variant="info">30-day grace period</Badge>
              <Badge variant="default">Data preservation options</Badge>
              <Badge variant="warning">Admin override capability</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform-wide Security Monitoring */}
      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Sessions
            {sessionStats && (
              <Badge variant="info" className="ml-1">
                {sessionStats.activeSessions}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Security Alerts
            {alertStats && alertStats.unreadAlerts > 0 && (
              <Badge variant="error" className="ml-1">
                {alertStats.unreadAlerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alert-types" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alert Types
            {alertsByType.length > 0 && (
              <Badge variant="warning" className="ml-1">
                {alertsByType.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stability" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Platform Stability
          </TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="blocked">Blocked IPs</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {sessionStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Sessions</CardDescription>
                  <CardTitle className="text-2xl">{sessionStats.activeSessions}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Users</CardDescription>
                  <CardTitle className="text-2xl">{sessionStats.activeUsers}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Last 24h</CardDescription>
                  <CardTitle className="text-2xl">{sessionStats.sessionsLast24h}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Revoked</CardDescription>
                  <CardTitle className="text-2xl">{sessionStats.revokedSessions}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>All User Sessions</CardTitle>
              <CardDescription>Platform-wide active sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {adminLoading ? (
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              ) : (
                <AdminSessionsTable 
                  sessions={sessions} 
                  onRevoke={revokeSession}
                  currentUserId={currentUserId}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalSessions={totalSessions}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alertStats && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Alerts</CardDescription>
                  <CardTitle className="text-2xl">{alertStats.totalAlerts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Unread</CardDescription>
                  <CardTitle className="text-2xl">{alertStats.unreadAlerts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Last 24h</CardDescription>
                  <CardTitle className="text-2xl">{alertStats.alertsLast24h}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Critical</CardDescription>
                  <CardTitle className="text-2xl text-destructive">{alertStats.criticalAlerts}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Warnings</CardDescription>
                  <CardTitle className="text-2xl text-yellow-600">{alertStats.warningAlerts}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>All Security Alerts</CardTitle>
              <CardDescription>Platform-wide security notifications</CardDescription>
            </CardHeader>
            <CardContent>
              {adminLoading ? (
                <div className="h-32 bg-muted animate-pulse rounded-lg" />
              ) : (
                <AdminAlertsTable alerts={alerts} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alert-types" className="space-y-4">
          {alertsByTypeLoading ? (
            <div className="h-32 bg-muted animate-pulse rounded-lg" />
          ) : alertsByType.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No alerts found in the selected time period</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {alertsByType.map((alertGroup: any) => (
                <Card key={alertGroup.type}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Badge variant={
                            alertGroup.type.includes('critical') || alertGroup.type.includes('brute_force') ? 'error' :
                            alertGroup.type.includes('warning') || alertGroup.type.includes('rate_limit') ? 'warning' :
                            'info'
                          }>
                            {alertGroup.type.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {alertGroup.count} total alerts • {alertGroup.unreadCount} unread • Latest: {new Date(alertGroup.latestAlert).toLocaleString()}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{alertGroup.count}</div>
                        <div className="text-sm text-muted-foreground">Total</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Recent Examples:</h4>
                      <div className="space-y-2">
                        {alertGroup.recentAlerts.map((alert: any, index: number) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={
                                  alert.severity === 'critical' ? 'error' :
                                  alert.severity === 'warning' ? 'warning' : 'info'
                                } className="text-xs">
                                  {alert.severity}
                                </Badge>
                                {!alert.read && (
                                  <Badge variant="info" className="text-xs">Unread</Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium">{alert.title}</p>
                              <p className="text-xs text-muted-foreground">{alert.message}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                {alert.userEmail && (
                                  <span>User: {alert.userEmail}</span>
                                )}
                                <span>{new Date(alert.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="threats" className="space-y-4">
          <SecurityMetrics metrics={metrics} />
          <ThreatMonitor threats={threats} />
        </TabsContent>

        <TabsContent value="blocked" className="space-y-4">
          <BlockedIPsTable blockedIPs={blockedIPs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

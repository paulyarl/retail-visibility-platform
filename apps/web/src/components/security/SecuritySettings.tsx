/**
 * Security Settings - Main Container
 * Phase 1: Basic Security Features
 */

'use client';

import { useSecurity } from '@/hooks/useSecurity';
import { LoginActivityTable } from './shared/LoginActivityTable';
import { SecurityAlerts } from './shared/SecurityAlerts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Shield, Activity, Bell } from 'lucide-react';

export function SecuritySettings() {
  const {
    sessions,
    alerts,
    loading,
    error,
    revokeSession,
    revokeAllSessions,
    markAlertAsRead,
    dismissAlert,
  } = useSecurity();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Security Settings</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const unreadAlerts = alerts.filter(a => !a.read).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Security Settings
        </h2>
        <p className="text-muted-foreground mt-2">
          Manage your account security, active sessions, and security alerts
        </p>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active Sessions
            {sessions.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                {sessions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Security Alerts
            {unreadAlerts > 0 && (
              <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                {unreadAlerts}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage devices and locations where you're currently signed in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginActivityTable
                sessions={sessions}
                onRevoke={revokeSession}
                onRevokeAll={revokeAllSessions}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>
                Important security notifications about your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SecurityAlerts
                alerts={alerts}
                onMarkRead={markAlertAsRead}
                onDismiss={dismissAlert}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

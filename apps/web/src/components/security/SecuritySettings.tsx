/**
 * Security Settings - Main Container
 * Phase 1: Basic Security Features
 */

'use client';

import { useSecurity } from '@/hooks/useSecurity';
import { LoginActivityTable } from './shared/LoginActivityTable';
import { SecurityAlerts } from './shared/SecurityAlerts';
import { ThreatAnalysis } from './shared/ThreatAnalysis';
import { LocationAnalysis } from './shared/LocationAnalysis';
import { DeviceAnalysis } from './shared/DeviceAnalysis';
import { UserContextAnalysis } from './shared/UserContextAnalysis';
import { RealTimeMonitoring } from './shared/RealTimeMonitoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Shield, Activity, Bell, Radar, MapPin, ShieldCheck, TrendingUp, Filter, Users } from 'lucide-react';

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
    refreshSessions,
    refreshAlerts,
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

  const unreadAlerts = Array.isArray(alerts) ? alerts.filter(a => !a.read).length : 0;
  const sessionsCount = Array.isArray(sessions) ? sessions.length : 0;

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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Sessions
            {sessionsCount > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                {sessionsCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
            {unreadAlerts > 0 && (
              <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                {unreadAlerts}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="threats" className="flex items-center gap-2">
            <Radar className="h-4 w-4" />
            Threats
          </TabsTrigger>
          <TabsTrigger value="location" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Location
          </TabsTrigger>
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Monitor
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

        <TabsContent value="threats" className="space-y-4">
          <ThreatAnalysis alerts={alerts} />
        </TabsContent>

        <TabsContent value="location" className="space-y-4">
          <LocationAnalysis alerts={alerts} />
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <DeviceAnalysis alerts={alerts} />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserContextAnalysis alerts={alerts} />
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <RealTimeMonitoring 
            alerts={alerts} 
            onRefresh={() => {
              refreshSessions();
              refreshAlerts();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

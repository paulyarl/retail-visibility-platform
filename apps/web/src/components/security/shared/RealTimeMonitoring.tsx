/**
 * Real-time Monitoring Component
 * Displays live security monitoring and trends
 */

'use client';

import { useState, useEffect } from 'react';
import { SecurityAlert } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Activity, TrendingUp, AlertTriangle, Clock, RefreshCw, Download, Globe, Shield, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonitoringProps {
  alerts: SecurityAlert[];
  onRefresh?: () => void;
}

export function RealTimeMonitoring({ alerts, onRefresh }: MonitoringProps) {
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Calculate metrics
  const now = new Date();
  const timeRanges = {
    '1h': new Date(now.getTime() - 60 * 60 * 1000),
    '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
    '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
  };

  const alertsInRange = alerts.filter(alert => 
    new Date(alert.createdAt) >= timeRanges[timeRange]
  );

  const recentAlerts = alerts.filter(alert => 
    new Date(alert.createdAt) >= timeRanges['1h']
  );

  const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000).getHours();
    const count = alerts.filter(alert => 
      new Date(alert.createdAt).getHours() === hour &&
      new Date(alert.createdAt) >= timeRanges['24h']
    ).length;
    return { hour, count };
  }).reverse();

  // Analyze request patterns
  const requestPatterns = alertsInRange.reduce((acc, alert) => {
    const request = alert.metadata?.request;
    if (request) {
      // Origin analysis
      const origin = request.origin || 'Unknown';
      acc.origins[origin] = (acc.origins[origin] || 0) + 1;
      
      // Protocol analysis
      const protocol = request.protocol || 'Unknown';
      acc.protocols[protocol] = (acc.protocols[protocol] || 0) + 1;
      
      // XHR vs Navigation
      const requestType = request.xhr ? 'XHR' : 'Navigation';
      acc.requestTypes[requestType] = (acc.requestTypes[requestType] || 0) + 1;
      
      // Content types
      const contentType = request.contentType || 'Unknown';
      acc.contentTypes[contentType] = (acc.contentTypes[contentType] || 0) + 1;
      
      // Security flags
      if (!request.secure) acc.insecureRequests++;
      if (request.xhr) acc.xhrRequests++;
    }
    return acc;
  }, {
    origins: {} as Record<string, number>,
    protocols: {} as Record<string, number>,
    requestTypes: {} as Record<string, number>,
    contentTypes: {} as Record<string, number>,
    insecureRequests: 0,
    xhrRequests: 0
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getActivityLevel = () => {
    const recentCount = recentAlerts.length;
    if (recentCount === 0) return { level: 'quiet', color: 'text-green-500', bg: 'bg-green-500/10' };
    if (recentCount <= 5) return { level: 'normal', color: 'text-blue-500', bg: 'bg-blue-500/10' };
    if (recentCount <= 10) return { level: 'elevated', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    return { level: 'high', color: 'text-orange-500', bg: 'bg-orange-500/10' };
  };

  const activityLevel = getActivityLevel();

  // Simulate live updates
  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      setLastUpdate(new Date());
      if (onRefresh) onRefresh();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [isLive, onRefresh]);

  const exportData = () => {
    const data = alerts.map(alert => ({
      timestamp: alert.createdAt,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      ip: alert.metadata?.ip,
      device: alert.metadata?.device?.device,
      location: alert.metadata?.location?.geo?.country || 'Unknown'
    }));

    const csv = [
      ['Timestamp', 'Type', 'Severity', 'Title', 'IP', 'Device', 'Location'],
      ...data.map(row => [
        row.timestamp,
        row.type,
        row.severity,
        row.title,
        row.ip,
        row.device,
        row.location
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-alerts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Monitoring Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-time Monitoring
              </CardTitle>
              <CardDescription>
                Live security monitoring and threat detection
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isLive ? "default" : "outline"}
                size="sm"
                onClick={() => setIsLive(!isLive)}
                className="flex items-center gap-2"
              >
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isLive ? "bg-green-500 animate-pulse" : "bg-gray-400"
                )} />
                {isLive ? 'Live' : 'Paused'}
              </Button>
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportData}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
              <div className={cn(
                "px-3 py-1 rounded-full border text-sm font-medium",
                activityLevel.bg, activityLevel.color
              )}>
                Activity: {activityLevel.level}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Time range:</span>
              <div className="flex gap-1">
                {(['1h', '24h', '7d', '30d'] as const).map(range => (
                  <Button
                    key={range}
                    variant={timeRange === range ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeRange(range)}
                  >
                    {range}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{alertsInRange.length}</div>
                <div className="text-xs text-muted-foreground">Total Events</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{recentAlerts.length}</div>
                <div className="text-xs text-muted-foreground">Last Hour</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold text-orange-500">
                  {alertsInRange.filter(a => a.severity === 'error').length}
                </div>
                <div className="text-xs text-muted-foreground">High Priority</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">
                  {Math.max(...hourlyActivity.map(h => h.count))}
                </div>
                <div className="text-xs text-muted-foreground">Peak Hour</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>24-Hour Activity</CardTitle>
          <CardDescription>
            Security events by hour over the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-end gap-1 h-32">
              {hourlyActivity.map(({ hour, count }) => {
                const maxCount = Math.max(...hourlyActivity.map(h => h.count));
                const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                
                return (
                  <div
                    key={hour}
                    className="flex-1 bg-blue-500 rounded-t-sm relative group cursor-pointer"
                    style={{ height: `${height}%` }}
                  >
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {hour}:00 - {count} events
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:00</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Severity Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Severity Distribution</CardTitle>
          <CardDescription>
            Breakdown of alerts by severity level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(['critical', 'high', 'medium', 'low'] as const).map(severity => {
              const count = alertsInRange.filter(a => a.severity === severity).length;
              const percentage = alertsInRange.length > 0 ? (count / alertsInRange.length) * 100 : 0;
              
              return (
                <div key={severity} className="flex items-center gap-4">
                  <div className="w-20 capitalize text-sm font-medium">{severity}</div>
                  <div className="flex-1">
                    <div className="relative">
                      <Progress value={percentage} className="h-2" />
                      <div 
                        className={cn(
                          "absolute top-0 left-0 h-full rounded-sm",
                          getSeverityColor(severity)
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground w-12 text-right">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Request Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Request Analysis
          </CardTitle>
          <CardDescription>
            HTTP request patterns and security indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Origins */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Request Origins
              </h4>
              <div className="space-y-2">
                {Object.entries(requestPatterns.origins).map(([origin, count]) => {
                  const percentage = alertsInRange.length > 0 ? (count / alertsInRange.length) * 100 : 0;
                  const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1');
                  return (
                    <div key={origin} className="flex items-center gap-2">
                      <div className="flex-1 truncate">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {origin}
                        </code>
                      </div>
                      <div className="w-20">
                        <Progress value={percentage} className="h-1" />
                      </div>
                      <div className="text-xs text-muted-foreground w-8">{count}</div>
                      {isLocal && (
                        <Badge variant="secondary" className="text-xs">Local</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Protocols */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Protocols & Security
              </h4>
              <div className="space-y-3">
                {Object.entries(requestPatterns.protocols).map(([protocol, count]) => {
                  const percentage = alertsInRange.length > 0 ? (count / alertsInRange.length) * 100 : 0;
                  const isSecure = protocol === 'https';
                  return (
                    <div key={protocol} className="flex items-center gap-2">
                      <div className="w-16 text-sm font-medium">{protocol}</div>
                      <div className="flex-1">
                        <Progress value={percentage} className="h-2" />
                      </div>
                      <div className="text-xs text-muted-foreground w-8">{count}</div>
                      <Badge variant={isSecure ? "secondary" : "error"} className="text-xs">
                        {isSecure ? "Secure" : "Insecure"}
                      </Badge>
                    </div>
                  );
                })}
                {requestPatterns.insecureRequests > 0 && (
                  <div className="pt-2 border-t">
                    <Badge variant="error" className="text-xs">
                      {requestPatterns.insecureRequests} insecure requests detected
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Request Types & Content Types */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Request Types</h4>
              <div className="space-y-2">
                {Object.entries(requestPatterns.requestTypes).map(([type, count]) => {
                  const percentage = alertsInRange.length > 0 ? (count / alertsInRange.length) * 100 : 0;
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <div className="w-20 text-sm">{type}</div>
                      <div className="flex-1">
                        <Progress value={percentage} className="h-1" />
                      </div>
                      <div className="text-xs text-muted-foreground w-8">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-3">Content Types</h4>
              <div className="space-y-2">
                {Object.entries(requestPatterns.contentTypes)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 5)
                  .map(([contentType, count]) => {
                    const percentage = alertsInRange.length > 0 ? (count / alertsInRange.length) * 100 : 0;
                    return (
                      <div key={contentType} className="flex items-center gap-2">
                        <div className="flex-1 truncate">
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {contentType}
                          </code>
                        </div>
                        <div className="text-xs text-muted-foreground w-8">{count}</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>
            Latest security alerts and activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentAlerts.slice(0, 10).map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    getSeverityColor(alert.severity || 'low')
                  )} />
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {alert.metadata?.ip} • {new Date(alert.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {alert.severity || 'low'}
                </Badge>
              </div>
            ))}
            {recentAlerts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

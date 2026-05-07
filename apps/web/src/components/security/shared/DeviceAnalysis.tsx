/**
 * Device Analysis Component
 * Displays device fingerprinting and analysis data
 */

'use client';

import { SecurityAlert } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Monitor, Smartphone, Tablet, Fingerprint, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeviceAnalysisProps {
  alerts: SecurityAlert[];
}

export function DeviceAnalysis({ alerts }: DeviceAnalysisProps) {
  // Extract device data from alerts
  const devices = alerts.reduce((acc, alert) => {
    const device = alert.metadata?.device;
    const fingerprint = device?.fingerprint;
    
    if (fingerprint) {
      if (!acc[fingerprint]) {
        acc[fingerprint] = {
          fingerprint,
          device: device || {},
          alerts: [],
          firstSeen: alert.createdAt,
          lastSeen: alert.createdAt,
          suspiciousCount: 0,
          browsers: new Set(),
          os: new Set(),
          types: new Set()
        };
      }
      
      acc[fingerprint].alerts.push(alert);
      
      // Update timestamps
      if (new Date(alert.createdAt) < new Date(acc[fingerprint].firstSeen)) {
        acc[fingerprint].firstSeen = alert.createdAt;
      }
      if (new Date(alert.createdAt) > new Date(acc[fingerprint].lastSeen)) {
        acc[fingerprint].lastSeen = alert.createdAt;
      }
      
      // Count suspicious alerts
      if (alert.metadata?.summary?.isSuspicious) {
        acc[fingerprint].suspiciousCount++;
      }
      
      // Collect device info
      if (device?.browser) acc[fingerprint].browsers.add(device.browser);
      if (device?.os) acc[fingerprint].os.add(device.os);
      if (device?.device) acc[fingerprint].types.add(device.device);
    }
    
    return acc;
  }, {} as Record<string, any>);

  const deviceArray = Object.values(devices);
  const uniqueBrowsers = [...new Set(deviceArray.flatMap(d => Array.from(d.browsers)))] as string[];
  const uniqueOS = [...new Set(deviceArray.flatMap(d => Array.from(d.os)))] as string[];
  const suspiciousDevices = deviceArray.filter(d => d.suspiciousCount > 0);

  const getDeviceIcon = (device: any) => {
    const type = typeof device.device === 'string' ? device.device.toLowerCase() : '';
    if (type.includes('mobile') || type.includes('phone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (type.includes('tablet') || type.includes('ipad')) {
      return <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getDeviceRisk = (device: any) => {
    if (device.suspiciousCount > 0) return { level: 'high', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    if (device.alerts.length > 10) return { level: 'medium', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    return { level: 'low', color: 'text-green-500', bg: 'bg-green-500/10' };
  };

  const getFingerprintConfidence = (device: any) => {
    const fingerprintData = device.device?.fingerprintData || {};
    const dataPoints = Object.keys(fingerprintData).length;
    
    if (dataPoints >= 15) return { level: 'high', percentage: 90 };
    if (dataPoints >= 10) return { level: 'medium', percentage: 70 };
    if (dataPoints >= 5) return { level: 'low', percentage: 50 };
    return { level: 'minimal', percentage: 30 };
  };

  return (
    <div className="space-y-6">
      {/* Device Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{deviceArray.length}</div>
                <div className="text-xs text-muted-foreground">Unique Devices</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{uniqueBrowsers.length}</div>
                <div className="text-xs text-muted-foreground">Browsers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{deviceArray.length - suspiciousDevices.length}</div>
                <div className="text-xs text-muted-foreground">Trusted Devices</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold text-orange-500">{suspiciousDevices.length}</div>
                <div className="text-xs text-muted-foreground">Suspicious</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Device Distribution</CardTitle>
          <CardDescription>
            Breakdown by browser and operating system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Browsers</h4>
              <div className="space-y-2">
                {uniqueBrowsers.map(browser => {
                  const count = deviceArray.filter(d => d.browsers.has(browser)).length;
                  return (
                    <div key={browser} className="flex items-center gap-2">
                      <div className="w-20 text-sm">{browser}</div>
                      <div className="flex-1">
                        <Progress value={(count / deviceArray.length) * 100} className="h-2" />
                      </div>
                      <div className="text-xs text-muted-foreground w-8">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-3">Operating Systems</h4>
              <div className="space-y-2">
                {uniqueOS.map(os => {
                  const count = deviceArray.filter(d => d.os.has(os)).length;
                  return (
                    <div key={os} className="flex items-center gap-2">
                      <div className="w-20 text-sm">{os}</div>
                      <div className="flex-1">
                        <Progress value={(count / deviceArray.length) * 100} className="h-2" />
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

      {/* Device Details */}
      <Card>
        <CardHeader>
          <CardTitle>Device Fingerprints</CardTitle>
          <CardDescription>
            Detailed device analysis and identification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {deviceArray.map(device => {
              const risk = getDeviceRisk(device);
              const confidence = getFingerprintConfidence(device);
              
              return (
                <div key={device.fingerprint} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getDeviceIcon(device)}
                      <div>
                        <div className="font-medium">
                          {device.device?.browser} {device.device?.version || ''} on {device.device?.os}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {device.device?.device} • {device.alerts.length} events
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn(risk.bg, risk.color)}>
                        {risk.level} risk
                      </Badge>
                      {device.suspiciousCount > 0 && (
                        <Badge variant="error" className="text-xs">
                          {device.suspiciousCount} suspicious
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Fingerprint Confidence */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Fingerprint Confidence</span>
                      <span className={cn(
                        confidence.level === 'high' ? 'text-green-500' :
                        confidence.level === 'medium' ? 'text-yellow-500' :
                        'text-orange-500'
                      )}>
                        {confidence.level} ({confidence.percentage}%)
                      </span>
                    </div>
                    <Progress value={confidence.percentage} className="h-1" />
                  </div>
                  
                  {/* Device Details */}
                  <details className="mt-3">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      View fingerprint details
                    </summary>
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <div className="text-xs font-mono space-y-1">
                        {Object.entries(device.device?.fingerprintData || {}).slice(0, 10).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="truncate ml-2 max-w-[200px]">
                              {typeof value === 'string' ? value : JSON.stringify(value)}
                            </span>
                          </div>
                        ))}
                        {Object.keys(device.device?.fingerprintData || {}).length > 10 && (
                          <div className="text-muted-foreground italic">
                            ... and {Object.keys(device.device?.fingerprintData || {}).length - 10} more
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Suspicious Devices */}
      {suspiciousDevices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="h-5 w-5" />
              Suspicious Devices
            </CardTitle>
            <CardDescription>
              Devices with flagged security events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suspiciousDevices.map(device => (
                <div key={device.fingerprint} className="flex items-center justify-between p-3 rounded-lg border bg-orange-500/5">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {getDeviceIcon(device)}
                      {device.device?.browser} on {device.device?.os}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {device.device?.device} • {device.suspiciousCount} suspicious events
                    </div>
                  </div>
                  <Badge variant="error" className="text-xs">
                    Review Required
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Device Data */}
      {deviceArray.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No Device Data</p>
            <p className="text-sm text-muted-foreground mt-1">
              No security events with device information found
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

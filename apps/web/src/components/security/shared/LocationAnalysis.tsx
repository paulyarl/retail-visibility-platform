/**
 * Location Analysis Component
 * Displays geolocation data and security insights by location
 */

'use client';

import { SecurityAlert } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MapPin, Globe, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationAnalysisProps {
  alerts: SecurityAlert[];
}

export function LocationAnalysis({ alerts }: LocationAnalysisProps) {
  // Extract location data from alerts
  const locations = alerts.reduce((acc, alert) => {
    const location = alert.metadata?.location;
    const ip = location?.ipAddress || alert.metadata?.ip;
    
    if (ip) {
      if (!acc[ip]) {
        acc[ip] = {
          ip,
          geo: location?.geo || {},
          alerts: [],
          firstSeen: alert.createdAt,
          lastSeen: alert.createdAt,
          suspiciousCount: 0
        };
      }
      
      acc[ip].alerts.push(alert);
      
      // Update timestamps
      if (new Date(alert.createdAt) < new Date(acc[ip].firstSeen)) {
        acc[ip].firstSeen = alert.createdAt;
      }
      if (new Date(alert.createdAt) > new Date(acc[ip].lastSeen)) {
        acc[ip].lastSeen = alert.createdAt;
      }
      
      // Count suspicious alerts
      if (alert.metadata?.summary?.isSuspicious) {
        acc[ip].suspiciousCount++;
      }
    }
    
    return acc;
  }, {} as Record<string, any>);

  const locationArray = Object.values(locations);
  const uniqueCountries = [...new Set(
    locationArray
      .filter(loc => loc.geo?.country)
      .map(loc => loc.geo.country)
  )];

  const suspiciousLocations = locationArray.filter(loc => loc.suspiciousCount > 0);

  const getLocationRisk = (location: any) => {
    if (location.suspiciousCount > 0) return { level: 'high', color: 'text-orange-500', bg: 'bg-orange-500/10' };
    if (location.alerts.length > 5) return { level: 'medium', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
    return { level: 'low', color: 'text-green-500', bg: 'bg-green-500/10' };
  };

  const formatLocation = (geo: any) => {
    if (!geo || Object.keys(geo).length === 0) {
      return 'Unknown Location';
    }
    
    const parts = [];
    if (geo.city) parts.push(geo.city);
    if (geo.region) parts.push(geo.region);
    if (geo.country) parts.push(geo.country);
    
    return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
  };

  return (
    <div className="space-y-6">
      {/* Location Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{locationArray.length}</div>
                <div className="text-xs text-muted-foreground">Unique IPs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{uniqueCountries.length}</div>
                <div className="text-xs text-muted-foreground">Countries</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{locationArray.length - suspiciousLocations.length}</div>
                <div className="text-xs text-muted-foreground">Safe Locations</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold text-orange-500">{suspiciousLocations.length}</div>
                <div className="text-xs text-muted-foreground">Suspicious</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations List */}
      <Card>
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
          <CardDescription>
            IP addresses and their associated security events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {locationArray.map(location => {
              const risk = getLocationRisk(location);
              return (
                <div key={location.ip} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {location.ip}
                        </code>
                        <Badge variant="outline" className={cn(risk.bg, risk.color)}>
                          {risk.level} risk
                        </Badge>
                        {location.suspiciousCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {location.suspiciousCount} suspicious
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        {formatLocation(location.geo)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{location.alerts.length} events</span>
                        <span>First: {new Date(location.firstSeen).toLocaleDateString()}</span>
                        <span>Last: {new Date(location.lastSeen).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Suspicious Locations */}
      {suspiciousLocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="h-5 w-5" />
              Suspicious Locations
            </CardTitle>
            <CardDescription>
              Locations with flagged security events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suspiciousLocations.map(location => (
                <div key={location.ip} className="flex items-center justify-between p-3 rounded-lg border bg-orange-500/5">
                  <div>
                    <div className="font-mono text-sm">{location.ip}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatLocation(location.geo)} • {location.suspiciousCount} suspicious events
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    Review Required
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Location Data */}
      {locationArray.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No Location Data</p>
            <p className="text-sm text-muted-foreground mt-1">
              No security events with location information found
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Threat Monitor
 * Phase 3: Real-time threat detection display
 */

'use client';

import { useState } from 'react';
import { SecurityThreat } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import * as securityMonitoringService from '@/services/securityMonitoring';

interface ThreatMonitorProps {
  threats: SecurityThreat[];
}

export function ThreatMonitor({ threats }: ThreatMonitorProps) {
  const [resolving, setResolving] = useState<string | null>(null);

  const handleResolve = async (threatId: string) => {
    try {
      setResolving(threatId);
      await securityMonitoringService.resolveThreat(threatId, 'Resolved via UI');
      window.location.reload();
    } catch (error) {
      console.error('Failed to resolve threat:', error);
    } finally {
      setResolving(null);
    }
  };

  const getSeverityIcon = (severity: SecurityThreat['severity']) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: SecurityThreat['severity']) => {
    const variants = {
      critical: 'error',
      high: 'warning',
      medium: 'warning',
      low: 'info',
    } as const;

    return <Badge variant={variants[severity]}>{severity.toUpperCase()}</Badge>;
  };

  const getStatusBadge = (status: SecurityThreat['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="error">Active</Badge>;
      case 'investigating':
        return <Badge variant="warning">Investigating</Badge>;
      case 'resolved':
        return <Badge variant="success">Resolved</Badge>;
      case 'false_positive':
        return <Badge variant="default">False Positive</Badge>;
    }
  };

  const activeThreats = threats.filter(t => t.status === 'active' || t.status === 'investigating');
  const resolvedThreats = threats.filter(t => t.status === 'resolved' || t.status === 'false_positive');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Threat Monitor
        </CardTitle>
        <CardDescription>
          Real-time security threat detection and response
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Threats */}
        {activeThreats.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Active Threats ({activeThreats.length})</h3>
            {activeThreats.map((threat) => (
              <div
                key={threat.id}
                className="p-4 border rounded-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(threat.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{threat.type}</p>
                        {getSeverityBadge(threat.severity)}
                        {getStatusBadge(threat.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{threat.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-1 text-muted-foreground">
                    <p>Source: {threat.source}</p>
                    <p>Detected: {format(new Date(threat.detectedAt), 'PPp')}</p>
                    {threat.affectedResources.length > 0 && (
                      <p>Affected: {threat.affectedResources.join(', ')}</p>
                    )}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleResolve(threat.id)}
                    disabled={resolving === threat.id}
                  >
                    {resolving === threat.id ? 'Resolving...' : 'Mark Resolved'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resolved Threats */}
        {resolvedThreats.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Recently Resolved ({resolvedThreats.length})</h3>
            {resolvedThreats.slice(0, 5).map((threat) => (
              <div
                key={threat.id}
                className="p-3 border rounded-lg opacity-60"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{threat.type}</p>
                      {getStatusBadge(threat.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Resolved: {threat.resolvedAt ? format(new Date(threat.resolvedAt), 'PPp') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {threats.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
            <p>No security threats detected</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

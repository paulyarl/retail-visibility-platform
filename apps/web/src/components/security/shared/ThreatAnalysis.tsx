/**
 * Threat Analysis Component
 * Displays threat levels, risk factors, and security insights
 */

'use client';

import { SecurityAlert } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { AlertTriangle, Shield, Info, XCircle, TrendingUp, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThreatAnalysisProps {
  alerts: SecurityAlert[];
}

export function ThreatAnalysis({ alerts }: ThreatAnalysisProps) {
  // Analyze threats from alerts
  const threatLevels = alerts.reduce((acc, alert) => {
    const summary = alert.metadata?.summary;
    if (summary?.threatLevel) {
      acc[summary.threatLevel] = (acc[summary.threatLevel] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const suspiciousAlerts = alerts.filter(alert => 
    alert.metadata?.summary?.isSuspicious
  );

  const allRiskFactors = alerts.flatMap(alert => 
    alert.metadata?.summary?.riskFactors || []
  );

  const uniqueRiskFactors = [...new Set(allRiskFactors)];

  const getThreatIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'medium':
        return <TrendingUp className="h-5 w-5 text-yellow-500" />;
      case 'low':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-destructive/10 border-destructive/50 text-destructive';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/50 text-orange-500';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500';
      case 'low':
      default:
        return 'bg-blue-500/10 border-blue-500/50 text-blue-500';
    }
  };

  const getOverallThreatLevel = () => {
    if (threatLevels.critical > 0) return { level: 'critical', icon: <XCircle className="h-6 w-6 text-destructive" /> };
    if (threatLevels.high > 0) return { level: 'high', icon: <AlertTriangle className="h-6 w-6 text-orange-500" /> };
    if (threatLevels.medium > 0) return { level: 'medium', icon: <TrendingUp className="h-6 w-6 text-yellow-500" /> };
    return { level: 'low', icon: <Shield className="h-6 w-6 text-green-500" /> };
  };

  const overallThreat = getOverallThreatLevel();
  const totalAlerts = alerts.length;

  return (
    <div className="space-y-6">
      {/* Overall Threat Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {overallThreat.icon}
            Overall Threat Level
          </CardTitle>
          <CardDescription>
            Current security posture based on all alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={cn(
              "px-4 py-2 rounded-lg border font-medium capitalize",
              getThreatColor(overallThreat.level)
            )}>
              {overallThreat.level}
            </div>
            <div className="text-sm text-muted-foreground">
              Based on {totalAlerts} security event{totalAlerts !== 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Threat Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Threat Distribution</CardTitle>
          <CardDescription>
            Breakdown of alerts by threat level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(threatLevels).map(([level, count]) => (
              <div key={level} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24">
                  {getThreatIcon(level)}
                  <span className="capitalize text-sm font-medium">{level}</span>
                </div>
                <div className="flex-1">
                  <Progress 
                    value={(count / totalAlerts) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="text-sm text-muted-foreground w-12 text-right">
                  {count}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suspicious Activity */}
      {suspiciousAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-500">
              <Eye className="h-5 w-5" />
              Suspicious Activity
            </CardTitle>
            <CardDescription>
              Alerts flagged as potentially suspicious
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suspiciousAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border bg-orange-500/5">
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {alert.metadata?.summary?.device} • {alert.metadata?.summary?.ip}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-orange-500">
                    Suspicious
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Factors */}
      {uniqueRiskFactors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Risk Factors</CardTitle>
            <CardDescription>
              Common security risks identified across alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {uniqueRiskFactors.map(factor => (
                <Badge key={factor} variant="outline" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Threats */}
      {alerts.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Shield className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
            <p className="font-medium text-green-500">No Security Threats</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your account security looks good!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

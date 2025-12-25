/**
 * Security Alerts Component
 * Phase 1: Display security notifications
 */

'use client';

import { SecurityAlert } from '@/types/security';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, AlertTriangle, Info, XCircle, X, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface SecurityAlertsProps {
  alerts: SecurityAlert[];
  onMarkRead: (alertId: string) => Promise<void>;
  onDismiss: (alertId: string) => Promise<void>;
}

export function SecurityAlerts({ alerts, onMarkRead, onDismiss }: SecurityAlertsProps) {
  const getSeverityIcon = (severity: SecurityAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: SecurityAlert['severity']) => {
    switch (severity) {
      case 'critical':
      case 'error':
        return 'border-destructive/50 bg-destructive/5';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/5';
      case 'info':
      default:
        return 'border-blue-500/50 bg-blue-500/5';
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Check className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
        <p className="font-medium">No security alerts</p>
        <p className="text-sm mt-1">Your account security looks good!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            'relative rounded-lg border p-4 transition-all',
            getSeverityColor(alert.severity),
            !alert.read && 'ring-2 ring-primary/20'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getSeverityIcon(alert.severity)}</div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{alert.message}</p>
                    {!alert.read && (
                      <Badge variant="default" className="text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                  </p>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 -mt-1 -mr-1"
                  onClick={() => onDismiss(alert.id)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Dismiss</span>
                </Button>
              </div>

              {alert.actions && alert.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {alert.actions.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.action === 'take_action' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        if (action.url) {
                          window.location.href = action.url;
                        }
                        if (action.action === 'dismiss') {
                          onDismiss(alert.id);
                        }
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}

              {!alert.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onMarkRead(alert.id)}
                  className="text-xs"
                >
                  Mark as read
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

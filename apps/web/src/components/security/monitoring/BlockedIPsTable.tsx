/**
 * Blocked IPs Table
 * Phase 3: Manage blocked IP addresses
 */

'use client';

import { useState } from 'react';
import { BlockedIP } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Ban, Unlock, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import * as securityMonitoringService from '@/services/securityMonitoring';

interface BlockedIPsTableProps {
  blockedIPs: BlockedIP[];
}

export function BlockedIPsTable({ blockedIPs }: BlockedIPsTableProps) {
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const handleUnblock = async (ipAddress: string) => {
    try {
      setUnblocking(ipAddress);
      await securityMonitoringService.unblockIP(ipAddress, 'Unblocked via UI');
      window.location.reload();
    } catch (error) {
      console.error('Failed to unblock IP:', error);
    } finally {
      setUnblocking(null);
    }
  };

  const getReasonBadge = (reason: string) => {
    const reasonMap: Record<string, { variant: 'error' | 'warning' | 'default'; label: string }> = {
      brute_force: { variant: 'error', label: 'Brute Force' },
      suspicious_activity: { variant: 'warning', label: 'Suspicious' },
      rate_limit: { variant: 'warning', label: 'Rate Limit' },
      manual: { variant: 'default', label: 'Manual' },
    };

    const config = reasonMap[reason] || { variant: 'default' as const, label: reason };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-5 w-5" />
          Blocked IP Addresses
        </CardTitle>
        <CardDescription>
          Manage blocked IP addresses and security rules
        </CardDescription>
      </CardHeader>
      <CardContent>
        {blockedIPs.length > 0 ? (
          <div className="space-y-3">
            {blockedIPs.map((blockedIP) => (
              <div
                key={blockedIP.ipAddress}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {blockedIP.ipAddress}
                    </code>
                    {getReasonBadge(blockedIP.reason)}
                    {blockedIP.permanent && (
                      <Badge variant="error">Permanent</Badge>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Blocked: {format(new Date(blockedIP.blockedAt), 'PPp')}</p>
                    {blockedIP.expiresAt && !blockedIP.permanent && (
                      <p className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Expires {formatDistanceToNow(new Date(blockedIP.expiresAt), { addSuffix: true })}
                      </p>
                    )}
                    {blockedIP.attempts && (
                      <p>Failed attempts: {blockedIP.attempts}</p>
                    )}
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUnblock(blockedIP.ipAddress)}
                  disabled={unblocking === blockedIP.ipAddress}
                >
                  {unblocking === blockedIP.ipAddress ? (
                    'Unblocking...'
                  ) : (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      Unblock
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Ban className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No blocked IP addresses</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

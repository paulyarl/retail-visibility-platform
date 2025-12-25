/**
 * Login Activity Table
 * Phase 1: Display active sessions with revoke actions
 */

'use client';

import { useState } from 'react';
import { LoginSession } from '@/types/security';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/Badge';
import { Monitor, Smartphone, Tablet, LogOut, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LoginActivityTableProps {
  sessions: LoginSession[];
  onRevoke: (sessionId: string) => Promise<void>;
  onRevokeAll: () => Promise<void>;
}

export function LoginActivityTable({ sessions, onRevoke, onRevokeAll }: LoginActivityTableProps) {
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const getDeviceIcon = (deviceType: string | undefined) => {
    if (!deviceType) return <Monitor className="h-4 w-4" />;
    const typeLower = deviceType.toLowerCase();
    if (typeLower.includes('mobile') || typeLower.includes('phone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (typeLower.includes('tablet') || typeLower.includes('ipad')) {
      return <Tablet className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const handleRevoke = async (sessionId: string) => {
    try {
      setRevoking(sessionId);
      await onRevoke(sessionId);
    } catch (error) {
      console.error('Failed to revoke session:', error);
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    try {
      setRevokingAll(true);
      await onRevokeAll();
      setShowRevokeAllDialog(false);
    } catch (error) {
      console.error('Failed to revoke all sessions:', error);
    } finally {
      setRevokingAll(false);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No active sessions found</p>
      </div>
    );
  }

  const otherSessions = sessions.filter(s => !s.isCurrent);

  return (
    <div className="space-y-4">
      {otherSessions.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowRevokeAllDialog(true)}
            className="text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out All Other Sessions
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(session.deviceInfo?.type || session.device)}
                    <div>
                      <div className="font-medium">
                        {session.deviceInfo 
                          ? `${session.deviceInfo.browser} on ${session.deviceInfo.os}`
                          : session.device || 'Unknown Device'
                        }
                      </div>
                      {session.isCurrent && (
                        <Badge variant="default" className="mt-1">
                          Current Session
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {typeof session.location === 'string' 
                    ? session.location 
                    : `${session.location.city}, ${session.location.country}`
                  }
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {session.ipAddress}
                  </code>
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(session.id)}
                      disabled={revoking === session.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {revoking === session.id ? (
                        'Revoking...'
                      ) : (
                        <>
                          <LogOut className="h-4 w-4 mr-2" />
                          Revoke
                        </>
                      )}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Sign Out All Other Sessions?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out of all other devices and locations. You will remain signed in
              on this device. You'll need to sign in again on those devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeAll}
              disabled={revokingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revokingAll ? 'Signing Out...' : 'Sign Out All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Admin Sessions Table
 * Platform-wide session monitoring for administrators
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Monitor, Smartphone, Tablet, LogOut, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Pagination } from '@/components/ui/Pagination';

interface AdminSession {
  id: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
  userRole: string;
  deviceInfo: {
    type: string;
    browser: string;
    os: string;
  };
  ipAddress: string;
  location: {
    city: string;
    country: string;
  };
  lastActivity: string;
  createdAt: string;
}

interface AdminSessionsTableProps {
  sessions: AdminSession[];
  onRevoke: (sessionId: string) => Promise<void>;
  currentUserId?: string; // Current admin user's ID to prevent self-revocation
  // Pagination props
  currentPage: number;
  pageSize: number;
  totalSessions: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function AdminSessionsTable({ 
  sessions, 
  onRevoke,
  currentUserId,
  currentPage,
  pageSize,
  totalSessions,
  onPageChange,
  onPageSizeChange
}: AdminSessionsTableProps) {
  const [revoking, setRevoking] = useState<string | null>(null);

  const getDeviceIcon = (type: string) => {
    const typeLower = type?.toLowerCase() || '';
    if (typeLower.includes('mobile') || typeLower.includes('phone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    if (typeLower.includes('tablet')) {
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

  const getUserDisplay = (session: AdminSession) => {
    const name = [session.userFirstName, session.userLastName].filter(Boolean).join(' ');
    return name || session.userEmail;
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">No active sessions</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
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
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{getUserDisplay(session)}</div>
                    <div className="text-xs text-muted-foreground">{session.userEmail}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="default">{session.userRole}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getDeviceIcon(session.deviceInfo?.type)}
                  <div className="text-sm">
                    {session.deviceInfo 
                      ? `${session.deviceInfo.browser} on ${session.deviceInfo.os}`
                      : 'Unknown Device'
                    }
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {typeof session.location === 'object'
                    ? `${session.location.city}, ${session.location.country}`
                    : 'Unknown'
                  }
                </div>
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {session.ipAddress}
                </code>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {formatDistanceToNow(new Date(session.lastActivity), { addSuffix: true })}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {session.userId === currentUserId ? (
                  <Badge variant="default" className="text-xs">
                    Current Session
                  </Badge>
                ) : (
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
      
      {/* Pagination */}
      {totalSessions > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalSessions}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      )}
    </div>
  );
}

/**
 * Deletion Progress Modal
 * Phase 1: Display deletion progress and grace period
 */

'use client';

import { AccountDeletionRequest } from '@/types/security';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';

interface DeletionProgressModalProps {
  deletionRequest: AccountDeletionRequest | null;
  onCancel: () => Promise<void>;
}

export function DeletionProgressModal({ deletionRequest, onCancel }: DeletionProgressModalProps) {
  if (!deletionRequest) return null;

  const daysRemaining = differenceInDays(
    new Date(deletionRequest.scheduledFor),
    new Date()
  );
  const totalDays = 30;
  const progress = ((totalDays - daysRemaining) / totalDays) * 100;

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Account Deletion Scheduled
        </CardTitle>
        <CardDescription>
          Your account is scheduled for permanent deletion
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Time Remaining
            </span>
            <span className="font-medium">
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
            </span>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="text-sm text-muted-foreground">
            Deletion scheduled for {format(new Date(deletionRequest.scheduledFor), 'PPP')}
            <br />
            ({formatDistanceToNow(new Date(deletionRequest.scheduledFor), { addSuffix: true })})
          </div>
        </div>

        {deletionRequest.reason && (
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-1">Reason provided:</p>
            <p className="text-sm text-muted-foreground">{deletionRequest.reason}</p>
          </div>
        )}

        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 space-y-2">
          <p className="text-sm font-medium text-yellow-600">What happens next?</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Your account will be permanently deleted on the scheduled date</li>
            <li>• All your data will be irreversibly removed</li>
            <li>• You can cancel this request at any time before deletion</li>
            <li>• After deletion, this action cannot be undone</li>
          </ul>
        </div>

        {deletionRequest.canCancel && (
          <div className="flex gap-3">
            <Button
              variant="primary"
              onClick={onCancel}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Deletion Request
            </Button>
          </div>
        )}

        {!deletionRequest.canCancel && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive font-medium">
              Deletion cannot be cancelled at this time
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

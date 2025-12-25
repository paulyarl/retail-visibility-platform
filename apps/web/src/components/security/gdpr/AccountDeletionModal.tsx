/**
 * Account Deletion Modal
 * Phase 1: Multi-step account deletion flow
 */

'use client';

import { useState } from 'react';
import { useGDPR } from '@/hooks/useGDPR';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface AccountDeletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountDeletionModal({ open, onOpenChange }: AccountDeletionModalProps) {
  const { requestDeletion } = useGDPR();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (confirmation !== 'DELETE') return;
    
    try {
      setSubmitting(true);
      await requestDeletion({ reason, confirmation, password });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Failed to request deletion:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setReason('');
    setConfirmation('');
    setPassword('');
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Your account will be scheduled for permanent deletion.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-2">
              <p className="font-medium text-destructive">Warning: This will permanently delete:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Your profile and account information</li>
                <li>• All your preferences and settings</li>
                <li>• Your activity history and data</li>
                <li>• All associated records</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for deletion (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Help us improve by telling us why you're leaving..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
              />
            </div>

            <div className="rounded-lg bg-muted p-4 text-sm">
              <p className="font-medium mb-2">Grace Period:</p>
              <p className="text-muted-foreground">
                Your account will be scheduled for deletion in 30 days. You can cancel this request
                at any time during this period.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Type <strong>DELETE</strong> to confirm
              </Label>
              <Input
                id="confirmation"
                placeholder="DELETE"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Confirm your password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 text-sm">
              <p className="font-medium text-yellow-600 mb-1">Final Warning</p>
              <p className="text-muted-foreground">
                This will schedule your account for permanent deletion. You have 30 days to cancel.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setStep(2)}>
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="danger"
                onClick={handleSubmit}
                disabled={confirmation !== 'DELETE' || !password || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scheduling Deletion...
                  </>
                ) : (
                  'Delete My Account'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

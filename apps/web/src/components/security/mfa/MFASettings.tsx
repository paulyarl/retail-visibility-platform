/**
 * MFA Settings
 * Phase 3: Manage MFA settings
 */

'use client';

import { useState } from 'react';
import { useMFA } from '@/hooks/useMFA';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Shield, ShieldCheck, ShieldOff, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { MFASetupWizard } from './MFASetupWizard';
import { BackupCodesDisplay } from './BackupCodesDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

export function MFASettings() {
  const { mfaStatus, disableMFA, regenerateBackupCodes, loading } = useMFA();
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);

  const handleDisable = async () => {
    try {
      await disableMFA();
      setShowDisableDialog(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to disable MFA:', error);
    }
  };

  const handleRegenerateCodes = async () => {
    try {
      const codes = await regenerateBackupCodes();
      setNewBackupCodes(codes);
      setShowBackupCodes(true);
    } catch (error) {
      console.error('Failed to regenerate codes:', error);
    }
  };

  if (showSetup) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setShowSetup(false)}>
          ← Back to Settings
        </Button>
        <MFASetupWizard />
      </div>
    );
  }

  if (showBackupCodes && newBackupCodes.length > 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setShowBackupCodes(false)}>
          ← Back to Settings
        </Button>
        <BackupCodesDisplay
          codes={newBackupCodes}
          onComplete={() => {
            setShowBackupCodes(false);
            setNewBackupCodes([]);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </div>
            {mfaStatus?.enabled ? (
              <Badge variant="success" className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="default" className="flex items-center gap-1">
                <ShieldOff className="h-3 w-3" />
                Disabled
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!mfaStatus?.enabled ? (
            <>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-sm font-medium text-blue-600 mb-2">
                  Protect your account with 2FA
                </p>
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication adds an extra layer of security by requiring
                  a code from your phone in addition to your password.
                </p>
              </div>

              <Button onClick={() => setShowSetup(true)} className="w-full">
                <Shield className="h-4 w-4 mr-2" />
                Enable Two-Factor Authentication
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <ShieldCheck className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-600">2FA is Active</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your account is protected with two-factor authentication
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Backup Codes</p>
                      <p className="text-sm text-muted-foreground">
                        {mfaStatus.backupCodesRemaining} codes remaining
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleRegenerateCodes}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate
                        </>
                      )}
                    </Button>
                  </div>

                  {mfaStatus.backupCodesRemaining <= 2 && (
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <p className="text-sm text-yellow-600">
                        You're running low on backup codes. Consider regenerating them.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  variant="danger"
                  onClick={() => setShowDisableDialog(true)}
                  className="w-full"
                >
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Disable Two-Factor Authentication
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Disable Two-Factor Authentication?
            </DialogTitle>
            <DialogDescription>
              This will make your account less secure. You'll only need your password to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive">
              Warning: Disabling 2FA will remove the extra security layer from your account.
              Anyone with your password will be able to access your account.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDisable} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disabling...
                </>
              ) : (
                'Disable 2FA'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Auth0 MFA Settings
 * Custom UI for Auth0 MFA backend
 */

'use client';

import { useState } from 'react';
import { useAuth0MFA } from '@/hooks/useAuth0MFA';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Shield, ShieldCheck, ShieldOff, RefreshCw, Loader2, AlertTriangle, Smartphone, Mail, Key } from 'lucide-react';
import { Auth0TOTPSetupWizard } from './Auth0TOTPSetupWizard';
import { Auth0SMSSetupWizard } from './Auth0SMSSetupWizard';
import { Auth0BackupCodesDisplay } from './Auth0BackupCodesDisplay';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { clientLogger } from '@/lib/client-logger';

export function Auth0MFASettings() {
  const { mfaStatus, loading, error, deleteMFAFactor, generateBackupCodes, clearError } = useAuth0MFA();
  const [showTOTPSetup, setShowTOTPSetup] = useState(false);
  const [showSMSSetup, setShowSMSSetup] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [factorToDelete, setFactorToDelete] = useState<string | null>(null);

  const handleDisable = async () => {
    if (!factorToDelete) return;
    
    try {
      await deleteMFAFactor(factorToDelete);
      setShowDisableDialog(false);
      setFactorToDelete(null);
    } catch (error) {
      clientLogger.error('Failed to disable MFA factor:', { detail: error });
    }
  };

  const handleRegenerateCodes = async () => {
    try {
      const codes = await generateBackupCodes();
      setNewBackupCodes(codes);
      setShowBackupCodes(true);
    } catch (error) {
      clientLogger.error('Failed to regenerate codes:', { detail: error });
    }
  };

  const openDisableDialog = (factorId: string) => {
    setFactorToDelete(factorId);
    setShowDisableDialog(true);
  };

  if (showTOTPSetup) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setShowTOTPSetup(false)}>
          × Back to Settings
        </Button>
        <Auth0TOTPSetupWizard />
      </div>
    );
  }

  if (showSMSSetup) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setShowSMSSetup(false)}>
          × Back to Settings
        </Button>
        <Auth0SMSSetupWizard />
      </div>
    );
  }

  if (showBackupCodes && newBackupCodes.length > 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setShowBackupCodes(false)}>
          × Back to Settings
        </Button>
        <Auth0BackupCodesDisplay
          codes={newBackupCodes}
          onComplete={() => {
            setShowBackupCodes(false);
            setNewBackupCodes([]);
          }}
        />
      </div>
    );
  }

  const enabledMethods = Object.entries(mfaStatus?.methods || {})
    .filter(([_, enabled]) => enabled)
    .map(([method]) => method);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Auth0 Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Enhanced security with Auth0's multi-factor authentication
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
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="ghost" size="sm" onClick={clearError} className="mt-2">
                Dismiss
              </Button>
            </div>
          )}

          {!mfaStatus?.enabled ? (
            <>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                <p className="text-sm font-medium text-blue-600 mb-2">
                  Protect your account with Auth0 2FA
                </p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security using Auth0's enterprise-grade 
                  multi-factor authentication system.
                </p>
              </div>

              <div className="grid gap-4">
                <Button onClick={() => setShowTOTPSetup(true)} className="w-full">
                  <Key className="h-4 w-4 mr-2" />
                  Set Up Authenticator App (TOTP)
                </Button>
                <Button onClick={() => setShowSMSSetup(true)} variant="outline" className="w-full">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Set Up SMS Authentication
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <ShieldCheck className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-600">Auth0 2FA is Active</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your account is protected with Auth0 multi-factor authentication
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">Enabled Methods:</div>
                  {enabledMethods.map((method) => (
                    <div key={method} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        {method === 'totp' && <Key className="h-4 w-4" />}
                        {method === 'sms' && <Smartphone className="h-4 w-4" />}
                        {method === 'email' && <Mail className="h-4 w-4" />}
                        <span className="capitalize">{method}</span>
                        {method === 'sms' && mfaStatus?.phone && (
                          <span className="text-sm text-muted-foreground">
                            ({mfaStatus.phone})
                          </span>
                        )}
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => openDisableDialog(method)}
                        disabled={loading}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}

                  {mfaStatus?.backupCodes && (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Backup Codes</p>
                        <p className="text-sm text-muted-foreground">
                          {mfaStatus.backupCodes.remaining} of {mfaStatus.backupCodes.total} codes remaining
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
                  )}

                  {mfaStatus?.backupCodes && mfaStatus.backupCodes.remaining <= 2 && (
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
                <div className="grid gap-2">
                  <Button onClick={() => setShowTOTPSetup(true)} variant="outline">
                    <Key className="h-4 w-4 mr-2" />
                    Add Authenticator App
                  </Button>
                  <Button onClick={() => setShowSMSSetup(true)} variant="outline">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Add SMS Authentication
                  </Button>
                </div>
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
              Remove 2FA Method?
            </DialogTitle>
            <DialogDescription>
              This will remove the multi-factor authentication method from your account.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive">
              Warning: Removing 2FA will make your account less secure. 
              Consider adding another 2FA method before removing this one.
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
                  Removing...
                </>
              ) : (
                'Remove Method'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

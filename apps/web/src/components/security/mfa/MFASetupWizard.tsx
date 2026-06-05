/**
 * MFA Setup Wizard
 * Phase 3: Multi-step MFA setup flow
 */

'use client';

import { useState } from 'react';
import { useMFA } from '@/hooks/useMFA';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Shield, Smartphone, Key, CheckCircle, Loader2 } from 'lucide-react';
import { BackupCodesDisplay } from './BackupCodesDisplay';

type SetupStep = 'intro' | 'qr-code' | 'verify' | 'backup-codes' | 'complete';

export function MFASetupWizard() {
  const { setupMFA, verifySetup, regenerateBackupCodes, loading } = useMFA();
  const [step, setStep] = useState<SetupStep>('intro');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleStartSetup = async () => {
    try {
      setError('');
      const result = await setupMFA();
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setStep('qr-code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start setup');
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setError('');
      const result = await verifySetup({ verificationCode });
      // verifySetup returns boolean, backup codes come from regenerateBackupCodes
      if (result) {
        // Generate backup codes after successful verification
        const codes = await regenerateBackupCodes();
        setBackupCodes(codes || []);
      }
      setStep('backup-codes');
    } catch (err) {
      setError('Invalid verification code. Please try again.');
      setVerificationCode('');
    }
  };

  const handleComplete = () => {
    setStep('complete');
  };

  if (step === 'intro') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Enable Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 mt-1 text-primary" />
              <div>
                <p className="font-medium">Step 1: Install an authenticator app</p>
                <p className="text-sm text-muted-foreground">
                  Download Google Authenticator, Authy, or 1Password on your phone
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Key className="h-5 w-5 mt-1 text-primary" />
              <div>
                <p className="font-medium">Step 2: Scan QR code</p>
                <p className="text-sm text-muted-foreground">
                  Use your authenticator app to scan the QR code we'll show you
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 mt-1 text-primary" />
              <div>
                <p className="font-medium">Step 3: Verify and save backup codes</p>
                <p className="text-sm text-muted-foreground">
                  Enter the code from your app and save your backup codes
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
            <p className="text-sm font-medium text-blue-600 mb-1">Why enable 2FA?</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Protects your account even if your password is compromised</li>
              <li>• Required for accessing sensitive features</li>
              <li>• Industry best practice for security</li>
            </ul>
          </div>

          <Button onClick={handleStartSetup} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              'Begin Setup'
            )}
          </Button>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'qr-code') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scan QR Code</CardTitle>
          <CardDescription>
            Use your authenticator app to scan this code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            {qrCode && (
              <img src={qrCode} alt="MFA QR Code" className="w-64 h-64 border rounded-lg" />
            )}
            
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Can't scan the code? Enter this key manually:
              </p>
              <code className="block text-xs bg-muted px-4 py-2 rounded font-mono">
                {secret}
              </code>
            </div>
          </div>

          <Button onClick={() => setStep('verify')} className="w-full">
            Continue to Verification
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify Setup</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="verification-code">Verification Code</Label>
            <Input
              id="verification-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep('qr-code')} className="flex-1">
              Back
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verificationCode.length !== 6 || loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'backup-codes') {
    return (
      <BackupCodesDisplay
        codes={backupCodes}
        onComplete={handleComplete}
      />
    );
  }

  if (step === 'complete') {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/10 p-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">Two-Factor Authentication Enabled!</h3>
            <p className="text-muted-foreground">
              Your account is now protected with 2FA
            </p>
          </div>
          <Button onClick={() => window.location.reload()} className="w-full">
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

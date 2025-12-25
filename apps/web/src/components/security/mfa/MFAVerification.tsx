/**
 * MFA Verification
 * Phase 3: Login verification interface
 */

'use client';

import { useState } from 'react';
import { useMFA } from '@/hooks/useMFA';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

interface MFAVerificationProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MFAVerification({ onSuccess, onCancel }: MFAVerificationProps) {
  const { verifyLogin, loading } = useMFA();
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleVerify = async () => {
    if (code.length < 6) {
      setError('Please enter a valid code');
      return;
    }

    try {
      setError('');
      await verifyLogin(code);
      onSuccess();
    } catch (err) {
      setAttempts(prev => prev + 1);
      setError(
        useBackupCode
          ? 'Invalid backup code. Please try again.'
          : 'Invalid verification code. Please try again.'
      );
      setCode('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length >= 6) {
      handleVerify();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          {useBackupCode
            ? 'Enter one of your backup codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="mfa-code">
            {useBackupCode ? 'Backup Code' : 'Verification Code'}
          </Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={useBackupCode ? 10 : 6}
            placeholder={useBackupCode ? '0000000000' : '000000'}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyPress={handleKeyPress}
            className="text-center text-2xl tracking-widest"
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {attempts >= 3 && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
            <p className="text-sm text-yellow-600">
              Having trouble? Make sure your device's time is synchronized correctly.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleVerify}
            disabled={code.length < 6 || loading}
            className="w-full"
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

          <Button
            variant="ghost"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              setError('');
            }}
            className="w-full"
          >
            {useBackupCode ? 'Use authenticator code' : 'Use backup code'}
          </Button>

          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Lost access to your authenticator?</p>
          <button className="text-primary hover:underline">
            Contact support
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

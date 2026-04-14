/**
 * Auth0 TOTP Setup Wizard
 * Custom UI for TOTP enrollment with Auth0 backend
 */

'use client';

import { useState } from 'react';
import { useAuth0MFA } from '@/hooks/useAuth0MFA';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Key, QrCode, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export function Auth0TOTPSetupWizard() {
  const { initiateTOTPEnrollment, verifyTOTPEnrollment, loading, error, clearError } = useAuth0MFA();
  const [step, setStep] = useState<'start' | 'scan' | 'verify' | 'success'>('start');
  const [enrollmentData, setEnrollmentData] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleStartSetup = async () => {
    try {
      clearError();
      const data = await initiateTOTPEnrollment();
      setEnrollmentData(data);
      setStep('scan');
    } catch (err) {
      console.error('Failed to start TOTP setup:', err);
    }
  };

  const handleVerify = async () => {
    if (!enrollmentData || !verificationCode) return;

    try {
      setVerifying(true);
      clearError();
      
      // Note: In a real implementation, you'd need the factorId from Auth0
      // For now, we'll use a placeholder - this would need to be implemented
      // based on Auth0's actual response structure
      await verifyTOTPEnrollment(enrollmentData.factorId || 'placeholder', verificationCode);
      setStep('success');
    } catch (err) {
      console.error('Failed to verify TOTP:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleBack = () => {
    if (step === 'scan') {
      setStep('start');
      setEnrollmentData(null);
    } else if (step === 'verify') {
      setStep('scan');
      setVerificationCode('');
    }
  };

  if (step === 'start') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Set Up Authenticator App
          </CardTitle>
          <CardDescription>
            Add an extra layer of security with Time-based One-Time Password (TOTP)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <h4 className="font-medium text-blue-600 mb-2">Before you start</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Install an authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
                <li>Have your phone ready to scan the QR code</li>
                <li>Keep your backup codes in a safe place</li>
              </ul>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <QrCode className="h-5 w-5" />
                <div>
                  <p className="font-medium">Scan QR Code</p>
                  <p className="text-sm text-muted-foreground">
                    Quick setup with your authenticator app
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <Key className="h-5 w-5" />
                <div>
                  <p className="font-medium">Manual Entry</p>
                  <p className="text-sm text-muted-foreground">
                    Enter the secret key manually
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleStartSetup} 
            className="w-full" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Continue Setup
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'scan' && enrollmentData) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan QR Code
            </CardTitle>
          </div>
          <CardDescription>
            Scan this QR code with your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-lg border p-4 bg-white">
              {/* QR Code would be rendered here */}
              <img 
                src={enrollmentData.qrCode} 
                alt="QR Code for TOTP Setup"
                className="w-48 h-48"
              />
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Can't scan? Use this secret key instead:
              </p>
              <div className="font-mono text-sm bg-muted p-2 rounded border">
                {enrollmentData.secret}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigator.clipboard.writeText(enrollmentData.secret)}
              >
                Copy Secret Key
              </Button>
            </div>
          </div>

          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
            <p className="text-sm text-green-600">
              {enrollmentData.message}
            </p>
          </div>

          <Button onClick={() => setStep('verify')} className="w-full">
            I've scanned the QR code
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'verify') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Enter Verification Code
            </CardTitle>
          </div>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="text-center text-lg font-mono"
                autoFocus
              />
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleVerify} 
            className="w-full" 
            disabled={verificationCode.length !== 6 || verifying}
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify and Enable'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'success') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            TOTP Setup Complete
          </CardTitle>
          <CardDescription>
            Your account is now protected with authenticator app 2FA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
            <h4 className="font-medium text-green-600 mb-2">What's next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Your authenticator app is now linked to your account</li>
              <li>You'll be prompted for a code when signing in</li>
              <li>Consider adding backup codes for account recovery</li>
            </ul>
          </div>

          <Button className="w-full" onClick={() => window.location.reload()}>
            Go to MFA Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}

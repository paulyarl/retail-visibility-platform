/**
 * Auth0 SMS Setup Wizard
 * Custom UI for SMS enrollment with Auth0 backend
 */

'use client';

import { useState } from 'react';
import { useAuth0MFA } from '@/hooks/useAuth0MFA';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Smartphone, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';

export function Auth0SMSSetupWizard() {
  const { initiateSMSEnrollment, verifySMSEnrollment, loading, error, clearError } = useAuth0MFA();
  const [step, setStep] = useState<'start' | 'verify' | 'success'>('start');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [enrollmentData, setEnrollmentData] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleStartSetup = async () => {
    if (!phoneNumber) return;

    try {
      clearError();
      const data = await initiateSMSEnrollment(phoneNumber);
      setEnrollmentData(data);
      setStep('verify');
    } catch (err) {
      console.error('Failed to start SMS setup:', err);
    }
  };

  const handleVerify = async () => {
    if (!enrollmentData || !verificationCode) return;

    try {
      setVerifying(true);
      clearError();
      
      // Note: In a real implementation, you'd need the factorId from Auth0
      // For now, we'll use the factorId from enrollment data
      await verifySMSEnrollment(enrollmentData.factorId, verificationCode);
      setStep('success');
    } catch (err) {
      console.error('Failed to verify SMS:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleBack = () => {
    if (step === 'verify') {
      setStep('start');
      setVerificationCode('');
      setEnrollmentData(null);
    }
  };

  if (step === 'start') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Set Up SMS Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security with SMS-based two-factor authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <h4 className="font-medium text-blue-600 mb-2">Before you start</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Ensure you have reliable SMS service on your phone</li>
                <li>Keep your phone number up to date in your account settings</li>
                <li>Consider adding a backup method for account recovery</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="text-lg"
              />
              <p className="text-sm text-muted-foreground">
                Enter the phone number where you'll receive verification codes
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
            onClick={handleStartSetup} 
            className="w-full" 
            disabled={!phoneNumber || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending code...
              </>
            ) : (
              <>
                <Smartphone className="h-4 w-4 mr-2" />
                Send Verification Code
              </>
            )}
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
              <Smartphone className="h-5 w-5" />
              Enter SMS Code
            </CardTitle>
          </div>
          <CardDescription>
            Enter the verification code sent to {phoneNumber}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <p className="text-sm text-blue-600">
                {enrollmentData?.message || 'A verification code has been sent to your phone.'}
              </p>
            </div>

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
                Enter the 6-digit code from your SMS message
              </p>
            </div>
          </div>

          {error && (
            <Alert variant="error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-2">
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
            
            <Button 
              variant="outline" 
              onClick={handleStartSetup}
              disabled={loading}
            >
              Resend Code
            </Button>
          </div>
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
            SMS Setup Complete
          </CardTitle>
          <CardDescription>
            Your account is now protected with SMS-based 2FA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
            <h4 className="font-medium text-green-600 mb-2">What's next?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>SMS verification codes will be sent to {phoneNumber}</li>
              <li>You'll be prompted for a code when signing in</li>
              <li>Keep your phone number updated in account settings</li>
              <li>Consider adding a backup method for account recovery</li>
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

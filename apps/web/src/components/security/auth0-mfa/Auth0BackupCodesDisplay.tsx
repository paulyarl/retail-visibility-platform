/**
 * Auth0 Backup Codes Display
 * Component for displaying and managing backup codes
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { CheckCircle, Copy, Download, AlertTriangle, Shield } from 'lucide-react';

interface Auth0BackupCodesDisplayProps {
  codes: string[];
  onComplete: () => void;
}

export function Auth0BackupCodesDisplay({ codes, onComplete }: Auth0BackupCodesDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCopyCodes = async () => {
    const codesText = codes.join('\n');
    await navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCodes = () => {
    const codesText = codes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auth0-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleComplete = () => {
    if (!acknowledged) return;
    onComplete();
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Your Backup Codes
        </CardTitle>
        <CardDescription>
          Save these codes in a secure location for account recovery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-yellow-600 font-medium">
                Important: Save these codes immediately
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Each code can only be used once</li>
                <li>Store them in a secure, offline location</li>
                <li>These codes will not be shown again</li>
                <li>Generate new codes if you lose access to these</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {codes.map((code, index) => (
              <div 
                key={index} 
                className="font-mono text-sm bg-muted p-3 rounded border text-center"
              >
                {code}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleCopyCodes}
              className="flex-1"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadCodes}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <input
              type="checkbox"
              id="acknowledged"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1"
            />
            <div>
              <label htmlFor="acknowledged" className="text-sm font-medium cursor-pointer">
                I have saved my backup codes in a secure location
              </label>
              <p className="text-sm text-muted-foreground mt-1">
                Check this box to confirm you've safely stored your backup codes
              </p>
            </div>
          </div>

          <Button 
            onClick={handleComplete} 
            className="w-full"
            disabled={!acknowledged}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Setup
          </Button>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            These codes are your only way to access your account if you lose your authenticator app 
            or phone. Keep them safe and never share them with anyone.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

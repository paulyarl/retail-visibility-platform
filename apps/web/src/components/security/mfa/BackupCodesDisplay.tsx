/**
 * Backup Codes Display
 * Phase 3: Display and download backup codes
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Label } from '@/components/ui/Label';
import { Download, Copy, CheckCircle, AlertTriangle } from 'lucide-react';

interface BackupCodesDisplayProps {
  codes: string[];
  onComplete: () => void;
}

export function BackupCodesDisplay({ codes, onComplete }: BackupCodesDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Save Your Backup Codes
        </CardTitle>
        <CardDescription>
          Store these codes in a safe place. You'll need them if you lose access to your authenticator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-muted p-4">
          <div className="grid grid-cols-2 gap-3 font-mono text-sm">
            {codes.map((code, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-background rounded border"
              >
                <span className="text-muted-foreground">{index + 1}.</span>
                <span className="font-semibold">{code}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCopy} className="flex-1">
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Codes
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={handleDownload} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>

        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 space-y-2">
          <p className="text-sm font-medium text-yellow-600">Important:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Each code can only be used once</li>
            <li>• Store them in a password manager or safe location</li>
            <li>• Don't share these codes with anyone</li>
            <li>• You can regenerate codes later if needed</li>
          </ul>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="confirm-saved"
            checked={confirmed}
            onCheckedChange={(checked: boolean) => setConfirmed(checked)}
          />
          <Label
            htmlFor="confirm-saved"
            className="text-sm font-normal cursor-pointer"
          >
            I have saved these backup codes in a safe place
          </Label>
        </div>

        <Button
          onClick={onComplete}
          disabled={!confirmed}
          className="w-full"
        >
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

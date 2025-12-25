/**
 * Preference Backup
 * Phase 2: Export and import preferences
 */

'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Download, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import * as gdprService from '@/services/gdpr';

export function PreferenceBackup() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      setExporting(true);
      await gdprService.exportPreferences();
    } catch (error) {
      console.error('Failed to export preferences:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setImportResult(null);
      await gdprService.importPreferences(file);
      setImportResult({
        success: true,
        message: 'Preferences imported successfully. Reloading...',
      });
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      setImportResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import preferences',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Export Preferences</CardTitle>
          <CardDescription>
            Download all your preferences as a JSON file for backup or transfer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Preferences
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Preferences</CardTitle>
          <CardDescription>
            Upload a previously exported preferences file to restore your settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Preferences
              </>
            )}
          </Button>

          {importResult && (
            <div
              className={`flex items-start gap-2 p-4 rounded-lg ${
                importResult.success
                  ? 'bg-green-500/10 border border-green-500/20'
                  : 'bg-destructive/10 border border-destructive/20'
              }`}
            >
              {importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
              )}
              <p className={`text-sm ${importResult.success ? 'text-green-600' : 'text-destructive'}`}>
                {importResult.message}
              </p>
            </div>
          )}

          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">Important Notes:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Only import files exported from this platform</li>
              <li>• Importing will overwrite your current preferences</li>
              <li>• The page will reload after successful import</li>
              <li>• Invalid files will be rejected</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Data Export Widget
 * Phase 1: GDPR data export interface
 */

'use client';

import { useState } from 'react';
import { useGDPR } from '@/hooks/useGDPR';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Checkbox } from '@/components/ui/Checkbox';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { ExportHistoryTable } from './ExportHistoryTable';

export function DataExportWidget() {
  const { exports, requestExport, downloadExport } = useGDPR();
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const handleRequestExport = async () => {
    try {
      setRequesting(true);
      await requestExport({ format, includeMetadata });
    } catch (error) {
      console.error('Failed to request export:', error);
    } finally {
      setRequesting(false);
    }
  };

  const handleDownload = async (exportId: string) => {
    try {
      await downloadExport(exportId);
    } catch (error) {
      console.error('Failed to download export:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export Your Data</CardTitle>
          <CardDescription>
            Request a copy of all your data stored in our system. This includes your profile,
            preferences, activity history, and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Export Format</Label>
              <RadioGroup value={format} onValueChange={(v: string) => setFormat(v as 'json' | 'csv')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="json" />
                  <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer">
                    <FileJson className="h-4 w-4" />
                    JSON (Recommended for developers)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Easy to open in Excel)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="metadata"
                checked={includeMetadata}
                onCheckedChange={(checked: boolean) => setIncludeMetadata(checked)}
              />
              <Label
                htmlFor="metadata"
                className="text-sm font-normal cursor-pointer"
              >
                Include metadata (timestamps, IP addresses, etc.)
              </Label>
            </div>
          </div>

          <Button
            onClick={handleRequestExport}
            disabled={requesting}
            className="w-full sm:w-auto"
          >
            {requesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Requesting Export...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Request Data Export
              </>
            )}
          </Button>

          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">What's included in your export:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Profile information and account details</li>
              <li>• User preferences and settings</li>
              <li>• Consent records and privacy choices</li>
              <li>• Activity history and audit logs</li>
              <li>• All data associated with your account</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {exports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>
              Your previous data export requests and downloads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportHistoryTable exports={exports} onDownload={handleDownload} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

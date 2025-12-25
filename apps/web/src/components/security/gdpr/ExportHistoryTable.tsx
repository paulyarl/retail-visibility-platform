/**
 * Export History Table
 * Phase 1: Display export history and downloads
 */

'use client';

import { DataExport } from '@/types/security';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Download, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ExportHistoryTableProps {
  exports: DataExport[];
  onDownload: (exportId: string) => Promise<void>;
}

export function ExportHistoryTable({ exports, onDownload }: ExportHistoryTableProps) {
  const getStatusBadge = (status: DataExport['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="info" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="error" className="flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Failed
          </Badge>
        );
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  if (exports.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No export history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exports.map((exp) => (
        <div
          key={exp.id}
          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3">
              <span className="font-medium">
                {exp.format.toUpperCase()} Export
              </span>
              {getStatusBadge(exp.status)}
            </div>
            <div className="text-sm text-muted-foreground space-y-0.5">
              <p>
                Requested {formatDistanceToNow(new Date(exp.requestedAt), { addSuffix: true })}
              </p>
              {exp.completedAt && (
                <p>
                  Completed on {format(new Date(exp.completedAt), 'PPp')}
                </p>
              )}
              {exp.status === 'completed' && exp.expiresAt && (
                <p className="text-yellow-600">
                  Expires {formatDistanceToNow(new Date(exp.expiresAt), { addSuffix: true })}
                </p>
              )}
              {exp.fileSize && (
                <p>Size: {formatFileSize(exp.fileSize)}</p>
              )}
            </div>
          </div>

          {exp.status === 'completed' && exp.downloadUrl && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onDownload(exp.id)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

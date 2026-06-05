/**
 * Consent History
 * Phase 2: Display consent change history
 */

'use client';

import { useEffect, useState } from 'react';
import { ConsentHistoryEntry } from '@/types/security';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { CheckCircle, XCircle, RefreshCw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import * as gdprService from '@/services/gdpr';

export function ConsentHistory() {
  const [history, setHistory] = useState<ConsentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await gdprService.getConsentHistory();
        setHistory(data);
      } catch (error) {
        console.error('Failed to fetch consent history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const getActionIcon = (action: ConsentHistoryEntry['action']) => {
    switch (action) {
      case 'granted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'revoked':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'updated':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
    }
  };

  const getActionBadge = (action: ConsentHistoryEntry['action']) => {
    switch (action) {
      case 'granted':
        return <Badge variant="success">Granted</Badge>;
      case 'revoked':
        return <Badge variant="error">Revoked</Badge>;
      case 'updated':
        return <Badge variant="info">Updated</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="h-32 bg-muted animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No consent history found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6">
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-4 p-4 border rounded-lg"
            >
              <div className="mt-1">{getActionIcon(entry.action)}</div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {entry.consentType.split('_').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </span>
                  {getActionBadge(entry.action)}
                </div>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>{format(new Date(entry.timestamp), 'PPpp')}</p>
                  {entry.ipAddress && (
                    <p className="flex items-center gap-2">
                      IP: <code className="text-xs bg-muted px-2 py-0.5 rounded">{entry.ipAddress}</code>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

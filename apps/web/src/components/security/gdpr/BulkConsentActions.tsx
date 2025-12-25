/**
 * Bulk Consent Actions
 * Phase 2: Bulk consent management operations
 */

'use client';

import { useState } from 'react';
import { ConsentRecord, BulkConsentUpdateData } from '@/types/security';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import * as gdprService from '@/services/gdpr';

interface BulkConsentActionsProps {
  consents: ConsentRecord[];
}

export function BulkConsentActions({ consents }: BulkConsentActionsProps) {
  const [updating, setUpdating] = useState(false);

  const optionalConsents = consents.filter(c => !c.required);
  const allOptionalGranted = optionalConsents.every(c => c.consented);
  const allOptionalRevoked = optionalConsents.every(c => !c.consented);

  const handleAcceptAll = async () => {
    try {
      setUpdating(true);
      const updates: BulkConsentUpdateData = {
        updates: optionalConsents.map(c => ({
          type: c.type,
          consented: true,
        })),
      };
      await gdprService.bulkUpdateConsents(updates);
      window.location.reload();
    } catch (error) {
      console.error('Failed to accept all consents:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectAll = async () => {
    try {
      setUpdating(true);
      const updates: BulkConsentUpdateData = {
        updates: optionalConsents.map(c => ({
          type: c.type,
          consented: false,
        })),
      };
      await gdprService.bulkUpdateConsents(updates);
      window.location.reload();
    } catch (error) {
      console.error('Failed to reject all consents:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (optionalConsents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Bulk Actions</p>
            <p className="text-sm text-muted-foreground">
              Manage all optional consents at once
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAcceptAll}
              disabled={updating || allOptionalGranted}
            >
              {updating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Accept All
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRejectAll}
              disabled={updating || allOptionalRevoked}
            >
              {updating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

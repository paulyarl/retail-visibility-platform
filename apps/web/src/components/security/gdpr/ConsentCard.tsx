/**
 * Consent Card
 * Phase 2: Individual consent item display and toggle
 */

'use client';

import { ConsentRecord } from '@/types/security';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Label } from '@/components/ui/Label';
import { Info } from 'lucide-react';
import { format } from 'date-fns';

interface ConsentCardProps {
  consent: ConsentRecord;
  onChange: (consentId: string, consented: boolean) => Promise<void>;
}

export function ConsentCard({ consent, onChange }: ConsentCardProps) {
  const handleToggle = async (checked: boolean) => {
    if (consent.required && !checked) {
      return;
    }
    await onChange(consent.id, checked);
  };

  return (
    <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={consent.id} className="font-medium cursor-pointer">
            {consent.type.split('_').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ')}
          </Label>
          {consent.required && (
            <Badge variant="default">Required</Badge>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground">
          {consent.description}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Last updated: {format(new Date(consent.lastUpdated), 'PPp')}
          </span>
          {consent.source && (
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              Source: {consent.source}
            </span>
          )}
        </div>
      </div>

      <div className="ml-4">
        <Switch
          id={consent.id}
          checked={consent.consented}
          onCheckedChange={handleToggle}
          disabled={consent.required}
        />
      </div>
    </div>
  );
}

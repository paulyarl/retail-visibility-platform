/**
 * Consent Manager
 * Phase 2: Main consent management interface
 */

'use client';

import { useState, useMemo } from 'react';
import { useGDPR } from '@/hooks/useGDPR';
import { ConsentRecord, ConsentGroup } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConsentCard } from './ConsentCard';
import { ConsentHistory } from './ConsentHistory';
import { BulkConsentActions } from './BulkConsentActions';
import { Shield, History, Settings } from 'lucide-react';

export function ConsentManager() {
  const { consents, updateConsent, loading } = useGDPR();
  const [showHistory, setShowHistory] = useState(false);

  const groupedConsents = useMemo(() => {
    const groups: Record<string, ConsentGroup> = {
      essential: {
        category: 'Essential',
        description: 'Required for the platform to function properly',
        consents: [],
      },
      marketing: {
        category: 'Marketing & Communications',
        description: 'How we communicate with you about products and services',
        consents: [],
      },
      analytics: {
        category: 'Analytics & Performance',
        description: 'Help us understand how you use our platform',
        consents: [],
      },
      sharing: {
        category: 'Data Sharing',
        description: 'How we share your data with third parties',
        consents: [],
      },
    };

    consents.forEach((consent) => {
      if (consent.type === 'marketing') {
        groups.marketing.consents.push(consent);
      } else if (consent.type === 'analytics') {
        groups.analytics.consents.push(consent);
      } else if (consent.type === 'data_sharing' || consent.type === 'third_party') {
        groups.sharing.consents.push(consent);
      } else if (consent.type === 'data_processing') {
        groups.essential.consents.push(consent);
      } else {
        groups.analytics.consents.push(consent);
      }
    });

    return Object.values(groups).filter(group => group.consents.length > 0);
  }, [consents]);

  const handleConsentChange = async (consentId: string, consented: boolean) => {
    const consent = consents.find(c => c.id === consentId);
    if (!consent) return;

    try {
      await updateConsent({ type: consent.type, consented });
    } catch (error) {
      console.error('Failed to update consent:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Privacy & Consent
        </h2>
        <p className="text-muted-foreground mt-2">
          Manage your privacy preferences and data processing consents
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant={showHistory ? 'secondary' : 'ghost'}
          onClick={() => setShowHistory(!showHistory)}
        >
          <History className="h-4 w-4 mr-2" />
          {showHistory ? 'Hide History' : 'View History'}
        </Button>
      </div>

      {showHistory ? (
        <ConsentHistory />
      ) : (
        <>
          <BulkConsentActions consents={consents} />

          <div className="space-y-6">
            {groupedConsents.map((group) => (
              <Card key={group.category}>
                <CardHeader>
                  <CardTitle>{group.category}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.consents.map((consent) => (
                    <ConsentCard
                      key={consent.id}
                      consent={consent}
                      onChange={handleConsentChange}
                    />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {consents.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No consent preferences found</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

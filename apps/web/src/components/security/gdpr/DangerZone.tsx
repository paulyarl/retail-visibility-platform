/**
 * Danger Zone Component
 * Collapsible section for destructive account actions
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AccountDeletionModal } from './AccountDeletionModal';
import { ChevronDown, ChevronUp, AlertTriangle, Trash2 } from 'lucide-react';

export function DangerZone() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  return (
    <>
      <Card className="border-destructive/50 bg-destructive/5">
        <div 
          className="cursor-pointer hover:bg-destructive/10 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>
                    Irreversible and destructive actions
                  </CardDescription>
                </div>
              </div>
              <div className="text-destructive">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5" />
                ) : (
                  <ChevronDown className="h-5 w-5" />
                )}
              </div>
            </div>
          </CardHeader>
        </div>

        {isExpanded && (
          <CardContent className="space-y-4 border-t border-destructive/20 pt-6">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-destructive mb-1">
                      Delete Your Account
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>

                  <div className="rounded-lg bg-background/50 p-3 space-y-2">
                    <p className="text-sm font-medium">This will permanently delete:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Your profile and account information</li>
                      <li>• All your preferences and settings</li>
                      <li>• Your activity history and data</li>
                      <li>• All associated records and content</li>
                    </ul>
                  </div>

                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
                    <p className="text-sm font-medium text-yellow-600 mb-1">
                      30-Day Grace Period
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Your account will be scheduled for deletion in 30 days. You can cancel this request
                      at any time during this period by logging back in.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      This action requires password confirmation
                    </p>
                    <Button
                      variant="danger"
                      size="lg"
                      onClick={() => setShowDeleteModal(true)}
                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete My Account
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <AccountDeletionModal 
        open={showDeleteModal} 
        onOpenChange={setShowDeleteModal} 
      />
    </>
  );
}

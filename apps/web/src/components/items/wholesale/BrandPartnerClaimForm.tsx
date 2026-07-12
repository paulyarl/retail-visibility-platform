'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, Loader2, Send, ShieldCheck } from 'lucide-react';
import { brandPartnerService, BrandPartnerClaim } from '@/services/BrandPartnerService';

interface BrandPartnerClaimFormProps {
  gtin?: string;
  onSuccess?: (claimId: string) => void;
}

export function BrandPartnerClaimForm({ gtin: initialGtin, onSuccess }: BrandPartnerClaimFormProps) {
  const [brandName, setBrandName] = useState('');
  const [gtin, setGtin] = useState(initialGtin || '');
  const [claimType, setClaimType] = useState('verified');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingClaims, setExistingClaims] = useState<BrandPartnerClaim[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim() || !gtin.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await brandPartnerService.createClaim({
        brand_name: brandName.trim(),
        gtin: gtin.trim(),
        claim_type: claimType,
        contact_email: contactEmail.trim() || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit claim');
      }

      setSuccess(true);
      if (onSuccess && result.claim?.id) {
        onSuccess(result.claim.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  const checkExistingClaims = async () => {
    if (!gtin.trim()) return;
    try {
      const claims = await brandPartnerService.getClaimsByGtin(gtin.trim());
      setExistingClaims(claims);
    } catch {
      // silently ignore
    }
  };

  if (success) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-600 mb-3" />
          <h3 className="text-lg font-medium mb-2">Claim Submitted</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your brand partner claim for <strong>{gtin}</strong> has been submitted and is pending admin review.
            You'll be notified at {contactEmail || 'your registered email'} once approved.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setSuccess(false);
              setBrandName('');
              setContactEmail('');
            }}
          >
            Submit Another Claim
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Brand Partner Claim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="Brand Name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g., Acme Goods Co."
                required
                disabled={submitting}
              />
            </div>
            <div>
              <Input
                label="GTIN / Barcode"
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                placeholder="e.g., 00843154000127"
                required
                disabled={submitting || !!initialGtin}
                helperText="The product barcode this claim applies to"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Claim Type</label>
              <select
                value={claimType}
                onChange={(e) => setClaimType(e.target.value)}
                disabled={submitting}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-background text-sm"
              >
                <option value="verified">Verified (standard)</option>
                <option value="preferred">Preferred (requires approval)</option>
                <option value="exclusive">Exclusive (requires approval)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Hierarchy: exclusive &gt; preferred &gt; verified
              </p>
            </div>
            <div>
              <Input
                label="Contact Email (optional)"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="brand@acme.com"
                disabled={submitting}
                helperText="For approval notification"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" disabled={submitting || !brandName.trim() || !gtin.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Claim
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {existingClaims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Existing Claims for {gtin}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingClaims.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="font-medium">{c.brand_name}</span>
                  <span className="text-muted-foreground ml-2">({c.claim_type})</span>
                </div>
                <Badge variant={c.admin_approved ? 'default' : 'secondary'} className="text-xs">
                  {c.admin_approved ? 'Approved' : 'Pending'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

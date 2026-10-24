'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@mantine/core';
import directoryClaimPublicService from '@/services/DirectoryClaimPublicService';

/**
 * Claimant email-confirmation landing (migration 358). The emailed link
 * verifies the claimant's inbox and files the pending claim request for
 * operator review. On success we link back to the claim page (proof
 * upload + pending-review screen) via the returned claimToken.
 */
export default function VerifyClaimClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'already' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Verification link is missing or invalid.');
      setStatus('error');
      return;
    }

    const verify = async () => {
      const result = await directoryClaimPublicService.verifyClaimRequestEmail(token);
      if (result.claimToken) setClaimToken(result.claimToken);
      if (result.businessName) setBusinessName(result.businessName);

      if (result.success) {
        setStatus('success');
      } else if (result.error === 'token_already_verified') {
        setStatus('already');
      } else {
        setError(
          result.error === 'token_expired'
            ? 'This confirmation link has expired. Go back to your claim link and submit again to get a fresh one.'
            : result.error === 'token_not_found'
              ? 'This confirmation link is invalid.'
              : result.error === 'already_claimed'
                ? 'This listing has already been claimed.'
                : result.error === 'rate_limited'
                  ? 'Too many attempts — please wait a moment and try the link again.'
                  : 'We could not confirm your email. Please try again.'
        );
        setStatus('error');
      }
    };

    verify();
  }, [searchParams]);

  const claimHref = claimToken ? `/directory/claim/${claimToken}` : '/directory';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Confirming your email...
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">Please wait while we file your claim request.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Claim request submitted
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Thanks — your email is confirmed and your claim for{' '}
              <strong>{businessName || 'the listing'}</strong> is now in review.
              Our team will verify ownership, usually within 1–2 business days.
            </p>
            <div className="flex flex-col gap-2">
              <Button component={Link} href={claimHref} variant="light" fullWidth>
                Back to your claim — upload proof of ownership
              </Button>
              <Button component={Link} href="/directory" variant="subtle" fullWidth>
                Browse the directory
              </Button>
            </div>
          </>
        )}

        {status === 'already' && (
          <>
            <MailCheck className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Already confirmed
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              You&apos;ve already confirmed this email — your claim is in the review queue.
            </p>
            <div className="flex flex-col gap-2">
              <Button component={Link} href={claimHref} variant="light" fullWidth>
                View your claim status
              </Button>
              <Button component={Link} href="/directory" variant="subtle" fullWidth>
                Back to Directory
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Confirmation failed
            </h1>
            <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
            <div className="flex flex-col gap-2">
              <Button component={Link} href={claimHref} variant="light" fullWidth>
                Back to your claim
              </Button>
              <Button component={Link} href="/directory" variant="subtle" fullWidth>
                Back to Directory
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

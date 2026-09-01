'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@mantine/core';
import DirectorySubmissionPublicService from '@/services/DirectorySubmissionPublicService';

export default function VerifyBusinessClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [seedId, setSeedId] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Verification link is missing or invalid.');
      setStatus('error');
      return;
    }

    const verify = async () => {
      const result = await DirectorySubmissionPublicService.verifyToken(token);
      if (result.success && result.seedId) {
        setSeedId(result.seedId);
        setStatus('success');
      } else {
        setError(
          result.error === 'token_expired'
            ? 'This verification link has expired. Please submit the business again.'
            : result.error === 'token_not_found'
            ? 'This verification link is invalid.'
            : result.error === 'token_already_verified'
            ? 'This submission has already been verified.'
            : 'We could not verify your submission. Please try again.'
        );
        setStatus('error');
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center px-4">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Verifying your submission...
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">Please wait while we confirm your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Submission confirmed
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              Thank you. Your business has been submitted for review. Our team will verify and publish it.
            </p>
            <Button component={Link} href="/directory" variant="light">
              Browse the directory
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Verification failed
            </h1>
            <p className="text-red-700 dark:text-red-300 mb-6">{error}</p>
            <div className="flex flex-col gap-2">
              <Button component={Link} href="/directory/add-business" variant="light" fullWidth>
                Try again
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

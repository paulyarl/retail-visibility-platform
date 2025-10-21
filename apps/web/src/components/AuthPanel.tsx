"use client";

import { useState, useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { Button, Input, Alert } from '@/components/ui';

export default function AuthPanel() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    };
    run();
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setUserEmail(session?.user?.email ?? null);
      }
    );
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    setSuccess(false);
    // Use current origin for redirect, ensuring it's the production URL
    const redirectTo = typeof window !== 'undefined' 
      ? `${window.location.origin}/tenants`
      : undefined;
    const { error: authError } = await supabase.auth.signInWithOtp({ 
      email, 
      options: { emailRedirectTo: redirectTo } 
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSuccess(true);
      setEmail('');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="space-y-4">
      {userEmail ? (
        <div className="space-y-4">
          <Alert variant="success" title="Signed In">
            You are signed in as <strong>{userEmail}</strong>
          </Alert>
          <Button 
            onClick={() => window.location.href = '/tenants'} 
            variant="primary" 
            className="w-full"
          >
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Continue to Dashboard
          </Button>
          <Button onClick={signOut} variant="secondary" className="w-full">
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </Button>
        </div>
      ) : (
        <>
          {success && (
            <Alert variant="success" title="Check your email!" onClose={() => setSuccess(false)}>
              We've sent you a magic link. Click the link in your email to sign in.
            </Alert>
          )}
          
          {error && (
            <Alert variant="error" title="Error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          <form onSubmit={signIn} className="space-y-4">
            <Input
              type="email"
              placeholder="you@example.com"
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" disabled={loading} loading={loading} className="w-full">
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {loading ? 'Sending magic link…' : 'Send magic link'}
            </Button>
          </form>
          
          <div className="text-center">
            <p className="text-xs text-neutral-500">
              We'll email you a magic link for a password-free sign in
            </p>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export default function AuthPanel() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined } });
    setLoading(false);
    if (error) alert(error.message);
    else alert('Check your email for the magic link');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="border rounded p-4 space-y-3 max-w-md">
      <div className="text-sm opacity-70">Auth</div>
      {userEmail ? (
        <div className="space-y-2">
          <div className="text-sm">Signed in as <span className="font-medium">{userEmail}</span></div>
          <button onClick={signOut} className="px-3 py-2 text-sm rounded border hover:bg-gray-100">Sign out</button>
        </div>
      ) : (
        <form onSubmit={signIn} className="space-y-2">
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full px-3 py-2 border rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button disabled={loading} className="px-3 py-2 text-sm rounded border hover:bg-gray-100 disabled:opacity-60">
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
      <p className="text-xs opacity-70">
        For RLS by tenant, ensure your Supabase JWT includes a <code>tenant_id</code> claim (or adjust policies to read
        it from <code>user_metadata.tenant_id</code>).
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function Protected({ children, redirect = true }: { children: React.ReactNode; redirect?: boolean }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(session);
      setLoading(false);
      if (!session && redirect) {
        router.replace("/login");
      }
    };
    run();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, newSession) => {
      setSession(newSession);
      if (!newSession && redirect) router.replace("/login");
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [redirect, router]);

  if (loading) {
    return <div className="text-sm opacity-70">Checking session…</div>;
  }

  if (!session && !redirect) {
    return <div className="text-sm">You must be signed in to view this content.</div>;
  }

  return <>{children}</>;
}

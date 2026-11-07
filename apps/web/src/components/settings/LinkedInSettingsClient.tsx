'use client';

/**
 * LinkedInSettingsClient — tenant-side LinkedIn connect flow.
 * Status → Connect (OAuth) → org-page select → disconnect. The OAuth legs
 * run through /api/tenants/:tid/linkedin/* (tenant-auth twin of the portal
 * customer routes); the shared callback lands back here with ?connected=linkedin.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { contentHubService } from '@/services/ContentHubService';
import { clientLogger } from '@/lib/client-logger';

type Status = Awaited<ReturnType<typeof contentHubService.getLinkedInStatus>>;
type Org = { urn: string; name: string; role: string };

export default function LinkedInSettingsClient({ tenantId }: { tenantId: string }) {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get('connected') === 'linkedin';
  const oauthError = searchParams.get('error');

  const [status, setStatus] = useState<Status>(null);
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([
        contentHubService.getLinkedInStatus(tenantId),
        contentHubService.getLinkedInOrganizations(tenantId),
      ]);
      setStatus(s);
      setOrgs(o?.connected ? o.organizations : []);
    } catch (err) {
      clientLogger.error('[LinkedInSettings] load failed:', { error: String(err) });
      setError('Failed to load LinkedIn status');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    setBusy('connect');
    try {
      const url = await contentHubService.getLinkedInAuthorizeUrl(tenantId);
      if (url) window.location.href = url;
      else setError('Could not start LinkedIn connect');
    } finally {
      setBusy(null);
    }
  };

  const selectOrg = async (org: Org) => {
    setBusy(org.urn);
    try {
      const ok = await contentHubService.selectLinkedInSurface(tenantId, org.urn, org.name);
      if (ok) await load();
      else setError('Failed to connect that page');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (surfaceId: string) => {
    setBusy(surfaceId);
    try {
      const ok = await contentHubService.deleteLinkedInSurface(tenantId, surfaceId);
      if (ok) await load();
      else setError('Failed to disconnect');
    } finally {
      setBusy(null);
    }
  };

  const connectedRefs = new Set(status?.surfaces.map((s) => s.targetRef) ?? []);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900">LinkedIn</h1>
      <p className="text-sm text-gray-500 mt-1">Connect a company page to publish LinkedIn posts from Content.</p>

      {oauthError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          LinkedIn connect failed: {oauthError}
        </div>
      )}
      {justConnected && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          LinkedIn connected — select a company page below to start posting to it.
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-400">Loading…</p>
      ) : status && !status.entitled ? (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-600">LinkedIn posting isn't enabled for this tier.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {/* Connection */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Account</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {status?.connected
                    ? `Connected as ${status.memberName ?? 'LinkedIn member'}`
                    : 'No LinkedIn account connected'}
                </p>
                {(status?.tokenExpired || status?.reauthorizationRequired) && (
                  <p className="text-xs text-amber-600 mt-1">Token expired — reconnect to keep posting.</p>
                )}
              </div>
              <button
                type="button"
                onClick={connect}
                disabled={busy === 'connect'}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl px-4 py-2"
              >
                {busy === 'connect' ? 'Redirecting…' : status?.connected ? 'Reconnect' : 'Connect LinkedIn'}
              </button>
            </div>
          </div>

          {/* Connected company pages */}
          {status && status.surfaces.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Connected pages</h2>
              <ul className="divide-y divide-gray-100">
                {status.surfaces.map((s) => (
                  <li key={s.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-800">{s.displayName ?? s.targetRef}</p>
                      {s.memberRole && <p className="text-xs text-gray-400">{s.memberRole}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => disconnect(s.id)}
                      disabled={busy === s.id}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Disconnect
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Available org pages */}
          {status?.connected && orgs && orgs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">Company pages you administer</h2>
              <p className="text-xs text-gray-400 mb-3">Posts go to every page you connect.</p>
              <ul className="divide-y divide-gray-100">
                {orgs.map((org) => {
                  const connected = connectedRefs.has(org.urn);
                  return (
                    <li key={org.urn} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-800">{org.name}</p>
                        <p className="text-xs text-gray-400">{org.role}</p>
                      </div>
                      {connected ? (
                        <span className="text-xs text-green-600 font-medium">Connected</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectOrg(org)}
                          disabled={busy === org.urn}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Connect
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {status?.connected && orgs?.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm text-gray-600">
                No administered company pages found. Make the connected member an admin of your company page
                on LinkedIn, or the Community Management API scope may still be pending review.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

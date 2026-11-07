'use client';

/**
 * Social Posting Suite — customer portal composer.
 *
 * Spec: docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md §9
 * Platform profile card (per-surface connect state) + write-once→fan-out
 * composer + scheduled/published queue. Wraps /api/customer/marketing/social/*.
 */

import { useEffect, useState } from 'react';
import socialPostingService, { LinkedInOrganization, LinkedInSurface } from '@/services/SocialPostingService';
import { CheckCircle, Clock, Globe, Image, AtSign, Briefcase, Plus, RefreshCw, Trash2 } from 'lucide-react';

const SURFACES = [
  { platform: 'meta_facebook', surface: 'facebook_page', label: 'Facebook Page', icon: Globe },
  { platform: 'meta_instagram', surface: 'instagram', label: 'Instagram', icon: Image },
  { platform: 'meta_threads', surface: 'threads', label: 'Threads', icon: AtSign },
];

interface SurfaceState { id: string; targetRef: string; displayName: string | null; tokenExpired: boolean; }
interface Status {
  meta: { connected: boolean; reauthorizationRequired: boolean; scopesMissing: string[]; surfaces: Record<string, SurfaceState> };
  linkedin?: {
    connected: boolean;
    memberName: string | null;
    reauthorizationRequired: boolean;
    tokenExpired: boolean;
    surfaces: Record<string, LinkedInSurface>;
  };
}

export default function SocialPostingPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [linkedinSelected, setLinkedinSelected] = useState<Set<string>>(new Set());
  const [scheduledFor, setScheduledFor] = useState('');
  const [busy, setBusy] = useState(false);
  const [liOrgs, setLiOrgs] = useState<LinkedInOrganization[] | null>(null);
  const [liBusy, setLiBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        socialPostingService.getStatus(),
        socialPostingService.getPosts(),
      ]);
      setStatus(s);
      setPosts(p);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = (p: string) =>
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = async (immediate: boolean) => {
    setBusy(true);
    setError(null);
    try {
      for (const platform of selected) {
        try {
          await socialPostingService.createPost({
            platform,
            body,
            linkUrl: linkUrl || undefined,
            scheduledFor: !immediate && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
          });
        } catch (e: any) {
          setError(`${platform}: ${e.message || 'Publish failed'}`);
        }
      }
      // LinkedIn posts per connected organization page (member token is shared).
      for (const targetRef of linkedinSelected) {
        try {
          await socialPostingService.createPost({
            platform: 'linkedin',
            targetRef,
            body,
            linkUrl: linkUrl || undefined,
            scheduledFor: !immediate && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
          });
        } catch (e: any) {
          setError(`linkedin: ${e.message || 'Publish failed'}`);
        }
      }
      if (!error) { setBody(''); setLinkUrl(''); setScheduledFor(''); setSelected([]); setLinkedinSelected(new Set()); }
      await load();
    } finally {
      setBusy(false);
    }
  };

  const cancelPost = async (id: string) => {
    await socialPostingService.deletePost(id);
    await load();
  };

  const disconnectSurface = async (id: string) => {
    await socialPostingService.disconnectSurface(id);
    await load();
  };

  const connectLinkedIn = async () => {
    setLiBusy('authorize');
    try {
      const url = await socialPostingService.getLinkedInAuthorizeUrl();
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'LinkedIn connect failed');
      setLiBusy(null);
    }
  };

  const loadLinkedInOrgs = async () => {
    setLiBusy('orgs');
    try {
      const { organizations } = await socialPostingService.getLinkedInOrganizations();
      setLiOrgs(organizations);
    } catch (e: any) {
      setError(e.message || 'Failed to load LinkedIn organizations');
    } finally {
      setLiBusy(null);
    }
  };

  const connectLinkedInOrg = async (urn: string) => {
    setLiBusy(urn);
    try {
      await socialPostingService.selectLinkedInSurface(urn);
      setLiOrgs(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to connect organization page');
    } finally {
      setLiBusy(null);
    }
  };

  const disconnectLinkedInSurface = async (id: string) => {
    await socialPostingService.disconnectLinkedInSurface(id);
    await load();
  };

  const toggleLinkedIn = (urn: string) =>
    setLinkedinSelected((prev) => {
      const next = new Set(prev);
      if (next.has(urn)) next.delete(urn);
      else next.add(urn);
      return next;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const surfaces = status?.meta.surfaces ?? {};
  const linkedinSurfaces = Object.values(status?.linkedin?.surfaces ?? {});
  const canPost = selected.length > 0 || linkedinSelected.size > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Social Posting</h1>
        <p className="text-neutral-600 mt-1">Write once — publish to every connected social surface.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      )}

      {/* Platform profile */}
      <section className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="font-semibold text-neutral-900 mb-3">Meta platform profile</h2>
        {status?.meta.reauthorizationRequired && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
            Posting permissions are missing — reconnect Meta to grant them.
          </div>
        )}
        <div className="grid gap-2">
          {SURFACES.map(({ surface, label, icon: Icon }) => {
            const s = surfaces[surface];
            return (
              <div key={surface} className="flex items-center justify-between border border-neutral-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-medium">{label}</span>
                  {s && <span className="text-xs text-neutral-500">{s.displayName}</span>}
                </div>
                {s ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> connected</span>
                    <button onClick={() => disconnectSurface(s.id)} className="text-xs text-neutral-400 hover:text-red-500">disconnect</button>
                  </div>
                ) : (
                  <span className="text-xs text-neutral-400">not connected</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-neutral-500 mt-3">
          Surfaces connect through the Meta integrations settings page — Facebook Page and Instagram via the Meta connect flow, Threads via its own authorization leg.
        </p>
      </section>

      {/* LinkedIn platform profile */}
      <section className="bg-white border border-neutral-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-neutral-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4" /> LinkedIn company pages
          </h2>
          {status?.linkedin?.connected ? (
            <button onClick={loadLinkedInOrgs} disabled={liBusy === 'orgs'} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
              {liBusy === 'orgs' ? 'loading…' : 'choose pages'}
            </button>
          ) : (
            <button onClick={connectLinkedIn} disabled={liBusy === 'authorize'} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {liBusy === 'authorize' ? 'redirecting…' : 'Connect LinkedIn'}
            </button>
          )}
        </div>
        {status?.linkedin?.reauthorizationRequired && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
            LinkedIn authorization needs to be renewed — reconnect to keep posting.
          </div>
        )}
        {status?.linkedin?.tokenExpired && !status.linkedin.reauthorizationRequired && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
            The LinkedIn token has expired — the refresh job will renew it, or reconnect if posts start failing.
          </div>
        )}
        {status?.linkedin?.connected && (
          <div className="grid gap-2">
            {Object.values(status.linkedin.surfaces).map((s) => (
              <div key={s.id} className="flex items-center justify-between border border-neutral-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-medium">{s.displayName || s.targetRef}</span>
                  {s.memberRole && <span className="text-xs text-neutral-400">{s.memberRole.toLowerCase().replace(/_/g, ' ')}</span>}
                </div>
                <button onClick={() => disconnectLinkedInSurface(s.id)} className="text-xs text-neutral-400 hover:text-red-500">disconnect</button>
              </div>
            ))}
            {Object.keys(status.linkedin.surfaces).length === 0 && (
              <p className="text-sm text-neutral-500">No organization pages connected yet — use “choose pages” to pick the pages you administer.</p>
            )}
          </div>
        )}
        {!status?.linkedin?.connected && (
          <p className="text-sm text-neutral-500">
            Connect a LinkedIn member account, then pick the company pages it administers. Requires the Community Management API product on our LinkedIn app.
          </p>
        )}
        {liOrgs && liOrgs.length > 0 && (
          <div className="mt-3 border border-neutral-200 rounded-lg divide-y divide-neutral-100">
            {liOrgs.map((o) => {
              const connected = Object.values(status?.linkedin?.surfaces ?? {}).some((s) => s.targetRef === o.urn);
              return (
                <div key={o.urn} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{o.name}</p>
                    <p className="text-xs text-neutral-400">{o.role.toLowerCase().replace(/_/g, ' ')}</p>
                  </div>
                  {connected ? (
                    <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> connected</span>
                  ) : (
                    <button onClick={() => connectLinkedInOrg(o.urn)} disabled={liBusy === o.urn} className="text-xs px-3 py-1 border border-blue-600 text-blue-600 rounded-lg disabled:opacity-50">
                      {liBusy === o.urn ? 'connecting…' : 'connect'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {liOrgs && liOrgs.length === 0 && (
          <p className="text-sm text-neutral-500 mt-3">No administrable organization pages found for this LinkedIn member.</p>
        )}
      </section>

      {/* Composer */}
      <section className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-neutral-900">Compose</h2>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="What's new at your business?"
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
        />
        <input
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Link URL (optional)"
          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {SURFACES.map(({ platform, label }) => {
            const connected = !!surfaces[SURFACES.find((s) => s.platform === platform)!.surface];
            const active = selected.includes(platform);
            return (
              <button
                key={platform}
                disabled={!connected}
                onClick={() => toggle(platform)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${active ? 'bg-blue-600 text-white border-blue-600' : connected ? 'border-neutral-300 text-neutral-700 hover:bg-neutral-50' : 'border-neutral-200 text-neutral-300 cursor-not-allowed'}`}
              >
                {label}
              </button>
            );
          })}
          {linkedinSurfaces.map((s) => {
            const active = linkedinSelected.has(s.targetRef);
            return (
              <button
                key={s.id}
                onClick={() => toggleLinkedIn(s.targetRef)}
                className={`px-3 py-1.5 rounded-lg text-sm border inline-flex items-center gap-1.5 ${active ? 'bg-blue-600 text-white border-blue-600' : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}`}
              >
                <Briefcase className="w-3.5 h-3.5" /> {s.displayName || 'LinkedIn page'}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm"
          />
          <button
            onClick={() => submit(true)}
            disabled={busy || !body.trim() || !canPost}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Publish now
          </button>
          <button
            onClick={() => submit(false)}
            disabled={busy || !body.trim() || !canPost || !scheduledFor}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-blue-600 text-sm rounded-lg disabled:opacity-50"
          >
            <Clock className="w-4 h-4" /> Schedule
          </button>
          <button onClick={load} className="ml-auto text-neutral-400 hover:text-neutral-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </section>

      {/* Queue */}
      <section className="bg-white border border-neutral-200 rounded-xl p-5">
        <h2 className="font-semibold text-neutral-900 mb-3">Posts</h2>
        {posts.length === 0 && <p className="text-sm text-neutral-500">No posts yet.</p>}
        <div className="divide-y divide-neutral-100">
          {posts.map((p) => (
            <div key={p.id} className="py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="font-medium">{p.platform}</span>
                  <span>·</span>
                  <span className={p.status === 'PUBLISHED' ? 'text-emerald-600' : p.status === 'FAILED' ? 'text-red-600' : 'text-amber-600'}>{p.status}</span>
                  {p.scheduled_for && <span>· {new Date(p.scheduled_for).toLocaleString()}</span>}
                </div>
                <p className="text-sm text-neutral-800 mt-1 truncate">{p.body}</p>
                {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="text-xs text-blue-600">view post</a>}
                {p.last_error && <p className="text-xs text-red-500 mt-1">{p.last_error}</p>}
              </div>
              {(p.status === 'SCHEDULED' || p.status === 'DRAFT') && (
                <button onClick={() => cancelPost(p.id)} className="text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Loader2, CheckCircle, AlertCircle, Globe, ExternalLink, RefreshCw, Clock, Copy } from 'lucide-react';
import { tenantInfoService } from '@/services/TenantInfoService';
import { useEffectiveStorefrontDomains } from '@/hooks/useEffectiveCapabilities';
import { useEffectiveTenantFlags } from '@/hooks/useEffectiveFlags';
import { clientLogger } from '@/lib/client-logger';

interface CustomDomainSettingsProps {
  tenantId: string;
}

interface CustomDomain {
  id: string;
  domain: string;
  status: string;
  attachedHosts: string[];
  verificationToken: string | null;
  verificationError: string | null;
  certificateError: string | null;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; className: string; hint: string }> = {
  pending_verification: {
    label: 'Awaiting DNS',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    hint: 'Add the DNS records below at your registrar, then click Check status.',
  },
  verified: {
    label: 'Verified — securing certificate',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    hint: 'DNS verified. HTTPS certificate is being issued — this usually takes a few minutes.',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    hint: 'Your storefront is live on this domain.',
  },
  error: {
    label: 'Needs attention',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    hint: 'Something went wrong — check the message below and try Check status again.',
  },
  disabled: {
    label: 'Disabled',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    hint: 'This domain is disabled on your current plan.',
  },
};

function DnsRecordRow({ type, name, value }: { type: string; name: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <tr className="border-t border-gray-200 dark:border-gray-700">
      <td className="py-2 pr-3 font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">{type}</td>
      <td className="py-2 pr-3 font-mono text-xs text-gray-700 dark:text-gray-300">{name}</td>
      <td className="py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
        <span className="inline-flex items-center gap-1">
          {value}
          <button
            type="button"
            aria-label={`Copy ${type} value`}
            onClick={() => {
              navigator.clipboard?.writeText(value).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            {copied ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </button>
        </span>
      </td>
    </tr>
  );
}

export default function CustomDomainSettings({ tenantId }: CustomDomainSettingsProps) {
  const { data: storefrontDomains, isLoading: capsLoading } = useEffectiveStorefrontDomains(tenantId);
  const { data: tenantFlags } = useEffectiveTenantFlags(tenantId);
  // Tenant-scoped payload: the tenant's decision is tenantEffectiveOn;
  // effectiveOn is the platform-level state (misleading in beta posture).
  const customDomainsFlag = tenantFlags?.['custom_domains'];
  const flagOn = customDomainsFlag?.tenantEffectiveOn ?? customDomainsFlag?.effectiveOn ?? false;
  const entitled = storefrontDomains?.customDomainEnabled ?? false;

  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [domainKind, setDomainKind] = useState<'subdomain' | 'apex'>('subdomain');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // The list route is entitlement/flag-agnostic (checkTenantAccess only) —
  // always fetch so an admin-attached domain stays visible even when the
  // rollout flag or capability gate is off.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tenantInfoService.listCustomDomains(tenantId);
      setDomains(data?.domains ?? []);
    } catch (e) {
      clientLogger.error('Failed to load custom domains:', { detail: e });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const addDomain = async () => {
    const value = newDomain.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await tenantInfoService.addCustomDomain(tenantId, value, domainKind === 'apex');
      setNewDomain('');
      setSuccess('Domain added. Configure the DNS records below, then click Check status.');
      await load();
    } catch (e: any) {
      const msg = e?.message || 'Failed to add domain';
      setError(
        /taken/i.test(msg)
          ? 'That domain is already connected to another storefront.'
          : /included in your plan|not enabled/i.test(msg)
            ? msg
            : msg,
      );
    } finally {
      setBusy(false);
    }
  };

  const checkDomain = async (domainId: string) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const data = await tenantInfoService.checkCustomDomain(tenantId, domainId);
      const status = data?.domain?.status;
      setSuccess(
        status === 'active'
          ? 'Domain is live!'
          : status === 'verified'
            ? 'DNS verified — certificate is being issued. Check again in a few minutes.'
            : 'Not ready yet — confirm the DNS records below are saved at your registrar.',
      );
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to check domain status');
    } finally {
      setBusy(false);
    }
  };

  const removeDomain = async (domain: CustomDomain) => {
    if (!confirm(`Remove ${domain.domain}? Your storefront will keep working on its platform URL.`)) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await tenantInfoService.removeCustomDomain(tenantId, domain.id);
      setSuccess('Domain removed.');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to remove domain');
    } finally {
      setBusy(false);
    }
  };

  const liveDomain = domains.find((d) => d.status !== 'disabled') ?? domains[0];
  const hasDomain = domains.length > 0;

  // A domain already attached (incl. DFY-attached by a platform admin) is
  // always shown — the rollout flag only gates NEW attaches, never
  // visibility or management of an existing domain.
  // Not entitled + no domain → upsell (capability-authoritative per D12, not a tier-name check)
  if (!capsLoading && !loading && !hasDomain && !entitled) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Globe className="h-5 w-5" />
            Your Own Domain
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Put your storefront on a domain you own — like shop.mybrand.com or mybrand.com.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Custom domains are available on Professional and Organization plans. Your storefront keeps
            working on its current address either way.
          </p>
          <Link
            href={`/t/${tenantId}/settings/billing`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            View plans
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Entitled but the platform flag (beta rollout) is off for this tenant,
  // and nothing is attached yet
  if (!loading && !hasDomain && entitled && !flagOn) {
    return (
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Globe className="h-5 w-5" />
            Your Own Domain
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Custom domains are rolling out gradually and aren&apos;t enabled for your account yet. Contact support to join the early access group.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isApexSetup = liveDomain ? liveDomain.attachedHosts.length > 1 : domainKind === 'apex';

  return (
    <Card className="dark:bg-gray-800 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
          <Globe className="h-5 w-5" />
          Your Own Domain
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-300">
          Serve your storefront on a domain you own. You&apos;ll add two records at your registrar —
          we handle everything else.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 dark:bg-gray-800">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading domain…
          </div>
        ) : liveDomain ? (
          <div className="space-y-4">
            {/* Status row */}
            <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-neutral-700 rounded-lg bg-gray-50 dark:bg-neutral-800/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-neutral-100">{liveDomain.domain}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_META[liveDomain.status]?.className ?? ''}`}>
                    {STATUS_META[liveDomain.status]?.label ?? liveDomain.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-neutral-400">
                  {STATUS_META[liveDomain.status]?.hint}
                </p>
                {liveDomain.status === 'active' && (
                  <a
                    href={`https://${liveDomain.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Visit your storefront
                  </a>
                )}
                {(liveDomain.verificationError || liveDomain.certificateError) && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {liveDomain.verificationError || liveDomain.certificateError}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => checkDomain(liveDomain.id)} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Check status
                </Button>
                <button
                  onClick={() => removeDomain(liveDomain)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg transition-colors border border-red-200 dark:border-red-800"
                >
                  Remove
                </button>
              </div>
            </div>

            {/* DNS instruction card — only while the domain is still being set up */}
            {liveDomain.status !== 'active' && liveDomain.status !== 'disabled' && (
              <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20 space-y-3">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Add these records at your domain registrar
                </h4>
                <table className="w-full">
                  <tbody>
                    {isApexSetup ? (
                      <>
                        <DnsRecordRow type="A" name="@" value="76.76.21.21" />
                        <DnsRecordRow type="CNAME" name="www" value="cname.vercel-dns.com" />
                      </>
                    ) : (
                      <DnsRecordRow type="CNAME" name={liveDomain.domain.split('.')[0]} value="cname.vercel-dns.com" />
                    )}
                    {liveDomain.verificationToken && (
                      <DnsRecordRow type="TXT" name="_vercel" value={liveDomain.verificationToken} />
                    )}
                  </tbody>
                </table>
                <p className="text-xs text-blue-800 dark:text-blue-200 flex items-start gap-1">
                  <Clock className="h-3 w-3 mt-0.5 shrink-0" />
                  DNS changes can take up to 48 hours to propagate, but usually complete within minutes.
                  We re-check automatically — or click Check status after saving.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* No domain yet — the add form */
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-white">Domain</label>
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder={domainKind === 'apex' ? 'mybrand.com' : 'shop.mybrand.com'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-white">What kind of domain is this?</label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="domainKind"
                    checked={domainKind === 'subdomain'}
                    onChange={() => setDomainKind('subdomain')}
                    className="mt-1"
                  />
                  <span>
                    <strong>A subdomain</strong> like <code className="font-mono text-xs">shop.mybrand.com</code> or{' '}
                    <code className="font-mono text-xs">www.mybrand.com</code> — easiest setup, just one CNAME record.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="domainKind"
                    checked={domainKind === 'apex'}
                    onChange={() => setDomainKind('apex')}
                    className="mt-1"
                  />
                  <span>
                    <strong>Your root domain</strong> like <code className="font-mono text-xs">mybrand.com</code> —
                    needs an A or ALIAS record (we also set up the www version for you).
                  </span>
                </label>
              </div>
            </div>

            <Button onClick={addDomain} disabled={!newDomain.trim() || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add domain
            </Button>
          </div>
        )}

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Your platform address keeps working — your custom domain becomes the primary address once it&apos;s live.
          One domain per storefront.
        </p>
      </CardContent>
    </Card>
  );
}

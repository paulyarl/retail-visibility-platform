"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Button, TextInput, Select, Badge, Table, Modal, Group, Text, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import PageHeader from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import {
  demoTenantAdminService,
  DemoTenant,
  DemoTemplate,
} from '@/services/DemoTenantAdminService';
import { QrCode, Download, BarChart3, ExternalLink, RefreshCw, ArrowRightLeft, Crown } from 'lucide-react';
import { manualBillingService } from '@/services/ManualBillingService';
import { clientLogger } from '@/lib/client-logger';

export default function DemoTenantsAdminPage() {
  const [mounted, setMounted] = useState(false);
  const { hasAccess, loading: accessLoading } = useAccessControl(
    null,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const [tenants, setTenants] = useState<DemoTenant[]>([]);
  const [templates, setTemplates] = useState<DemoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeExpired, setIncludeExpired] = useState(false);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [businessName, setBusinessName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [creating, setCreating] = useState(false);

  // Convert modal state
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertTenantId, setConvertTenantId] = useState('');
  const [convertTemplate, setConvertTemplate] = useState('');
  const [convertExpiryDays, setConvertExpiryDays] = useState('30');
  const [converting, setConverting] = useState(false);
  const [convertTenants, setConvertTenants] = useState<{ id: string; name: string }[]>([]);
  const [convertTenantsLoading, setConvertTenantsLoading] = useState(false);

  // QR modal state
  const [qrOpen, setQrOpen] = useState(false);
  const [qrTenant, setQrTenant] = useState<DemoTenant | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [qrAnalytics, setQrAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Tier change modal state
  const [tierOpen, setTierOpen] = useState(false);
  const [tierTenant, setTierTenant] = useState<DemoTenant | null>(null);
  const [tierValue, setTierValue] = useState('');
  const [changingTier, setChangingTier] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !hasAccess) return;
    fetchData();
  }, [mounted, hasAccess, includeExpired]);

  useEffect(() => {
    if (!convertOpen) return;
    async function loadConvertTenants() {
      setConvertTenantsLoading(true);
      try {
        const tenantsArray = await manualBillingService.getAllTenants();
        setConvertTenants((tenantsArray || []).map((t: any) => ({ id: t.id, name: t.name })));
      } catch (error: any) {
        clientLogger.error('Failed to load tenants for conversion:', { detail: error });
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to load tenants',
          color: 'red',
        });
      } finally {
        setConvertTenantsLoading(false);
      }
    }
    loadConvertTenants();
  }, [convertOpen]);

  async function fetchData() {
    setLoading(true);
    try {
      const [tenantsResult, templatesResult] = await Promise.all([
        demoTenantAdminService.listDemoTenants(includeExpired),
        demoTenantAdminService.getTemplates(),
      ]);
      if (tenantsResult && Array.isArray(tenantsResult)) {
        setTenants(tenantsResult);
      }
      if (templatesResult && Array.isArray(templatesResult)) {
        setTemplates(templatesResult);
      }
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to load demo tenants',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!selectedTemplate) {
      notifications.show({ title: 'Validation', message: 'Select a template', color: 'orange' });
      return;
    }
    setCreating(true);
    try {
      const result = await demoTenantAdminService.createDemoTenant({
        template: selectedTemplate,
        businessName: businessName || undefined,
        subdomain: subdomain || undefined,
      });
      if (result) {
        notifications.show({
          title: 'Demo Tenant Created',
          message: `${result.name} — ${result.productsCreated} products seeded`,
          color: 'green',
        });
        setCreateOpen(false);
        setSelectedTemplate('');
        setBusinessName('');
        setSubdomain('');
        fetchData();
      }
    } catch (error: any) {
      notifications.show({
        title: 'Creation Failed',
        message: error.message,
        color: 'red',
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleExpire(id: string) {
    if (!confirm('Expire this demo tenant? It will be marked as closed but data is preserved.')) return;
    try {
      const result = await demoTenantAdminService.expireDemoTenant(id);
      if (result?.expired) {
        notifications.show({ title: 'Expired', message: result.reason, color: 'blue' });
        fetchData();
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleRevokeDemo(id: string) {
    if (!confirm('Revoke demo status from this tenant? It will become a regular tenant again.')) return;
    try {
      const result = await demoTenantAdminService.revokeDemoStatus(id);
      if (result?.revoked) {
        notifications.show({ title: 'Demo Status Revoked', message: result.reason, color: 'blue' });
        fetchData();
      } else {
        notifications.show({ title: 'Error', message: result?.reason || 'Failed to revoke demo status', color: 'red' });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  async function handleChangeTier() {
    if (!tierTenant || !tierValue) {
      notifications.show({ title: 'Validation', message: 'Select a tier', color: 'orange' });
      return;
    }
    setChangingTier(true);
    try {
      const result = await demoTenantAdminService.changeDemoTenantTier(tierTenant.id, tierValue);
      if (result?.changed) {
        notifications.show({
          title: 'Tier Changed',
          message: result.reason,
          color: 'green',
        });
        setTierOpen(false);
        setTierTenant(null);
        setTierValue('');
        fetchData();
      } else {
        notifications.show({ title: 'Tier Change Failed', message: result?.reason || 'Failed to change tier', color: 'red' });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setChangingTier(false);
    }
  }

  async function handleConvert() {
    if (!convertTenantId.trim()) {
      notifications.show({ title: 'Validation', message: 'Tenant ID is required', color: 'orange' });
      return;
    }
    setConverting(true);
    try {
      const expiresAt = convertExpiryDays
        ? new Date(Date.now() + parseInt(convertExpiryDays) * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      const result = await demoTenantAdminService.convertToDemoTenant({
        tenantId: convertTenantId.trim(),
        template: convertTemplate || undefined,
        expiresAt,
      });
      if (result?.converted) {
        notifications.show({
          title: 'Converted to Demo',
          message: result.reason,
          color: 'green',
        });
        setConvertOpen(false);
        setConvertTenantId('');
        setConvertTemplate('');
        setConvertExpiryDays('30');
        fetchData();
      } else {
        notifications.show({ title: 'Conversion Failed', message: result?.reason || 'Failed to convert', color: 'red' });
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    } finally {
      setConverting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Permanently delete this demo tenant and ALL its data? This cannot be undone.')) return;
    try {
      const result = await demoTenantAdminService.deleteDemoTenant(id);
      if (result?.deleted) {
        notifications.show({
          title: 'Deleted',
          message: `Removed ${result.productsDeleted} products`,
          color: 'red',
        });
        fetchData();
      }
    } catch (error: any) {
      notifications.show({ title: 'Error', message: error.message, color: 'red' });
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function isExpired(dateStr: string | null): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  function getQrUrl(tenant: DemoTenant): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://visibleshelf.com';
    return `${origin}/qr/${tenant.id}`;
  }

  async function handleOpenQR(tenant: DemoTenant) {
    setQrTenant(tenant);
    setQrOpen(true);
    setQrDataUrl(null);
    setQrAnalytics(null);
    await generateQRCode(tenant);
    await fetchQRAnalytics(tenant.id);
  }

  async function generateQRCode(tenant: DemoTenant) {
    try {
      setQrGenerating(true);
      const QRCode = (await import('qrcode')).default;
      const url = getQrUrl(tenant);
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      await QRCode.toCanvas(canvas, url, {
        width: 512,
        margin: 3,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(canvas.toDataURL('image/png', 1.0));
    } catch (err) {
      clientLogger.error('Failed to generate QR code:', { detail: err });
      notifications.show({ title: 'Error', message: 'Failed to generate QR code', color: 'red' });
    } finally {
      setQrGenerating(false);
    }
  }

  async function downloadQRCode(size: number) {
    if (!qrTenant) return;
    try {
      setQrGenerating(true);
      const QRCode = (await import('qrcode')).default;
      const url = getQrUrl(qrTenant);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      await QRCode.toCanvas(canvas, url, {
        width: size,
        margin: 3,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      });
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-${qrTenant.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${size}px.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      clientLogger.error('Failed to download QR code:', { detail: err });
    } finally {
      setQrGenerating(false);
    }
  }

  async function downloadPrintableCard() {
    if (!qrTenant || !qrDataUrl) return;
    try {
      setQrGenerating(true);
      // Create a printable card with QR code and tenant info
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // A4-ish proportions at 150 DPI (595 x 842 pixels)
      canvas.width = 595;
      canvas.height = 842;

      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 595, 842);

      // Border
      ctx.strokeStyle = '#E5E5E5';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, 555, 802);

      // Title
      ctx.fillStyle = '#1A1A1A';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(qrTenant.name, 297, 80);

      // Subtitle
      ctx.fillStyle = '#666666';
      ctx.font = '16px sans-serif';
      ctx.fillText('Scan to visit our demo store', 297, 110);

      // QR Code (centered, 350x350)
      const qrImg = new Image();
      qrImg.onload = () => {
        ctx.drawImage(qrImg, 122, 150, 350, 350);

        // URL below QR
        ctx.fillStyle = '#999999';
        ctx.font = '12px monospace';
        ctx.fillText(getQrUrl(qrTenant), 297, 530);

        // Demo badge
        ctx.fillStyle = '#7C3AED';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('DEMO STORE', 297, 570);

        // Expiry
        if (qrTenant.demo_expires_at) {
          ctx.fillStyle = '#666666';
          ctx.font = '12px sans-serif';
          ctx.fillText(`Expires: ${new Date(qrTenant.demo_expires_at).toLocaleDateString()}`, 297, 595);
        }

        // Footer
        ctx.fillStyle = '#CCCCCC';
        ctx.font = '11px sans-serif';
        ctx.fillText('Powered by VisibleShelf', 297, 800);

        // Download
        const dataUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `qr-card-${qrTenant.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setQrGenerating(false);
      };
      qrImg.src = qrDataUrl;
    } catch (err) {
      clientLogger.error('Failed to generate printable card:', { detail: err });
      setQrGenerating(false);
    }
  }

  async function fetchQRAnalytics(tenantId: string) {
    try {
      setLoadingAnalytics(true);
      const data = await demoTenantAdminService.getQRAnalytics(tenantId);
      setQrAnalytics(data);
    } catch (err) {
      clientLogger.error('Failed to fetch QR analytics:', { detail: err });
    } finally {
      setLoadingAnalytics(false);
    }
  }

  if (!mounted || accessLoading) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  const rows = tenants.map((t) => (
    <Table.Tr key={t.id}>
      <Table.Td>{t.name}</Table.Td>
      <Table.Td>
        <Badge variant="light" color="grape">{t.demo_template || '—'}</Badge>
      </Table.Td>
      <Table.Td>{t.subdomain || t.slug || '—'}</Table.Td>
      <Table.Td>
        {isExpired(t.demo_expires_at) ? (
          <Badge color="red">Expired</Badge>
        ) : t.location_status === 'closed' ? (
          <Badge color="gray">Closed</Badge>
        ) : (
          <Badge color="green">Active</Badge>
        )}
      </Table.Td>
      <Table.Td>{formatDate(t.demo_expires_at)}</Table.Td>
      <Table.Td>{formatDate(t.created_at)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Button size="xs" variant="light" color="indigo" onClick={() => handleOpenQR(t)} leftSection={<QrCode size={14} />}>
            QR
          </Button>
          {t.location_status === 'active' && (
            <Button size="xs" variant="light" color="orange" onClick={() => handleExpire(t.id)}>
              Expire
            </Button>
          )}
          <Button size="xs" variant="light" color="grape" onClick={() => handleRevokeDemo(t.id)} leftSection={<RefreshCw size={14} />}>
            Revoke Demo
          </Button>
          <Button size="xs" variant="light" color="amber" onClick={() => { setTierTenant(t); setTierValue(''); setTierOpen(true); }} leftSection={<Crown size={14} />}>
            Change Tier
          </Button>
          <Button size="xs" variant="light" color="red" onClick={() => handleDelete(t.id)}>
            Delete
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px' }}>
      <PageHeader
        title="Demo Tenants"
        description="Create and manage demo tenants with pre-populated data for sales demos"
        actions={
          <Group>
            <Button
              variant="light"
              size="sm"
              onClick={() => setIncludeExpired(!includeExpired)}
            >
              {includeExpired ? 'Hide Expired' : 'Show Expired'}
            </Button>
            <Button variant="light" leftSection={<ArrowRightLeft size={16} />} onClick={() => setConvertOpen(true)}>
              Convert Existing Tenant
            </Button>
            <Button onClick={() => setCreateOpen(true)}>Create Demo Tenant</Button>
          </Group>
        }
      />

      <div style={{ marginTop: '1rem' }}>
      <Card>
        <CardHeader>
          <CardTitle>Demo Tenants ({tenants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Text>Loading...</Text>
          ) : tenants.length === 0 ? (
            <Text color="dimmed">No demo tenants found. Create one to get started.</Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Template</Table.Th>
                  <Table.Th>Subdomain/Slug</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>

      <Modal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Demo Tenant"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Template"
            placeholder="Select a template"
            data={templates.map((t) => ({
              value: t.key,
              label: `${t.name} (${t.productCount} products)`,
            }))}
            value={selectedTemplate}
            onChange={(val) => setSelectedTemplate(val || '')}
          />
          <TextInput
            label="Business Name (optional)"
            placeholder="Defaults to template name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
          <TextInput
            label="Subdomain (optional)"
            placeholder="e.g. demo-grocery"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Convert Existing Tenant Modal */}
      <Modal
        opened={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Convert Existing Tenant to Demo"
        size="md"
      >
        <Stack gap="md">
          <Select
            label="Tenant"
            placeholder="Select tenant"
            data={convertTenants.map((t) => ({ value: t.id, label: t.name }))}
            value={convertTenantId}
            onChange={(val) => setConvertTenantId(val || '')}
            searchable
            required
            disabled={convertTenantsLoading}
            nothingFoundMessage="No tenants found"
          />
          <Select
            label="Template (optional)"
            placeholder="No template — keep existing data"
            data={templates.map((t) => ({ value: t.key, label: t.name }))}
            value={convertTemplate}
            onChange={(val) => setConvertTemplate(val || '')}
          />
          <TextInput
            label="Expiry (days from now)"
            placeholder="30"
            value={convertExpiryDays}
            onChange={(e) => setConvertExpiryDays(e.target.value)}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setConvertOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvert} loading={converting}>
              Convert to Demo
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Tier Change Modal */}
      <Modal
        opened={tierOpen}
        onClose={() => setTierOpen(false)}
        title={
          <Group gap="xs">
            <Crown size={20} />
            <span>Change Tier — {tierTenant?.name}</span>
          </Group>
        }
        size="sm"
      >
        <Stack gap="md">
          <Select
            label="New Tier"
            placeholder="Select a tier"
            data={[
              { value: 'discovery', label: 'Discovery ($29/mo)' },
              { value: 'storefront', label: 'Storefront ($59/mo)' },
              { value: 'commitment', label: 'Commitment ($79/mo)' },
              { value: 'ecommerce', label: 'E-Commerce ($99/mo)' },
              { value: 'omnichannel', label: 'Omnichannel ($149/mo)' },
              { value: 'professional', label: 'Professional ($199/mo)' },
              { value: 'chain_starter', label: 'Chain Starter ($299/mo)' },
              { value: 'chain_professional', label: 'Chain Professional ($399/mo)' },
              { value: 'enterprise', label: 'Enterprise ($499/mo)' },
              { value: 'organization', label: 'Organization ($499/mo)' },
            ]}
            value={tierValue}
            onChange={(val) => setTierValue(val || '')}
            required
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setTierOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeTier} loading={changingTier}>
              Change Tier
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        opened={qrOpen}
        onClose={() => setQrOpen(false)}
        title={
          <Group gap="xs">
            <QrCode size={20} />
            <span>QR Code — {qrTenant?.name}</span>
          </Group>
        }
        size="lg"
      >
        <Stack gap="md">
          {/* QR Code Display */}
          <div className="flex flex-col items-center py-4">
            {qrGenerating ? (
              <div className="w-64 h-64 bg-neutral-100 dark:bg-neutral-700 rounded-lg animate-pulse" />
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="rounded-lg border border-neutral-200 dark:border-neutral-700"
                style={{ width: 256, height: 256 }}
              />
            ) : (
              <div className="w-64 h-64 bg-neutral-100 dark:bg-neutral-700 rounded-lg flex items-center justify-center text-neutral-400">
                No QR Code
              </div>
            )}
            <Text size="xs" c="dimmed" ta="center" mt="xs">
              {qrTenant ? getQrUrl(qrTenant) : ''}
            </Text>
          </div>

          {/* Download buttons */}
          <Group justify="center" gap="xs">
            <Button size="xs" variant="light" leftSection={<Download size={14} />} onClick={() => downloadQRCode(512)} loading={qrGenerating}>
              512px
            </Button>
            <Button size="xs" variant="light" leftSection={<Download size={14} />} onClick={() => downloadQRCode(1024)} loading={qrGenerating}>
              1024px
            </Button>
            <Button size="xs" variant="light" leftSection={<Download size={14} />} onClick={() => downloadQRCode(2048)} loading={qrGenerating}>
              2048px
            </Button>
            <Button size="xs" variant="filled" color="indigo" leftSection={<Download size={14} />} onClick={downloadPrintableCard} loading={qrGenerating}>
              Printable Card
            </Button>
          </Group>

          {/* Open QR landing page */}
          <Button
            variant="subtle"
            size="xs"
            leftSection={<ExternalLink size={14} />}
            onClick={() => qrTenant && window.open(getQrUrl(qrTenant), '_blank')}
          >
            Open QR Landing Page
          </Button>

          {/* QR Analytics */}
          <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
            <Group gap="xs" mb="sm">
              <BarChart3 size={18} />
              <Text fw={600} size="sm">Scan Analytics</Text>
            </Group>
            {loadingAnalytics ? (
              <Text size="sm" c="dimmed">Loading analytics...</Text>
            ) : qrAnalytics ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-center">
                    <Text fw={700} size="xl">{qrAnalytics.stats?.total_scans || 0}</Text>
                    <Text size="xs" c="dimmed">Total Scans</Text>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                    <Text fw={700} size="xl" c="blue">{qrAnalytics.stats?.scans_24h || 0}</Text>
                    <Text size="xs" c="dimmed">24h</Text>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                    <Text fw={700} size="xl" c="green">{qrAnalytics.stats?.scans_7d || 0}</Text>
                    <Text size="xs" c="dimmed">7 days</Text>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                    <Text fw={700} size="xl" c="purple">{qrAnalytics.stats?.scans_30d || 0}</Text>
                    <Text size="xs" c="dimmed">30 days</Text>
                  </div>
                </div>
                {(qrAnalytics.stats?.last_scan_at) && (
                  <Text size="xs" c="dimmed" ta="center">
                    Last scan: {new Date(qrAnalytics.stats.last_scan_at).toLocaleString()}
                  </Text>
                )}
                {qrAnalytics.recentScans && qrAnalytics.recentScans.length > 0 && (
                  <div className="max-h-48 overflow-y-auto">
                    <Text size="xs" fw={600} c="dimmed" mb="xs">Recent Scans</Text>
                    {qrAnalytics.recentScans.slice(0, 10).map((scan: any) => (
                      <div key={scan.id} className="flex items-center justify-between py-1 text-xs border-b border-neutral-100 dark:border-neutral-800">
                        <span className="text-neutral-600 dark:text-neutral-400">{scan.source}</span>
                        <span className="text-neutral-400">{new Date(scan.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Text size="sm" c="dimmed">No scan data yet.</Text>
            )}
          </div>
        </Stack>
      </Modal>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GBPCategoryCard from '@/components/settings/GBPCategoryCard';
import { Container, Title, Text, Stack, Group, Breadcrumbs, Anchor, Alert, Card, Grid, Loader } from '@mantine/core';
import { gbpCategoryService } from '@/services/GBPCategoryService';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { IconInfoCircle, IconCheck, IconRocket, IconTarget, IconLink, IconAlertTriangle, IconBulb } from '@tabler/icons-react';
import { clientLogger } from '@/lib/client-logger';


export default function GBPCategoryPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Centralized access control - Platform Support or Tenant Admin
  const { hasAccess, loading: accessLoading, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profileData = await gbpCategoryService.getTenantGBPCategoryProfile(tenantId);
        setProfile(profileData);
      } catch (error) {
        clientLogger.error('[GBPCategoryPage] Failed to load profile:', { detail: error });
      } finally {
        setLoading(false);
      }
    }

    if (tenantId) {
      loadProfile();
    }
  }, [tenantId]);

  // Access control checks
  if (accessLoading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        title="Admin Access Required"
        message="You need tenant administrator privileges to manage Google Business Profile category."
        userRole={tenantRole}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Group justify="center">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Breadcrumb */}
        <Breadcrumbs>
          <Anchor component={Link} href={`/t/${tenantId}/settings`}>
            Settings
          </Anchor>
          <Text>GBP Business Category</Text>
        </Breadcrumbs>

        {/* Page Header */}
        <div>
          <Title order={1}>Google Business Profile Category</Title>
          <Text c="dimmed">
            Manage your primary business category for Google Business Profile
          </Text>
        </div>

        {/* Clarification Card */}
        <Alert color="blue" icon={<IconInfoCircle size={16} />}>
          <Stack gap="xs">
            <Text fw={500}>What's the difference?</Text>
            <Text size="sm">
              <strong>Business Category</strong> (this page) describes your store type for Google Business Profile 
              (e.g., "Grocery store", "Clothing store"). <strong>Product Categories</strong> organize 
              individual items you sell (e.g., "Dairy", "Produce", "Men's Apparel").
            </Text>
            <Anchor component={Link} href={`/t/${tenantId}/categories`} size="sm" fw={500}>
              Manage Product Categories
              <IconLink size={12} style={{ marginLeft: '4px' }} />
            </Anchor>
          </Stack>
        </Alert>

        {/* Main Category Card */}
        <GBPCategoryCard
          tenantId={tenantId}
          initialPrimary={
            profile?.gbpCategoryId && profile?.gbpCategoryName
              ? { id: profile.gbpCategoryId, name: profile.gbpCategoryName }
              : null
          }
          initialSecondary={profile?.gbpSecondaryCategories || []}
          syncStatus={profile?.gbpCategorySyncStatus}
          lastSynced={profile?.gbpCategoryLastMirrored}
        />

        {/* Quick Start Guide */}
        <Card shadow="sm" padding="lg" withBorder bg="blue.0">
          <Stack gap="lg">
            <Group gap="sm">
              <IconRocket size={20} />
              <Title order={3}>🚀 Quick Start Guide</Title>
            </Group>
            
            {/* How It Works */}
            <Card padding="md" withBorder bg="white">
              <Group gap="sm" mb="md">
                <IconCheck size={16} color="blue" />
                <Text fw={500}>How It Works</Text>
              </Group>
              <Stack gap="sm" pl={30}>
                <Group gap="sm">
                  <Text c="blue" fw={500}>1.</Text>
                  <Text size="sm"><strong>Select Primary Category:</strong> Choose from dropdown or search for your main business type (required)</Text>
                </Group>
                <Group gap="sm">
                  <Text c="blue" fw={500}>2.</Text>
                  <Text size="sm"><strong>Add Secondary Categories:</strong> Add up to 9 additional categories that describe your business (optional)</Text>
                </Group>
                <Group gap="sm">
                  <Text c="blue" fw={500}>3.</Text>
                  <Text size="sm"><strong>Save & Sync:</strong> Your categories automatically sync to your directory listing</Text>
                </Group>
                <Group gap="sm">
                  <Text c="blue" fw={500}>4.</Text>
                  <Text size="sm"><strong>View Mappings:</strong> See which directory categories your GBP categories map to</Text>
                </Group>
              </Stack>
            </Card>

            {/* Popular Categories */}
            <div>
              <Text fw={500} mb="md">Popular Retail Categories</Text>
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap="xs">
                    <Text c="blue" size="sm" fw={500}>Food & Beverage</Text>
                    <Text size="sm" c="dimmed">
                      • Grocery store<br />
                      • Convenience store<br />
                      • Supermarket<br />
                      • Liquor store
                    </Text>
                  </Stack>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap="xs">
                    <Text c="blue" size="sm" fw={500}>General Retail</Text>
                    <Text size="sm" c="dimmed">
                      • Clothing store<br />
                      • Electronics store<br />
                      • Furniture store<br />
                      • Hardware store
                    </Text>
                  </Stack>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap="xs">
                    <Text c="blue" size="sm" fw={500}>Health & Beauty</Text>
                    <Text size="sm" c="dimmed">
                      • Pharmacy<br />
                      • Beauty supply store<br />
                      • Cosmetics store
                    </Text>
                  </Stack>
                </Grid.Col>
                
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Stack gap="xs">
                    <Text c="blue" size="sm" fw={500}>Specialty Stores</Text>
                    <Text size="sm" c="dimmed">
                      • Book store<br />
                      • Pet store<br />
                      • Toy store<br />
                      • Sporting goods store
                    </Text>
                  </Stack>
                </Grid.Col>
              </Grid>
            </div>

            {/* Tips & Best Practices */}
            <Card padding="md" withBorder bg="white">
              <Group gap="sm" mb="md">
                <IconBulb size={16} color="blue" />
                <Text fw={500}>Tips & Best Practices</Text>
              </Group>
              <Stack gap="sm" pl={30}>
                <Group gap="sm">
                  <Text c="blue">💡</Text>
                  <Text size="sm"><strong>Primary First:</strong> Your primary category is most important for Google search results</Text>
                </Group>
                <Group gap="sm">
                  <IconTarget size={12} color="blue" />
                  <Text size="sm"><strong>Be Specific:</strong> "Grocery store" is better than just "store"</Text>
                </Group>
                <Group gap="sm">
                  <Text c="blue">🔍</Text>
                  <Text size="sm"><strong>Can't Find It?</strong> Click "🔍 Can't find it? Search" to search thousands of categories</Text>
                </Group>
                <Group gap="sm">
                  <IconLink size={12} color="blue" />
                  <Text size="sm"><strong>Check Mappings:</strong> After saving, see which directory categories your store will appear in</Text>
                </Group>
                <Group gap="sm">
                  <IconAlertTriangle size={12} color="blue" />
                  <Text size="sm"><strong>Unmapped Warning:</strong> If a category shows "unmapped", your store won't appear in that directory category page</Text>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

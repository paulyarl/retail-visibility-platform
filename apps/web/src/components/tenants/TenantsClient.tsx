"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Card, 
  Text, 
  Title, 
  Button, 
  TextInput, 
  Badge, 
  Alert, 
  Modal, 
  Pagination,
  Group,
  Stack,
  Grid,
  Container,
  ActionIcon,
  Flex,
  Box,
  Transition,
  Skeleton
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { motion } from "framer-motion";
import PageHeader, { Icons } from "@/components/PageHeader";
import { platformHomeService } from "@/services/PlatformHomeSingletonService";
import { useAuth } from "@/contexts/AuthContext";
import { canEditTenant, canDeleteTenant, canRenameTenant } from "@/lib/auth/access-control";
import { ContextBadges } from "@/components/ContextBadges";
import { SubscriptionStatusGuide } from "@/components/subscription/SubscriptionStatusGuide";
import ChangeLocationStatusModal from '@/components/tenant/ChangeLocationStatusModal';
import CreateTenantModal, { TenantCreationData } from './CreateTenantModal';
import NextLink from "next/link";
import { IconBuilding } from "@tabler/icons-react";
//import { Link } from "lucide-react";

type Tenant = { 
  id: string; 
  name: string; 
  createdAt?: string;
  status?: string;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  locationStatus?: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  organization?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    items?: number;
    users?: number;
  };
};



export default function TenantsClient({ initialTenants = [] }: { initialTenants?: Tenant[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // Check if we're viewing a specific tenant
  const specificTenantId = searchParams?.get('id');
  const isViewingSpecificTenant = !!specificTenantId;
  
  // Pagination and search state
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [chainFilter, setChainFilter] = useState<'all' | 'chain' | 'standalone'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'inactive' | 'closed' | 'archived' | 'trial'>('active');
  
  // View mode toggle
  // Important for hydration: default to 'grid' on both server and initial client render,
  // then read localStorage AFTER hydration to avoid SSR/client mismatch.
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Read saved view mode on client after hydration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('tenants_view_mode');
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved as 'grid' | 'list');
      }
    } catch {}
  }, []);

  // Status modal state
  const [statusModalTenant, setStatusModalTenant] = useState<Tenant | null>(null);

  // Check for onboarding data passed from /onboarding
  const onboardingName = searchParams?.get('onboarding_name');
  const onboardingPhone = searchParams?.get('onboarding_phone');
  const onboardingBusinessType = searchParams?.get('onboarding_business_type');
  const hasOnboardingData = !!(onboardingName || onboardingPhone || onboardingBusinessType);

  const openStatusModal = async (tenant: Tenant) => {
    // Refresh data first to ensure we have the latest status
    await refresh();
    setStatusModalTenant(tenant);
  };

  const handleStatusChange = () => {
    setStatusModalTenant(null);
    // Refresh the tenant list after status change
    refresh();
  };

  // Auto-open create modal if onboarding data is present
  useEffect(() => {
    if (hasOnboardingData && !createModalOpen) {
      setCreateModalOpen(true);
    }
  }, [hasOnboardingData]);

  const handleCreateModalClose = () => {
    setCreateModalOpen(false);
    // Clear onboarding params from URL when modal is closed
    if (hasOnboardingData) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('onboarding_name');
      newUrl.searchParams.delete('onboarding_phone');
      newUrl.searchParams.delete('onboarding_business_type');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('tenants_view_mode', viewMode);
    } catch {}
  }, [viewMode]);

  // Filter and paginate tenants
  const filteredTenants = useMemo(() => {
    let filtered = tenants;
    
    /* console.log('[TenantsClient] Filtering tenants:', { 
      totalTenants: tenants.length, 
      isViewingSpecificTenant, 
      specificTenantId 
    }); */
    
    // If viewing a specific tenant, filter to just that one
    if (isViewingSpecificTenant && specificTenantId) {
      filtered = tenants.filter(t => t.id === specificTenantId);
      //console.log('[TenantsClient] After specific tenant filter:', filtered.length);
    }
    
    // Apply existing filters
    const query = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((t) => {
      const matchesSearch = !query || t.name.toLowerCase().includes(query) || t.id.toLowerCase().includes(query);
      const matchesChain = chainFilter === 'all' || 
        (chainFilter === 'chain' && t.organization) ||
        (chainFilter === 'standalone' && !t.organization);
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'trial' && t.subscriptionStatus === 'trial') ||
        (statusFilter === 'active' && ((t.locationStatus || 'active') === 'active' || t.subscriptionStatus === 'trial')) ||
        ((statusFilter === 'pending' || statusFilter === 'inactive' || statusFilter === 'closed' || statusFilter === 'archived') && (t.locationStatus || 'active') === statusFilter);
      
      return matchesSearch && matchesChain && matchesStatus;
    });
    
    //console.log('[TenantsClient] Final filtered tenants count:', filtered.length);
    return filtered;
  }, [tenants, searchQuery, chainFilter, statusFilter, isViewingSpecificTenant, specificTenantId]);

  const paginatedTenants = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTenants.slice(startIndex, endIndex);
  }, [filteredTenants, currentPage, pageSize]);

  // Reset to page 1 when status filter changes (client-side filtering only)
  useEffect(() => {
    setCurrentPage(1);
    // No automatic refresh - rely on client-side filtering
  }, [statusFilter]);

  // Reset to page 1 when search or chain filter changes (client-side only)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, chainFilter]);

  // Initial data load - get all tenants for client-side filtering
  useEffect(() => {
    // console.log('[TenantsClient] Initial data load - getting all tenants');
    fetchTenants(true); // Get all tenants including archived for complete client-side filtering
  }, []);

  const fetchTenants = async (includeArchived = false, statusParam?: string) => {
    // console.log('[TenantsClient] fetchTenants called:', { includeArchived, statusParam });
    setLoading(true);
    setError(null);
    try {
      const tenants = await platformHomeService.getTenants();
      // console.log('[TenantsClient] Raw tenants from API:', tenants?.length, tenants?.map(t => ({ name: t.name, subscriptionStatus: t.subscriptionStatus })));
      
      // Filter tenants based on parameters
      let filteredTenants = tenants || [];
      //console.log('[TenantsClient] Initial filtered tenants:', filteredTenants);
      
      if (tenants) {
        filteredTenants = tenants.filter(tenant => {
          const tenantStatus = tenant.status || tenant.subscriptionStatus || 'active';
          //console.log('[TenantsClient] tenant status:', tenantStatus);
          
          // Include archived if requested
          if (includeArchived && tenantStatus === 'archived') {
            return true;
          }
          // Skip archived unless specifically requested
          if (!includeArchived && tenantStatus === 'archived') {
            return false;
          }
          // Apply status filter
          if (statusParam && tenantStatus !== statusParam) {
            return false;
          }
          return true;
        });
      }
      
      //console.log('[TenantsClient] Final filtered tenants:', filteredTenants);
      setTenants(filteredTenants);
    } catch (_e) {
      setError("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    //console.log('[TenantsClient] refresh called, statusFilter:', statusFilter);
    if (statusFilter === 'all') {
      // 'all' filter: include archived tenants but no specific status filter
      await fetchTenants(true);
    } else if (statusFilter === 'archived') {
      // 'archived' filter: include archived and filter to archived status
      await fetchTenants(true, 'archived');
    } else if (statusFilter === 'trial') {
      // 'trial' filter: get all tenants and filter client-side by subscriptionStatus
      await fetchTenants(true);
    } else {
      // Specific status filter: don't include archived, filter to specific status
      await fetchTenants(false, statusFilter);
    }
  };

  const onCreate = async (data: TenantCreationData) => {
    setLoading(true);
    setError(null);
    try {
      const responseData = await platformHomeService.createTenant({
        name: data.name.trim(),
        slug: data.slug || '',
        city: data.city,
        state: data.state,
        country_code: data.country_code,
      });
      
      if (!responseData) {
        console.error('[TenantsClient] Create failed: No response data');
        throw new Error("Failed to create tenant");
      }
      
      const newTenant = responseData as Tenant;
      console.log('[TenantsClient] Tenant created:', newTenant.id, newTenant.name);
      
      // Immediately add the new tenant to the list for instant UI update
      setTenants(prev => {
        const updated = [...prev, newTenant];
        console.log('[TenantsClient] Tenants after adding new one:', updated.length);
        return updated;
      });
      
      // Reset filters to ensure the new tenant is visible
      setSearchQuery('');
      setChainFilter('all');
      setStatusFilter('active'); // New tenants are typically 'active'
      setCurrentPage(1);
      
      // Also refresh in background to ensure consistency
      refresh().catch(console.error);
      
      // Show success feedback
      notifications.show({
        title: 'Location Created!',
        message: `${newTenant.name} has been added successfully.`,
        color: 'green',
        icon: <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>,
        autoClose: 4000,
      });
      console.log('[TenantsClient] New tenant added successfully:', newTenant.name);
      
      // If this was from onboarding flow, redirect to profile page
      if (hasOnboardingData) {
        router.replace('/settings/profile');
      }
    } catch (err) {
      console.error('[TenantsClient] Create error:', err);
      setError(err instanceof Error ? err.message : "Failed to create tenant");
      throw err; // Re-throw to let modal handle it
    } finally {
      setLoading(false);
    }
  };

  const onRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const data = await platformHomeService.updateTenant(id, { name: newName.trim() });
      if (data) {
        setTenants((prev) => prev.map((t) => (t.id === id ? data : t)));
      } else {
        setError("Failed to rename tenant");
      }
    } catch (error) {
      setError("Failed to rename tenant");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete tenant? This cannot be undone.")) return;
    try {
      await platformHomeService.deleteTenant(id);
      setTenants((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      setError("Failed to delete tenant");
    }
  };

  return (
    <Container size="xl" py="md">
      <PageHeader
        title="Locations"
        description="Manage your stores and business locations"
        icon={Icons.Tenants}
        actions={
          <Group>
            <Button 
              onClick={() => router.push('/')} 
              variant="subtle"
              leftSection={
                <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              }
            >
              Dashboard
            </Button>
            <Button onClick={() => refresh()} disabled={loading} variant="light" 
              leftSection={
                <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            >
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </Group>
        }
      />

      <Stack gap="lg">
        {/* Subscription Status Guide: only visible during maintenance or freeze windows */}
        {isViewingSpecificTenant && <SubscriptionStatusGuide tenantId={specificTenantId!} />}

        {/* Context Badges */}
        <ContextBadges showPlatformRole contextLabel="Tenants" />
        {/* Quick Stats Dashboard */}
        {tenants.length > 0 && (
          <Grid>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Card withBorder p="md">
                <Flex justify="space-between" align="center">
                  <div>
                    <Text size="sm" c="dimmed">Total Locations</Text>
                    <Text size="xl" fw="bold">{tenants.length}</Text>
                  </div>
                  <Box w={48} h={48} bg="blue.1" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" color="blue.6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </Box>
                </Flex>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Card withBorder p="md">
                <Flex justify="space-between" align="center">
                  <div>
                    <Text size="sm" c="dimmed">Chain Locations</Text>
                    <Text size="xl" fw="bold">{tenants.filter(t => t.organization).length}</Text>
                  </div>
                  <Box w={48} h={48} bg="cyan.6" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" color="white">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </Box>
                </Flex>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Card withBorder p="md">
                <Flex justify="space-between" align="center">
                  <div>
                    <Text size="sm" c="dimmed">Standalone</Text>
                    <Text size="xl" fw="bold">{tenants.filter(t => !t.organization).length}</Text>
                  </div>
                  <Box w={48} h={48} bg="green.6" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" color="white">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </Box>
                </Flex>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Card withBorder p="md">
                <Flex justify="space-between" align="center">
                  <div>
                    <Text size="sm" c="dimmed">Filtered</Text>
                    <Text size="xl" fw="bold">{filteredTenants.length}</Text>
                  </div>
                  <Box w={48} h={48} bg="gray.2" style={{ borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" color="gray.6">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </Box>
                </Flex>
              </Card>
            </Grid.Col>
          </Grid>
        )}

        {/* Error Alert */}
        {error && (
          <Alert color="red" title="Error" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Create Tenant Card */}
        <Card withBorder>
          <Stack>
            <Title order={3}>Add New Location</Title>
            <Text c="dimmed">Create a new store or business location with professional URL</Text>
            <Button 
              onClick={() => setCreateModalOpen(true)} 
              disabled={loading}
              fullWidth
              leftSection={
                <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              Add New Location
            </Button>
          </Stack>
        </Card>

        {/* Tenants List */}
        <Card withBorder>
          <Stack>
            <Group justify="space-between" wrap="nowrap">
              <div style={{ flex: 1, minWidth: 0 }}>
                <Title order={3}>Your Locations</Title>
                <Text c="dimmed">Manage your store locations</Text>
              </div>
              <Group gap="sm">
                <Badge color="blue" variant="light">{filteredTenants.length} of {tenants.length}</Badge>
                {/* View Toggle */}
                <Button.Group>
                  <Button
                    variant={viewMode === 'grid' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                  >
                    <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                  >
                    <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </Button>
                </Button.Group>
              </Group>
            </Group>
            
            {/* Filters */}
            <Stack gap="md">
              {/* Search Input */}
              <TextInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or ID..."
                label="Search Tenants"
              />
              
              {/* Chain Filter */}
              <Group>
                <Button
                  variant={chainFilter === 'all' ? 'filled' : 'light'}
                  size="sm"
                  onClick={() => setChainFilter('all')}
                >
                  All Types
                </Button>
                <Button
                  variant={chainFilter === 'chain' ? 'filled' : 'light'}
                  size="sm"
                  onClick={() => setChainFilter('chain')}
                  leftSection={
                    <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                >
                  Chain
                </Button>
                <Button
                  variant={chainFilter === 'standalone' ? 'filled' : 'light'}
                  size="sm"
                  onClick={() => setChainFilter('standalone')}
                >
                  Standalone
                </Button>
              </Group>
              
              {/* Location Status Filter */}
              <Stack gap="xs">
                <Text size="sm" fw="500">Filter by Status</Text>
                <Group>
                  <Button
                    variant={statusFilter === 'all' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    All Statuses
                  </Button>
                  <Button
                    variant={statusFilter === 'active' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setStatusFilter('active')}
                  >
                    ✅ Active
                  </Button>
                  <Button
                    variant={statusFilter === 'trial' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setStatusFilter('trial')}
                  >
                    🧪 Trial
                  </Button>
                  <Button
                    variant={statusFilter === 'inactive' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setStatusFilter('inactive')}
                  >
                    ⏸️ Inactive
                  </Button>
                  <Button
                    variant={statusFilter === 'pending' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setStatusFilter('pending')}
                  >
                    🚧 Pending
                  </Button>
                  <Button
                    variant={statusFilter === 'closed' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setStatusFilter('closed')}
                  >
                    🔒 Closed
                  </Button>
                  <Button
                    variant={statusFilter === 'archived' ? 'filled' : 'light'}
                    size="sm"
                    onClick={() => setStatusFilter('archived')}
                  >
                    📦 Archived
                  </Button>
                </Group>
              </Stack>
            </Stack>
            
            {/* Tenant List Content */}
            {loading ? (
              <Grid>
                {[1, 2, 3, 4].map((n) => (
                  <Grid.Col span={{ base: 12, lg: 6 }} key={n}>
                    <Card withBorder p="md">
                      <Skeleton height={20} mb="sm" />
                      <Skeleton height={16} width="60%" mb="md" />
                      <Group gap="sm">
                        <Skeleton height={32} width={100} />
                        <Skeleton height={32} width={80} />
                        <Skeleton height={32} width={90} />
                      </Group>
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
            ) : filteredTenants.length === 0 ? (
              <Box py="xl" ta="center">
                <svg
                  style={{ width: 48, height: 48, margin: '0 auto', marginBottom: 16 }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  color="gray"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <Title order={3}>
                  {searchQuery ? "No matching tenants" : "No tenants"}
                </Title>
                <Text c="dimmed" mt="xs">
                  {searchQuery
                    ? "Try a different search term"
                    : "Get started by creating your first tenant."}
                </Text>
              </Box>
            ) : (
              <>
                <div
                  style={{
                    display: viewMode === "list" ? "flex" : "grid",
                    flexDirection: viewMode === "list" ? "column" : "row",
                    gap: 16,
                    gridTemplateColumns: viewMode === "list" ? "none" : "repeat(2, 1fr)"
                  }}
                >
                  {paginatedTenants.map((t, index) => {
                    // Use centralized permission helpers
                    const canEdit = user ? canEditTenant(user, t.id) : false;
                    const canDelete = user ? canDeleteTenant(user, t.id) : false;
                    const canRename = user
                      ? canRenameTenant(user, t.id)
                      : false;

                    return (
                      <TenantRow
                        key={t.id}
                        tenant={t}
                        index={index}
                        onSelect={() =>
                          router.push(
                            `/t/${encodeURIComponent(t.id)}/dashboard`,
                          )
                        }
                        onViewItems={() =>
                          router.push(
                            `/t/${encodeURIComponent(t.id)}/items`,
                          )
                        }
                        onEditProfile={() =>
                          router.push(
                            `/t/${encodeURIComponent(t.id)}/onboarding`,
                          )
                        }
                        onRename={onRename}
                        onDelete={() => onDelete(t.id)}
                        onStatusChange={openStatusModal}
                        onRefresh={refresh}
                        statusFilter={statusFilter}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        canRename={canRename}
                      />
                    );
                  })}
                </div>
              </>
            )}

            {filteredTenants.length > 0 && (
              <Pagination
                value={currentPage}
                total={Math.ceil(filteredTenants.length / pageSize)}
                onChange={setCurrentPage}
                mt="lg"
              />
            )}
          </Stack>
        </Card>
      </Stack>

      {/* Status Update Modal */}
      {statusModalTenant && (
        <ChangeLocationStatusModal
          tenantId={statusModalTenant.id}
          tenantName={statusModalTenant.name}
          initialStatus={statusModalTenant.locationStatus || 'active'}
          isOpen={true}
          onClose={() => setStatusModalTenant(null)}
          onStatusChanged={handleStatusChange}
        />
      )}

      {/* Create Tenant Modal */}
      <CreateTenantModal
        isOpen={createModalOpen}
        onClose={handleCreateModalClose}
        onCreate={onCreate}
        loading={loading}
        initialData={hasOnboardingData ? {
          name: onboardingName || '',
          phone: onboardingPhone || '',
          businessType: onboardingBusinessType || '',
        } : undefined}
      />
    </Container>
  );
}

function TenantRow({ tenant, index, onSelect, onViewItems, onEditProfile, onRename, onDelete, onStatusChange, onRefresh, statusFilter, canEdit = false, canRename = false, canDelete = false }: {
  tenant: Tenant;
  index: number;
  onSelect: () => void;
  onViewItems?: () => void;
  onEditProfile: () => void;
  onRename: (id: string, newName: string) => void;
  onDelete: () => void;
  onStatusChange: (tenant: Tenant) => void;
  onRefresh: (includeArchived?: boolean, statusParam?: string) => void;
  statusFilter?: 'all' | 'pending' | 'active' | 'inactive' | 'closed' | 'archived' | 'trial';
  canEdit?: boolean;
  canRename?: boolean;
  canDelete?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tenant.name);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  useEffect(() => setValue(tenant.name), [tenant.name]);

  const save = async () => {
    await onRename(tenant.id, value);
    setEditing(false);
  };

  const handleDelete = () => {
    setShowDeleteModal(false);
    onDelete();
  };
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
      >
        <Card 
          withBorder 
          p="md" 
          shadow="sm"
          style={{ 
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            ':hover': {
              transform: 'translateY(-2px)',
              boxShadow: 'var(--mantine-shadow-lg)'
            }
          }}
        >
          {/* Tenant Info */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <Group>
                <TextInput
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  style={{ maxWidth: 400 }}
                  autoFocus
                />
                <Button size="sm" onClick={save}>Save</Button>
                <Button size="sm" variant="light" onClick={() => setEditing(false)}>Cancel</Button>
              </Group>
            ) : (
              <Stack gap="xs">
                {/* Header row with org and icon */}
                <Group gap="sm" wrap="nowrap">
                  {tenant.organization && (
                    <Badge 
                      size="xs" 
                      color="cyan" 
                      variant="light"
                      leftSection={
                        <IconBuilding size={12} />
                      }
                    >
                      <NextLink className="hover:underline" target="_blank" href={`/t/${tenant.id}/settings/organization`}>
                        {tenant.organization.name}
                      </NextLink>
                    </Badge>
                  )}
                  <svg style={{ width: 20, height: 20, flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" color="gray">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <Badge 
                    size="lg" 
                    color="blue" 
                    variant="light"
                    style={{ cursor: 'pointer' }}
                    onClick={onSelect}
                  >
                    <Text size="sm">{tenant.name}</Text>
                  </Badge>
                </Group>
                
                {/* Tier and Status badges */}
                <Group gap="xs">
                  {/* Subscription Tier */}
                  {tenant.subscriptionTier && (
                    <Badge
                      size="xs"
                      color={
                        tenant.subscriptionTier === 'professional' ? 'violet' :
                        tenant.subscriptionTier === 'enterprise' ? 'indigo' :
                        tenant.subscriptionTier === 'starter' ? 'teal' :
                        tenant.subscriptionTier === 'google_only' ? 'orange' :
                        'gray'
                      }
                      variant="light"
                    >
                      {tenant.subscriptionTier.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  )}
                  
                  {/* Subscription Status */}
                  {tenant.subscriptionStatus && tenant.subscriptionStatus !== 'active' && (
                    <Badge
                      size="xs"
                      color={
                        tenant.subscriptionStatus === 'trial' ? 'blue' :
                        tenant.subscriptionStatus === 'past_due' ? 'yellow' :
                        tenant.subscriptionStatus === 'canceled' ? 'red' :
                        'gray'
                      }
                      variant="light"
                    >
                      {tenant.subscriptionStatus.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  )}
                  
                  {/* Location Status */}
                  {tenant.locationStatus && tenant.locationStatus !== 'active' && (
                    <Badge
                      size="xs"
                      color={
                        tenant.locationStatus === 'pending' ? 'yellow' :
                        tenant.locationStatus === 'inactive' ? 'orange' :
                        tenant.locationStatus === 'closed' ? 'red' :
                        'gray'
                      }
                      variant="light"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(tenant);
                      }}
                      style={{ cursor: 'pointer' }}
                      leftSection={
                        <span>
                          {tenant.locationStatus === 'pending' ? '🚧' :
                           tenant.locationStatus === 'inactive' ? '⏸️' :
                           tenant.locationStatus === 'closed' ? '🔒' :
                           '📦'}
                        </span>
                      }
                    >
                      {tenant.locationStatus}
                    </Badge>
                  )}
                </Group>
                
                {/* Stats Row */}
                <Group gap="md">
                  {tenant._count?.items !== undefined && (
                    <Text size="xs" c="dimmed">
                      {tenant._count.items} products
                    </Text>
                  )}
                  {tenant._count?.users !== undefined && (
                    <Text size="xs" c="dimmed">
                      {tenant._count.users} users
                    </Text>
                  )}
                </Group>
              </Stack>
            )}
          </Box>

          {/* Actions */}
          {!editing && (
            <Group gap="xs" mt="md" pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
              {/* Quick Status Change - Prominent placement */}
               <Button size="sm" onClick={onViewItems ?? onSelect} title="Click to view the location inventory"
                leftSection={
                  <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
              >
                View Inventory
              </Button>
              
               {canRename && (
                <Button size="sm" variant="light" onClick={() => setEditing(true)} title="Click to rename the location's name"
                  leftSection={
                    <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  }
                >
                  Rename
                </Button>
              )}
              {canEdit && (
                <Button size="sm" variant="light" onClick={onEditProfile} 
                  title="Click to change the location information"
                  leftSection={
                    <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                >
                  Edit Profile
                </Button>
              )}
              <Button size="sm" variant="light" onClick={() => window.open(`/tenant/${tenant.id}`, '_blank')} title="Click to preview the inventory storefront website"
                leftSection={
                  <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              >
                View Storefront
              </Button>
             {canEdit && (
                <Button 
                  size="sm" 
                  variant={tenant.locationStatus === 'active' ? 'light' : 'outline'}
                  color={tenant.locationStatus === 'active' ? 'green' : 'orange'}
                  onClick={() => onStatusChange(tenant)}
                  title="Click to change the location status"
                  leftSection={
                    tenant.locationStatus === 'active' ? (
                      <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )
                  }
                >
                  {tenant.locationStatus === 'active' ? 'Active' : (tenant.locationStatus ? tenant.locationStatus.charAt(0).toUpperCase() + tenant.locationStatus.slice(1) : 'Status')}
                </Button>
              )}
              {canDelete && (
                <Button size="sm" variant="outline" color="red" onClick={() => setShowDeleteModal(true)} 
                  title="Click to remove the location"
                  leftSection={
                    <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  }
                >
                  Delete
                </Button>
              )}
            </Group>
          )}
        </Card>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Tenant"
        size="sm"
      >
        <Stack gap="md">
          <Alert color="yellow" title="Warning">
            This action cannot be undone. All data associated with this tenant will be permanently deleted.
          </Alert>
          <Box bg="gray.1" p="md" style={{ borderRadius: 8 }}>
            <Text size="sm" fw="500">{tenant.name}</Text>
            <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }} mt="xs">{tenant.id}</Text>
          </Box>
          <Group justify="flex-end">
            <Button variant="light" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete}>
              Delete Tenant
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

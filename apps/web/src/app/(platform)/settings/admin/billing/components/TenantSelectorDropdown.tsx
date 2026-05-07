'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Select, 
  Text, 
  Group, 
  Badge, 
  Stack, 
  Box, 
  Avatar,
  LoadingOverlay,
  ActionIcon,
  Tooltip
} from '@mantine/core';
import { 
  IconSearch, 
  IconBuilding, 
  IconTrendingUp, 
  IconAlertTriangle,
  IconRefresh
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { tenantTierService } from '@/services/TenantTierService';
import { adminOperationsService, AdminTenant } from '@/services/AdminOperationsService';

interface TenantSelectorDropdownProps {
  selectedTenant?: string | null;
  onTenantSelect: (tenantId: string | null) => void;
  placeholder?: string;
  showStats?: boolean;
  disabled?: boolean;
}

export function TenantSelectorDropdown({
  selectedTenant,
  onTenantSelect,
  placeholder = "Select a tenant to view billing details...",
  showStats = true,
  disabled = false
}: TenantSelectorDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all tenants for the dropdown
  const { data: tenants = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-tenants-list'],
    queryFn: async () => {
      const result = await adminOperationsService.getTenants(1, 100);
      return result.tenants || [];
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Filter tenants based on search
  const filteredTenants = useMemo(() => {
    if (!searchQuery) return tenants;
    
    const query = searchQuery.toLowerCase();
    return tenants.filter((tenant) => 
      tenant.name.toLowerCase().includes(query) ||
      tenant.id.toLowerCase().includes(query)
    );
  }, [tenants, searchQuery]);

  // Get selected tenant details
  const selectedTenantData = useMemo(() => {
    if (!selectedTenant) return null;
    return tenants.find((t) => t.id === selectedTenant) || null;
  }, [selectedTenant, tenants]);

  // Custom select item rendering
  const renderSelectItem = (tenant: AdminTenant) => {
    if (!tenant) return null;
    
    const statusColor = tenant.subscriptionStatus === 'active' ? 'green' : 
                       tenant.subscriptionStatus === 'trial' ? 'blue' : 
                       tenant.subscriptionStatus === 'past_due' ? 'red' : 'gray';

    return (
      <Group gap="sm" wrap="nowrap">
        <Avatar size="sm" radius="xl">
          <IconBuilding size="1rem" />
        </Avatar>
        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {tenant.name}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Text size="xs" c="dimmed">
              {tenant.id}
            </Text>
            <Badge size="xs" color={statusColor} variant="light">
              {tenant.subscriptionStatus || 'unknown'}
            </Badge>
            </Group>
        </div>
      </Group>
    );
  };

  // Calculate platform stats
  const platformStats = useMemo(() => {
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter((tenant) => tenant.subscriptionStatus === 'active').length;
    const totalMRR = 0; // MRR not available in AdminTenant
    const avgHealthScore = 0; // Health score not available in AdminTenant

    return {
      totalTenants,
      activeTenants,
      totalMRR,
      avgHealthScore
    };
  }, [tenants]);

  return (
    <Stack gap="md">
      {/* Platform Stats Overview */}
      {showStats && (
        <Box p="md" bg="blue.0" style={{ borderRadius: '8px' }}>
          <Group justify="space-between" align="center">
            <Group gap="lg">
              <div>
                <Text size="xs" c="dimmed">Total Tenants</Text>
                <Text size="lg" fw={600}>{platformStats.totalTenants}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Active</Text>
                <Text size="lg" fw={600} c="green">{platformStats.activeTenants}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Platform MRR</Text>
                <Text size="lg" fw={600} c="blue">${platformStats.totalMRR.toLocaleString()}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Avg Health</Text>
                <Text size="lg" fw={600} c={platformStats.avgHealthScore >= 80 ? 'green' : platformStats.avgHealthScore >= 60 ? 'yellow' : 'red'}>
                  {platformStats.avgHealthScore}%
                </Text>
              </div>
            </Group>
            <ActionIcon 
              variant="light" 
              color="blue" 
              onClick={() => refetch()}
              loading={isLoading}
            >
              <IconRefresh size="1rem" />
            </ActionIcon>
          </Group>
        </Box>
      )}

      {/* Tenant Selector */}
      <Box pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Select
          size="md"
          placeholder={placeholder}
          data={filteredTenants.map((tenant) => ({
            value: tenant.id,
            label: tenant.name,
            tenant
          }))}
          renderOption={(item) => {
            const tenant = (item as any).tenant as AdminTenant;
            return renderSelectItem(tenant);
          }}
          value={selectedTenant}
          onChange={(value) => onTenantSelect(value || null)}
          searchable
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          nothingFoundMessage="No tenants found"
          leftSection={<IconSearch size="1rem" />}
          disabled={disabled}
          maxDropdownHeight={400}
          comboboxProps={{ 
            withinPortal: true,
            position: 'bottom-start',
            offset: 0
          }}
        />
      </Box>

      {/* Selected Tenant Quick Stats */}
      {selectedTenantData && showStats && (
        <Box p="md" bg="gray.0" style={{ borderRadius: '8px' }}>
          <Group gap="md" align="start">
            <Avatar size="lg" radius="xl">
              <IconBuilding size="1.5rem" />
            </Avatar>
            <div style={{ flex: 1 }}>
              <Text size="lg" fw={600}>
                {selectedTenantData.name}
              </Text>
              <Text size="sm" c="dimmed" mb="sm">
                {selectedTenantData.id}
              </Text>
              <Group gap="md" wrap="wrap">
                <Group gap={4}>
                  <Text size="xs" c="dimmed">Status:</Text>
                  <Badge 
                    size="xs" 
                    color={selectedTenantData.subscriptionStatus === 'active' ? 'green' : 
                           selectedTenantData.subscriptionStatus === 'trial' ? 'blue' : 
                           selectedTenantData.subscriptionStatus === 'past_due' ? 'red' : 'gray'}
                    variant="light"
                  >
                    {selectedTenantData.subscriptionStatus || 'unknown'}
                  </Badge>
                </Group>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">Tier:</Text>
                  <Badge size="xs" color="blue" variant="light">
                    {selectedTenantData.subscriptionTier || 'discovery'}
                  </Badge>
                </Group>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">Users:</Text>
                  <Text size="xs" fw={500}>{selectedTenantData._count?.user_tenants || 0}</Text>
                </Group>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">Products:</Text>
                  <Text size="xs" fw={500}>{selectedTenantData._count?.inventory_items || 0}</Text>
                </Group>
              </Group>
            </div>
          </Group>
        </Box>
      )}
    </Stack>
  );
}

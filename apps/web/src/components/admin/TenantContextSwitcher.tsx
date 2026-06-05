'use client';

import { useState, useEffect } from 'react';
import { Alert, Button, Group, Text, Stack, Badge, Card, Select, Loader } from '@mantine/core';
import { IconBuildingStore, IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminSecurityMonitoringService } from '@/services/AdminSecurityMonitoringSingletonService';
import { clientTenantContextManager } from '@/lib/clientTenantContext';

interface TenantContextSwitcherProps {
  onTenantChange?: (tenantId: string) => void;
  showWarning?: boolean;
}

export function TenantContextSwitcher({ 
  onTenantChange, 
  showWarning = true 
}: TenantContextSwitcherProps) {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; role?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Load available tenants for ADMIN/platform ADMIN users
  useEffect(() => {
    if (user?.role === 'PLATFORM_ADMIN' || user?.role === 'ADMIN') {
      loadTenants();
    } else {
      // For regular users, just get their tenant
      if (user?.tenants && user.tenants.length > 0) {
        setTenants(user.tenants.map(t => ({
          id: t.id,
          name: t.name || 'Unknown',
          role: t.role
        })));
        setCurrentTenant(user.tenants[0].id);
      }
      setLoading(false);
    }
  }, [user]);

  // Get current tenant from context
  useEffect(() => {
    const checkCurrentContext = () => {
      const context = clientTenantContextManager.getTenantContext();
      if (context.tenantId) {
        setCurrentTenant(context.tenantId);
      }
    };

    checkCurrentContext();
    // Check every 5 seconds in case context changes
    const interval = setInterval(checkCurrentContext, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const tenants = await adminSecurityMonitoringService.getAvailableTenants();
      setTenants(tenants || []);
    } catch (error) {
      console.error('[TenantContextSwitcher] Failed to load tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTenantSwitch = async (newTenantId: string) => {
    if (newTenantId === currentTenant) return;

    try {
      setSwitching(true);
      
      // Update the centralized tenant context
      clientTenantContextManager.setTenantContext(newTenantId, 'localStorage');

      setCurrentTenant(newTenantId);
      onTenantChange?.(newTenantId);
      
      // Show success feedback
      console.log(`[TenantContextSwitcher] Switched to tenant: ${newTenantId}`);
    } catch (error) {
      console.error('[TenantContextSwitcher] Failed to switch tenant:', error);
    } finally {
      setSwitching(false);
    }
  };

  const getCurrentTenantName = () => {
    const tenant = tenants.find(t => t.id === currentTenant);
    return tenant?.name || 'Unknown Tenant';
  };

  const getCurrentTenantRole = () => {
    const tenant = tenants.find(t => t.id === currentTenant);
    return tenant?.role || user?.role;
  };

  if (loading) {
    return (
      <Card p="sm" withBorder>
        <Group>
          <Loader size="sm" />
          <Text size="sm">Loading tenant context...</Text>
        </Group>
      </Card>
    );
  }

  // Only show for ADMIN users
  if (user?.role !== 'PLATFORM_ADMIN' && user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <Card p="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <IconBuildingStore size={16} />
            <Text size="sm" fw={500}>Tenant Context</Text>
          </Group>
          {currentTenant && (
            <Badge 
              color="blue" 
              variant="light"
              size="sm"
            >
              Active
            </Badge>
          )}
        </Group>

        {showWarning && currentTenant && (
          <Alert 
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
            p="xs"
          >
            <Text size="xs">
              You are operating as <strong>{getCurrentTenantName()}</strong>. 
              All actions will affect this tenant.
            </Text>
          </Alert>
        )}

        <Select
          label="Current Tenant"
          placeholder={loading ? "Loading tenants..." : "Select tenant..."}
          data={tenants.map(t => ({
            value: t.id,
            label: `${t.name} (${t.id})`
          }))}
          value={currentTenant || ''}
          onChange={(value) => value && handleTenantSwitch(value)}
          disabled={switching || loading}
          leftSection={loading ? <Loader size={16} /> : <IconBuildingStore size={16} />}
          description={`Role: ${getCurrentTenantRole()}`}
        />

        {switching && (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm">Switching context...</Text>
          </Group>
        )}

        {!switching && currentTenant && (
          <Group gap="xs">
            <IconCheck size={16} color="green" />
            <Text size="xs" c="green">
              Context set to: {getCurrentTenantName()}
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

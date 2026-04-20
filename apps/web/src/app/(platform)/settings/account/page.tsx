'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Card,
  TextInput,
  Select,
  Button,
  Stack,
  Group,
  Title,
  Text,
  ThemeIcon,
  Paper,
  Divider,
  Badge,
  Avatar,
  Box,
  Grid,
  Radio,
  Spoiler,
  Loader,
  rem,
} from '@mantine/core';
import { IconUser, IconShield, IconBuilding, IconCrown, IconNavigation, IconCheck, IconLock, IconEdit, IconX, IconDeviceFloppy } from '@tabler/icons-react';
import TenantLimitBadge from '@/components/tenant/TenantLimitBadge';
import SubscriptionUsageBadge from '@/components/subscription/SubscriptionUsageBadge';
import { useTenantLimits } from '@/hooks/useTenantLimits';
import { SubscriptionStatusGuide } from '@/components/subscription/SubscriptionStatusGuide';
import { userManagementService } from '@/services/UserManagementService';


export default function AccountPage() {
  const { user } = useAuth();
  const { status: tenantLimitStatus } = useTenantLimits();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Navigation preference state
  const [navigationPreference, setNavigationPreference] = useState<'last-visited' | 'current-page'>('last-visited');
  const [savingPreference, setSavingPreference] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    businessName: '',
    businessType: '',
    phone: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Initialize edit form when user data changes
  useEffect(() => {
    if (user) {
      setEditFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        businessName: user.businessName || '',
        businessType: user.businessType || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  // Load navigation preference from server
  useEffect(() => {
    const loadPreference = async () => {
      if (!user?.id) return;
      
      try {
        const preferences = await userManagementService.getUserPreferences();
        if (preferences?.navigationPreference) {
          setNavigationPreference(preferences.navigationPreference as 'last-visited' | 'current-page');
          if (user && user.id) {
            localStorage.setItem(`user-nav-preference-${user.id}`, preferences.navigationPreference);
          }
        }
      } catch (error) {
        console.error('Failed to load navigation preference:', error);
      }
    };

    loadPreference();
  }, [user?.id]);

  // Save navigation preference to server
  const saveNavigationPreference = async (preference: 'last-visited' | 'current-page') => {
    setSavingPreference(true);
    try {
      const updatedPreferences = await userManagementService.updateUserPreferences({
        navigationPreference: preference
      });

      if (updatedPreferences) {
        setNavigationPreference(preference);
        if (user && user.id) {
          localStorage.setItem(`user-nav-preference-${user.id}`, preference);
        }
      }
    } catch (error) {
      console.error('Failed to save navigation preference:', error);
    } finally {
      setSavingPreference(false);
    }
  };

  // Helper to get tenant details from tenant-limits API
  const getTenantDetails = (tenantId: string) => {
    if (!tenantLimitStatus?.tenants) return null;
    return tenantLimitStatus.tenants.find((t: any) => t.id === tenantId);
  };

  // Paginate tenants
  const paginatedTenants = useMemo(() => {
    if (!user?.tenants) return [];
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return user.tenants.slice(startIndex, endIndex);
  }, [user?.tenants, currentPage, pageSize]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return 'violet';
      case 'PLATFORM_SUPPORT':
        return 'amber';
      case 'PLATFORM_VIEWER':
        return 'gray';
      case 'OWNER':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
      case 'PLATFORM_SUPPORT':
      case 'PLATFORM_VIEWER':
        return <IconShield style={{ width: rem(20), height: rem(20) }} />;
      case 'OWNER':
        return <IconCrown style={{ width: rem(20), height: rem(20) }} />;
      default:
        return <IconUser style={{ width: rem(20), height: rem(20) }} />;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return 'Full platform access';
      case 'PLATFORM_SUPPORT':
        return 'Support platform access';
      case 'PLATFORM_VIEWER':
        return 'Basic platform access';
      case 'OWNER':
        return 'Full tenant access';
      case 'USER':
        return 'Basic tenant access';
      default:
        return 'Platform user';
    }
  };

  const getPlatformPrivileges = (role: string) => {
    switch (role) {
      case 'PLATFORM_ADMIN':
      case 'ADMIN':
        return [
          'Full platform access',
          'Manage all tenants and users',
          'Access platform administration',
          'Configure platform settings',
          'View all analytics and reports',
          'Manage feature flags',
          'Access admin tools',
        ];
      case 'PLATFORM_SUPPORT':
        return [
          'Support platform access',
          'View and manage tenants for support',
          'Access support tools',
          'View analytics and reports',
          'Test features across tenants',
          'Limited to 3 test locations globally',
        ];
      case 'PLATFORM_VIEWER':
        return [
          'Basic platform access',
          'Read-only access across all tenants',
          'View analytics and reports',
          'Monitor platform health',
          'Cannot create or modify data',
        ];
      case 'OWNER':
        return [
          'Full tenant access',
          'Manage tenant settings',
          'Invite and manage team members',
          'Configure store branding',
          'Access all tenant features',
          'View tenant analytics',
        ];
      case 'USER':
        return [
          'Basic tenant access',
          'Access assigned tenants',
          'Manage products and inventory',
          'View tenant analytics',
          'Update business hours',
        ];
      default:
        return ['Basic platform access'];
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'organization': return 'blue';
      case 'enterprise': return 'indigo';
      case 'professional': return 'green';
      case 'starter': return 'yellow';
      case 'discovery': return 'purple';
      case 'commitment': return 'pink';
      case 'storefront': return 'teal';
      case 'google_only': return 'gray';
      case 'trial': return 'orange';
      default: return 'gray';
    }
  };

  const formatTierName = (tier: string) => {
    return tier.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await userManagementService.updateProfile(editFormData);
      setIsEditing(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) {
    return (
      <Stack align="center" justify="center" mih="60vh">
        <Loader size="lg" />
        <Text c="dimmed">Loading account information...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" maw={900} mx="auto" p="md">
      {/* Subscription Status Guide */}
      <SubscriptionStatusGuide />

      {/* Profile Card */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group>
            <Avatar size={60} radius="xl" color="blue" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
              <IconUser style={{ width: rem(30), height: rem(30) }} />
            </Avatar>
            <div>
              <Title order={3}>
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user.email}
              </Title>
              <Text c="dimmed" size="sm">{user.email}</Text>
            </div>
          </Group>
          <Button
            variant={isEditing ? 'subtle' : 'light'}
            leftSection={isEditing ? <IconX size={16} /> : <IconEdit size={16} />}
            onClick={() => {
              if (isEditing) {
                setEditFormData({
                  firstName: user.firstName || '',
                  lastName: user.lastName || '',
                  businessName: user.businessName || '',
                  businessType: user.businessType || '',
                  phone: user.phone || '',
                });
              }
              setIsEditing(!isEditing);
            }}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </Group>

        <Divider mb="md" />

        {isEditing ? (
          <Stack gap="md">
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="First Name"
                  value={editFormData.firstName}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  placeholder="Enter first name"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Last Name"
                  value={editFormData.lastName}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  placeholder="Enter last name"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Business Name"
                  value={editFormData.businessName}
                  onChange={(e) => setEditFormData({ ...editFormData, businessName: e.target.value })}
                  placeholder="Enter business name"
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label="Business Type"
                  value={editFormData.businessType}
                  onChange={(value) => setEditFormData({ ...editFormData, businessType: value || '' })}
                  data={[
                    { value: 'retail', label: 'Retail Store' },
                    { value: 'restaurant', label: 'Restaurant/Food Service' },
                    { value: 'service', label: 'Service Business' },
                    { value: 'ecommerce', label: 'E-commerce' },
                    { value: 'other', label: 'Other' },
                  ]}
                  placeholder="Select business type"
                  clearable
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput
                  label="Phone"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </Grid.Col>
            </Grid>
            <Group justify="flex-end">
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSaveProfile}
                loading={savingProfile}
                style={{ color: 'white' }}
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        ) : (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>First Name</Text>
              <Text>{user.firstName || 'Not set'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Last Name</Text>
              <Text>{user.lastName || 'Not set'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Business Name</Text>
              <Text>{user.businessName || 'Not set'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Business Type</Text>
              <Text>
                {user.businessType === 'retail' ? 'Retail Store' :
                 user.businessType === 'restaurant' ? 'Restaurant/Food Service' :
                 user.businessType === 'service' ? 'Service Business' :
                 user.businessType === 'ecommerce' ? 'E-commerce' :
                 user.businessType === 'other' ? 'Other' :
                 user.businessType || 'Not set'}
              </Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Phone</Text>
              <Text>{user.phone || 'Not set'}</Text>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>Email</Text>
              <Text>{user.email}</Text>
            </Grid.Col>
            <Grid.Col span={12}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>User ID</Text>
              <Text size="xs" ff="monospace" c="dimmed">{user.id}</Text>
            </Grid.Col>
          </Grid>
        )}
      </Card>

      {/* Navigation Preferences */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <ThemeIcon size="lg" radius="md" variant="light" color="blue">
            <IconNavigation style={{ width: rem(20), height: rem(20) }} />
          </ThemeIcon>
          <div>
            <Title order={4}>Navigation Preferences</Title>
            <Text size="sm" c="dimmed">Choose how tenant switching behaves</Text>
          </div>
        </Group>

        <Stack gap="xs">
          <Paper
            p="md"
            radius="md"
            withBorder
            style={{ cursor: 'pointer', borderColor: navigationPreference === 'last-visited' ? 'var(--mantine-color-blue-6)' : undefined }}
            onClick={() => saveNavigationPreference('last-visited')}
          >
            <Group>
              <Radio checked={navigationPreference === 'last-visited'} onChange={() => {}} />
              <div style={{ flex: 1 }}>
                <Group justify="space-between">
                  <Text fw={500}>Navigate to Last Visited Page</Text>
                  <Badge size="xs" variant="light">Default</Badge>
                </Group>
                <Text size="sm" c="dimmed">When switching tenants, go to the last page you visited in that tenant</Text>
              </div>
            </Group>
          </Paper>

          <Paper
            p="md"
            radius="md"
            withBorder
            style={{ cursor: 'pointer', borderColor: navigationPreference === 'current-page' ? 'var(--mantine-color-blue-6)' : undefined }}
            onClick={() => saveNavigationPreference('current-page')}
          >
            <Group>
              <Radio checked={navigationPreference === 'current-page'} onChange={() => {}} />
              <div style={{ flex: 1 }}>
                <Text fw={500}>Stay on Current Page</Text>
                <Text size="sm" c="dimmed">When switching tenants, stay on the same page (if it exists in the new tenant)</Text>
              </div>
            </Group>
          </Paper>
        </Stack>

        {savingPreference && (
          <Group gap="xs" mt="sm">
            <Loader size="xs" />
            <Text size="sm" c="blue">Saving preference...</Text>
          </Group>
        )}
      </Card>

      {/* Platform Role & Privileges */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={4} mb="md">Platform Role & Privileges</Title>
        
        <Group mb="lg">
          <ThemeIcon size="xl" radius="md" color={getRoleColor(user.role)} variant="light">
            {getRoleIcon(user.role)}
          </ThemeIcon>
          <div>
            <Badge size="lg" color={getRoleColor(user.role)} variant="light">{user.role}</Badge>
            <Text size="sm" c="dimmed">{getRoleDescription(user.role)}</Text>
          </div>
        </Group>

        <Spoiler maxHeight={120} showLabel="Show all privileges" hideLabel="Hide privileges">
          <Stack gap="xs">
            {getPlatformPrivileges(user.role).map((privilege, index) => (
              <Group key={index} gap="xs">
                <ThemeIcon color="green" size="sm" radius="xl" variant="light">
                  <IconCheck style={{ width: rem(12), height: rem(12) }} />
                </ThemeIcon>
                <Text size="sm">{privilege}</Text>
              </Group>
            ))}
          </Stack>
        </Spoiler>
      </Card>

      {/* Location Capacity */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <ThemeIcon size="lg" radius="md" variant="light" color="blue">
            <IconBuilding style={{ width: rem(20), height: rem(20) }} />
          </ThemeIcon>
          <div>
            <Title order={4}>Location Capacity</Title>
            <Text size="sm" c="dimmed">Your location creation limits based on your role and subscription tier</Text>
          </div>
        </Group>
        <TenantLimitBadge variant="full" showUpgrade={true} />
      </Card>

      {/* SKU Usage */}
      <SubscriptionUsageBadge variant="card" showUpgradeLink={true} />

      {/* Tenant Access */}
      {user.tenants && user.tenants.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="md">
            <Group>
              <ThemeIcon size="lg" radius="md" variant="light" color="cyan">
                <IconBuilding style={{ width: rem(20), height: rem(20) }} />
              </ThemeIcon>
              <div>
                <Title order={4}>Tenant Access</Title>
                <Text size="sm" c="dimmed">Stores and locations you have access to</Text>
              </div>
            </Group>
            <Badge size="lg" color="cyan" variant="light">
              {user.tenants.length} {user.tenants.length === 1 ? 'Location' : 'Locations'}
            </Badge>
          </Group>

          <Stack gap="xs">
            {paginatedTenants.map((tenant) => {
              const tenantDetails = getTenantDetails(tenant.id);
              return (
                <Paper key={tenant.id} p="sm" radius="md" withBorder>
                  <Group justify="space-between">
                    <Group>
                      <ThemeIcon size="md" radius="md" variant="light" color="blue">
                        <IconBuilding style={{ width: rem(16), height: rem(16) }} />
                      </ThemeIcon>
                      <div>
                        <Text fw={500}>{tenant.name}</Text>
                        <Text size="xs" c="dimmed" ff="monospace">{tenant.id}</Text>
                      </div>
                    </Group>
                    <Group gap="xs">
                      {tenantDetails && (
                        <>
                          <Badge size="sm" color={getTierColor(tenantDetails.tier)} variant="light">
                            {formatTierName(tenantDetails.tier)}
                          </Badge>
                          <Badge size="sm" color={tenantDetails.status === 'active' ? 'green' : 'gray'} variant="light">
                            {tenantDetails.status}
                          </Badge>
                        </>
                      )}
                      <Badge size="sm" color={getRoleColor(tenant.role)} variant="light">
                        {tenant.role}
                      </Badge>
                    </Group>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        </Card>
      )}

      {/* Account Status */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <ThemeIcon size="lg" radius="md" variant="light" color="green">
            <IconCheck style={{ width: rem(20), height: rem(20) }} />
          </ThemeIcon>
          <div>
            <Title order={4}>Account Status</Title>
            <Text size="sm" c="dimmed">Your account health and activity</Text>
          </div>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Paper p="md" radius="md" bg="green.0">
              <Group>
                <ThemeIcon color="green" variant="light" radius="xl" size="lg">
                  <IconCheck style={{ width: rem(16), height: rem(16) }} />
                </ThemeIcon>
                <div>
                  <Text fw={500} c="green.9">Account Active</Text>
                  <Text size="xs" c="green.7">All systems operational</Text>
                </div>
              </Group>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Paper p="md" radius="md" bg="blue.0">
              <Group>
                <ThemeIcon color="blue" variant="light" radius="xl" size="lg">
                  <IconLock style={{ width: rem(16), height: rem(16) }} />
                </ThemeIcon>
                <div>
                  <Text fw={500} c="blue.9">Secure</Text>
                  <Text size="xs" c="blue.7">Authentication verified</Text>
                </div>
              </Group>
            </Paper>
          </Grid.Col>
        </Grid>
      </Card>
    </Stack>
  );
}

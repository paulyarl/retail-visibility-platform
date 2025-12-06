# Flexible Sidebar Navigation System

## Overview

This enhanced sidebar system provides collapsible, nested navigation with support for icons, badges, and different scopes (tenant, admin, platform).

## Features

- **Collapsible Navigation**: Click to expand/collapse menu sections
- **Nested Menus**: Support for multi-level navigation hierarchies
- **Icons & Badges**: Visual indicators and status badges
- **Auto-Expansion**: Automatically expands sections containing active pages
- **Scope Awareness**: Different configurations for tenant, admin, and platform contexts
- **Responsive Design**: Works on desktop and mobile
- **Accessibility**: Keyboard navigation and ARIA labels

## Quick Start

### 1. Basic Usage

```tsx
import GeneralSidebar from '@/components/GeneralSidebar';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <DashboardIcon />
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <SettingsIcon />,
    children: [
      { label: 'General', href: '/settings' },
      { label: 'Advanced', href: '/settings/advanced' }
    ]
  }
];

<GeneralSidebar 
  nav={navItems} 
  collapsible={true} 
  scope="tenant" 
/>
```

### 2. Using Layout Components

```tsx
import { TenantLayout } from '@/components/navigation/SidebarLayout';

export default function TenantPage() {
  return (
    <TenantLayout>
      <div>Your page content here</div>
    </TenantLayout>
  );
}
```

### 3. Custom Layout

```tsx
import SidebarLayout from '@/components/navigation/SidebarLayout';

const customNavItems = [
  // Your navigation items
];

export default function CustomPage() {
  return (
    <SidebarLayout 
      navItems={customNavItems}
      scope="admin"
      collapsible={true}
    >
      <div>Your content</div>
    </SidebarLayout>
  );
}
```

## NavItem Structure

```tsx
type NavItem = {
  label: string;           // Display text
  href: string;           // Navigation link
  icon?: React.ReactNode; // Optional icon
  badge?: {               // Optional status badge
    text: string;
    variant: 'default' | 'success' | 'warning' | 'error' | 'org';
  };
  children?: NavItem[];   // Nested menu items
  accessLevel?: 'public' | 'user' | 'admin' | 'owner';
};
```

## Badge Variants

- `default`: Gray badge
- `success`: Green badge (for active counts, success states)
- `warning`: Yellow badge (for warnings, pending items)
- `error`: Red badge (for errors, critical issues)
- `org`: Blue gradient badge (for organization features)

## Scope Options

- `workspace`: General workspace navigation
- `tenant`: Tenant/location scoped navigation
- `admin`: Administrative interface
- `platform`: Platform-wide navigation

## Examples

### Tenant Navigation

```tsx
const tenantNav = [
  {
    label: 'Dashboard',
    href: '/t/[tenantId]',
    icon: <DashboardIcon />
  },
  {
    label: 'Inventory',
    href: '/t/[tenantId]/items',
    icon: <InventoryIcon />,
    badge: { text: '47', variant: 'success' }
  },
  {
    label: 'Categories',
    href: '/t/[tenantId]/categories',
    icon: <CategoriesIcon />,
    children: [
      { label: 'All Categories', href: '/t/[tenantId]/categories' },
      { label: 'Quick Start', href: '/t/[tenantId]/categories/quick-start' }
    ]
  }
];
```

### Admin Navigation

```tsx
const adminNav = [
  {
    label: 'User Management',
    href: '/settings/admin/users',
    icon: <UsersIcon />,
    children: [
      { label: 'All Users', href: '/settings/admin/users' },
      { label: 'Invitations', href: '/settings/admin/invitations' }
    ]
  },
  {
    label: 'System Settings',
    href: '/settings/admin/system',
    icon: <SettingsIcon />,
    badge: { text: 'NEW', variant: 'warning' }
  }
];
```

## Integration with Existing Pages

To add this to your existing pages:

1. **Replace current sidebar**: Import and use `GeneralSidebar` instead of your current sidebar
2. **Update navigation structure**: Convert your nav items to the new `NavItem` format
3. **Add collapsible functionality**: Set `collapsible={true}` to enable expand/collapse
4. **Customize scope**: Use appropriate scope for context-aware headers

## Backward Compatibility

The enhanced `GeneralSidebar` maintains backward compatibility:

```tsx
// Old usage still works
<GeneralSidebar nav={oldNavItems} isMobile={false} />

// New enhanced features
<GeneralSidebar 
  nav={newNavItems} 
  collapsible={true} 
  scope="tenant" 
/>
```

## Files Created

- `GeneralSidebar.tsx` - Enhanced sidebar component
- `SidebarTemplates.tsx` - Pre-built templates for different scopes
- `SidebarLayout.tsx` - Layout wrapper components
- `README.md` - This usage guide

## Next Steps

1. Test the enhanced sidebar in your tenant pages
2. Customize navigation items for your specific use cases
3. Add icons and badges where appropriate
4. Implement role-based access control if needed
5. Test responsive behavior on mobile devices

# Propagation Control Panel Structure

## Overview
The Organization Dashboard needs to mirror the 7 propagation types from the tenant-scoped propagation page, organized into 4 groups.

## Source Reference
Tenant-scoped page: `/t/[tenantId]/settings/propagation/page.tsx`

## 4 Groups with 7 Types

### Group 1: Product & Catalog Management
**Description**: Propagate products, categories, and catalog structure

1. **Categories** (Purple)
   - Icon: Tag icon
   - Description: Propagate product categories and Google taxonomy alignments
   - Stats: "Bulk propagation"
   - Badge: ACTIVE
   - Action: Open categories modal

2. **Products/SKUs** (Blue)
   - Icon: Box/cube icon
   - Description: Propagate individual or bulk products to locations
   - Stats: "Single or bulk"
   - Badge: ACTIVE
   - Action: Open items modal / Go to Items page

### Group 2: Business Information
**Description**: Propagate business hours, profile, and operational details

3. **Business Hours** (Green)
   - Icon: Clock icon
   - Description: Propagate regular and special hours to all locations
   - Stats: "Hours template"
   - Badge: NEW
   - Action: Open business hours modal

4. **Business Profile** (Cyan)
   - Icon: Building icon
   - Description: Propagate business description, attributes, and settings
   - Stats: "Profile info"
   - Badge: NEW
   - Action: Open business profile modal

### Group 3: Configuration & Settings
**Description**: Propagate feature flags, permissions, and system settings

5. **Feature Flags** (Indigo)
   - Icon: Flag icon
   - Description: Enable or disable features across all locations
   - Stats: "Centralized control"
   - Badge: NEW
   - Action: Open feature flags modal

6. **User Roles & Permissions** (Pink)
   - Icon: Users icon
   - Description: Propagate user invitations and role assignments
   - Stats: "Team management"
   - Badge: NEW
   - Action: Open user roles modal

### Group 4: Branding & Assets
**Description**: Propagate logos, colors, and brand identity

7. **Brand Assets** (Orange)
   - Icon: Palette/paint icon
   - Description: Propagate logos, colors, and branding elements
   - Stats: "Brand consistency"
   - Badge: NEW
   - Action: Open brand assets modal

## Implementation Notes

### Current State (Organization Dashboard)
- Has 6 custom propagation types
- Not organized into groups
- Different colors and icons
- Missing several types from tenant page

### Required Changes
1. Replace all 6 cards with the 7 types above
2. Organize into 4 groups with section headers
3. Use exact same colors, icons, and descriptions
4. Add group headers with descriptions
5. Keep "Admin Only" visibility with ProtectedCard
6. Maintain existing "Bulk Sync from Hero" functionality
7. Add placeholders for other types (Coming Soon or link to tenant page)

### Layout Structure
```tsx
<CardContent>
  {/* Group 1: Product & Catalog Management */}
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
      Product & Catalog Management
    </h3>
    <p className="text-xs text-neutral-600 mb-4">
      Propagate products, categories, and catalog structure
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Categories card */}
      {/* Products/SKUs card */}
    </div>
  </div>

  {/* Group 2: Business Information */}
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
      Business Information
    </h3>
    <p className="text-xs text-neutral-600 mb-4">
      Propagate business hours, profile, and operational details
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Business Hours card */}
      {/* Business Profile card */}
    </div>
  </div>

  {/* Group 3: Configuration & Settings */}
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
      Configuration & Settings
    </h3>
    <p className="text-xs text-neutral-600 mb-4">
      Propagate feature flags, permissions, and system settings
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Feature Flags card */}
      {/* User Roles card */}
    </div>
  </div>

  {/* Group 4: Branding & Assets */}
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3">
      Branding & Assets
    </h3>
    <p className="text-xs text-neutral-600 mb-4">
      Propagate logos, colors, and brand identity
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Brand Assets card */}
    </div>
  </div>

  {/* Status Display (existing) */}
  {syncResult && (
    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
      ...
    </div>
  )}
</CardContent>
```

### Card Template
```tsx
<div className="p-4 bg-white rounded-lg border-2 border-[color]-200 hover:border-[color]-400 transition-colors">
  <div className="flex items-start gap-3 mb-3">
    <div className="p-2 bg-[color]-100 rounded-lg">
      {/* Icon SVG */}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <h4 className="font-semibold text-sm text-neutral-900">{title}</h4>
        <Badge variant="success|default" className="text-xs">{badge}</Badge>
      </div>
      <p className="text-xs text-neutral-600">{description}</p>
      <p className="text-xs text-neutral-500 mt-1">{stats}</p>
    </div>
  </div>
  <Button
    variant="primary|secondary|ghost"
    size="sm"
    className="w-full"
    onClick={action}
    disabled={disabled}
  >
    {buttonText}
  </Button>
</div>
```

## Color Mapping
- Purple (`purple-500`): Categories
- Blue (`blue-500`): Products/SKUs
- Green (`green-500`): Business Hours
- Cyan (`cyan-500`): Business Profile
- Indigo (`indigo-500`): Feature Flags
- Pink (`pink-500`): User Roles & Permissions
- Orange (`orange-500`): Brand Assets

## Next Steps
1. Backup current organization/page.tsx
2. Replace CardContent section with new structure
3. Keep existing state and handlers for "Bulk Sync from Hero"
4. Add placeholder actions for other types (link to tenant page or "Coming Soon")
5. Test with admin user to verify visibility
6. Test with member user to verify hidden
7. Deploy and verify on staging

## Benefits
- **Consistency**: Same types across tenant and organization pages
- **Clarity**: Organized into logical groups
- **Scalability**: Easy to add more types to groups
- **Professional**: Matches existing tenant page design
- **User-Friendly**: Clear categorization helps users find what they need

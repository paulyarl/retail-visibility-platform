# Changelog

## [Unreleased] - 2025-11-05

### Added - Enhanced Business Hours & Settings Organization

#### Business Hours Enhancements
- **Multiple Special Hours Per Day**: Support for split shifts and multiple time periods per date
  - Validation to prevent overlapping time periods
  - Visual indicators: red for overlaps, blue for multiple periods
  - Real-time status updates on storefront for each period
- **Live Preview Pane**: WYSIWYG preview showing exact storefront/dashboard display
  - Auto-refreshes every 30 seconds
  - Shows both storefront and dashboard views
  - Sticky positioning for easy reference while editing
- **Centralized Hours Logic**: Single source of truth in `/lib/hours-utils.ts`
  - Used by storefront, dashboard, and preview
  - Eliminates code duplication (~125 lines removed)
  - Easier maintenance and testing
- **Special Hours Guide**: Comprehensive info box explaining capabilities
  - Multiple periods per day support
  - Google sync limitations (2-3 periods)
  - Pro tip highlighting platform advantages over Google
  - Test-it-live call-to-action banner
- **Improved UX**: Feature-first design with guide below controls

#### Settings Page Reorganization
- **Quick Start & Onboarding Group** (tenant-scoped)
  - Business Profile Setup
  - Product Quick Start
  - Category Quick Start
- **Team Management Group**
  - Team Members (tenant-scoped)
  - Tenant Users
  - User Management (admin)
- **Google Business Profile Group** (tenant-scoped)
  - Business Hours (Auto-Sync badge)
  - Business Category (M3 badge)
  - Product Categories
- **Removed Duplicates**
  - Platform Offerings (kept in Subscriptions & Billing)
  - Permission Matrix (moved to Admin Tools)
- **Context-Aware Filtering**
  - Personal settings (Appearance, Language) hidden in tenant context
  - Admin settings filtered based on role
  - Empty groups automatically removed

#### Admin Tools Improvements
- Added Permission Matrix to Analytics Dashboards section
- Better organization of admin-only features

### Fixed
- Infinite update loop in TimeInput component (using ref to track last value)
- Missing Image import in storefront page
- Time range validation (prevent opening time after closing time)
- Overlap detection for both regular and special hours

### Technical
- Added `personalOnly` flag to SettingCard type for context filtering
- Improved settings group filtering logic
- Enhanced type safety for hours utilities

## [Unreleased] - 2025-11-04

### Added - Business Hours Feature

#### Feature Flag System Enhancements
- Added `FF_TENANT_GBP_HOURS_SYNC` platform feature flag for business hours management
- Added `description` field to both `PlatformFeatureFlag` and `TenantFeatureFlag` models
- Implemented flag description persistence and display in admin UI
- Added delete functionality for platform flags with cascade to tenant overrides
- Fixed tenant flags UI to use proper enable/disable instead of non-existent override endpoints

#### Business Hours Management
- Created `BusinessHours` and `BusinessHoursSpecial` database tables
- Implemented business hours API endpoints:
  - `GET/PUT /api/tenant/:tenantId/business-hours` - Regular weekly hours
  - `GET/PUT /api/tenant/:tenantId/business-hours/special` - Holiday/special hours
  - `POST /api/tenant/:tenantId/gbp/hours/mirror` - Sync to Google Business Profile
  - `GET /api/tenant/:tenantId/gbp/hours/status` - Check sync status
- Added business hours settings page at `/t/{tenantId}/settings/hours`
- Implemented weekly schedule editor with auto-save
- Added timezone picker with support for all major timezones
- Created special/holiday hours calendar component

#### Public Storefront Display
- Integrated business hours into public profile API (`/public/tenant/:tenantId/profile`)
- Added real-time open/closed status calculation with timezone support
- Display features:
  - Header: Real-time status with colored indicator (🟢 Open / 🔴 Closed)
  - Footer: Full weekly hours schedule
  - Shows next opening time when closed
  - Shows closing time when open
- Simplified storefront header to avoid duplicate contact information

#### Technical Improvements
- Standardized flag naming convention (removed non-standard `gbp_hours` flag)
- Fixed day name conversion from database format (MONDAY) to display format (Monday)
- Added proper feature flag checks via API instead of hardcoded environment variables
- Implemented proper auth token passing for server-side API calls
- Added debug logging for business hours data flow

### Fixed
- Fixed `enrichmentStatus` enum serialization error by setting NOT NULL constraint with default value
- Fixed tenant flags "Force On" button 404 error by implementing proper toggle functionality
- Removed duplicate contact information from storefront header and footer
- Fixed business hours not displaying due to day name case mismatch

### Database Migrations
- `20251104_add_feature_flag_description` - Added description column to feature flag tables
- `20251104_fix_enrichment_status_null` - Fixed enrichmentStatus NULL values and constraints
- Created `gbp_hours` flag (later removed in favor of standard naming)

### API Changes
- Updated `/public/tenant/:tenantId/profile` to include business hours from BusinessHours table
- All business hours endpoints now use standard `FF_TENANT_GBP_HOURS_SYNC` flag
- Platform flags API now supports description field
- Tenant flags API now supports description field

### UI/UX Improvements
- Admin platform flags UI shows descriptions with auto-save
- Admin tenant flags UI simplified with Enable/Disable buttons
- Storefront header shows only business name, logo, and real-time status
- Storefront footer shows complete weekly schedule in organized format
- Added visual indicators (green/red dots) for open/closed status

---

## Previous Changes
(Add previous changelog entries here)

# Broadcast Alerts — Agent User Guide

> **Feature**: CRM Admin Broadcast Alerts
> **Route**: `/settings/admin/crm/broadcast`
> **API**: `POST /api/admin/crm/alerts/broadcast`
> **Status**: Implemented July 2026

---

## Overview

The Broadcast Alerts feature allows platform admins to send alerts to all tenants or a selected subset of tenants from a single, modern UI within the CRM Admin panel. Alerts appear in each tenant's CRM alert feed and support optional Call-to-Action (CTA) links.

---

## How to Use

### 1. Navigate to Broadcast

- **CRM Dashboard**: Click the "Broadcast Alert" button in the top-right header
- **CRM Nav Panel**: Click "Broadcast" in the left sidebar (📢 icon)

### 2. Compose the Alert

#### Alert Type Presets

Eight preset cards provide quick-start templates with appropriate icons and alert types:

| Preset | Alert Type | Icon | Use Case |
|---|---|---|---|
| Announcement | `info` | 📢 | General platform news or updates |
| Security Alert | `warning` | 🔒 | Security incident or vulnerability notice |
| Emergency | `warning` | 🚨 | Critical issue requiring immediate attention |
| Promotion | `info` | 🎉 | Feature promotion or special offer |
| Milestone | `milestone` | 🏆 | Platform achievement or anniversary |
| Congratulations | `congratulations` | ✨ | Celebratory message for tenants |
| Subscription | `subscription` | 💳 | Billing or subscription-related notice |
| Maintenance | `info` | 🔧 | Scheduled maintenance or downtime |

Clicking a preset sets the alert type and icon. You can also override the type manually via the "Custom Type" dropdown.

#### Fields

- **Title** (required): Short headline for the alert
- **Body** (optional): Detailed message — supports multi-line text
- **Icon** (optional): Emoji displayed alongside the alert (defaults to 📢)

### 3. Optional CTA (Call to Action)

Toggle "Include CTA" to add a clickable button to each alert:

- **CTA Label**: Button text (e.g., "Learn More", "Read Details")
- **CTA Link**: URL the button links to (e.g., `https://docs.example.com/maintenance`)

When CTA is included, both values are stored in the alert's `metadata` field as `cta_label` and `cta_href`.

### 4. Select Recipients

Two modes:

#### Send to All Tenants

Toggle the "Send to All Tenants" checkbox at the top of the recipients panel.

- Fetches all active tenants (excludes `cancelled` subscription status)
- The tenant checklist is disabled when this is active
- A warning banner appears in the confirmation modal

#### Select Specific Tenants

Use the checklist to pick individual tenants:

- **Search**: Filter by tenant name, ID, or email
- **Tier filter**: Quick-filter buttons for `all`, `trial`, `starter`, `growth`, `scale`, `enterprise`
- **Select all visible**: Bulk-select/deselect all tenants matching current filters
- **Per-tenant checkboxes**: Each row shows tenant name, ID, tier badge, and subscription status badge

### 5. Review and Send

Click "Broadcast to N tenants" to open a confirmation modal:

- **Preview**: Shows how the alert will appear (icon, title, body, type badge, CTA)
- **Warning**: For send-to-all, a yellow warning banner reminds you to verify content
- **Confirm**: Click "Send to N tenants" to execute
- **Cancel**: Returns to the form without sending

### 6. After Sending

- **Success banner**: Green confirmation showing how many tenants received the alert
- **Form reset**: All fields, selections, and CTA are cleared
- **Error handling**: Red error banner with message if the broadcast fails

---

## API Reference

### `POST /api/admin/crm/alerts/broadcast`

**Auth**: Admin token (mounted externally via `authenticateToken`)

**Request Body**:

```json
{
  "send_to_all": false,
  "tenant_ids": ["tenant_001", "tenant_002"],
  "type": "warning",
  "title": "Scheduled Maintenance — July 15",
  "body": "The platform will be unavailable from 2-4 AM UTC on July 15.",
  "icon": "🔧",
  "metadata": {
    "cta_label": "Read Details",
    "cta_href": "https://docs.example.com/maintenance"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | One of: `info`, `warning`, `milestone`, `subscription`, `congratulations`, `welcome`, `order` |
| `title` | `string` | Yes | Alert headline |
| `send_to_all` | `boolean` | No | If `true`, broadcasts to all active tenants (excludes `cancelled`) |
| `tenant_ids` | `string[]` | Yes* | Array of tenant IDs (required when `send_to_all` is false) |
| `body` | `string` | No | Detailed message body |
| `icon` | `string` | No | Emoji string |
| `metadata` | `object` | No | Arbitrary metadata; used for CTA (`cta_label`, `cta_href`) |

**Response**:

```json
{
  "success": true,
  "data": [/* array of created CrmAlert objects */],
  "count": 42
}
```

**Error Responses**:

| Status | Error Code | Condition |
|---|---|---|
| 400 | `invalid_input` | Missing `type` or `title`; or missing `tenant_ids` when `send_to_all` is false |
| 400 | `no_tenants` | `send_to_all` is true but no active tenants found |
| 500 | `internal_error` | Server error during alert creation |

---

## Architecture & Implementation Notes

### Files Modified/Created

| File | Change |
|---|---|
| `apps/api/src/routes/crm/admin/crm-admin.ts` | Added `prisma` import; updated broadcast endpoint with `send_to_all` support |
| `apps/web/src/services/crm/CrmAdminService.ts` | Updated `broadcastAlert()` signature with `send_to_all`, CTA fields, and `{ alerts, count }` return |
| `apps/web/src/components/crm/CrmNavPanel.tsx` | Added "Broadcast" nav item with `IconBroadcast` |
| `apps/web/src/app/(platform)/settings/admin/crm/page.tsx` | Added "Broadcast Alert" button in dashboard header |
| `apps/web/src/app/(platform)/settings/admin/crm/broadcast/page.tsx` | New — server wrapper for the broadcast page |
| `apps/web/src/app/(platform)/settings/admin/crm/broadcast/BroadcastAlertsClient.tsx` | New — full broadcast UI client component |

### Key Design Decisions

1. **Send to All is server-side**: When `send_to_all` is true, the backend queries `prisma.tenants.findMany` for all non-cancelled tenants. This avoids the client needing to fetch and send hundreds of IDs.

2. **Per-tenant alert creation**: Each broadcast creates individual `crm_alerts` records via `alertService.create()` with `Promise.all()`. This ensures each tenant gets their own alert with proper ID generation and independent read/dismiss state.

3. **CTA stored in metadata**: The CTA label and href are stored in the alert's `metadata` JSON field rather than as dedicated columns. This keeps the schema flexible without migrations.

4. **Audit trail**: Every broadcast logs an audit entry with `entity_type: 'crm_alert_broadcast'`, the count of alerts sent, and whether it was a send-to-all operation.

5. **Type presets map to existing AlertType**: The presets use the existing `AlertType` enum values (`info`, `warning`, `milestone`, `subscription`, `congratulations`, `welcome`, `order`). Multiple presets can map to the same underlying type (e.g., both "Announcement" and "Maintenance" use `info`).

6. **Tenant list capped at 500**: The UI fetches tenants with `limit: 500` to cover most platform sizes. For larger tenant counts, the search and tier filters help narrow down the selection.

### Frontend Service Method

```typescript
// CrmAdminService.ts
async broadcastAlert(data: {
  tenant_ids?: string[];
  send_to_all?: boolean;
  type: string;
  title: string;
  body?: string;
  icon?: string;
  cta_label?: string;
  cta_href?: string;
  metadata?: Record<string, any>;
}): Promise<{ alerts: CrmAlert[]; count: number }>
```

### Existing Infrastructure Reused

- **CrmPageShell**: Layout wrapper with breadcrumbs and nav panel
- **CrmNavPanel**: Sidebar navigation (extended with Broadcast item)
- **UI components**: `Card`, `Button`, `Badge`, `Modal`, `ModalFooter`, `Textarea`, `Spinner` from `@/components/ui`
- **CrmAdminService**: Singleton pattern with cache invalidation via `invalidateServiceCaches()`
- **CrmAlertService.create()**: Existing service method for creating individual alerts
- **Audit middleware**: `audit()` function for compliance tracking

---

## Testing Checklist

- [ ] Navigate to `/settings/admin/crm/broadcast` — page loads with tenant list
- [ ] Select an alert type preset — type and icon update
- [ ] Enter title and body — form validates
- [ ] Toggle CTA — CTA fields appear
- [ ] Toggle "Send to All" — tenant checklist disables, target count updates
- [ ] Select specific tenants — checkboxes work, count updates
- [ ] Use search filter — tenant list filters correctly
- [ ] Use tier filter — tenant list filters by subscription tier
- [ ] Click "Select all visible" — bulk select/deselect works
- [ ] Click "Broadcast to N tenants" — confirmation modal opens with preview
- [ ] Confirm send — success banner appears with correct count
- [ ] Verify alerts appear in tenant CRM feeds
- [ ] Test error handling — network error shows error banner
- [ ] Verify audit log entry created with correct count and `send_to_all` flag

---

## Common Issues

| Issue | Solution |
|---|---|
| `IconMegaphone` not found | Use `IconBroadcast` from `@tabler/icons-react` — the installed version doesn't export `IconMegaphone` |
| Broadcast returns 0 tenants | Check that tenants exist with `subscription_status` other than `cancelled` |
| CTA not showing in tenant feed | The tenant-side alert rendering needs to read `metadata.cta_label` and `metadata.cta_href` — verify the tenant CRM alert component handles these metadata fields |
| Large tenant count slow | The UI caps at 500 tenants. For platforms with more, consider paginated selection or rely on "Send to All" |

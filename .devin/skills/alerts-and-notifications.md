---
description: How to add, extend, and integrate CRM alerts and email notifications on the VisibleShelf platform — patterns, services, routes, and frontend wiring
---

# Alerts & Notifications System Guide

This document describes the full alert and notification architecture on the VisibleShelf platform, how to add new alert types, how to wire email notifications, and how to integrate new event sources.

## Architecture Overview

The platform has **three distinct notification systems** that co-exist and often fire simultaneously for the same event:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EVENT (order, billing, security)                │
│                              │                                      │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │  CRM Alerts  │  │    Emails    │  │   Security   │             │
│   │ (in-app)     │  │ (external)   │  │   Alerts     │             │
│   │              │  │              │  │ (user-scoped)│             │
│   │ crm_alerts   │  │ Resend/      │  │ security_   │             │
│   │ table        │  │ Mailtrap     │  │ alerts table │             │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│          │                 │                 │                      │
│          ▼                 ▼                 ▼                      │
│   Tenant + Customer   Merchant +        User dashboard             │
│   CRM dashboards      Customer inbox    security panel              │
│   (widget + alerts    (via email        (security-alerts           │
│    page)              service)           routes)                   │
└─────────────────────────────────────────────────────────────────────┘
```

### System 1: CRM Alerts (In-App)

**Purpose**: Tenant-facing in-app notifications surfaced in the CRM widget and alerts page.

**Database**: `crm_alerts` table (Prisma model `crm_alerts`)
- Fields: `id`, `tenant_id`, `type`, `title`, `body`, `icon`, `is_read`, `is_dismissed`, `metadata` (JSON), `created_at`, `read_at`
- ID format: `crmalt-{tenantKey}-{nanoid8}` via `generateCrmAlertId()`
- Indexes: `[tenant_id, type]`, `[tenant_id, is_read, is_dismissed, created_at]`

**Backend Service**: `apps/api/src/services/CrmAlertService.ts` (singleton, extends `BaseService`)
- `create(data)` — generic alert creation
- `createOrderAlert(params)` — order-specific alert with predefined titles/bodies/icons
- `listByTenant(tenantId, filters)` — list undismissed alerts
- `markRead(alertId)`, `markAllRead(tenantId)`, `dismiss(alertId)`
- `countUnread(tenantId)`

**Alert Types** (enum `AlertType` in `apps/web/src/types/crm.ts`):
- `milestone` — platform milestones (first order, etc.)
- `subscription` — billing/subscription events
- `welcome` — onboarding welcome
- `info` — general information
- `warning` — warnings requiring attention
- `congratulations` — celebratory messages
- `order` — order lifecycle events

**Fire-and-forget pattern**: CRM alerts are always created fire-and-forget from notification services. Errors are caught and logged, never thrown:

```typescript
CrmAlertService.getInstance().createOrderAlert({
  tenantId: data.tenantId,
  orderId: data.orderId,
  eventType: data.type,
  customerName: data.customerName,
  amount: data.amount,
}).catch(err => console.error('[ServiceName] Failed to create CRM alert:', err));
```

### System 2: Email Notifications (External)

**Purpose**: Send transactional emails to merchants and customers for major events.

**Email Service**: `apps/api/src/services/email-service.ts` (singleton `emailService`)
- Provider-based: supports Resend, Mailtrap (pluggable via `EmailProvider` interface)
- `sendEmail({ to, subject, html, text })` → `EmailResult { success, messageId, error }`
- Fallback chain: tries primary provider, then fallbacks

**Specialized Email Services** (all in `apps/api/src/services/email/`):
- `AdminEmailService.ts` — notifications to platform admins
- `InvoiceEmailService.ts` — invoice emails
- `MerchantPayoutEmailService.ts` — payout notifications
- `DigitalDownloadEmailService.ts` — digital product delivery
- `PlatformFeeSummaryEmailService.ts` — platform revenue summaries

**Notification Log**: `notification_logs` table (Prisma model `notification_logs`)
- Fields: `id`, `tenant_id`, `type`, `sent` (boolean), `error_message`, `created_at`, `metadata` (JSON)
- ID format: `nlog-{uuid}`
- Serves as audit trail for all email notifications
- Admin viewable at `/api/admin/notification-logs`

### System 3: Security Alerts (User-Scoped)

**Purpose**: User-level security notifications (suspicious logins, rate limiting, etc.).

**Database**: `security_alerts` table (accessed via raw SQL in `apps/api/src/routes/security-alerts.ts`)
- Fields: `id`, `user_id`, `type`, `severity`, `title`, `message`, `metadata`, `read`, `dismissed`, `created_at`, `read_at`

**Infrastructure Alerting**: `apps/api/src/services/alerting.ts` (singleton `alertManager`)
- In-memory alert manager for performance/security/system issues
- Cooldown-based spam prevention (5-30 min per type)
- Severity levels: LOW, MEDIUM, HIGH, CRITICAL
- Alert types: SECURITY, PERFORMANCE, ERROR, SYSTEM, BUSINESS
- Auto-resolves non-critical alerts after 30 minutes
- External notification hook (`sendExternalNotification`) — placeholder for Slack/email integration

## Key Services & Their Roles

### OrderNotificationService
**File**: `apps/api/src/services/OrderNotificationService.ts`
**Pattern**: Sends emails + creates CRM alert + logs to `notification_logs` — all in one call.

```
sendNotification(data) →
  1. Build merchant email payload → emailService.sendEmail()
  2. Build customer email payload → emailService.sendEmail()
  3. Log to notification_logs
  4. Create CRM alert (fire-and-forget)
```

**Notification types**: `order_placed`, `order_cancelled`, `order_fulfilled`, `order_picked_up`, `order_shipped`, `order_out_for_delivery`, `order_delivered`, `deposit_forfeited`, `refund_processed`

**Convenience methods**: `notifyOrderPlaced()`, `notifyOrderCancelled()`, `notifyOrderFulfilled()`, `notifyOrderShipped()`, `notifyOrderOutForDelivery()`, `notifyOrderDelivered()`, `notifyDepositForfeited()`, `notifyRefundProcessed()`

### BillingNotificationService
**File**: `apps/api/src/services/subscription/BillingNotificationService.ts`
**Pattern**: Sends emails to all tenant owners + creates CRM alert + creates CRM task + logs.

```
sendNotification(data) →
  1. Get all tenant owner emails (user_tenants + business_profile)
  2. Send email to each owner
  3. Create CRM alert (once per event, not per owner)
  4. Log to notification_logs
```

**Notification types**: `payment_success`, `payment_failed`, `grace_period_warning`, `grace_period_final`, `payment_method_update_reminder`, `payment_method_added`, `subscription_canceled`, `subscription_reactivated`, `tier_changed`, `invoice_created`, `trial_started`, `trial_converted`, `trial_payment_failed`, `trial_expired`, `bsaas_purchase_success`, `bsaas_renewal_success`, `bsaas_renewal_failed`, `bsaas_grace_period_warning`, `bsaas_trial_started`, `bsaas_purchase_cancelled`

**CRM task creation**: Also creates a CRM task for critical billing events (payment failed, grace period, cancellation) via `createSubscriptionCrmTask()` — these surface as actionable items in the tenant's CRM dashboard.

### FulfillmentService
**File**: `apps/api/src/services/FulfillmentService.ts`
Creates CRM alerts for scheduled pickup status changes (fire-and-forget via `CrmAlertService.getInstance().createOrderAlert()`).

### OrderManagementService
**File**: `apps/api/src/services/OrderManagementService.ts`
Creates CRM alerts when order status changes (fire-and-forget).

## API Routes

### Tenant CRM Alert Routes
**File**: `apps/api/src/routes/crm/tenant/crm-tenant.ts`
- `GET /api/tenant/crm/alerts` — list tenant alerts (filter by type, unreadOnly)
- `PUT /api/tenant/crm/alerts/:alertId/read` — mark single alert read
- `PUT /api/tenant/crm/alerts/read-all` — mark all tenant alerts read
- `PUT /api/tenant/crm/alerts/:alertId/dismiss` — dismiss alert

### Admin CRM Alert Routes
**File**: `apps/api/src/routes/crm/admin/crm-admin.ts`
- `POST /api/admin/crm/alerts` — create alert for a single tenant
- `POST /api/admin/crm/alerts/broadcast` — broadcast same alert to multiple tenants

### Customer CRM Alert Routes
**File**: `apps/api/src/routes/crm/customer/crm-customer.ts`
- `GET /api/customer/crm/alerts` — list alerts scoped to customer's orders/tenants
- `PUT /api/customer/crm/alerts/:alertId/read` — mark read (with ownership check)
- `PUT /api/customer/crm/alerts/read-all` — mark all read
- `PUT /api/customer/crm/alerts/:alertId/dismiss` — dismiss (with ownership check)

**Customer scoping**: Customer alerts are scoped by `getCustomerAlertScope(customerEmail)` — finds all tenant IDs and order IDs from orders matching the customer's email. Order alerts are filtered to only those matching the customer's own orders.

### Tenant Notification Routes
**File**: `apps/api/src/routes/tenant-notifications.ts`
- `GET /api/tenants/:tenantId/notifications` — list notification logs (paginated)
- `PATCH /api/tenants/:tenantId/notifications/:notificationId/read`
- `PATCH /api/tenants/:tenantId/notifications/mark-all-read`
- `DELETE /api/tenants/:tenantId/notifications/:notificationId`
- `GET /api/tenants/:tenantId/notifications/stats`
- `GET /api/tenants/:tenantId/notifications/unread-count`

### Admin Notification Log Routes
**File**: `apps/api/src/routes/admin/notification-logs.ts`
- `GET /api/admin/notification-logs` — list all notification logs (filter by tenant, type, sent, date range)
- `GET /api/admin/notification-logs/stats` — summary stats (total, sent, failed, by type)
- `GET /api/admin/notification-logs/:id` — single log detail

### Customer Notification Preferences
**File**: `apps/api/src/routes/customer-notifications.ts`
- `GET /api/customer-notifications/preferences` — get notification preferences
- `PUT /api/customer-notifications/preferences` — update preferences

**Preferences**: `orderUpdates`, `shippingUpdates`, `heartUpdates`, `reviewReminders`, `reviewResponses`, `listUpdates`, `listReminders`, `promotionalEmails`, `recommendedProducts`, `priceDropAlerts`, `backInStock`, `smsEnabled`, `smsPhone`

### Security Alert Routes
**File**: `apps/api/src/routes/security-alerts.ts`
- `GET /api/security/alerts` — list user security alerts
- `PATCH /api/security/alerts/:alertId/read` — mark read
- `PATCH /api/security/alerts/:alertId/dismiss` — dismiss

## Frontend Services

### CrmTenantCrmService (Tenant)
**File**: `apps/web/src/services/crm/CrmTenantCrmService.ts`
- `listAlerts(filters)`, `markAlertRead(id)`, `markAllAlertsRead()`, `dismissAlert(id)`
- Cache key pattern: `crm-tenant-alerts-{queryString}`, 2-min TTL

### CrmAdminService (Admin)
**File**: `apps/web/src/services/crm/CrmAdminService.ts`
- `createAlert(data)` — POST to `/api/admin/crm/alerts`
- `broadcastAlert(data)` — POST to `/api/admin/crm/alerts/broadcast`

### CrmCustomerService (Customer)
**File**: `apps/web/src/services/crm/CrmCustomerService.ts`
- `listAlerts(filters)`, `markAlertRead(id)`, `markAllAlertsRead()`, `dismissAlert(id)`
- Cache key pattern: `crm-customer-alerts-{queryString}`, 2-min TTL

## Frontend Pages

### Tenant Alerts Page
**File**: `apps/web/src/app/t/[tenantId]/support/alerts/page.tsx`
- Filter by type (all, milestone, subscription, welcome, info, warning, congratulations, order)
- Mark individual alert read, mark all read, dismiss
- Type-specific colors and icons
- Unread badge count in nav

### CRM Widget (Tenant Dashboard)
Alerts appear in the CRM widget on `TenantDashboardV2` via `CrmTenantCrmService.getStats()` which returns `recent_alerts` and `unread_alert_count`.

## How to Add a New Alert Type

### Step 1: Add the type to the frontend type

In `apps/web/src/types/crm.ts`:
```typescript
export type AlertType = 'milestone' | 'subscription' | 'welcome' | 'info' | 'warning' | 'congratulations' | 'order' | 'your_new_type';
```

### Step 2: Add type color and icon to frontend pages

In `apps/web/src/app/t/[tenantId]/support/alerts/page.tsx`:
```typescript
const TYPE_COLORS: Record<string, string> = {
  // ... existing
  your_new_type: 'bg-teal-100 text-teal-800',
};
const TYPE_ICONS: Record<string, string> = {
  // ... existing
  your_new_type: '🔔',
};
```

### Step 3: Create alerts from your service (backend)

Use `CrmAlertService.getInstance().create()`:
```typescript
await CrmAlertService.getInstance().create({
  tenant_id: tenantId,
  type: 'your_new_type',
  title: 'Your alert title',
  body: 'Detailed message body',
  icon: '🔔',
  metadata: { key: 'value', event_id: eventId },
});
```

Or for order-related alerts, use `createOrderAlert()` with a new eventType:
```typescript
CrmAlertService.getInstance().createOrderAlert({
  tenantId,
  orderId,
  eventType: 'your_order_event',
  customerName,
  amount,
}).catch(err => console.error('[YourService] CRM alert failed:', err));
```

If using `createOrderAlert`, add the eventType to the `titles`, `bodies`, and `icons` maps in `CrmAlertService.ts`.

### Step 4: Add email notification (if needed)

Create a method in your service or a new email service:
```typescript
const emailPayload = {
  to: recipientEmail,
  subject: 'Your Subject',
  html: `<div>...</div>`,
  text: 'Plain text version',
};
const result = await emailService.sendEmail(emailPayload);
```

Log to notification_logs:
```typescript
await prisma.notification_logs.create({
  data: {
    tenant_id: tenantId,
    type: 'your_notification_type',
    sent: result.success,
    metadata: { ...eventData } as any,
  },
});
```

### Step 5: Wire both together in a notification method

Follow the `OrderNotificationService` pattern:
1. Send email(s) via `emailService.sendEmail()`
2. Log to `notification_logs`
3. Create CRM alert (fire-and-forget)
4. Return success boolean

## How to Add a New Event Source

When a new platform event needs notifications (e.g., inventory threshold, review submitted, etc.):

1. **Decide which systems should fire**: CRM alert only? Email + CRM alert? Security alert?
2. **Create or extend a notification service** following the `OrderNotificationService` pattern
3. **Add the event trigger** in the relevant route or service — call the notification method after the primary action succeeds
4. **Use fire-and-forget for CRM alerts**: `.catch(err => console.error(...))` — never let alert failure break the primary operation
5. **Log all email notifications** to `notification_logs` for audit trail
6. **Add frontend display** if new alert type (see "How to Add a New Alert Type" above)

## How to Integrate External Notification Channels

### Slack/Webhook Integration (Future)
The `alertManager` in `alerting.ts` has a `sendExternalNotification()` hook ready for implementation. To add Slack:

1. Implement `sendExternalNotification()` in `apps/api/src/services/alerting.ts`
2. Add Slack webhook URL to environment variables
3. Map severity to Slack notification format

### SMS Integration
Customer notification preferences already have `smsEnabled` and `smsPhone` fields. To add SMS:

1. Create an `SmsNotificationService` following the email service pattern
2. Check `customer_notification_preferences` before sending
3. Log to `notification_logs` with type prefix `sms_`

### Push Notifications (Future)
CRM alerts could trigger push notifications. Pattern:

1. Create a `PushNotificationService` 
2. Subscribe to new `crm_alerts` creation (via database trigger or service hook)
3. Send to tenant owner devices via FCM/APNs

## Important Patterns

### Fire-and-Forget
CRM alerts must NEVER block or fail the parent operation. Always use:
```typescript
CrmAlertService.getInstance().create({...})
  .catch(err => console.error('[ServiceName] CRM alert failed:', err));
```

### One Alert Per Event, Not Per Recipient
`BillingNotificationService` sends emails to each owner individually but creates only ONE CRM alert per billing event. CRM alerts are tenant-scoped, not user-scoped.

### Audit Trail
Every email notification should be logged to `notification_logs`. This provides:
- Admin visibility at `/api/admin/notification-logs`
- Tenant visibility at `/api/tenants/:tenantId/notifications`
- Delivery status tracking (`sent` boolean)

### Customer Ownership Scoping
Customer CRM alert routes verify ownership via `getCustomerAlertScope()`:
- Finds customer's orders by email
- Filters order alerts to only those matching customer's order IDs
- Non-order alerts (info, warning, subscription) are tenant-scoped and visible to all customers of that tenant

### CRM Widget Stats
`CrmTenantService.getTenantCrmStats()` includes alert counts:
- `recent_alerts` — last 5 undismissed alerts
- `unread_alert_count` — count of unread alerts
- `unread_count` — combined total of tickets + tasks + inquiries + alerts + activities

### User Read State
`CrmUserReadStateService` tracks per-user read timestamps for CRM widget scopes (including `ALERT_FEED`). This allows unread counts to be calculated based on last-read time rather than per-alert read flags.

## Key File Reference

| Component | File |
|-----------|------|
| CrmAlertService | `apps/api/src/services/CrmAlertService.ts` |
| OrderNotificationService | `apps/api/src/services/OrderNotificationService.ts` |
| BillingNotificationService | `apps/api/src/services/subscription/BillingNotificationService.ts` |
| EmailService | `apps/api/src/services/email-service.ts` |
| AdminEmailService | `apps/api/src/services/email/AdminEmailService.ts` |
| AlertManager (infra) | `apps/api/src/services/alerting.ts` |
| Security Alerts Routes | `apps/api/src/routes/security-alerts.ts` |
| Tenant CRM Alert Routes | `apps/api/src/routes/crm/tenant/crm-tenant.ts` |
| Admin CRM Alert Routes | `apps/api/src/routes/crm/admin/crm-admin.ts` |
| Customer CRM Alert Routes | `apps/api/src/routes/crm/customer/crm-customer.ts` |
| Tenant Notification Routes | `apps/api/src/routes/tenant-notifications.ts` |
| Admin Notification Log Routes | `apps/api/src/routes/admin/notification-logs.ts` |
| Customer Notification Prefs | `apps/api/src/routes/customer-notifications.ts` |
| CrmTenantCrmService (FE) | `apps/web/src/services/crm/CrmTenantCrmService.ts` |
| CrmAdminService (FE) | `apps/web/src/services/crm/CrmAdminService.ts` |
| CrmCustomerService (FE) | `apps/web/src/services/crm/CrmCustomerService.ts` |
| CRM Types | `apps/web/src/types/crm.ts` |
| Tenant Alerts Page | `apps/web/src/app/t/[tenantId]/support/alerts/page.tsx` |
| CrmTenantService (stats) | `apps/api/src/services/CrmTenantService.ts` |
| ID Generator | `apps/api/src/lib/id-generator.ts` |
| Prisma Schema (crm_alerts) | `apps/api/prisma/schema.prisma` (line ~560) |
| Prisma Schema (notification_logs) | `apps/api/prisma/schema.prisma` (line ~2264) |

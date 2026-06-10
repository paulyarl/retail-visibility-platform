# Internal CRM — Superseded Design Document (v2)

> **This document supersedes:**
> - `CRM_UIUX_DESIGN.md` (v1 UI/UX)
> - `CRM_IMPLEMENTATION_PLAN.md` (v1 Technical Plan)
> - `CRM_PHASED_IMPLEMENTATION_PLAN.md` (v1 Phased Plan)
>
> **Why superseded:** The v1 gap analysis identified 9 blocking issues and 5 moderate issues. Additionally, the CRM scope expanded from platform-only to a three-surface architecture (Platform Admin + Tenant + Customer). This document reconciles all gaps and incorporates the expanded scope into a single canonical reference.
>
> **Migration strategy:** Manual SQL DDL executed via SQL editor. No Prisma migrate. Both staging and production receive identical migrations in lock step. After DDL is applied, `prisma db pull && prisma generate` syncs the Prisma client.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model](#2-data-model)
3. [Auth & Role Model](#3-auth--role-model)
4. [Backend API Design](#4-backend-api-design)
5. [Frontend Architecture](#5-frontend-architecture)
6. [UI/UX Design](#6-uiux-design)
7. [Phased Implementation Plan](#7-phased-implementation-plan)
8. [Gap Resolution Tracker](#8-gap-resolution-tracker)
9. [Migration Scripts](#9-migration-scripts)
10. [Testing Strategy](#10-testing-strategy)
11. [Rollback Plan](#11-rollback-plan)

---

## 1. Architecture Overview

### 1.1 Three-Surface Architecture

The CRM serves three distinct actor types, each with their own auth context, API surface, and frontend singleton:

| Surface | Actor | Singleton Base | Auth Mechanism | API Prefix |
|---|---|---|---|---|
| **Platform Admin** | Platform users (admin, support, viewer) | `AdminApiSingleton` | Auth0 cookies → `x-auth0-id` / `x-auth0-email` | `/api/admin/crm/*` |
| **Tenant** | Tenant members (owner, admin, member) | `TenantApiSingleton` | Auth0 cookies → `x-auth0-id` + `X-Tenant-ID` | `/api/tenant/crm/*` |
| **Customer** | Customers (shoppers) | `CustomerApiSingleton` | JWT Bearer token + `X-Customer-ID` | `/api/customer/crm/*` |

### 1.2 Visibility Rules

| Entity | Platform Admin | Tenant User | Customer |
|---|---|---|---|
| `crm_contacts` | All tenants | Own tenant only | No access |
| `crm_support_tickets` | All tenants | Own tenant's tickets | Own tickets only (cross-tenant) |
| `crm_ticket_messages` | All | Own tenant; internal notes visible | Own tickets; `is_internal=false` filter |
| `crm_tasks` | All tenants | Own tenant only | No access |
| `crm_activities` | All | Own tenant; internal visible | Own tickets only; `is_internal=false` |
| `crm_inquiries` | All | Own tenant only | Own inquiries only |
| `orders` (transactions) | All tenants | Own tenant | Own orders only |

**Cross-tenant customer rule:** A customer can shop at multiple tenants. Their ticket list spans tenants. However, each tenant only sees tickets scoped to themselves — tenant A cannot see that a customer also has a ticket with tenant B.

### 1.3 Mental Model

**Tenant-centric with activity as the spine.**

A platform user navigates by tenant first. The tenant is the container. Inside the container, the Activity tab is the default view — it is the chronological spine connecting notes, ticket updates, task completions, and system events. Tickets, Tasks, and Transactions are specialized lenses into that tenant's world. The global Tickets and Tasks views exist for cross-tenant queue management (Support/Ops workflows), but the mental home is the tenant detail page.

---

## 2. Data Model

### 2.1 `crm_contacts`

Linked to `tenants` (required) and optionally to `customers`.

```prisma
model crm_contacts {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id     String   @db.VarChar(255)
  customer_id   String?  @db.VarChar(255)   // optional link to existing customer
  first_name    String   @db.VarChar(255)
  last_name     String?  @db.VarChar(255)
  email         String   @db.VarChar(255)
  phone         String?  @db.VarChar(50)
  role          String?  @db.VarChar(50)   // e.g. 'owner', 'billing', 'technical'
  is_primary    Boolean  @default(false)
  notes         String?
  created_at    DateTime @default(now()) @db.Timestamptz(6)
  updated_at    DateTime @updatedAt @db.Timestamptz(6)

  tenants       tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  customers     customers? @relation(fields: [customer_id], references: [id], onDelete: SetNull)

  @@index([tenant_id])
  @@index([email])
  @@index([is_primary])
}
```

**Gap fix:** `updated_at` uses `@updatedAt` for automatic Prisma-managed updates.

### 2.2 `crm_support_tickets`

Ticket lifecycle tied to a tenant. **New:** `customer_id` FK for customer-created tickets. `first_responded_at` for SLA tracking.

```prisma
model crm_support_tickets {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id         String    @db.VarChar(255)
  contact_id        String?   @db.Uuid          // set by platform/tenant users
  customer_id       String?   @db.VarChar(255)  // set when customer self-creates ticket
  title             String    @db.VarChar(255)
  description       String?
  status            String    @default("open") @db.VarChar(20)   // open, in_progress, waiting, resolved, closed
  priority          String    @default("medium") @db.VarChar(20) // low, medium, high, urgent
  category          String?   @db.VarChar(50)   // billing, technical, onboarding, general
  assigned_to       String?   @db.VarChar(255)  // platform user id
  first_responded_at DateTime? @db.Timestamptz(6)  // SLA: first response timestamp
  resolved_at       DateTime? @db.Timestamptz(6)
  created_at        DateTime  @default(now()) @db.Timestamptz(6)
  updated_at        DateTime  @updatedAt @db.Timestamptz(6)

  tenants           tenants    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  crm_contacts      crm_contacts? @relation(fields: [contact_id], references: [id], onDelete: SetNull)
  customers         customers? @relation(fields: [customer_id], references: [id], onDelete: SetNull)

  @@index([tenant_id, status])
  @@index([assigned_to, status])
  @@index([priority, status])
  @@index([customer_id, status])
  @@index([created_at])
}
```

**Gap fixes:**
- `customer_id` + `customers` relation: enables customer self-service ticket creation
- `first_responded_at`: enables Avg Response Time metric on dashboard
- `@updatedAt` on `updated_at`

### 2.3 `crm_ticket_messages`

**New table.** Structured conversation thread for tickets. Replaces the "append activity as note" pattern for ticket conversations. Enables:
- Customer replies visible to tenant
- Tenant internal notes hidden from customer
- Platform admin notes follow `is_internal` rules

```prisma
model crm_ticket_messages {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ticket_id    String   @db.Uuid
  author_id    String   @db.VarChar(255)
  author_type  String   @db.VarChar(20)    // platform | tenant | customer
  author_name  String   @db.VarChar(255)
  content      String
  is_internal  Boolean  @default(false)    // hidden from customer view
  created_at   DateTime @default(now()) @db.Timestamptz(6)

  crm_support_tickets crm_support_tickets @relation(fields: [ticket_id], references: [id], onDelete: Cascade)

  @@index([ticket_id, created_at])
}
```

### 2.4 `crm_activities`

Polymorphic audit-style log. **New:** `actor_type` field for three-actor model. `task_id` now has a proper Prisma relation.

```prisma
model crm_activities {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  ticket_id       String?  @db.Uuid          // optional FK to crm_support_tickets
  task_id         String?  @db.Uuid          // optional FK to crm_tasks
  actor_id        String   @db.VarChar(255)  // user or customer id who performed the action
  actor_type      String   @default("platform") @db.VarChar(20)  // platform | tenant | customer
  actor_name      String   @db.VarChar(255)
  activity_type   String   @db.VarChar(50)   // note, call, email, status_change, task_created, etc.
  content         String?                     // markdown or plain text
  metadata        Json?    @default("{}")
  is_internal     Boolean  @default(false)    // hidden from tenant/customer-facing views
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  tenants              tenants             @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  crm_support_tickets  crm_support_tickets? @relation(fields: [ticket_id], references: [id], onDelete: Cascade)
  crm_tasks            crm_tasks?          @relation(fields: [task_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, created_at])
  @@index([tenant_id, activity_type])
  @@index([ticket_id])
  @@index([task_id])
  @@index([actor_id, actor_type])
}
```

**Gap fixes:**
- `actor_type` field: distinguishes platform/tenant/customer actors for name resolution
- `crm_tasks` relation on `task_id`: enables cascade delete and type-safe navigation
- Index on `[actor_id, actor_type]`: efficient actor lookups

### 2.5 `crm_inquiries`

**New:** `customer_id` FK and `urgent` priority added.

```prisma
model crm_inquiries {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  contact_id      String?  @db.Uuid
  customer_id     String?  @db.VarChar(255)  // customer-submitted inquiries
  subject         String   @db.VarChar(255)
  body            String?
  status          String   @default("open") @db.VarChar(20)   // open, in_progress, resolved, closed
  priority        String   @default("medium") @db.VarChar(20) // low, medium, high, urgent
  assigned_to     String?  @db.VarChar(255)
  source          String?  @db.VarChar(50)   // web_form, email, chat, phone, customer_portal
  resolved_at     DateTime? @db.Timestamptz(6)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @updatedAt @db.Timestamptz(6)

  tenants         tenants       @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  crm_contacts    crm_contacts? @relation(fields: [contact_id], references: [id], onDelete: SetNull)
  customers       customers?    @relation(fields: [customer_id], references: [id], onDelete: SetNull)

  @@index([tenant_id, status])
  @@index([assigned_to, status])
  @@index([customer_id, status])
  @@index([created_at])
}
```

**Gap fixes:**
- `customer_id`: enables customer-submitted inquiries
- `urgent` priority: aligns with ticket priority scale for unified Requests Hub
- `resolved_at`: consistent with tickets (was missing)
- `@updatedAt` on `updated_at`

### 2.6 `crm_tasks`

Action items assignable to platform users, scoped to a tenant. **New:** `contact_id` for task-to-contact association.

```prisma
model crm_tasks {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String    @db.VarChar(255)
  contact_id      String?   @db.Uuid          // optional link to a specific contact
  title           String    @db.VarChar(255)
  description     String?
  status          String    @default("pending") @db.VarChar(20) // pending, in_progress, completed, cancelled
  priority        String    @default("medium") @db.VarChar(20) // low, medium, high
  due_date        DateTime? @db.Timestamptz(6)
  assigned_to     String?   @db.VarChar(255)  // platform user id
  created_by      String    @db.VarChar(255)
  completed_at    DateTime? @db.Timestamptz(6)
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  updated_at      DateTime  @updatedAt @db.Timestamptz(6)

  tenants         tenants       @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  crm_contacts    crm_contacts? @relation(fields: [contact_id], references: [id], onDelete: SetNull)

  @@index([tenant_id, status])
  @@index([assigned_to, status])
  @@index([contact_id])
  @@index([due_date])
  @@index([created_at])
}
```

**Gap fixes:**
- `contact_id`: enables "Call Jane about billing" tasks to link to a specific contact
- `@updatedAt` on `updated_at`

### 2.7 `crm_request_reads`

**New table.** Per-user read state for the Requests Hub unread indicator.

```prisma
model crm_request_reads {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id      String   @db.VarChar(255)    // platform user who read the request
  request_id   String   @db.Uuid            // ID of the ticket/task/inquiry
  request_type String   @db.VarChar(20)     // ticket | task | inquiry
  read_at      DateTime @default(now()) @db.Timestamptz(6)

  @@unique([user_id, request_id, request_type])
  @@index([user_id, read_at])
}
```

### 2.8 Reused Existing Tables

- `tenants` — master record (name, subscription_tier, subscription_status, service_level, location_status, created_at, etc.)
- `orders` — read-only transaction history (order_number, total_cents, order_status, payment_status, created_at)
- `users` — platform user lookup for assignments (first_name, last_name, email, role)
- `customers` — customer lookup for customer-scoped tickets (first_name, last_name, email, phone)
- `customer_tenant_relationships` — validates customer↔tenant relationship before ticket creation

### 2.9 Enum Extension

The existing `entity_type` enum (`inventory_item, tenant, policy, oauth, other`) must be extended for CRM audit entries:

```sql
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_contact';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_ticket';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_task';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_activity';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_inquiry';
```

---

## 3. Auth & Role Model

### 3.1 CRM Permissions (Platform)

Add to `PERMISSION_GROUPS` in both:
- `apps/api/src/config/role-groups.ts`
- `apps/web/src/config/rbac.ts`

```ts
CAN_VIEW_CRM: [
  USER_ROLES.PLATFORM_ADMIN,
  USER_ROLES.PLATFORM_SUPPORT,
  USER_ROLES.PLATFORM_VIEWER,
  USER_ROLES.ADMIN,
],

CAN_MANAGE_CRM_SALES: [
  USER_ROLES.PLATFORM_ADMIN,
  USER_ROLES.ADMIN,
],

CAN_MANAGE_CRM_SUPPORT: [
  USER_ROLES.PLATFORM_ADMIN,
  USER_ROLES.PLATFORM_SUPPORT,
  USER_ROLES.ADMIN,
],

CAN_MANAGE_CRM_OPS: [
  USER_ROLES.PLATFORM_ADMIN,
  USER_ROLES.ADMIN,
  // NOTE: PLATFORM_SUPPORT removed — Support manages tickets, not ops tasks
],
```

**Gap fix:** `PLATFORM_SUPPORT` removed from `CAN_MANAGE_CRM_OPS`. Support manages tickets; Ops manages tasks. The v1 design had an overlap where Support could do everything Ops could.

### 3.2 Role-to-Function Mapping

| Function | Mapped Permission | Typical Role |
|---|---|---|
| Sales (view pipeline, outreach) | `CAN_MANAGE_CRM_SALES` | `PLATFORM_ADMIN` |
| Support (tickets, contacts) | `CAN_MANAGE_CRM_SUPPORT` | `PLATFORM_SUPPORT` |
| Ops (tasks, tenant health) | `CAN_MANAGE_CRM_OPS` | `PLATFORM_ADMIN` |
| Read-only CRM access | `CAN_VIEW_CRM` | `PLATFORM_VIEWER` |

### 3.3 Tenant CRM Access

Tenant users access CRM via `checkTenantAccess` middleware — same pattern as existing tenant-scoped routes. No new permissions needed; tenant membership (via `user_tenants` table) is the gate.

### 3.4 Customer CRM Access

**New middleware:** `authenticateCustomer`

```ts
// apps/api/src/middleware/auth.ts — add after existing middleware

/**
 * Customer authentication middleware
 * Validates JWT Bearer token from customer sessions
 * Resolves to customers table (NOT users table)
 * Sets req.customer for downstream use
 */
export async function authenticateCustomer(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    // Also check X-Customer-ID + X-Customer-Token for session-based flows
    const customerId = req.headers['x-customer-id'] as string;
    const customerToken = req.headers['x-customer-token'] as string;
    if (!customerId || !customerToken) {
      return res.status(401).json({ error: 'customer_auth_required', message: 'Customer authentication required' });
    }
  }

  try {
    // Verify JWT via authService (same verifier as optionalAuth)
    const payload = authService.verifyAccessToken(token);

    // Resolve to customers table
    const { prisma } = await import('../prisma');
    const customer = await prisma.customers.findUnique({
      where: { id: payload.customerId || payload.userId },
      select: { id: true, email: true, first_name: true, last_name: true }
    });

    if (!customer) {
      return res.status(401).json({ error: 'customer_not_found', message: 'Customer not found' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'customer_auth_failed', message: 'Customer authentication failed' });
  }
}
```

**Express Request extension:**

```ts
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      customer?: { id: string; email: string; first_name: string | null; last_name: string | null };
    }
  }
}
```

### 3.5 Middleware Hierarchy (Updated)

| Priority | Middleware | Purpose | Used By |
|---|---|---|---|
| 1 | `authenticateToken` | Auth0 session → `users` table | Platform + Tenant surfaces |
| 2 | `requirePlatformUser` | Platform roles only | Admin CRM routes |
| 3 | `checkTenantAccess` | Platform users OR tenant members | Tenant CRM routes |
| 4 | `authenticateCustomer` | JWT Bearer → `customers` table | Customer CRM routes |
| 5 | `requireSelfOrPlatformAdmin` | Platform admin OR self-scoped data | Customer data access |

---

## 4. Backend API Design

### 4.1 File Layout

```
apps/api/src/
  routes/
    crm/
      admin/
        crm-admin.ts              ← admin route aggregator
        crm-admin-tenants.ts      ← list + detail + stats
        crm-admin-contacts.ts     ← CRUD
        crm-admin-tickets.ts      ← CRUD + assignment + status transitions
        crm-admin-inquiries.ts    ← CRUD + assignment
        crm-admin-requests.ts     ← unified read-only hub
        crm-admin-activities.ts   ← create + list
        crm-admin-tasks.ts        ← CRUD + assignment
        crm-admin-analytics.ts    ← dashboard stats + reporting
      tenant/
        crm-tenant.ts             ← tenant route aggregator
        crm-tenant-tickets.ts     ← tenant's own tickets + messages
        crm-tenant-tasks.ts       ← tenant's own tasks (read)
        crm-tenant-activities.ts  ← tenant's own activity feed
        crm-tenant-stats.ts       ← tenant CRM dashboard stats
      customer/
        crm-customer.ts           ← customer route aggregator
        crm-customer-tickets.ts   ← customer's own tickets + messages
        crm-customer-orders.ts    ← customer's own order history
        crm-customer-activities.ts ← customer's activity feed
  services/
    CrmTenantService.ts           ← aggregates tenant + order + ticket + task stats
    CrmContactService.ts
    CrmTicketService.ts
    CrmTicketMessageService.ts    ← NEW: structured ticket conversations
    CrmInquiryService.ts
    CrmRequestHubService.ts       ← unions tickets + tasks + inquiries
    CrmRequestReadService.ts      ← NEW: per-user read state management
    CrmActivityService.ts
    CrmTaskService.ts
    CrmAnalyticsService.ts
```

### 4.2 Platform Admin Endpoints

**All routes:** `authenticateToken` + `requirePlatformUser` + permission checks

| Method | Endpoint | Purpose | Permission |
|---|---|---|---|
| GET | `/api/admin/crm/tenants?q=&tier=&status=&assignedTo=&page=&limit` | Searchable tenant list with computed stats | `CAN_VIEW_CRM` |
| GET | `/api/admin/crm/tenants/:tenantId` | Full tenant profile + aggregates | `CAN_VIEW_CRM` |
| GET | `/api/admin/crm/tenants/:tenantId/transactions?page=&limit` | Paginated orders (read-only) | `CAN_VIEW_CRM` |
| GET | `/api/admin/crm/tenants/:tenantId/contacts` | List contacts | `CAN_VIEW_CRM` |
| POST | `/api/admin/crm/tenants/:tenantId/contacts` | Create contact | `CAN_MANAGE_CRM_SALES` |
| PUT | `/api/admin/crm/contacts/:contactId` | Update contact | `CAN_MANAGE_CRM_SALES` |
| DELETE | `/api/admin/crm/contacts/:contactId` | Delete contact | `CAN_MANAGE_CRM_SALES` |
| GET | `/api/admin/crm/tenants/:tenantId/tickets?status=&priority=` | List tickets for tenant | `CAN_VIEW_CRM` |
| POST | `/api/admin/crm/tenants/:tenantId/tickets` | Create ticket | `CAN_MANAGE_CRM_SUPPORT` |
| PUT | `/api/admin/crm/tickets/:ticketId` | Update ticket (status, assign, priority) | `CAN_MANAGE_CRM_SUPPORT` |
| GET | `/api/admin/crm/tickets?assignedTo=&status=&priority=` | Global ticket queue | `CAN_VIEW_CRM` |
| GET | `/api/admin/crm/tickets/:ticketId/messages` | Ticket conversation thread | `CAN_VIEW_CRM` |
| POST | `/api/admin/crm/tickets/:ticketId/messages` | Add message to ticket | `CAN_MANAGE_CRM_SUPPORT` |
| GET | `/api/admin/crm/tenants/:tenantId/inquiries?status=&priority=` | List inquiries | `CAN_VIEW_CRM` |
| POST | `/api/admin/crm/tenants/:tenantId/inquiries` | Create inquiry | `CAN_MANAGE_CRM_SUPPORT` |
| PUT | `/api/admin/crm/inquiries/:inquiryId` | Update inquiry | `CAN_MANAGE_CRM_SUPPORT` |
| GET | `/api/admin/crm/inquiries?assignedTo=&status=` | Global inquiries view | `CAN_VIEW_CRM` |
| GET | `/api/admin/crm/requests?type=&status=&priority=&assignedTo=&tenantId=&unread=&page=&limit` | Unified hub | `CAN_VIEW_CRM` |
| PATCH | `/api/admin/crm/requests/:requestId` | Polymorphic update (type in body) | `CAN_MANAGE_CRM_SUPPORT` |
| POST | `/api/admin/crm/requests/:requestId/read` | Mark read | `CAN_VIEW_CRM` |
| POST | `/api/admin/crm/requests/read-all` | Bulk mark-read | `CAN_VIEW_CRM` |
| GET | `/api/admin/crm/tenants/:tenantId/activities?type=&limit=` | Activity feed | `CAN_VIEW_CRM` |
| POST | `/api/admin/crm/tenants/:tenantId/activities` | Create activity/note | `CAN_MANAGE_CRM_SUPPORT` |
| POST | `/api/admin/crm/tickets/:ticketId/activities` | Ticket-scoped note | `CAN_MANAGE_CRM_SUPPORT` |
| GET | `/api/admin/crm/tasks?assignedTo=&status=&tenantId=` | Global task list | `CAN_VIEW_CRM` |
| POST | `/api/admin/crm/tasks` | Create task | `CAN_MANAGE_CRM_OPS` |
| PUT | `/api/admin/crm/tasks/:taskId` | Update task | `CAN_MANAGE_CRM_OPS` |
| DELETE | `/api/admin/crm/tasks/:taskId` | Delete task | `CAN_MANAGE_CRM_OPS` |
| GET | `/api/admin/crm/analytics/dashboard` | Dashboard stats | `CAN_VIEW_CRM` |
| GET | `/api/admin/crm/analytics/export?entity=&format=csv` | CSV export | `CAN_VIEW_CRM` |

**Gap fix:** All routes standardized on `/api/admin/crm/*` prefix. No `/api/crm/*` ambiguity.

### 4.3 Tenant Endpoints

**All routes:** `authenticateToken` + `checkTenantAccess`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/tenant/crm/stats` | Tenant CRM dashboard stats |
| GET | `/api/tenant/crm/contacts` | List own contacts |
| POST | `/api/tenant/crm/contacts` | Create contact |
| PUT | `/api/tenant/crm/contacts/:contactId` | Update contact |
| GET | `/api/tenant/crm/tickets?status=` | List own tickets |
| POST | `/api/tenant/crm/tickets` | Create ticket (tenant→platform or internal) |
| PUT | `/api/tenant/crm/tickets/:ticketId` | Update ticket status/assignment |
| GET | `/api/tenant/crm/tickets/:ticketId/messages` | Conversation thread (internal notes visible) |
| POST | `/api/tenant/crm/tickets/:ticketId/messages` | Reply to ticket |
| GET | `/api/tenant/crm/tasks?status=` | List own tasks (read-only) |
| GET | `/api/tenant/crm/activities?limit=&is_internal=false` | Activity feed (tenant view) |
| GET | `/api/tenant/crm/inquiries?status=` | List own inquiries |
| POST | `/api/tenant/crm/inquiries` | Submit inquiry |

### 4.4 Customer Endpoints

**All routes:** `authenticateCustomer`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/customer/crm/tickets?status=` | My tickets across all tenants |
| POST | `/api/customer/crm/tickets` | Create ticket (customer→tenant) |
| GET | `/api/customer/crm/tickets/:ticketId` | Ticket detail (own tickets only) |
| GET | `/api/customer/crm/tickets/:ticketId/messages` | Conversation (is_internal=false) |
| POST | `/api/customer/crm/tickets/:ticketId/messages` | Reply to my ticket |
| GET | `/api/customer/crm/orders` | My order history |
| GET | `/api/customer/crm/activities?limit=` | My activity feed (is_internal=false) |
| GET | `/api/customer/crm/inquiries?status=` | My inquiries |
| POST | `/api/customer/crm/inquiries` | Submit inquiry |

**Customer ticket creation validation:** Before creating a ticket, verify the customer has a `customer_tenant_relationships` record with the target tenant. The `tenant_id` is required in the POST body.

### 4.5 Route Registration

```ts
// apps/api/src/routes/mounts/admin-routes.ts — add CRM admin routes
import crmAdminRoutes from '../crm/admin/crm-admin';
app.use('/api/admin/crm', authenticateToken, requirePlatformUser, crmAdminRoutes);

// apps/api/src/routes/mounts/core-routes.ts — add tenant + customer CRM routes
import crmTenantRoutes from '../crm/tenant/crm-tenant';
import crmCustomerRoutes from '../crm/customer/crm-customer';
app.use('/api/tenant/crm', authenticateToken, checkTenantAccess, crmTenantRoutes);
app.use('/api/customer/crm', authenticateCustomer, crmCustomerRoutes);
```

### 4.6 Pagination Contract

All list endpoints return a consistent envelope:

```ts
interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### 4.7 Polymorphic Request Update

`PATCH /api/admin/crm/requests/:requestId` requires `{ type: 'ticket' | 'task' | 'inquiry', ...data }` in the body. The route handler dispatches to the correct service based on `type`. This is explicit, not inferred from ID prefix.

### 4.8 Audit Integration

All CRM mutations call `audit()` with the extended `entity_type` enum values:

```ts
await audit({
  tenantId: ticket.tenant_id,
  actor: req.user.userId,
  action: 'create',
  payload: { entity_type: 'crm_ticket', id: ticket.id, ... }
});
```

The `audit()` function at `apps/api/src/audit.ts` must be updated to map CRM action strings to the extended enum values instead of falling back to `'other'`.

---

## 5. Frontend Architecture

### 5.1 Three Service Singletons

```
apps/web/src/services/crm/
  CrmAdminService.ts        ← extends AdminApiSingleton   (platform CRM)
  CrmTenantCrmService.ts    ← extends TenantApiSingleton  (merchant CRM)
  CrmCustomerService.ts     ← extends CustomerApiSingleton (customer support portal)
```

### 5.2 `CrmAdminService.ts`

```ts
import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export class CrmAdminService extends AdminApiSingleton {
  private static instance: CrmAdminService;

  static getInstance(): CrmAdminService {
    if (!CrmAdminService.instance) {
      CrmAdminService.instance = new CrmAdminService('crm-admin', { ttl: 5 * 60 * 1000 });
    }
    return CrmAdminService.instance;
  }

  // --- Tenants (read-only for CRM context) ---
  async listTenants(params: CrmTenantListParams): Promise<PaginatedResult<CrmTenantSummary>> {
    const qs = new URLSearchParams(params as any).toString();
    const cacheKey = `crm-tenant-list-${qs}`;
    const result = await this.makeDefaultRequest<PaginatedResult<CrmTenantSummary>>(
      `/api/admin/crm/tenants?${qs}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async getTenantDetail(tenantId: string): Promise<CrmTenantDetail> {
    const cacheKey = `crm-tenant-${tenantId}`;
    const result = await this.makeDefaultRequest<CrmTenantDetail>(
      `/api/admin/crm/tenants/${tenantId}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // ... contacts, tickets, tasks, activities, requests follow same pattern
  // Query params appended to URL via URLSearchParams, NOT in RequestInit.params
  // Mutations (POST/PUT/DELETE) skip cache keys and call invalidateServiceCaches()

  public getServiceCachePatterns(): string[] {
    return ['crm-tenant-list-*', 'crm-tenant-*', 'crm-contacts-*', 'crm-tickets-*', 'crm-tasks-*', 'crm-activities-*', 'crm-requests-*'];
  }

  public async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCacheByPattern(pattern);
    }
  }
}

export const crmAdminService = CrmAdminService.getInstance();
```

**Gap fixes:**
- No `hashParams()` — uses `URLSearchParams.toString()` for deterministic cache keys
- No `{ method: 'GET', params }` — params appended to URL string directly
- `@updatedAt` on `updated_at` fields

### 5.3 `CrmTenantCrmService.ts`

```ts
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export class CrmTenantCrmService extends TenantApiSingleton {
  // Uses makeDefaultRequest with RequestType.TENANT
  // X-Tenant-ID injected automatically by onTenantRequest
  // Endpoints: /api/tenant/crm/*
  // ...
}
```

### 5.4 `CrmCustomerService.ts`

```ts
import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';

export class CrmCustomerService extends CustomerApiSingleton {
  // Uses makeCustomerRequest with JWT Bearer + X-Customer-ID
  // Endpoints: /api/customer/crm/*
  // ...
}
```

### 5.5 Type Definitions

New file: `apps/web/src/types/crm.ts`

```ts
// --- Pagination ---
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// --- Tenant ---
export interface CrmTenantListParams {
  q?: string;
  tier?: string;
  status?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
}

export interface CrmTenantSummary {
  id: string;
  name: string;
  tier: string;
  status: string;
  ltv_cents: number;
  open_tickets: number;
  pending_tasks: number;
  last_activity_at: string;
  last_activity_type: string;
}

export interface CrmTenantDetail extends CrmTenantSummary {
  contacts: CrmContact[];
  recent_activities: CrmActivity[];
  subscription_status: string;
  service_level: string;
}

// --- Contact ---
export interface CrmContact {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContactInput {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  role?: string;
  is_primary?: boolean;
  notes?: string;
  customer_id?: string;
}

// --- Ticket ---
export interface CrmTicket {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  customer_id: string | null;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string | null;
  assigned_to: string | null;
  first_responded_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmTicketMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  author_type: 'platform' | 'tenant' | 'customer';
  author_name: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

// --- Task ---
export interface CrmTask {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Activity ---
export interface CrmActivity {
  id: string;
  tenant_id: string;
  ticket_id: string | null;
  task_id: string | null;
  actor_id: string;
  actor_type: 'platform' | 'tenant' | 'customer';
  actor_name: string;
  activity_type: string;
  content: string | null;
  metadata: Record<string, any> | null;
  is_internal: boolean;
  created_at: string;
}

// --- Inquiry ---
export interface CrmInquiry {
  id: string;
  tenant_id: string;
  contact_id: string | null;
  customer_id: string | null;
  subject: string;
  body: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to: string | null;
  source: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Requests Hub ---
export type RequestType = 'ticket' | 'task' | 'inquiry';

export interface CrmRequestItem {
  id: string;
  type: RequestType;
  tenant_id: string;
  tenant_name: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
  is_read: boolean;
}

export interface RequestListParams {
  type?: RequestType;
  status?: string;
  priority?: string;
  assignedTo?: string;
  tenantId?: string;
  unread?: boolean;
  page?: number;
  limit?: number;
}
```

### 5.6 Route Structure

```
apps/web/src/app/settings/admin/crm/
  page.tsx                     ← CRM dashboard
  layout.tsx                   ← CRM layout with sub-nav tabs
  requests/
    page.tsx                   ← Requests Hub
  tenants/
    page.tsx                   ← Tenant list
    [tenantId]/
      layout.tsx               ← Tab layout: Overview | Activity | Tickets | Transactions | Tasks | Contacts
      overview/page.tsx
      activity/page.tsx
      tickets/page.tsx
      transactions/page.tsx
      tasks/page.tsx
      contacts/page.tsx
  tickets/
    page.tsx                   ← Global tickets queue
  tasks/
    page.tsx                   ← Global tasks board

apps/web/src/app/t/[tenantId]/
  support/
    page.tsx                   ← Tenant CRM support page (full-page widget)

apps/web/src/app/account/
  support/
    page.tsx                   ← Customer support portal
    [ticketId]/
      page.tsx                 ← Customer ticket detail
```

### 5.7 UI Components

```
apps/web/src/components/crm/
  TenantListTable.tsx          ← searchable, tier/status badges, last activity
  TenantDetailShell.tsx        ← header + subscription chips + quick actions
  TenantActivityFeed.tsx       ← chronological feed + inline note composer
  TicketList.tsx               ← table with status badges
  TicketDetailDrawer.tsx       ← side drawer for ticket view + message thread
  TicketMessageThread.tsx      ← NEW: structured conversation thread
  ContactCard.tsx              ← compact contact row with role badge
  RequestHubTable.tsx          ← unified request inbox table
  RequestHubFilters.tsx        ← chip filters for type + unread + priority
  TaskBoard.tsx                ← column board (pending / in-progress / completed / cancelled)
  TaskRow.tsx                  ← list row with assignee avatar + due date chip
  TransactionTable.tsx         ← read-only orders table
  CrmFilters.tsx               ← shared filter bar
  CrmTenantWidget.tsx          ← merchant dashboard right-panel widget
  CrmCustomerTicketList.tsx    ← NEW: customer's own ticket list
  CrmCustomerTicketDetail.tsx  ← NEW: customer ticket detail + reply
```

### 5.8 Navigation Integration

Add CRM entry to `AdminNavContent.tsx` `buildAdminNavItems`:

```ts
{
  label: 'CRM',
  icon: <Icon.Users />,
  href: '/settings/admin/crm',
  prefetch: false,
  children: [
    { label: 'Dashboard',    href: '/settings/admin/crm' },
    { label: 'Requests Hub', href: '/settings/admin/crm/requests', badge: 'openRequestCount' },
    { label: 'Tenants',      href: '/settings/admin/crm/tenants' },
    { label: 'Tickets',      href: '/settings/admin/crm/tickets' },
    { label: 'Tasks',        href: '/settings/admin/crm/tasks' },
  ],
  requiredPermission: 'CAN_VIEW_CRM',
}
```

### 5.9 RBAC Integration

```ts
const { hasPermission } = useRBAC();
const canViewCRM        = hasPermission('CAN_VIEW_CRM');
const canManageSales    = hasPermission('CAN_MANAGE_CRM_SALES');
const canManageSupport  = hasPermission('CAN_MANAGE_CRM_SUPPORT');
const canManageOps      = hasPermission('CAN_MANAGE_CRM_OPS');
```

- **Sales view**: Tenant list emphasized with subscription tier, MRR indicators, upgrade pipeline tags. Hide ticket deep-dive if not `CAN_MANAGE_CRM_SUPPORT`.
- **Support view**: Requests Hub as default landing. Show unified inbox, contact cards, quick assign, priority toggles.
- **Ops view**: Requests Hub + task board + tenant health alerts (failed syncs, overdue orders, subscription issues).

---

## 6. UI/UX Design

### 6.1 Primary Navigation Pattern

**Sidebar + Topbar + Inline Tabs**

- **Sidebar**: Collapsible admin sidebar (existing `AdminNavContent.tsx`). CRM is a top-level section under Admin.
- **Topbar inside CRM shell**: Sub-navigation bar with links to Dashboard, Requests Hub, Tenants, Tickets, Tasks. Acts as secondary nav scoped to the CRM module.
- **Inline Tabs**: On the Tenant Detail page, tabs switch between Overview / Activity / Tickets / Transactions / Tasks / Contacts. Tabs are sticky under the tenant header.

### 6.2 Screen Inventory

| Screen | Purpose | Entry Point |
|---|---|---|
| CRM Dashboard | Global stats: open tickets, overdue tasks, recent activity, tenant health alerts | `/settings/admin/crm` |
| Requests Hub | Unified inbox of all tenant requests (tickets + tasks + inquiries). Filterable, sortable, quick-actions. | `/settings/admin/crm/requests` |
| Tenants List | Searchable, filterable table of all tenants with computed CRM stats (LTV, open tickets, last activity) | Sidebar → CRM → Tenants |
| Tenant Detail | Container page for a single tenant; houses tabs | Click tenant row in list |
| Tenant Overview Tab | Quick stats, subscription status, contacts list, recent tasks/tickets | Default tab on Tenant Detail |
| Tenant Activity Tab | Chronological feed of notes, status changes, calls, emails | Tenant Detail → Activity |
| Tenant Tickets Tab | List of all tickets for this tenant + create ticket CTA | Tenant Detail → Tickets |
| Tenant Transactions Tab | Read-only order history with totals/status | Tenant Detail → Transactions |
| Tenant Tasks Tab | List of tasks scoped to this tenant + create task CTA | Tenant Detail → Tasks |
| Tenant Contacts Tab | CRUD contacts for this tenant | Tenant Detail → Contacts |
| Global Tickets Queue | All open tickets across tenants; filterable by assignee, priority, status | `/settings/admin/crm/tickets` |
| Global Tasks Board | Kanban-style board of tasks across tenants; filterable by assignee | `/settings/admin/crm/tasks` |
| Tenant Support Page | Full-page merchant CRM view | `/t/[tenantId]/support` |
| Customer Support Portal | Customer's own tickets and order history | `/account/support` |

### 6.3 Key Screens — ASCII Wireframes

#### Screen 1: Tenants List

```
+----------------------------------------------------------------------------------+
| Tenants                                                    [+ New Contact]       |
+----------------------------------------------------------------------------------+
| [Search tenants...    ] [Tier ▼] [Status ▼] [Assigned To ▼]     124 results      |
+----------------------------------------------------------------------------------+
| Tenant Name        | Tier      | Status | LTV     | Open Tix | Last Activity     |
|--------------------|-----------|--------|---------|----------|-------------------|
| Acme Grocery       | Starter   | Active | $4,200  | 2        | 2h ago — note     |
| BrightMart         | Pro       | Trial  | $0      | 0        | 1d ago — ticket   |
| Corner Deli        | Starter   | Active | $1,100  | 1        | 3h ago — task     |
| Downtown Pharmacy  | Enterprise| Active | $12,500 | 0        | 5m ago — call     |
| ...                                                                               |
+----------------------------------------------------------------------------------+
| < Prev  1  2  3  ...  13  Next >                                                 |
+----------------------------------------------------------------------------------+
```

#### Screen 2: Tenant Detail — Overview Tab (Default)

```
+----------------------------------------------------------------------------------+
| Acme Grocery                                    Starter | Active | [Edit Contact]  |
| 123 Market St, Springfield, MA                                            […]    |
+----------------------------------------------------------------------------------+
| Overview | Activity | Tickets | Transactions | Tasks | Contacts               |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +----------------+  +----------------+  +----------------+  +--------------+  |
|  | Lifetime Value |  | Open Tickets   |  | Pending Tasks  |  | Orders (30d) |  |
|  | $4,200         |  | 2              |  | 1              |  | 14           |  |
|  +----------------+  +----------------+  +----------------+  +--------------+  |
|                                                                                  |
|  Primary Contacts                                              + Add Contact  |
|  +-----------------------------------------------------------+                 |
|  | Name          | Role       | Email             | Phone    |                 |
|  |---------------|------------|-------------------|----------|                 |
|  | Jane Doe      | Owner      | jane@acme.com     | 555-0100 |                 |
|  | Bob Smith     | Billing    | bob@acme.com      | 555-0101 |                 |
|  +-----------------------------------------------------------+                 |
|                                                                                  |
|  Recent Activity (5)                                        [View All →]       |
|  +-----------------------------------------------------------+                 |
|  | Today  10:42a  | Support Note — "Called about refund"      | — Jane (S)     |
|  | Today   9:15a  | Ticket #2042 created — "Payment failed"   | — Auto         |
|  | Yesterday      | Task completed — "Onboarding call"        | — Mike (O)     |
|  +-----------------------------------------------------------+                 |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

#### Screen 3: Tenant Detail — Activity Tab

```
+----------------------------------------------------------------------------------+
| Acme Grocery                                                               […]   |
+----------------------------------------------------------------------------------+
| Overview | Activity (active) | Tickets | Transactions | Tasks | Contacts          |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  [All] [Notes] [Calls] [Emails] [System]                            [+ Add Note] |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Today  10:42a    Jane (Support)          [Note]                           |  |
|  |  "Called Jane about the failed payment. She will retry with new card."     |  |
|  |  [Edit] [Delete]                                        Internal             |  |
|  +----------------------------------------------------------------------------+  |
|  |  Today   9:15a    System                  [Ticket]                         |  |
|  |  Ticket #2042 created — "Payment failed" — assigned to Mike                  |  |
|  +----------------------------------------------------------------------------+  |
|  |  Yesterday        Mike (Ops)              [Task]                           |  |
|  |  Task "Onboarding call" completed.                                         |  |
|  +----------------------------------------------------------------------------+  |
|  |  Jun 4  2:00p     Jane (Support)          [Call]                           |  |
|  |  Duration 12m. Discussed refund policy.                                    |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  | [Write a note...                                ]  [Post]  [☐ Internal]    |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

#### Screen 4: Requests Hub (Unified Inbox)

```
+----------------------------------------------------------------------------------+
| Requests Hub                                                                  38 |
+----------------------------------------------------------------------------------+
| [Type: All ▼] [Status: Open ▼] [Priority: All ▼] [Assigned: Me ▼] [Tenant ▼]   |
| [Unread] [Tickets] [Tasks] [Inquiries]                                        [Mark All Read]
+----------------------------------------------------------------------------------+
| Type | Tenant            | Title / Summary              | Priority | Age  | Actions |
|------|-------------------|------------------------------|----------|------|---------|
| 🎫   | Acme Grocery      | Payment failed               | High     | 2h   | [View] [Assign]
| 📋   | BrightMart        | Refund approval              | Medium   | 3h   | [View] [Assign]
| 🎫   | Corner Deli       | Duplicate charge             | Urgent   | 5h   | [View] [Assign]
| 💬   | Downtown Pharmacy | "Can you add organic eggs?"  | Low      | 1d   | [View] [Assign]
| 📋   | Acme Grocery      | Onboarding call              | High     | 1d   | [View] [Assign]
| ...                                                                              |
+----------------------------------------------------------------------------------+
```

#### Screen 5: Global Tickets Queue

```
+----------------------------------------------------------------------------------+
| Tickets                                                                       38 |
+----------------------------------------------------------------------------------+
| [Status: Open ▼] [Priority: All ▼] [Assigned: Me ▼] [Tenant: All ▼]  [+ Ticket]  |
+----------------------------------------------------------------------------------+
| ID       | Tenant            | Title                  | Priority | Status | Age   |
|----------|-------------------|------------------------|----------|--------|-------|
| #2042    | Acme Grocery      | Payment failed         | High     | Open   | 2h    |
| #2041    | BrightMart        | Need onboarding help   | Medium   | Open   | 5h    |
| #2039    | Corner Deli       | Duplicate charge       | Urgent   | Open   | 1d    |
| #2038    | Downtown Pharmacy | Request tier upgrade   | Low      | Open   | 2d    |
| ...                                                                              |
+----------------------------------------------------------------------------------+
```

#### Screen 6: Global Tasks Board

```
+----------------------------------------------------------------------------------+
| Tasks                                                                         12 |
+----------------------------------------------------------------------------------+
| [Assigned: Me ▼] [Priority: All ▼] [Tenant: All ▼]                    [+ Task]   |
+----------------------------------------------------------------------------------+
|  +---------------------+  +---------------------+  +-------------------------+   |
|  | PENDING   (4)       |  | IN PROGRESS (6)     |  | COMPLETED   (2)         |   |
|  +---------------------+  +---------------------+  +-------------------------+   |
|  | Onboarding call     |  | Refund approval     |  | Sync catalog            |   |
|  | Acme Grocery        |  | BrightMart          |  | Corner Deli             |   |
|  | Due: Today          |  | Due: Tomorrow       |  | Jun 3                   |   |
|  | [Assignee avatar]   |  | [Assignee avatar]   |  | [Assignee avatar]       |   |
|  +---------------------+  | Catalog update      |  +-------------------------+   |
|  | Upload logo         |  | Downtown Pharmacy   |                             |   |
|  | Corner Deli         |  | Due: Jun 7          |                             |   |
|  | Due: Jun 8          |  +---------------------+                             |   |
|  +---------------------+                                                        |   |
+----------------------------------------------------------------------------------+
```

#### Screen 7: Tenant-Scoped CRM Engagement Widget (Merchant Dashboard)

```
+----------------------------------------------------------------------------------+
|  Support & Engagement                                                            |
|  [View All →]                                                                    |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Open Tickets (2)                                          [+ New Ticket]       |
|  +----------------------------------------------------------------------------+  |
|  |  #2042  Payment failed          High   ·  2h ago   ·  [View]             |  |
|  |  Assigned to: Mike (Support)                                               |  |
|  +----------------------------------------------------------------------------+  |
|  |  #2039  Duplicate charge         Medium ·  1d ago   ·  [View]             |  |
|  |  Assigned to: Jane (Support)                                               |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Pending Tasks (1)                                                             |
|  +----------------------------------------------------------------------------+  |
|  |  Refund approval                 Due: Tomorrow  ·  [View]                 |  |
|  |  Assigned to: Ops team                                                     |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Recent Activity (3)                                          [View All →]     |
|  +----------------------------------------------------------------------------+  |
|  |  Today  10:42a   Mike (Support) — Note on #2042                            |  |
|  |  "Called about refund. Will retry with new card."                          |  |
|  +----------------------------------------------------------------------------+  |
|  |  Today   9:15a   System — Ticket #2042 created                             |  |
|  +----------------------------------------------------------------------------+  |
|  |  Yesterday       Jane (Support) — Task "Refund approval" assigned          |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

**Data flow:** Tenant widget uses `CrmTenantCrmService` (extends `TenantApiSingleton`) calling `/api/tenant/crm/*` endpoints. Auth0 cookie-based auth with `X-Tenant-ID` header injected automatically.

#### Screen 8: Customer Support Portal (NEW)

```
+----------------------------------------------------------------------------------+
| My Support Tickets                                                               |
+----------------------------------------------------------------------------------+
| [Status: All ▼] [Tenant: All ▼]                              [+ New Ticket]     |
+----------------------------------------------------------------------------------+
| ID       | Store            | Title                  | Status   | Last Update     |
|----------|------------------|------------------------|----------|-----------------|
| #2042    | Acme Grocery     | Payment failed         | Open     | 2h ago          |
| #2035    | Corner Deli      | Missing item           | Resolved | 3d ago          |
| ...                                                                              |
+----------------------------------------------------------------------------------+

Ticket Detail (click row):
+----------------------------------------------------------------------------------+
| #2042 — Payment failed                                              Acme Grocery |
+----------------------------------------------------------------------------------+
| Status: Open  |  Priority: High  |  Assigned: Mike (Support)                     |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Messages:                                                                       |
|  +----------------------------------------------------------------------------+  |
|  |  Me (Customer)     Today 8:00a                                              |  |
|  |  "My payment keeps failing when I try to check out."                       |  |
|  +----------------------------------------------------------------------------+  |
|  |  Mike (Support)    Today 10:42a                                             |  |
|  |  "Called about refund. Will retry with new card."                           |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  | [Write a reply...                                             ]  [Send]    |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

**Data flow:** Customer portal uses `CrmCustomerService` (extends `CustomerApiSingleton`) calling `/api/customer/crm/*` endpoints. JWT Bearer token + `X-Customer-ID` header injected automatically.

### 6.4 Interaction & States

#### Important States

- **Empty list**: "No tenants match your filters." with a "Clear Filters" CTA.
- **Empty Requests Hub**: "All caught up — no open requests." with a celebratory icon; hide bulk action bar.
- **Empty activity feed**: "No activity yet. Write the first note." with the composer still visible.
- **No permission**: If a user lacks `CAN_MANAGE_CRM_SUPPORT`, hide the "+ Ticket" and "Edit" buttons; show read-only badges. Do not redirect — let them see data.
- **Loading**: Skeleton rows for tables (5-7 shimmer rows). Skeleton cards for stats. Spinner for tab content switching.
- **Error**: Inline error banner at top of tab content; retry button. Do not block the entire page.
- **Overdue indicators**: Due dates past today render in red; overdue tasks sort to top of Pending.

#### Core Interactions

- **Inline edit vs modal**: Notes use inline edit (click → textarea replaces text). Contacts use a modal form. Ticket creation uses a modal. Task creation uses a side drawer.
- **Bulk actions** (v2): On Tenants List and Tickets Queue, support shift-click multi-select → bulk assign / status change / tag.
- **Filters**: Applied client-side for small sets (<200), server-side for global queues. Filter state synced to URL query params so back button and deep links work.
- **Search**: Tenants list search is debounced 300ms, server-side across name + email + contact names.
- **Assignment**: Ticket/task assignment uses an autocomplete combobox (search users by name/email). Unassigned state is explicit.
- **Status transitions**: Ticket status changes (Open → In Progress → Waiting → Resolved → Closed) are logged automatically as system activities. **Waiting** is included in the UI flow (was missing in v1).
- **Task status**: Pending → In Progress → Completed. **Cancelled** shown as a filter option but not in the Kanban columns (cancelled tasks are excluded from the board by default, visible via filter).
- **Keyboard shortcuts** (nice-to-have): `/` focuses search, `n` opens create-note, `t` opens create-ticket, `r` opens create-request.

---

## 7. Phased Implementation Plan

### Phase 1: Foundation — Schema, Auth, Services, Tenant Widget, Customer Auth

**Goal**: Database, permissions, backend services, tenant CRM widget, and customer auth middleware are live. Platform admins can see tenant CRM stats; merchants can see their own support items; customers can authenticate and view their tickets.

**Duration**: 1.5–2 weeks

#### 1.1 Database Schema (Manual SQL DDL)

Apply 7 new tables + 1 enum extension:

- `crm_contacts`
- `crm_support_tickets` (with `customer_id`, `first_responded_at`)
- `crm_ticket_messages` (NEW)
- `crm_activities` (with `actor_type`, `crm_tasks` relation)
- `crm_inquiries` (with `customer_id`, `urgent` priority, `resolved_at`)
- `crm_tasks` (with `contact_id`)
- `crm_request_reads` (NEW)
- `entity_type` enum extension

**Tasks:**
- [ ] Execute SQL DDL against staging DB via SQL editor
- [ ] Execute same DDL against production DB via SQL editor
- [ ] Run `npx prisma db pull` to sync Prisma schema
- [ ] Run `npx prisma generate` to update Prisma client
- [ ] Verify all indexes and FK constraints
- [ ] Seed test data for 3 tenants (10 contacts, 5 tickets, 3 tasks, 8 activities, 2 inquiries, 5 messages)

#### 1.2 Auth & Permissions

**Tasks:**
- [ ] Add CRM permissions to `apps/api/src/config/role-groups.ts`
- [ ] Add CRM permissions to `apps/web/src/config/rbac.ts`
- [ ] Add `authenticateCustomer` middleware to `apps/api/src/middleware/auth.ts`
- [ ] Add `customer` property to Express Request type declaration
- [ ] Verify `useRBAC` hook resolves new permissions correctly

#### 1.3 Backend Services (Base Layer)

| Service | Responsibility |
|---|---|
| `CrmTenantService` | Aggregate tenant stats (orders + tickets + tasks + last activity) |
| `CrmContactService` | CRUD contacts |
| `CrmTicketService` | CRUD tickets + status transitions + assignment |
| `CrmTicketMessageService` | NEW: structured ticket conversations |
| `CrmTaskService` | CRUD tasks + status + assignment |
| `CrmActivityService` | Append-only activity log |
| `CrmInquiryService` | CRUD inquiries |
| `CrmRequestReadService` | NEW: per-user read state management |

**Tasks:**
- [ ] Create all 8 service files in `apps/api/src/services/`
- [ ] Write unit tests for each service (Jest, in-memory Prisma)
- [ ] Update `audit.ts` to map CRM entity types to extended enum values

#### 1.4 Frontend Service Singletons

**Tasks:**
- [ ] Create `apps/web/src/types/crm.ts` (all type definitions)
- [ ] Create `apps/web/src/services/crm/CrmAdminService.ts` (extends `AdminApiSingleton`)
- [ ] Create `apps/web/src/services/crm/CrmTenantCrmService.ts` (extends `TenantApiSingleton`)
- [ ] Create `apps/web/src/services/crm/CrmCustomerService.ts` (extends `CustomerApiSingleton`)
- [ ] Implement cache patterns and `invalidateServiceCaches()` for each

#### 1.5 Tenant CRM Widget

**Scope**: Tenant-scoped dashboard panel on `/t/[tenantId]/`.

**API Routes (tenant-scoped):**
- `GET /api/tenant/crm/stats`
- `GET /api/tenant/crm/tickets?status=&limit=`
- `GET /api/tenant/crm/tasks?status=&limit=`
- `GET /api/tenant/crm/activities?limit=&is_internal=false`
- `POST /api/tenant/crm/tickets`
- `GET /api/tenant/crm/tickets/:ticketId`

**Tasks:**
- [ ] Create `apps/api/src/routes/crm/tenant/crm-tenant.ts` and sub-routes
- [ ] Mount tenant CRM routes in `core-routes.ts`
- [ ] Create `CrmTenantWidget.tsx` component (right-panel on merchant dashboard)
- [ ] Sections: Open Tickets (2-3), Pending Tasks (1-2), Recent Activity (3-5)
- [ ] New Ticket modal with title + description + priority
- [ ] Side drawer for ticket/task detail view
- [ ] Auto-refresh every 60s

**Acceptance Criteria:**
- Merchant sees their open tickets on their own dashboard
- Merchant can create a new ticket without leaving their dashboard
- Ticket appears in panel immediately after creation
- Activity feed excludes internal notes
- Auth uses Auth0 cookies + `X-Tenant-ID` (not public/unauthenticated endpoints)

#### 1.6 Customer Auth & Minimal Routes

**Tasks:**
- [ ] Create `apps/api/src/routes/crm/customer/crm-customer.ts` and sub-routes
- [ ] Mount customer CRM routes
- [ ] `GET /api/customer/crm/tickets` — customer's own tickets
- [ ] `POST /api/customer/crm/tickets` — create ticket (validates `customer_tenant_relationships`)
- [ ] `GET /api/customer/crm/tickets/:ticketId/messages` — conversation (is_internal=false)
- [ ] `POST /api/customer/crm/tickets/:ticketId/messages` — reply

---

### Phase 2: Core CRM Entities — Admin CRUD, Tenant Detail, Customer Portal

**Goal**: Platform admins have full CRUD for tenants, contacts, tickets, tasks, and the activity feed. Tenant detail page with all tabs is functional. Customer support portal MVP is live.

**Duration**: 2.5–3 weeks

#### 2.1 Backend Admin API Routes

Register all CRUD routes under `/api/admin/crm`:

**Tasks:**
- [ ] Create route files (`crm-admin-tenants.ts`, `crm-admin-contacts.ts`, `crm-admin-tickets.ts`, `crm-admin-tasks.ts`, `crm-admin-activities.ts`, `crm-admin-inquiries.ts`)
- [ ] Create `crm-admin.ts` aggregator
- [ ] Mount in `admin-routes.ts`
- [ ] Zod validation schemas per route
- [ ] Audit logging on every mutation
- [ ] Middleware: `authenticateToken` + `requirePlatformUser` + permission checks
- [ ] Consistent `PaginatedResult<T>` envelope on all list endpoints

#### 2.2 Tenant List Page

**Route**: `/settings/admin/crm/tenants`

**Tasks:**
- [ ] Searchable, sortable table (name, tier, status, LTV, open tickets, last activity)
- [ ] Filter bar: search + tier + status + assignedTo
- [ ] Pagination with `PaginatedResult` envelope
- [ ] Row click → Tenant Detail
- [ ] "+ New Contact" CTA (opens modal)
- [ ] Loading skeletons

#### 2.3 Tenant Detail Shell

**Route**: `/settings/admin/crm/tenants/[tenantId]`

**Tasks:**
- [ ] Layout with sticky tab bar: Overview | Activity | Tickets | Transactions | Tasks | Contacts
- [ ] Tenant header: name + address + tier badge + status badge + quick-action dropdown
- [ ] Default tab: Overview

#### 2.4 Tenant Detail — Overview Tab

**Tasks:**
- [ ] Stats row: LTV, Open Tickets, Pending Tasks, Orders (30d)
- [ ] Primary Contacts inline table (max 4 rows) — click row → Contacts tab
- [ ] Recent Activity feed (5 items) — click "View All" → Activity tab
- [ ] Skeleton loading for stats cards

#### 2.5 Tenant Detail — Activity Tab

**Tasks:**
- [ ] Chronological feed with sub-filters (All / Notes / Calls / Emails / System)
- [ ] Inline composer at bottom: textarea + "Internal" checkbox + Post button
- [ ] Edit/Delete on user's own notes
- [ ] Activity type badges (Note, Call, Email, Ticket, Task, System)

#### 2.6 Tenant Detail — Contacts Tab

**Tasks:**
- [ ] Full CRUD table (name, role, email, phone, is_primary)
- [ ] "+ Add Contact" modal form
- [ ] Inline edit for simple fields
- [ ] Set primary contact action

#### 2.7 Tenant Detail — Tickets Tab

**Tasks:**
- [ ] Table: ID, title, priority, status, age, assigned_to
- [ ] "+ New Ticket" modal (title, description, priority, contact, assigned_to)
- [ ] Inline status change (Open → In Progress → Waiting → Resolved → Closed)
- [ ] Status transitions auto-log as system activities
- [ ] Click ticket → side drawer with message thread (`TicketMessageThread.tsx`)

#### 2.8 Tenant Detail — Tasks Tab

**Tasks:**
- [ ] Table: title, status, priority, due date, assignee, contact
- [ ] "+ New Task" side drawer
- [ ] Inline status change
- [ ] Overdue tasks sorted to top, red date indicator
- [ ] Cancelled tasks visible via filter but not in default view

#### 2.9 Tenant Detail — Transactions Tab

**Tasks:**
- [ ] Read-only table: order number, total, status, payment status, date
- [ ] Pagination
- [ ] Click row → external order detail (if exists)

#### 2.10 Customer Support Portal MVP

**Route**: `/account/support`

**Tasks:**
- [ ] Customer ticket list (cross-tenant)
- [ ] Ticket detail with message thread (is_internal=false)
- [ ] Reply composer
- [ ] New ticket form (tenant selector from `customer_tenant_relationships`)
- [ ] Order history read-only view

**Acceptance Criteria:**
- Platform admin can view all tenants with computed CRM stats
- Full CRUD for contacts, tickets, tasks per tenant
- Activity feed is append-only (no edits to system events)
- Status transitions log automatically to activity feed
- Ticket conversations use `crm_ticket_messages` (not activities)
- All tables have loading skeletons and empty states
- Customer can view and create tickets across tenants
- Customer cannot see internal notes

---

### Phase 3: Requests Hub, Global Views, & Analytics

**Goal**: Platform users have a unified inbox (Requests Hub) and global cross-tenant views. CRM dashboard shows actionable metrics.

**Duration**: 1.5–2 weeks

#### 3.1 Requests Hub (Unified Inbox)

**Route**: `/settings/admin/crm/requests`

**Backend:**
- [ ] `CrmRequestHubService.ts` — unions tickets + tasks + inquiries into a single query
- [ ] `GET /api/admin/crm/requests` with all filters
- [ ] `PATCH /api/admin/crm/requests/:requestId` — polymorphic update (type in body)
- [ ] `POST /api/admin/crm/requests/:requestId/read` — mark read (writes to `crm_request_reads`)
- [ ] `POST /api/admin/crm/requests/read-all` — bulk mark-read

**Frontend:**
- [ ] Filter bar: type + status + priority + assignedTo + tenant
- [ ] Quick filter chips: Unread | Tickets | Tasks | Inquiries
- [ ] Sortable table with type icons
- [ ] Inline actions: Assign popover, Status mini-menu
- [ ] Bulk select → bulk assign / status change / mark-read
- [ ] "+ Request" modal (pick type + tenant + details)
- [ ] Unread indicator: bold row + blue dot (from `crm_request_reads`)
- [ ] Row click → Tenant Detail → relevant tab with item pre-selected
- [ ] Empty state: "All caught up" with celebratory icon

#### 3.2 Global Tickets Queue

**Route**: `/settings/admin/crm/tickets`

**Tasks:**
- [ ] All open tickets across tenants
- [ ] Default filter for Support role: `Assigned: Me` + `Status: Open`
- [ ] Row click → Tenant Detail → Tickets Tab

#### 3.3 Global Tasks Board

**Route**: `/settings/admin/crm/tasks`

**Tasks:**
- [ ] Kanban columns: Pending | In Progress | Completed
- [ ] Cards: title, tenant name (linked), due date, assignee avatar
- [ ] Click card → side drawer with task details
- [ ] Drag-and-drop (v2 optional; v1 uses status select in drawer)

#### 3.4 CRM Dashboard

**Route**: `/settings/admin/crm`

**Tasks:**
- [ ] Stat cards: Open Tickets, Overdue Tasks, Active Tenants, Avg Response Time (uses `first_responded_at`)
- [ ] "My Tickets" table (5 rows, assigned to current user)
- [ ] Recent Activity feed (8 items)
- [ ] Quick links to Requests Hub, Tenants List, Global Tickets, Global Tasks

**Acceptance Criteria:**
- Support user lands on Requests Hub and sees their assigned open items
- Requests Hub correctly unions tickets + tasks + inquiries
- Bulk actions work across all three types
- Unread state persists across sessions (via `crm_request_reads`)
- Global Tickets queue filters work for cross-tenant views
- CRM Dashboard shows real computed stats including Avg Response Time

---

### Phase 4: Integrations, Polish, & Full Customer Portal

**Goal**: CRM is connected to the FAQ system. Merchant has a dedicated support page. Analytics and reporting are functional. Customer portal is full-featured.

**Duration**: 1.5–2 weeks

#### 4.1 FAQ Integration

**Tasks:**
- [ ] FAQ coverage gaps appear as CRM tasks for Support team
- [ ] "Write FAQ for top unanswered question" auto-creates a task
- [ ] Scheduled job queries `faq_feedback` for unresolved items → creates `crm_tasks`

#### 4.2 Chatbot Integration (BLOCKED)

> **Status:** BLOCKED — no chatbot service exists in the codebase. The FAQ system (`faq-public.ts`, `faqs` model, `faq_feedback` model) exists but there is no conversational bot. These tasks are deferred until a chatbot is built.

- [ ] ~Chatbot widget queries create `crm_inquiries` entries~ (DEFERRED)
- [ ] ~Ticket creation from bot~ (DEFERRED)

#### 4.3 Merchant-Facing Support Page

**Route**: `/t/[tenantId]/support`

**Tasks:**
- [ ] Full-page version of the CRM engagement widget
- [ ] Ticket history with search and filters
- [ ] Task history (read-only for merchant)
- [ ] Message thread for each ticket (tenant can see internal notes)
- [ ] New ticket creation form
- [ ] Uses `CrmTenantCrmService` (not `CrmAdminService`)

#### 4.4 Analytics & Reporting

**Tasks:**
- [ ] Ticket resolution time by assignee (uses `first_responded_at` and `resolved_at`)
- [ ] Ticket volume by category
- [ ] Tenant health score (composite: response time + ticket volume + task completion)
- [ ] Export to CSV for all tables (`GET /api/admin/crm/analytics/export?entity=&format=csv`)
- [ ] Streaming approach for large datasets (cursor-based pagination for export)

#### 4.5 Notifications

**Tasks:**
- [ ] Polling for real-time ticket/task updates (WebSocket deferred — no infrastructure exists)
- [ ] Email notifications for ticket assignment, status change, overdue tasks
- [ ] In-app notification bell for platform users

#### 4.6 Final Polish

**Tasks:**
- [ ] Keyboard shortcuts (`/` search, `n` new note, `t` new ticket)
- [ ] Bulk actions v2 (shift-click multi-select)
- [ ] Mobile responsiveness for merchant-facing widget and customer portal
- [ ] Performance audit: N+1 queries, cache hit rates
- [ ] E2E tests for critical flows (create ticket → assign → resolve → verify activity)

#### 4.7 Customer Portal Full Features

**Tasks:**
- [ ] Inquiry submission form
- [ ] Order detail view (linked from ticket context)
- [ ] Notification preferences for ticket updates

**Acceptance Criteria:**
- Merchant can access full support history at `/t/[tenantId]/support`
- FAQ gap analysis feeds into CRM as tasks
- Support team gets notified of new tickets and overdue tasks
- All major tables can export to CSV
- Customer portal supports ticket creation, reply, and inquiry submission
- E2E tests pass in CI

---

## 8. Gap Resolution Tracker

### Blocking Issues (Must Fix Before Implementation)

| # | Issue | Resolution | Document Section | Status |
|---|---|---|---|---|
| 1 | Route prefix inconsistency (`/api/crm/*` vs `/api/admin/crm/*`) | Standardized on `/api/admin/crm/*` for platform, `/api/tenant/crm/*` for tenant, `/api/customer/crm/*` for customer | §4.2, §4.3, §4.4 | ✅ Resolved |
| 2 | `crm_activities.task_id` missing Prisma relation | Added `crm_tasks crm_tasks? @relation(...)` with `onDelete: Cascade` | §2.4 | ✅ Resolved |
| 3 | `entity_type` enum can't represent CRM entities | Extended enum with 5 new values via ALTER TYPE | §2.9 | ✅ Resolved |
| 4 | "No customer-facing CRM" contradicts merchant widget | Removed constraint; expanded to three-surface architecture | §1.1, §8 item 4 | ✅ Resolved |
| 5 | `hashParams()` doesn't exist on base class | Replaced with `URLSearchParams.toString()` | §5.2 | ✅ Resolved |
| 6 | `makeDefaultRequest` signature mismatch for query params | Params appended to URL string, not passed in RequestInit | §5.2 | ✅ Resolved |
| 7 | CRM permissions missing from both RBAC configs | Added to both `role-groups.ts` and `rbac.ts`; fixed `CAN_MANAGE_CRM_OPS` to exclude `PLATFORM_SUPPORT` | §3.1 | 🔲 Pending (implement in Phase 1) |
| 8 | Merchant widget needs separate service (not AdminApiSingleton) | Created `CrmTenantCrmService` extending `TenantApiSingleton` | §5.3 | ✅ Resolved |
| 9 | No `crm_request_reads` table for unread tracking | Added new table with unique constraint on `(user_id, request_id, request_type)` | §2.7 | ✅ Resolved |

### Moderate Issues (Address During Implementation)

| # | Issue | Resolution | Document Section | Status |
|---|---|---|---|---|
| 10 | `CrmInquiryService` created in wrong phase | Moved to Phase 1 service layer | §1.3 | ✅ Resolved |
| 11 | No `first_responded_at` on tickets for SLA | Added `first_responded_at` field; set on first status change from `open` | §2.2 | ✅ Resolved |
| 12 | Ticket `waiting` status not in UI flow | Added `Waiting` to status transition UI and interaction spec | §6.4 | ✅ Resolved |
| 13 | No auto-seed from existing customers/users | Deferred to Phase 2 — add migration script to create initial contacts from `customer_tenant_relationships` | §7 (Phase 2) | 🔲 Pending |
| 14 | Chatbot integration blocked (no chatbot exists) | Marked Phase 4 chatbot tasks as BLOCKED/DEFERRED | §4.1 | ✅ Resolved |
| 15 | `crm_inquiries` missing `urgent` priority | Added `urgent` to inquiry priority values | §2.5 | ✅ Resolved |
| 16 | `crm_inquiries` missing `resolved_at` | Added `resolved_at` field | §2.5 | ✅ Resolved |
| 17 | `crm_tasks` missing `contact_id` | Added `contact_id` with relation to `crm_contacts` | §2.6 | ✅ Resolved |
| 18 | No structured ticket conversation model | Added `crm_ticket_messages` table | §2.3 | ✅ Resolved |
| 19 | No `actor_type` on activities for three-actor model | Added `actor_type` field with index | §2.4 | ✅ Resolved |
| 20 | No customer auth middleware | Added `authenticateCustomer` middleware | §3.4 | ✅ Resolved |
| 21 | No pagination metadata contract | Defined `PaginatedResult<T>` envelope | §4.6 | ✅ Resolved |
| 22 | `assigned_to` has no Prisma relation to `users` | Accepted as-is — resolved via separate query or join. Adding relation would require modifying `users` model which is high-risk. | §2.2, §2.6 | ⚠️ Accepted |
| 23 | `updated_at` not auto-updated by Prisma | Changed to `@updatedAt` on all CRM models | §2.1-2.6 | ✅ Resolved |

---

## 9. Migration Scripts

All migrations are manual SQL DDL executed via SQL editor. Run against staging first, then production.

### 9.1 Phase 1 Migration: CRM Core Tables

```sql
-- ============================================================
-- CRM Core Tables Migration
-- Execute against staging first, then production in lock step
-- ============================================================

-- 1. Extend entity_type enum for CRM audit entries
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_contact';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_ticket';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_task';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_activity';
ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'crm_inquiry';

-- 2. crm_contacts
CREATE TABLE IF NOT EXISTS crm_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     VARCHAR(255) NOT NULL,
  customer_id   VARCHAR(255),
  first_name    VARCHAR(255) NOT NULL,
  last_name     VARCHAR(255),
  email         VARCHAR(255) NOT NULL,
  phone         VARCHAR(50),
  role          VARCHAR(50),
  is_primary    BOOLEAN DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_contacts_tenant_id ON crm_contacts(tenant_id);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX idx_crm_contacts_is_primary ON crm_contacts(is_primary);

ALTER TABLE crm_contacts
  ADD CONSTRAINT fk_crm_contacts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_crm_contacts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 3. crm_support_tickets
CREATE TABLE IF NOT EXISTS crm_support_tickets (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          VARCHAR(255) NOT NULL,
  contact_id        UUID,
  customer_id        VARCHAR(255),
  title              VARCHAR(255) NOT NULL,
  description        TEXT,
  status             VARCHAR(20) DEFAULT 'open',
  priority           VARCHAR(20) DEFAULT 'medium',
  category           VARCHAR(50),
  assigned_to        VARCHAR(255),
  first_responded_at TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_tickets_tenant_status ON crm_support_tickets(tenant_id, status);
CREATE INDEX idx_crm_tickets_assigned_status ON crm_support_tickets(assigned_to, status);
CREATE INDEX idx_crm_tickets_priority_status ON crm_support_tickets(priority, status);
CREATE INDEX idx_crm_tickets_customer_status ON crm_support_tickets(customer_id, status);
CREATE INDEX idx_crm_tickets_created_at ON crm_support_tickets(created_at);

ALTER TABLE crm_support_tickets
  ADD CONSTRAINT fk_crm_tickets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_crm_tickets_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_crm_tickets_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 4. crm_ticket_messages
CREATE TABLE IF NOT EXISTS crm_ticket_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    UUID NOT NULL,
  author_id    VARCHAR(255) NOT NULL,
  author_type  VARCHAR(20) NOT NULL DEFAULT 'platform',
  author_name  VARCHAR(255) NOT NULL,
  content      TEXT NOT NULL,
  is_internal  BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_messages_ticket_created ON crm_ticket_messages(ticket_id, created_at);

ALTER TABLE crm_ticket_messages
  ADD CONSTRAINT fk_crm_messages_ticket FOREIGN KEY (ticket_id) REFERENCES crm_support_tickets(id) ON DELETE CASCADE;

-- 5. crm_activities
CREATE TABLE IF NOT EXISTS crm_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(255) NOT NULL,
  ticket_id       UUID,
  task_id         UUID,
  actor_id        VARCHAR(255) NOT NULL,
  actor_type      VARCHAR(20) DEFAULT 'platform',
  actor_name      VARCHAR(255) NOT NULL,
  activity_type   VARCHAR(50) NOT NULL,
  content         TEXT,
  metadata        JSONB DEFAULT '{}',
  is_internal     BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_activities_tenant_created ON crm_activities(tenant_id, created_at);
CREATE INDEX idx_crm_activities_tenant_type ON crm_activities(tenant_id, activity_type);
CREATE INDEX idx_crm_activities_ticket_id ON crm_activities(ticket_id);
CREATE INDEX idx_crm_activities_task_id ON crm_activities(task_id);
CREATE INDEX idx_crm_activities_actor ON crm_activities(actor_id, actor_type);

ALTER TABLE crm_activities
  ADD CONSTRAINT fk_crm_activities_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_crm_activities_ticket FOREIGN KEY (ticket_id) REFERENCES crm_support_tickets(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_crm_activities_task FOREIGN KEY (task_id) REFERENCES crm_tasks(id) ON DELETE CASCADE;

-- 6. crm_inquiries
CREATE TABLE IF NOT EXISTS crm_inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(255) NOT NULL,
  contact_id      UUID,
  customer_id     VARCHAR(255),
  subject         VARCHAR(255) NOT NULL,
  body            TEXT,
  status          VARCHAR(20) DEFAULT 'open',
  priority        VARCHAR(20) DEFAULT 'medium',
  assigned_to     VARCHAR(255),
  source          VARCHAR(50),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_inquiries_tenant_status ON crm_inquiries(tenant_id, status);
CREATE INDEX idx_crm_inquiries_assigned_status ON crm_inquiries(assigned_to, status);
CREATE INDEX idx_crm_inquiries_customer_status ON crm_inquiries(customer_id, status);
CREATE INDEX idx_crm_inquiries_created_at ON crm_inquiries(created_at);

ALTER TABLE crm_inquiries
  ADD CONSTRAINT fk_crm_inquiries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_crm_inquiries_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_crm_inquiries_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- 7. crm_tasks
CREATE TABLE IF NOT EXISTS crm_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       VARCHAR(255) NOT NULL,
  contact_id      UUID,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) DEFAULT 'pending',
  priority        VARCHAR(20) DEFAULT 'medium',
  due_date        TIMESTAMPTZ,
  assigned_to     VARCHAR(255),
  created_by      VARCHAR(255) NOT NULL,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crm_tasks_tenant_status ON crm_tasks(tenant_id, status);
CREATE INDEX idx_crm_tasks_assigned_status ON crm_tasks(assigned_to, status);
CREATE INDEX idx_crm_tasks_contact_id ON crm_tasks(contact_id);
CREATE INDEX idx_crm_tasks_due_date ON crm_tasks(due_date);
CREATE INDEX idx_crm_tasks_created_at ON crm_tasks(created_at);

ALTER TABLE crm_tasks
  ADD CONSTRAINT fk_crm_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_crm_tasks_contact FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL;

-- 8. crm_request_reads
CREATE TABLE IF NOT EXISTS crm_request_reads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      VARCHAR(255) NOT NULL,
  request_id   UUID NOT NULL,
  request_type VARCHAR(20) NOT NULL,
  read_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_crm_request_reads_unique ON crm_request_reads(user_id, request_id, request_type);
CREATE INDEX idx_crm_request_reads_user_read ON crm_request_reads(user_id, read_at);

-- 9. Add comment annotations for Prisma db pull
COMMENT ON TABLE crm_contacts IS 'Prisma: @@map("crm_contacts")';
COMMENT ON TABLE crm_support_tickets IS 'Prisma: @@map("crm_support_tickets")';
COMMENT ON TABLE crm_ticket_messages IS 'Prisma: @@map("crm_ticket_messages")';
COMMENT ON TABLE crm_activities IS 'Prisma: @@map("crm_activities")';
COMMENT ON TABLE crm_inquiries IS 'Prisma: @@map("crm_inquiries")';
COMMENT ON TABLE crm_tasks IS 'Prisma: @@map("crm_tasks")';
COMMENT ON TABLE crm_request_reads IS 'Prisma: @@map("crm_request_reads")';
```

### 9.2 Post-Migration Prisma Sync

After executing DDL:

```bash
cd apps/api
npx prisma db pull
npx prisma generate
```

Verify the generated Prisma client includes all 7 new models and the extended `entity_type` enum.

---

## 10. Testing Strategy

| Phase | Test Coverage |
|---|---|
| Phase 1 | Unit tests for all 8 services; tenant widget renders on merchant dashboard; `authenticateCustomer` middleware validates JWT correctly |
| Phase 2 | API integration tests for all admin CRUD routes; E2E for tenant detail tabs; customer ticket creation and reply flow |
| Phase 3 | E2E for Requests Hub filters, bulk actions, and navigation; unread state persistence via `crm_request_reads` |
| Phase 4 | E2E for FAQ gap → CRM task flow; notification delivery tests; CSV export for large datasets; customer portal full flow |

---

## 11. Rollback Plan

Each phase is additive. If a phase needs rollback:

- **Phase 4**: Remove FAQ hooks, disable merchant support page route, disable customer portal. CRM core remains.
- **Phase 3**: Hide Requests Hub and global views from sidebar. Tenant detail tabs remain.
- **Phase 2**: Hide CRM section from admin sidebar. Phase 1 tenant widget and customer auth remain.
- **Phase 1**: Drop CRM tables via SQL editor (reverse of §9.1 DDL). Merchant widget and customer auth disappear.

### Phase 1 Rollback SQL

```sql
DROP TABLE IF EXISTS crm_request_reads;
DROP TABLE IF EXISTS crm_ticket_messages;
DROP TABLE IF EXISTS crm_activities;
DROP TABLE IF EXISTS crm_inquiries;
DROP TABLE IF EXISTS crm_tasks;
DROP TABLE IF EXISTS crm_support_tickets;
DROP TABLE IF EXISTS crm_contacts;
-- Enum values cannot be removed in PostgreSQL; they remain but are unused
```

---

## Files Created / Modified Summary

### New Files (by Phase)

**Phase 1:**
- `apps/api/src/services/CrmTenantService.ts`
- `apps/api/src/services/CrmContactService.ts`
- `apps/api/src/services/CrmTicketService.ts`
- `apps/api/src/services/CrmTicketMessageService.ts`
- `apps/api/src/services/CrmTaskService.ts`
- `apps/api/src/services/CrmActivityService.ts`
- `apps/api/src/services/CrmInquiryService.ts`
- `apps/api/src/services/CrmRequestReadService.ts`
- `apps/web/src/types/crm.ts`
- `apps/web/src/services/crm/CrmAdminService.ts`
- `apps/web/src/services/crm/CrmTenantCrmService.ts`
- `apps/web/src/services/crm/CrmCustomerService.ts`
- `apps/api/src/routes/crm/tenant/crm-tenant.ts`
- `apps/api/src/routes/crm/tenant/crm-tenant-tickets.ts`
- `apps/api/src/routes/crm/tenant/crm-tenant-tasks.ts`
- `apps/api/src/routes/crm/tenant/crm-tenant-activities.ts`
- `apps/api/src/routes/crm/tenant/crm-tenant-stats.ts`
- `apps/api/src/routes/crm/customer/crm-customer.ts`
- `apps/api/src/routes/crm/customer/crm-customer-tickets.ts`
- `apps/api/src/routes/crm/customer/crm-customer-orders.ts`
- `apps/api/src/routes/crm/customer/crm-customer-activities.ts`
- `apps/web/src/components/crm/CrmTenantWidget.tsx`

**Phase 2:**
- `apps/api/src/routes/crm/admin/crm-admin.ts`
- `apps/api/src/routes/crm/admin/crm-admin-tenants.ts`
- `apps/api/src/routes/crm/admin/crm-admin-contacts.ts`
- `apps/api/src/routes/crm/admin/crm-admin-tickets.ts`
- `apps/api/src/routes/crm/admin/crm-admin-tasks.ts`
- `apps/api/src/routes/crm/admin/crm-admin-activities.ts`
- `apps/api/src/routes/crm/admin/crm-admin-inquiries.ts`
- `apps/web/src/app/settings/admin/crm/page.tsx`
- `apps/web/src/app/settings/admin/crm/layout.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/layout.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/overview/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/activity/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/tickets/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/transactions/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/tasks/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/contacts/page.tsx`
- `apps/web/src/components/crm/TenantListTable.tsx`
- `apps/web/src/components/crm/TenantDetailShell.tsx`
- `apps/web/src/components/crm/TenantActivityFeed.tsx`
- `apps/web/src/components/crm/TicketList.tsx`
- `apps/web/src/components/crm/TicketDetailDrawer.tsx`
- `apps/web/src/components/crm/TicketMessageThread.tsx`
- `apps/web/src/components/crm/ContactCard.tsx`
- `apps/web/src/components/crm/TaskBoard.tsx`
- `apps/web/src/components/crm/TaskRow.tsx`
- `apps/web/src/components/crm/TransactionTable.tsx`
- `apps/web/src/components/crm/CrmFilters.tsx`
- `apps/web/src/components/crm/CrmCustomerTicketList.tsx`
- `apps/web/src/components/crm/CrmCustomerTicketDetail.tsx`
- `apps/web/src/app/account/support/page.tsx`
- `apps/web/src/app/account/support/[ticketId]/page.tsx`

**Phase 3:**
- `apps/api/src/services/CrmRequestHubService.ts`
- `apps/api/src/routes/crm/admin/crm-admin-requests.ts`
- `apps/api/src/routes/crm/admin/crm-admin-analytics.ts`
- `apps/web/src/app/settings/admin/crm/requests/page.tsx`
- `apps/web/src/app/settings/admin/crm/tickets/page.tsx`
- `apps/web/src/app/settings/admin/crm/tasks/page.tsx`
- `apps/web/src/components/crm/RequestHubTable.tsx`
- `apps/web/src/components/crm/RequestHubFilters.tsx`

**Phase 4:**
- `apps/web/src/app/t/[tenantId]/support/page.tsx`
- `apps/api/src/services/CrmNotificationService.ts`
- `apps/api/src/services/CrmAnalyticsService.ts`
- `apps/api/src/jobs/faq-gap-to-crm-task.ts` (scheduled job)

### Modified Files (all phases)

- `apps/api/prisma/schema.prisma` — auto-updated by `prisma db pull` after DDL
- `apps/api/src/config/role-groups.ts` — add CRM permissions
- `apps/web/src/config/rbac.ts` — add CRM permissions
- `apps/api/src/middleware/auth.ts` — add `authenticateCustomer` middleware + `customer` Request type
- `apps/api/src/audit.ts` — map CRM entity types to extended enum values
- `apps/api/src/routes/mounts/admin-routes.ts` — mount CRM admin routes
- `apps/api/src/routes/mounts/core-routes.ts` — mount tenant + customer CRM routes
- `apps/web/src/components/navigation/AdminNavContent.tsx` — add CRM nav section
- `apps/web/src/app/t/[tenantId]/page.tsx` — embed CRM tenant widget

---

## Success Criteria (End of Phase 4)

- [ ] Merchant can see and create support tickets from their own dashboard
- [ ] Customer can view their tickets across tenants and reply to them
- [ ] Platform admin has full CRM: tenants, contacts, tickets, tasks, activities
- [ ] Support user has a unified Requests Hub inbox with unread tracking
- [ ] All status transitions are auditable in the activity feed
- [ ] Ticket conversations use structured messages (not activity notes)
- [ ] All major tables have search, filter, sort, and pagination
- [ ] FAQ gap analysis feeds into CRM as tasks
- [ ] E2E tests cover create → assign → resolve → verify flows

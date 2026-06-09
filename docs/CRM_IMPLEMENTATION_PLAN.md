# Internal Tenant CRM — Technical Implementation Plan

## 1. Overview

Build an internal tenant-centric CRM under `/settings/admin/crm` for three platform roles: **Sales**, **Support**, and **Ops**. It reuses the existing PostgreSQL (Supabase-hosted) database via Prisma, Express API middleware, Next.js App Router, and the established RBAC/auth stack (Auth0 + `useRBAC`).

**Scope:**
- Tenant list with search, filters, and quick stats
- Tenant detail page with tabs: Overview, Activity/Notes, Support Tickets, Transactions (read-only)
- Contacts associated with a tenant
- Tasks assignable to platform users

---

## 2. Data Model (Prisma Schema Additions)

Add five normalized tables. All use `gen_random_uuid()` PKs, `created_at/updated_at`, and indexes on foreign keys + status.

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
  updated_at    DateTime @default(now()) @db.Timestamptz(6)

  tenants       tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  customers     customers? @relation(fields: [customer_id], references: [id], onDelete: SetNull)

  @@index([tenant_id])
  @@index([email])
  @@index([is_primary])
}
```

### 2.2 `crm_support_tickets`
Ticket lifecycle tied to a tenant.

```prisma
model crm_support_tickets {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  contact_id      String?  @db.Uuid
  title           String   @db.VarChar(255)
  description     String?
  status          String   @default("open") @db.VarChar(20)   // open, in_progress, waiting, resolved, closed
  priority        String   @default("medium") @db.VarChar(20) // low, medium, high, urgent
  category        String?  @db.VarChar(50)   // billing, technical, onboarding, general
  assigned_to     String?  @db.VarChar(255)  // platform user id
  resolved_at     DateTime? @db.Timestamptz(6)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  tenants         tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  crm_contacts    crm_contacts? @relation(fields: [contact_id], references: [id], onDelete: SetNull)

  @@index([tenant_id, status])
  @@index([assigned_to, status])
  @@index([priority, status])
  @@index([created_at])
}
```

### 2.3 `crm_activities`
Polymorphic audit-style log for notes, calls, emails, and system events.

```prisma
model crm_activities {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  ticket_id       String?  @db.Uuid          // optional FK to crm_support_tickets
  task_id         String?  @db.Uuid          // optional FK to crm_tasks
  actor_id        String   @db.VarChar(255) // platform user id who performed the action
  actor_name      String   @db.VarChar(255)
  activity_type   String   @db.VarChar(50)  // note, call, email, status_change, task_created, etc.
  content         String?                   // markdown or plain text
  metadata        Json?    @default("{}")
  is_internal     Boolean  @default(false) // hidden from tenant-facing views
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  tenants         tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  crm_support_tickets crm_support_tickets? @relation(fields: [ticket_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, created_at])
  @@index([tenant_id, activity_type])
  @@index([ticket_id])
  @@index([task_id])
  @@index([actor_id])
}
```

### 2.4 `crm_inquiries`
Lightweight general inquiries / feature requests from tenants, distinct from structured support tickets.

```prisma
model crm_inquiries {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  contact_id      String?  @db.Uuid
  subject         String   @db.VarChar(255)
  body            String?
  status          String   @default("open") @db.VarChar(20)   // open, in_progress, resolved, closed
  priority        String   @default("medium") @db.VarChar(20) // low, medium, high
  assigned_to     String?  @db.VarChar(255)
  source          String?  @db.VarChar(50)   // web_form, email, chat, phone
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  tenants         tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  crm_contacts    crm_contacts? @relation(fields: [contact_id], references: [id], onDelete: SetNull)

  @@index([tenant_id, status])
  @@index([assigned_to, status])
  @@index([created_at])
}
```

### 2.5 `crm_tasks`
Action items assignable to platform users, scoped to a tenant.

```prisma
model crm_tasks {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenant_id       String   @db.VarChar(255)
  title           String   @db.VarChar(255)
  description     String?
  status          String   @default("pending") @db.VarChar(20) // pending, in_progress, completed, cancelled
  priority        String   @default("medium") @db.VarChar(20) // low, medium, high
  due_date        DateTime? @db.Timestamptz(6)
  assigned_to     String?  @db.VarChar(255)  // platform user id
  created_by      String   @db.VarChar(255)
  completed_at    DateTime? @db.Timestamptz(6)
  created_at      DateTime @default(now()) @db.Timestamptz(6)
  updated_at      DateTime @default(now()) @db.Timestamptz(6)

  tenants         tenants   @relation(fields: [tenant_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, status])
  @@index([assigned_to, status])
  @@index([due_date])
  @@index([created_at])
}
```

### 2.6 `crm_tenant_views` (Optional: Materialized or computed)
Not a new table. Use a Prisma view or runtime query that aggregates:
- `orders` → order count, lifetime value, last order date
- `crm_support_tickets` → open ticket count
- `crm_tasks` → pending task count
- `tenants` → subscription tier, status, service level

For v1, compute these in the API service layer via Prisma `$queryRaw` or parallel `count`/`aggregate` calls.

### 2.7 Reused Existing Tables
- `tenants` — master record (name, subscription_tier, subscription_status, service_level, location_status, created_at, etc.)
- `orders` — read-only transaction history (order_number, total_cents, order_status, payment_status, created_at)
- `users` — platform user lookup for assignments (first_name, last_name, email, role)

---

## 3. Auth & Role Model

Add CRM-specific permissions to the existing `PERMISSION_GROUPS` in both:
- `apps/api/src/config/role-groups.ts`
- `apps/web/src/config/rbac.ts` (frontend static mirror)

### New Permissions

```ts
export const PERMISSION_GROUPS = {
  // ... existing permissions ...

  CAN_VIEW_CRM: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.PLATFORM_VIEWER,
    USER_ROLES.ADMIN,
  ],

  CAN_MANAGE_CRM_SALES: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
    // optionally: USER_ROLES.PLATFORM_SALES (if added)
  ],

  CAN_MANAGE_CRM_SUPPORT: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],

  CAN_MANAGE_CRM_OPS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
  ],
} as const;
```

### Role-to-Function Mapping

| Function | Mapped Permission | Typical Role |
|---|---|---|
| Sales (view pipeline, outreach) | `CAN_MANAGE_CRM_SALES` | `PLATFORM_ADMIN` |
| Support (tickets, contacts) | `CAN_MANAGE_CRM_SUPPORT` | `PLATFORM_SUPPORT` |
| Ops (tasks, tenant health) | `CAN_MANAGE_CRM_OPS` | `PLATFORM_ADMIN` / `PLATFORM_SUPPORT` |
| Read-only CRM access | `CAN_VIEW_CRM` | `PLATFORM_VIEWER` |

All CRM routes use `requirePlatformUser` as a baseline; individual endpoints check `hasPermission(req.user.role, 'CAN_MANAGE_CRM_SUPPORT')` etc.

---

## 4. Backend API Design

### 4.1 File Layout

```
apps/api/src/
  routes/
    crm.ts                     ← main route aggregator
    crm-tenants.ts             ← list + detail + stats
    crm-contacts.ts            ← CRUD
    crm-tickets.ts             ← CRUD + assignment + status transitions
    crm-inquiries.ts           ← CRUD + assignment
    crm-requests.ts            ← unified read-only hub (union of tickets + tasks + inquiries)
    crm-activities.ts          ← create + list (append-only)
    crm-tasks.ts               ← CRUD + assignment
  services/
    CrmTenantService.ts        ← aggregates tenant + order + ticket + task stats
    CrmContactService.ts
    CrmTicketService.ts
    CrmInquiryService.ts
    CrmRequestHubService.ts    ← unions tickets + tasks + inquiries for the Requests Hub
    CrmActivityService.ts
    CrmTaskService.ts
```

### 4.2 Key Endpoints

**Tenants (read-only for CRM context)**
- `GET /api/crm/tenants?q=&tier=&status=&assignedTo=&page=&limit` — searchable list with computed stats
- `GET /api/crm/tenants/:tenantId` — full tenant profile + computed aggregates
- `GET /api/crm/tenants/:tenantId/transactions` — paginated orders (read-only), joins `orders`

**Contacts**
- `GET /api/crm/tenants/:tenantId/contacts`
- `POST /api/crm/tenants/:tenantId/contacts`
- `PUT /api/crm/contacts/:contactId`
- `DELETE /api/crm/contacts/:contactId`

**Support Tickets**
- `GET /api/crm/tenants/:tenantId/tickets?status=&priority=`
- `POST /api/crm/tenants/:tenantId/tickets`
- `PUT /api/crm/tickets/:ticketId` (status, assignment, priority)
- `GET /api/crm/tickets?assignedTo=&status=&priority=` — global queue view

**Inquiries**
- `GET /api/crm/tenants/:tenantId/inquiries?status=&priority=`
- `POST /api/crm/tenants/:tenantId/inquiries`
- `PUT /api/crm/inquiries/:inquiryId` (status, assignment, priority)
- `GET /api/crm/inquiries?assignedTo=&status=&priority=` — global inquiries view

**Requests Hub (Unified)**
- `GET /api/crm/requests?type=&status=&priority=&assignedTo=&tenantId=&unread=&page=&limit` — union of tickets + tasks + inquiries
- `PATCH /api/crm/requests/:requestId` — polymorphic update (type inferred from ID prefix or body)
- `POST /api/crm/requests/:requestId/read` — mark individual request as read
- `POST /api/crm/requests/read-all` — bulk mark-read for current user's open items

**Activities/Notes**
- `GET /api/crm/tenants/:tenantId/activities?type=&limit=`
- `POST /api/crm/tenants/:tenantId/activities`
- `POST /api/crm/tickets/:ticketId/activities` — ticket-scoped note

**Tasks**
- `GET /api/crm/tasks?assignedTo=&status=&tenantId=`
- `POST /api/crm/tasks`
- `PUT /api/crm/tasks/:taskId`
- `DELETE /api/crm/tasks/:taskId`

### 4.3 Route Registration

In `apps/api/src/routes/index.ts` (around line ~7650 per existing pattern):

```ts
import crmRoutes from './crm';
// ...
app.use('/api/crm', authenticateToken, requirePlatformUser, crmRoutes);
```

### 4.4 Middleware & Validation

- All CRM routes: `authenticateToken` + `requirePlatformUser`
- Mutations (POST/PUT/DELETE) check `CAN_MANAGE_CRM_SUPPORT` / `CAN_MANAGE_CRM_SALES` / `CAN_MANAGE_CRM_OPS`
- Zod schemas per route for body validation (consistent with existing routes)
- Audit trail: call `audit()` on every mutation, `entity_type: 'crm_contact' | 'crm_ticket' | 'crm_task' | 'crm_activity'`

### 4.5 Service Patterns

`CrmTenantService` uses Prisma `$queryRaw` or parallel aggregates for the list view:

```ts
async function getTenantCrmStats(tenantId: string) {
  const [ordersAgg, openTickets, pendingTasks, lastActivity] = await Promise.all([
    prisma.orders.aggregate({ where: { tenant_id: tenantId }, _count: true, _sum: { total_cents: true } }),
    prisma.crm_support_tickets.count({ where: { tenant_id: tenantId, status: { in: ['open','in_progress','waiting'] } } }),
    prisma.crm_tasks.count({ where: { tenant_id: tenantId, status: { in: ['pending','in_progress'] } } }),
    prisma.crm_activities.findFirst({ where: { tenant_id: tenantId }, orderBy: { created_at: 'desc' }, select: { created_at: true, activity_type: true } }),
  ]);
  return { ... };
}
```

---

## 5. Frontend Architecture

### 5.1 Route Structure

Under `apps/web/src/app/settings/admin/crm/`:

```
crm/
  page.tsx                     ← CRM dashboard (global queue + quick stats)
  layout.tsx                   ← CRM layout with sub-nav tabs
  tenants/
    page.tsx                   ← Tenant list (searchable, sortable table)
    [tenantId]/
      page.tsx                 ← Tenant detail shell
      layout.tsx               ← Tab layout: Overview | Activity | Tickets | Transactions | Tasks | Contacts
      overview/
        page.tsx
      activity/
        page.tsx
      tickets/
        page.tsx
      transactions/
        page.tsx
      tasks/
        page.tsx
      contacts/
        page.tsx
  requests/
    page.tsx                   ← Requests Hub (unified inbox)
  tickets/
    page.tsx                   ← Global ticket queue (all tenants)
  tasks/
    page.tsx                   ← Global task board
```

### 5.2 Frontend Service Pattern (Singleton + Caching, No Direct Fetch)

All CRM frontend services **extend an appropriate base singleton** and **never call `fetch()` directly**. Requests go through the inherited method on the base class, which handles auth headers, caching, and error normalization.

#### Base Class Selection

| Service Scope | Extends | Default Request Method | Cache TTL |
|---|---|---|---|
| CRM Admin (all ops) | `AdminApiSingleton` | `this.makeAdminRequest<T>()` or `this.makeDefaultRequest<T>()` | 5 min |

#### `CrmService.ts` — Full Pattern

```ts
import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

class CrmService extends AdminApiSingleton {
  private static instance: CrmService;

  private constructor() {
    super('crm-service', { ttl: 5 * 60 * 1000 }); // 5 minutes
  }

  getServiceCachePatterns(): string[] {
    return [
      'crm-tenants-list',
      'crm-tenant-detail',
      'crm-tenant-transactions',
      'crm-contacts',
      'crm-tickets',
      'crm-inquiries',
      'crm-requests-hub',
      'crm-activities',
      'crm-tasks',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): CrmService {
    if (!CrmService.instance) {
      CrmService.instance = new CrmService();
    }
    return CrmService.instance;
  }

  // --- Tenants (read) ---
  async listTenants(params: CrmTenantListParams): Promise<CrmTenantListResult> {
    const cacheKey = `crm-tenants-list-${this.hashParams(params)}`;
    const result = await this.makeDefaultRequest<CrmTenantListResult>(
      '/api/admin/crm/tenants',
      { method: 'GET', params },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async getTenantDetail(tenantId: string): Promise<CrmTenantDetail> {
    const cacheKey = `crm-tenant-detail-${tenantId}`;
    const result = await this.makeDefaultRequest<CrmTenantDetail>(
      `/api/admin/crm/tenants/${tenantId}`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async getTenantTransactions(tenantId: string, page: number): Promise<Order[]> {
    const cacheKey = `crm-tenant-transactions-${tenantId}-${page}`;
    const result = await this.makeDefaultRequest<Order[]>(
      `/api/admin/crm/tenants/${tenantId}/transactions`,
      { method: 'GET', params: { page } },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // --- Contacts (read + write) ---
  async listContacts(tenantId: string): Promise<CrmContact[]> {
    const cacheKey = `crm-contacts-${tenantId}`;
    const result = await this.makeDefaultRequest<CrmContact[]>(
      `/api/admin/crm/tenants/${tenantId}/contacts`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async createContact(tenantId: string, data: CreateContactInput): Promise<CrmContact> {
    const result = await this.makeDefaultRequest<CrmContact>(
      `/api/admin/crm/tenants/${tenantId}/contacts`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // --- Requests Hub (unified read + polymorphic write) ---
  async listRequests(params: RequestListParams): Promise<CrmRequestItem[]> {
    const cacheKey = `crm-requests-hub-${this.hashParams(params)}`;
    const result = await this.makeDefaultRequest<CrmRequestItem[]>(
      '/api/admin/crm/requests',
      { method: 'GET', params },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async updateRequest(requestId: string, type: RequestType, data: UpdateRequestInput): Promise<CrmRequestItem> {
    const result = await this.makeDefaultRequest<CrmRequestItem>(
      `/api/admin/crm/requests/${requestId}`,
      { method: 'PATCH', body: JSON.stringify({ type, ...data }) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  async markRequestRead(requestId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/admin/crm/requests/${requestId}/read`,
      { method: 'POST' }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
  }

  // --- Tickets (read + write) ---
  async listTickets(params: TicketListParams): Promise<CrmTicket[]> {
    const cacheKey = `crm-tickets-${this.hashParams(params)}`;
    const result = await this.makeDefaultRequest<CrmTicket[]>(
      '/api/admin/crm/tickets',
      { method: 'GET', params },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async updateTicket(ticketId: string, data: UpdateTicketInput): Promise<CrmTicket> {
    const result = await this.makeDefaultRequest<CrmTicket>(
      `/api/admin/crm/tickets/${ticketId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // --- Activities (append-only write) ---
  async listActivities(tenantId: string, ticketId?: string): Promise<CrmActivity[]> {
    const cacheKey = `crm-activities-${tenantId}-${ticketId ?? 'all'}`;
    const result = await this.makeDefaultRequest<CrmActivity[]>(
      `/api/admin/crm/tenants/${tenantId}/activities`,
      { method: 'GET', params: { ticketId } },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async createActivity(tenantId: string, data: CreateActivityInput): Promise<CrmActivity> {
    const result = await this.makeDefaultRequest<CrmActivity>(
      `/api/admin/crm/tenants/${tenantId}/activities`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // --- Tasks (read + write) ---
  async listTasks(params: TaskListParams): Promise<CrmTask[]> {
    const cacheKey = `crm-tasks-${this.hashParams(params)}`;
    const result = await this.makeDefaultRequest<CrmTask[]>(
      '/api/admin/crm/tasks',
      { method: 'GET', params },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async createTask(data: CreateTaskInput): Promise<CrmTask> {
    const result = await this.makeDefaultRequest<CrmTask>(
      '/api/admin/crm/tasks',
      { method: 'POST', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  async updateTask(taskId: string, data: UpdateTaskInput): Promise<CrmTask> {
    const result = await this.makeDefaultRequest<CrmTask>(
      `/api/admin/crm/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // --- helpers ---
  private hashParams(obj: unknown): string {
    return JSON.stringify(obj);
  }
}

export const crmService = CrmService.getInstance();
```

#### Rules

1. **No direct `fetch`**: All HTTP calls go through `this.makeDefaultRequest<T>()` (or `makeAdminRequest`, `makeAuthenticatedRequest`, `makePublicRequest`, `makeTenantRequest`). The base class injects auth headers, handles retries, normalizes errors, and manages cache.
2. **Cache keys are explicit**: Every `GET` call passes a deterministic `cacheKey` string. Mutations (`POST`/`PATCH`/`PUT`/`DELETE`) do **not** pass cache keys (they skip cache) and **must** call `await this.invalidateServiceCaches()` on success.
3. **Singleton access**: Export a `const crmService = CrmService.getInstance()` at module level. Components import the instance, not the class.
4. **Error normalization**: Always check `result.success`; throw with `getErrorMessage(result.error)` so UI boundaries can catch and render consistently.
5. **Type-safe responses**: Every request method is generic `makeDefaultRequest<T>(...)`. The response `data` field is typed as `T | undefined`.

### 5.3 UI Components

Reuse existing shadcn/ui components (PascalCase imports per project convention):

| Component | Source |
|---|---|
| `Table`, `DataTable` | `@/components/ui/Table` + `@tanstack/react-table` |
| `Tabs` | `@/components/ui/Tabs` |
| `Card`, `CardHeader`, `CardContent` | `@/components/ui/Card` |
| `Badge` | `@/components/ui/Badge` |
| `Button` | `@/components/ui/Button` |
| `Input`, `Textarea` | `@/components/ui/Input`, `@/components/ui/Textarea` |
| `Select` | `@/components/ui/Select` |
| `Dialog` | `@/components/ui/Dialog` |
| `Avatar` | `@/components/ui/Avatar` |
| `Skeleton` | `@/components/ui/Skeleton` |

New CRM-specific components:

```
apps/web/src/components/crm/
  TenantListTable.tsx          ← searchable, tier/status badges, last activity
  TenantDetailShell.tsx        ← header + subscription chips + quick actions
  TenantActivityFeed.tsx         ← chronological feed of activities + inline note composer
  TicketList.tsx               ← kanban-style columns or table with status badges
  TicketDetailDrawer.tsx       ← side drawer for ticket view + activity thread
  ContactCard.tsx              ← compact contact row with role badge
  RequestHubTable.tsx          ← unified request inbox table with type icon + quick actions
  RequestHubFilters.tsx        ← chip filters for type + unread + priority
  TaskBoard.tsx                ← simple column board (pending / in-progress / completed)
  TaskRow.tsx                  ← list row with assignee avatar + due date chip
  TransactionTable.tsx         ← read-only orders table with total/ status
  CrmFilters.tsx               ← shared filter bar for tenant/task/ticket lists
```

### 5.4 RBAC Integration

Use existing `useRBAC` hook to gate UI:

```ts
const { hasPermission } = useRBAC();
const canManageSupport = hasPermission('CAN_MANAGE_CRM_SUPPORT');
const canManageSales   = hasPermission('CAN_MANAGE_CRM_SALES');
const canManageOps     = hasPermission('CAN_MANAGE_CRM_OPS');
```

- **Sales view**: Tenant list emphasized with subscription tier, MRR indicators, upgrade pipeline tags. Hide ticket deep-dive if not `CAN_MANAGE_CRM_SUPPORT`.
- **Support view**: Requests Hub as default landing. Show unified inbox, contact cards, quick assign, priority toggles.
- **Ops view**: Requests Hub + task board + tenant health alerts (failed syncs, overdue orders, subscription issues).

### 5.5 Navigation Integration

Add CRM entry to `AdminNavContent.tsx` in the `buildAdminNavItems` array:

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

---

## 6. Key Integration Points

### 6.1 React ↔ Backend

| Frontend | Backend | Integration |
|---|---|---|
| `CrmService` singleton | Express `/api/crm/*` | `AdminApiSingleton.makeDefaultRequest()` with JWT + `x-auth0-id` headers |
| `TenantListTable` | `GET /api/crm/tenants` | Server component fetches initial list; client-side pagination via query params |
| `TenantActivityFeed` | `GET /api/crm/tenants/:id/activities` | Real-time feel via SWR / `useSWR` with 30s revalidation |
| `TicketList` | `GET /api/crm/tickets` | Global queue filtered by `assignedTo` (default to current user for support) |
| `TransactionTable` | `GET /api/crm/tenants/:id/transactions` | Read-only `orders` join; no mutation endpoints |

### 6.2 Database ↔ Backend

| Layer | Pattern |
|---|---|
| Prisma ORM | Direct `prisma.crm_support_tickets.create/ update/ findMany` with typed queries |
| Raw aggregates | `$queryRaw` for tenant list stats (order counts, LTV) to avoid N+1 |
| Audit | `audit({ entity_type, action, tenant_id, actor_id, diff })` on every mutation |
| Transactions | Prisma `$transaction` for multi-table updates (e.g. ticket status change + activity creation) |

### 6.3 Auth Flow

1. User hits `/settings/admin/crm/*` → Next.js middleware checks Auth0 session
2. API calls include `x-auth0-id` / `x-auth0-email` headers
3. Express `authenticateToken` resolves user, adds `req.user`
4. CRM route middleware checks `requirePlatformUser` + permission gates
5. Frontend `useRBAC` derives permissions from `AuthContext.user.role` for UI gates

---

## 7. Implementation Order (Phases)

### Phase 1 — Schema & Migration (1 dev day)
1. Write SQL migration: `migrations/crm_core_tables.sql`
2. Add Prisma models to `schema.prisma`
3. Run `prisma db pull` + `prisma generate`
4. Add new permissions to `role-groups.ts` and frontend `rbac.ts`

### Phase 2 — Backend API (2 dev days)
1. Implement `CrmTenantService`, `CrmTicketService`, `CrmActivityService`, `CrmTaskService`, `CrmContactService`
2. Wire up route files (`crm-*.ts`) with Zod validation
3. Register routes in `routes/index.ts`
4. Add audit calls to all mutations

### Phase 3 — Frontend Shell (1 dev day)
1. Create `CrmService` singleton extending `AdminApiSingleton`
2. Scaffold Next.js pages under `/settings/admin/crm/*`
3. Add CRM nav entry to `AdminNavContent.tsx`
4. Build `TenantListTable` + `TenantDetailShell` with `Tabs`

### Phase 4 — Feature Tabs (2 dev days)
1. **Activity**: `TenantActivityFeed` with inline composer
2. **Tickets**: `TicketList` + assignment/status flows
3. **Transactions**: Read-only `TransactionTable` (reuse order data)
4. **Tasks**: `TaskBoard` + create/edit modals
5. **Contacts**: `ContactCard` CRUD inline

### Phase 5 — Role Views & Polish (1 dev day)
1. Conditionally render tabs/actions based on `CAN_MANAGE_CRM_*`
2. Sales: subscription/MRR badges, upgrade pipeline tags
3. Support: default to personal ticket queue
4. Ops: overdue task alerts, tenant health indicators
5. Add loading skeletons, empty states, error boundaries

---

## 8. Notes & Constraints

- **Read-only transactions**: The `orders` table is never mutated by the CRM. Use Prisma `select` only.
- **No customer-facing CRM**: This is internal. No auth0 customer tokens involved.
- **Scalability**: Tenant list stats should be computed via SQL `JOIN`/`GROUP BY` or Prisma `$queryRaw` rather than in-memory loops. If the tenant list grows >1k rows, add cursor-based pagination.
- **Supabase compatibility**: Since the database is PostgreSQL (Supabase-hosted), standard Prisma migrations work. No Supabase JS client or RLS changes are required because access is gated at the Express middleware layer.
- **Cache keys**: Frontend service cache keys follow existing convention: `crm-tenant-list-${hash(params)}`, `crm-tenant-${tenantId}`, `crm-tickets-${hash(params)}`. Mutations invalidate via `invalidateServiceCaches`.

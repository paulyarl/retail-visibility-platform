# CRM — Phased Implementation Plan

This document breaks the full CRM build into 4 deliverable phases. Each phase produces a working, testable increment. No phase is "design only" — every phase ships code.

---

## Phase 1: Foundation — Schema, Auth, Services, Tenant Widget

**Goal**: The database, permissions, base backend services, and merchant-facing CRM engagement widget are live. Platform admins can see tenant CRM stats; merchants can see their own support items.

**Duration**: 1–1.5 weeks

### 1.1 Database Schema (Prisma)

Apply the 5 new tables from `CRM_IMPLEMENTATION_PLAN.md`:

- `crm_contacts`
- `crm_support_tickets`
- `crm_activities`
- `crm_inquiries`
- `crm_tasks`

**Tasks:**
- [ ] Write Prisma migration
- [ ] Run migration against staging DB
- [ ] Verify indexes (FK + status + priority + assigned_to + created_at)
- [ ] Seed test data for 3 tenants (10 contacts, 5 tickets, 3 tasks, 8 activities, 2 inquiries)

### 1.2 Auth & Permissions

Add CRM permission groups to both backend and frontend:

- `CAN_VIEW_CRM`
- `CAN_MANAGE_CRM_SALES`
- `CAN_MANAGE_CRM_SUPPORT`
- `CAN_MANAGE_CRM_OPS`

**Tasks:**
- [ ] Update `apps/api/src/config/role-groups.ts`
- [ ] Update `apps/web/src/config/rbac.ts`
- [ ] Verify `useRBAC` hook resolves new permissions correctly

### 1.3 Backend Services (Base Layer)

Create service classes (no routes yet — services are unit-testable):

| Service | Responsibility |
|---|---|
| `CrmTenantService` | Aggregate tenant stats (orders + tickets + tasks + last activity) |
| `CrmContactService` | CRUD contacts |
| `CrmTicketService` | CRUD tickets + status transitions + assignment |
| `CrmTaskService` | CRUD tasks + status + assignment |
| `CrmActivityService` | Append-only activity log |

**Tasks:**
- [ ] Create `apps/api/src/services/CrmTenantService.ts`
- [ ] Create `apps/api/src/services/CrmContactService.ts`
- [ ] Create `apps/api/src/services/CrmTicketService.ts`
- [ ] Create `apps/api/src/services/CrmTaskService.ts`
- [ ] Create `apps/api/src/services/CrmActivityService.ts`
- [ ] Write unit tests for each service (Jest, in-memory Prisma)

### 1.4 Frontend Service Singleton

Create `CrmService.ts` extending `AdminApiSingleton`:

**Tasks:**
- [ ] Create `apps/web/src/services/CrmService.ts`
- [ ] Implement cache patterns for all entity types
- [ ] Implement `invalidateServiceCaches()` for mutations

### 1.5 Merchant-Facing CRM Engagement Widget

**Scope**: Tenant-scoped dashboard panel (`/t/[tenantId]/`).

**API Routes (public, tenant-scoped):**
- `GET /api/public/crm/self/tickets?status=&limit=`
- `GET /api/public/crm/self/tasks?status=&limit=`
- `GET /api/public/crm/self/activities?limit=&is_internal=false`
- `POST /api/public/crm/self/tickets`
- `GET /api/public/crm/self/tickets/:ticketId`

**Frontend:**
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

---

## Phase 2: Core CRM Entities — Tenant List, Detail, Contacts, Tickets, Tasks, Activities

**Goal**: Platform admins have full CRUD for tenants, contacts, tickets, tasks, and the activity feed. Tenant detail page with all tabs is functional.

**Duration**: 2–2.5 weeks

### 2.1 Backend API Routes

Register all CRUD routes under `/api/admin/crm`:

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/crm/tenants` | GET | Searchable tenant list with computed stats |
| `/api/admin/crm/tenants/:tenantId` | GET | Tenant detail + aggregates |
| `/api/admin/crm/tenants/:tenantId/transactions` | GET | Paginated orders (read-only) |
| `/api/admin/crm/tenants/:tenantId/contacts` | GET / POST | List / create contacts |
| `/api/admin/crm/contacts/:contactId` | PUT / DELETE | Update / delete contact |
| `/api/admin/crm/tenants/:tenantId/tickets` | GET / POST | List / create tickets |
| `/api/admin/crm/tickets/:ticketId` | PUT | Update ticket (status, assign, priority) |
| `/api/admin/crm/tickets` | GET | Global ticket queue |
| `/api/admin/crm/tenants/:tenantId/tasks` | GET / POST | List / create tasks |
| `/api/admin/crm/tasks/:taskId` | PUT / DELETE | Update / delete task |
| `/api/admin/crm/tasks` | GET | Global task list |
| `/api/admin/crm/tenants/:tenantId/activities` | GET / POST | List / create activity |

**Tasks:**
- [ ] Create route files (`crm-tenants.ts`, `crm-contacts.ts`, `crm-tickets.ts`, `crm-tasks.ts`, `crm-activities.ts`)
- [ ] Wire into `apps/api/src/routes/index.ts`
- [ ] Zod validation schemas per route
- [ ] Audit logging on every mutation
- [ ] Middleware: `authenticateToken` + `requirePlatformUser` + permission checks

### 2.2 Tenant List Page

**Route**: `/settings/admin/crm/tenants`

**Tasks:**
- [ ] Searchable, sortable table (name, tier, status, LTV, open tickets, last activity)
- [ ] Filter bar: search + tier + status + assignedTo
- [ ] Pagination
- [ ] Row click → Tenant Detail
- [ ] "+ New Contact" CTA (opens modal)
- [ ] Loading skeletons

### 2.3 Tenant Detail Shell

**Route**: `/settings/admin/crm/tenants/[tenantId]`

**Tasks:**
- [ ] Layout with sticky tab bar: Overview | Activity | Tickets | Transactions | Tasks | Contacts
- [ ] Tenant header: name + address + tier badge + status badge + quick-action dropdown
- [ ] Default tab: Overview

### 2.4 Tenant Detail — Overview Tab

**Tasks:**
- [ ] Stats row: LTV, Open Tickets, Pending Tasks, Orders (30d)
- [ ] Primary Contacts inline table (max 4 rows) — click row → Contacts tab
- [ ] Recent Activity feed (5 items) — click "View All" → Activity tab
- [ ] Skeleton loading for stats cards

### 2.5 Tenant Detail — Activity Tab

**Tasks:**
- [ ] Chronological feed with sub-filters (All / Notes / Calls / Emails / System)
- [ ] Inline composer at bottom: textarea + "Internal" checkbox + Post button
- [ ] Edit/Delete on user's own notes
- [ ] Activity type badges (Note, Call, Email, Ticket, Task, System)

### 2.6 Tenant Detail — Contacts Tab

**Tasks:**
- [ ] Full CRUD table (name, role, email, phone, is_primary)
- [ ] "+ Add Contact" modal form
- [ ] Inline edit for simple fields
- [ ] Set primary contact action

### 2.7 Tenant Detail — Tickets Tab

**Tasks:**
- [ ] Table: ID, title, priority, status, age, assigned_to
- [ ] "+ New Ticket" modal (title, description, priority, contact, assigned_to)
- [ ] Inline status change (Open → In Progress → Resolved → Closed)
- [ ] Status transitions auto-log as system activities

### 2.8 Tenant Detail — Tasks Tab

**Tasks:**
- [ ] Table: title, status, priority, due date, assignee
- [ ] "+ New Task" side drawer
- [ ] Inline status change
- [ ] Overdue tasks sorted to top, red date indicator

### 2.9 Tenant Detail — Transactions Tab

**Tasks:**
- [ ] Read-only table: order number, total, status, payment status, date
- [ ] Pagination
- [ ] Click row → external order detail (if exists)

**Acceptance Criteria:**
- Platform admin can view all tenants with computed CRM stats
- Full CRUD for contacts, tickets, tasks per tenant
- Activity feed is append-only (no edits to system events)
- Status transitions log automatically to activity feed
- All tables have loading skeletons and empty states

---

## Phase 3: Requests Hub, Global Views, & Analytics

**Goal**: Platform users have a unified inbox (Requests Hub) and global cross-tenant views. CRM dashboard shows actionable metrics.

**Duration**: 1.5–2 weeks

### 3.1 Requests Hub (Unified Inbox)

**Route**: `/settings/admin/crm/requests`

**Backend:**
- [ ] `CrmRequestHubService.ts` — unions tickets + tasks + inquiries into a single query
- [ ] `GET /api/admin/crm/requests?type=&status=&priority=&assignedTo=&tenantId=&unread=&page=&limit`
- [ ] `PATCH /api/admin/crm/requests/:requestId` — polymorphic update
- [ ] `POST /api/admin/crm/requests/:requestId/read` — mark read
- [ ] `POST /api/admin/crm/requests/read-all` — bulk mark-read

**Frontend:**
- [ ] Filter bar: type + status + priority + assignedTo + tenant
- [ ] Quick filter chips: Unread | Tickets | Tasks | Inquiries
- [ ] Sortable table with type icons
- [ ] Inline actions: Assign popover, Status mini-menu
- [ ] Bulk select → bulk assign / status change / mark-read
- [ ] "+ Request" modal (pick type + tenant + details)
- [ ] Unread indicator: bold row + blue dot
- [ ] Row click → Tenant Detail → relevant tab with item pre-selected
- [ ] Empty state: "All caught up" with celebratory icon

### 3.2 Global Tickets Queue

**Route**: `/settings/admin/crm/tickets`

**Tasks:**
- [ ] All open tickets across tenants
- [ ] Default filter for Support role: `Assigned: Me` + `Status: Open`
- [ ] Row click → Tenant Detail → Tickets Tab

### 3.3 Global Tasks Board

**Route**: `/settings/admin/crm/tasks`

**Tasks:**
- [ ] Kanban columns: Pending | In Progress | Completed
- [ ] Cards: title, tenant name (linked), due date, assignee avatar
- [ ] Click card → side drawer with task details
- [ ] Drag-and-drop (v2 optional; v1 uses status select in drawer)

### 3.4 CRM Dashboard

**Route**: `/settings/admin/crm`

**Tasks:**
- [ ] Stat cards: Open Tickets, Overdue Tasks, Active Tenants, Avg Response Time
- [ ] "My Tickets" table (5 rows, assigned to current user)
- [ ] Recent Activity feed (8 items)
- [ ] Quick links to Requests Hub, Tenants List, Global Tickets, Global Tasks

**Acceptance Criteria:**
- Support user lands on Requests Hub and sees their assigned open items
- Requests Hub correctly unions tickets + tasks + inquiries
- Bulk actions work across all three types
- Global Tickets queue filters work for cross-tenant views
- CRM Dashboard shows real computed stats

---

## Phase 4: Integrations, Polish, & Merchant Support Page

**Goal**: CRM is connected to the chatbot/FAQ system. Merchant has a dedicated support page. Analytics and reporting are functional.

**Duration**: 1.5–2 weeks

### 4.1 Chatbot Integration

**Tasks:**
- [ ] Chatbot widget queries create `crm_inquiries` entries
- [ ] Bot gap report feeds into CRM as "suggested FAQ" tasks
- [ ] Ticket creation from bot: when a merchant says "I need help with...", bot can offer to create a ticket

### 4.2 FAQ Integration

**Tasks:**
- [ ] FAQ coverage gaps appear as CRM tasks for Support team
- [ ] "Write FAQ for top unanswered question" auto-creates a task

### 4.3 Merchant-Facing Support Page

**Route**: `/t/[tenantId]/support`

**Tasks:**
- [ ] Full-page version of the CRM engagement widget
- [ ] Ticket history with search and filters
- [ ] Task history (read-only for merchant)
- [ ] Activity thread for each ticket
- [ ] New ticket creation form

### 4.4 Analytics & Reporting

**Tasks:**
- [ ] Ticket resolution time by assignee
- [ ] Ticket volume by category
- [ ] Tenant health score (composite: response time + ticket volume + task completion)
- [ ] Export to CSV for all tables

### 4.5 Notifications

**Tasks:**
- [ ] WebSocket or polling for real-time ticket/task updates
- [ ] Email notifications for ticket assignment, status change, overdue tasks
- [ ] In-app notification bell for platform users

### 4.6 Final Polish

**Tasks:**
- [ ] Keyboard shortcuts (`/` search, `n` new note, `t` new ticket)
- [ ] Bulk actions v2 (shift-click multi-select)
- [ ] Mobile responsiveness for merchant-facing widget
- [ ] Performance audit: N+1 queries, cache hit rates
- [ ] E2E tests for critical flows (create ticket → assign → resolve → verify activity)

**Acceptance Criteria:**
- Merchant can access full support history at `/t/[tenantId]/support`
- Chatbot interactions surface in CRM as inquiries or tasks
- Support team gets notified of new tickets and overdue tasks
- All major tables can export to CSV
- E2E tests pass in CI

---

## Cross-Phase Dependencies

| Dependency | Source Phase | Consumer Phase |
|---|---|---|
| Prisma schema (all tables) | Phase 1 | All subsequent phases |
| `CrmTenantService` aggregates | Phase 1 | Phase 2 (tenant list), Phase 3 (dashboard) |
| `CrmTicketService` | Phase 1 | Phase 2 (tenant detail), Phase 3 (Requests Hub), Phase 4 (chatbot) |
| `CrmRequestHubService` | Phase 3 | Phase 4 (notifications, analytics) |
| Auth/permissions | Phase 1 | All phases |
| `CrmService.ts` (frontend singleton) | Phase 1 | All frontend phases |

---

## Testing Strategy

| Phase | Test Coverage |
|---|---|
| Phase 1 | Unit tests for all 5 services; widget renders on merchant dashboard |
| Phase 2 | API integration tests for all CRUD routes; E2E for tenant detail tabs |
| Phase 3 | E2E for Requests Hub filters, bulk actions, and navigation |
| Phase 4 | E2E for chatbot → CRM ticket flow; notification delivery tests |

---

## Rollback Plan

Each phase is additive. If a phase needs rollback:

- **Phase 4**: Remove chatbot hooks, disable merchant support page route. CRM core remains.
- **Phase 3**: Hide Requests Hub and global views from sidebar. Tenant detail tabs remain.
- **Phase 2**: Hide CRM section from admin sidebar. Phase 1 merchant widget remains.
- **Phase 1**: Revert Prisma migration. Merchant widget disappears.

---

## Files Created / Modified Summary

### New Files (by Phase)

**Phase 1:**
- `apps/api/prisma/migrations/..._crm_tables/migration.sql`
- `apps/api/src/services/CrmTenantService.ts`
- `apps/api/src/services/CrmContactService.ts`
- `apps/api/src/services/CrmTicketService.ts`
- `apps/api/src/services/CrmTaskService.ts`
- `apps/api/src/services/CrmActivityService.ts`
- `apps/web/src/services/CrmService.ts`
- `apps/web/src/components/crm/CrmTenantWidget.tsx`
- `apps/api/src/routes/crm-public.ts` (public tenant-scoped routes)

**Phase 2:**
- `apps/api/src/routes/crm.ts` (aggregator)
- `apps/api/src/routes/crm-tenants.ts`
- `apps/api/src/routes/crm-contacts.ts`
- `apps/api/src/routes/crm-tickets.ts`
- `apps/api/src/routes/crm-tasks.ts`
- `apps/api/src/routes/crm-activities.ts`
- `apps/web/src/app/settings/admin/crm/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/layout.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/overview/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/activity/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/tickets/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/transactions/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/tasks/page.tsx`
- `apps/web/src/app/settings/admin/crm/tenants/[tenantId]/contacts/page.tsx`

**Phase 3:**
- `apps/api/src/services/CrmRequestHubService.ts`
- `apps/api/src/routes/crm-requests.ts`
- `apps/web/src/app/settings/admin/crm/requests/page.tsx`
- `apps/web/src/app/settings/admin/crm/tickets/page.tsx`
- `apps/web/src/app/settings/admin/crm/tasks/page.tsx`

**Phase 4:**
- `apps/web/src/app/t/[tenantId]/support/page.tsx`
- `apps/api/src/services/CrmNotificationService.ts`
- `apps/api/src/routes/crm-analytics.ts`

### Modified Files (all phases)

- `apps/api/src/config/role-groups.ts` — add CRM permissions
- `apps/web/src/config/rbac.ts` — add CRM permissions
- `apps/api/src/routes/index.ts` — register CRM routes
- `apps/web/src/components/layout/AdminNavContent.tsx` — add CRM nav section
- `apps/web/src/app/t/[tenantId]/page.tsx` — embed CRM tenant widget

---

## Success Criteria (End of Phase 4)

- [ ] Merchant can see and create support tickets from their own dashboard
- [ ] Platform admin has full CRM: tenants, contacts, tickets, tasks, activities
- [ ] Support user has a unified Requests Hub inbox
- [ ] All status transitions are auditable in the activity feed
- [ ] All major tables have search, filter, sort, and pagination
- [ ] Chatbot interactions feed into CRM
- [ ] E2E tests cover create → assign → resolve → verify flows
